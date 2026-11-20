import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AdminModule } from './admin_modules';
import { AdminSession } from './admin_session';

/**
 * Xác định module đang mở (đã lọc sẵn danh sách menu theo quyền của phiên đăng nhập)
 * Hỗ trợ cả Cổng Quản trị (/admin/<module>/...) và Cổng Nhân viên (/staff/...).
 */
@Injectable({ providedIn: 'root' })
export class AdminNav {
  private readonly router = inject(Router);
  private readonly session = inject(AdminSession);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly isStaffRoute = computed(() => {
    const segments = this.url().split(/[?#]/)[0].split('/').filter(Boolean);
    return segments[0] === 'staff';
  });

  readonly activeModule = computed<AdminModule | null>(() => {
    const segments = this.url().split(/[?#]/)[0].split('/').filter(Boolean);
    const allowed = this.session.allowedModules();

    if (segments[0] === 'staff') {
      if (segments[1] === 'khong-co-quyen' || segments[1] === 'login') return null;
      return allowed[0] ?? null;
    }

    if (segments[0] !== 'admin') return null;
    return allowed.find((m) => m.key === segments[1]) ?? null;
  });
}
