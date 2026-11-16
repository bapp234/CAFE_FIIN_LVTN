import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ADMIN_MODULES, AdminModule, AdminModuleKey } from './admin_modules';
import { AdminAuthService } from './admin_auth_service';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  /** Tên vai trò hiển thị, ví dụ 'Quản trị viên toàn hệ thống' */
  role: string;
  /** Các module tài khoản này được vào: có thể 1, 2 hoặc cả 4 */
  modules: AdminModuleKey[];
}

/**
 * Quản lý phiên đăng nhập trang admin và phân quyền theo module.
 * Áp dụng mô hình HttpOnly Cookie + Mock Service.
 * Chặn ở giao diện để tối ưu UI/UX; backend kiểm tra quyền ở từng API endpoint.
 */
@Injectable({ providedIn: 'root' })
export class AdminSession {
  private readonly router = inject(Router);
  private readonly authService = inject(AdminAuthService);

  readonly user = signal<AdminUser | null>(this.authService.getInitialUser());

  /** Các module tài khoản được vào, theo thứ tự chuẩn CMS, CRM, HRM, ERP */
  readonly allowedModules = computed<readonly AdminModule[]>(() => {
    const user = this.user();
    return user ? ADMIN_MODULES.filter((m) => user.modules.includes(m.key)) : [];
  });

  can(key: AdminModuleKey): boolean {
    return this.allowedModules().some((m) => m.key === key);
  }

  /**
   * Đăng nhập bằng email và mật khẩu qua AdminAuthService
   */
  login(email: string, pass: string): Observable<AdminUser> {
    return this.authService.login(email, pass).pipe(
      tap((user) => {
        this.user.set(user);
        void this.router.navigateByUrl('/admin');
      })
    );
  }

  /**
   * Đăng xuất phiên quản trị và chuyển hướng về trang /admin/login
   */
  signOut(): void {
    this.user.set(null);
    void this.router.navigateByUrl('/admin/login');
    this.authService.logout().subscribe({
      error: () => {
        // Bỏ qua lỗi mạng khi logout mock
      },
    });
  }
}
