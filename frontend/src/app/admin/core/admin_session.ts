import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  ADMIN_MODULES,
  AdminMenuItem,
  AdminModule,
  AdminModuleKey,
  STAFF_PORTAL_MODULE,
} from './admin_modules';
import { AdminAuthService } from './admin_auth_service';

export type AdminPortal = 'admin' | 'staff';

export const TAB_SESSION_STORAGE_KEY = 'fiin_tab_session_token';

export interface AdminUser {
  id: string;
  userId: number;
  username: string;
  name: string;
  email: string;
  phoneNumber?: string;
  role: string;
  position: string;
  employeeId?: number;
  employeeCode?: string;
  branchId?: number;
  branchCode?: string;
  branchName?: string;
  hierarchyLevel: number;
  approvalLevel: number;
  portal: AdminPortal;
  sessionToken: string;
  roles: string[];
  permissions: string[];
  modules: AdminModuleKey[];
  mustChangePassword: boolean;
}

/**
 * Quản lý phiên đăng nhập thật theo từng tab/cửa sổ:
 * - Tab hiện tại giữ token trong sessionStorage -> F5 vẫn duy trì đăng nhập.
 * - Mở tab/cửa sổ mới -> sessionStorage trống -> bắt buộc đăng nhập lại.
 * - Đăng nhập cùng 1 tài khoản ở cửa sổ mới -> ghi đè ActiveSessionToken trong DB -> cửa sổ cũ tự đăng xuất.
 */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly router = inject(Router);
  private readonly authService = inject(AdminAuthService);

  readonly user = signal<AdminUser | null>(null);
  readonly isInitialized = signal(false);

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isValidating = false;
  private listenersBound = false;

  readonly isAdminPortal = computed(() => this.user()?.portal === 'admin');
  readonly isStaffPortal = computed(() => this.user()?.portal === 'staff');
  readonly hierarchyLevel = computed(() => this.user()?.hierarchyLevel ?? 1);
  readonly approvalLevel = computed(() => this.user()?.approvalLevel ?? 0);
  readonly canApprove = computed(() => {
    const u = this.user();
    if (!u) return false;
    return u.approvalLevel > 0 || u.hierarchyLevel >= 5 || u.roles.includes('Admin');
  });

  readonly allowedModules = computed<readonly AdminModule[]>(() => {
    const user = this.user();
    if (!user) return [];

    if (user.portal === 'staff') {
      const staffMenus = STAFF_PORTAL_MODULE.menu.filter((item) => this.canAccessMenuItem(item));
      return [{ ...STAFF_PORTAL_MODULE, menu: staffMenus }];
    }

    return ADMIN_MODULES.filter((m) => user.modules.includes(m.key))
      .map((m) => ({
        ...m,
        menu: m.menu.filter((item) => this.canAccessMenuItem(item)),
      }))
      .filter((m) => m.menu.length > 0);
  });

  hasPermission(code: string): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.hierarchyLevel >= 5 || u.roles.some((r) => r.toLowerCase() === 'admin')) {
      return true;
    }
    return u.permissions.some((p) => p.toLowerCase() === code.toLowerCase());
  }

  canAccessMenuItem(item: AdminMenuItem): boolean {
    const u = this.user();
    if (!u) return false;
    if (u.hierarchyLevel >= 5 || u.roles.some((r) => r.toLowerCase() === 'admin')) {
      return true;
    }
    if (item.minLevel && u.hierarchyLevel < item.minLevel) {
      return false;
    }
    if (item.permission && !this.hasPermission(item.permission)) {
      return false;
    }
    if (item.anyPermissions && item.anyPermissions.length > 0) {
      return item.anyPermissions.some((code) => this.hasPermission(code));
    }
    return true;
  }

  can(key: AdminModuleKey): boolean {
    return this.allowedModules().some((m) => m.key === key);
  }

  /**
   * Khôi phục phiên khi F5 trên chính tab đang đăng nhập.
   * Mở tab/cửa sổ mới sẽ không có token trong sessionStorage nên bắt buộc đăng nhập lại.
   */
  async restoreSession(): Promise<void> {
    if (this.isInitialized()) return;

    const tabToken = this.getTabToken();
    if (!tabToken) {
      this.user.set(null);
      this.isInitialized.set(true);
      return;
    }

    try {
      const current = await firstValueFrom(this.authService.me());
      if (current) {
        this.setTabToken(current.sessionToken || tabToken);
        this.user.set(current);
        this.startSessionMonitor();
      } else {
        this.clearTabToken();
        this.user.set(null);
      }
    } catch {
      this.clearTabToken();
      this.user.set(null);
    } finally {
      this.isInitialized.set(true);
    }
  }

  login(identifier: string, password: string, portal: AdminPortal = 'admin'): Observable<AdminUser> {
    return this.authService.login(identifier, password, portal).pipe(
      tap((user) => {
        this.setTabToken(user.sessionToken);
        this.user.set(user);
        this.isInitialized.set(true);
        this.startSessionMonitor();
        const target = user.portal === 'staff' ? '/staff' : '/admin';
        void this.router.navigateByUrl(target);
      })
    );
  }

  /**
   * Xóa phiên cục bộ trên tab hiện tại (dùng khi bấm Back về trang login hoặc bị đá phiên).
   */
  clearLocalTabSession(): void {
    this.stopSessionMonitor();
    this.clearTabToken();
    this.user.set(null);
  }

  /**
   * Tự động đăng xuất tab cũ khi phát hiện tài khoản đã đăng nhập ở cửa sổ khác.
   */
  handleSessionReplaced(): void {
    const portal = this.user()?.portal === 'staff' ? 'staff' : 'admin';
    this.clearLocalTabSession();
    const loginPath = portal === 'staff' ? '/staff/login' : '/admin/login';
    void this.router.navigate([loginPath], { queryParams: { reason: 'replaced' } });
  }

  signOut(): void {
    const portal = this.user()?.portal === 'staff' ? 'staff' : 'admin';
    this.stopSessionMonitor();
    this.user.set(null);
    this.authService.logout().subscribe({
      complete: () => this.clearTabToken(),
      error: () => this.clearTabToken(),
    });
    const loginPath = portal === 'staff' ? '/staff/login' : '/admin/login';
    void this.router.navigateByUrl(loginPath);
  }

  private startSessionMonitor(): void {
    if (typeof window === 'undefined') return;
    this.stopSessionMonitor();

    if (!this.listenersBound) {
      this.listenersBound = true;
      window.addEventListener('focus', () => this.verifyActiveSession());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.verifyActiveSession();
        }
      });
    }

    this.pollTimer = setInterval(() => {
      this.verifyActiveSession();
    }, 15000);
  }

  private stopSessionMonitor(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private verifyActiveSession(): void {
    if (!this.user() || this.isValidating) return;
    const tabToken = this.getTabToken();
    if (!tabToken) {
      this.handleSessionReplaced();
      return;
    }

    this.isValidating = true;
    this.authService.me().subscribe({
      next: (current) => {
        this.isValidating = false;
        if (!current) {
          this.handleSessionReplaced();
        }
      },
      error: () => {
        this.isValidating = false;
      },
    });
  }

  private getTabToken(): string | null {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
  }

  private setTabToken(token: string): void {
    if (typeof window === 'undefined' || !window.sessionStorage || !token) return;
    window.sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, token);
  }

  private clearTabToken(): void {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    window.sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
  }
}
