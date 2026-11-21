import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AdminModuleKey } from './admin_modules';
import { AdminSession } from './admin_session';

const ADMIN_FORBIDDEN = ['/admin', 'khong-co-quyen'];
const STAFF_FORBIDDEN = ['/staff', 'khong-co-quyen'];

/**
 * Bảo vệ Cổng Quản trị (/admin/...):
 * - Chưa đăng nhập -> /admin/login
 * - Đang đăng nhập bằng tài khoản Nhân viên (portal === 'staff' hoặc hierarchyLevel < 3) -> đẩy về /staff
 */
export const adminAuthGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  const user = session.user();

  if (!user) {
    return router.createUrlTree(['/admin', 'login']);
  }

  if (user.portal !== 'admin' || user.hierarchyLevel < 3) {
    return router.createUrlTree(['/staff']);
  }

  return true;
};

/**
 * Bảo vệ Cổng Nhân viên (/staff/...):
 * - Chưa đăng nhập -> /staff/login
 */
export const staffAuthGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  const user = session.user();

  if (!user) {
    return router.createUrlTree(['/staff', 'login']);
  }

  return true;
};

/**
 * Khi người dùng quay lại trang đăng nhập (/admin/login hoặc /staff/login),
 * hủy phiên cục bộ của tab hiện tại để bắt buộc đăng nhập lại (không tự nhảy vào lại khi bấm Back).
 */
export const adminGuestGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  if (session.user()) {
    session.clearLocalTabSession();
  }
  return true;
};

/** Vào /admin -> chuyển tới module đầu tiên & menu đầu tiên tài khoản được phép */
export const adminHomeGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  const firstMod = session.allowedModules()[0];
  if (!firstMod || firstMod.menu.length === 0) {
    return router.createUrlTree(ADMIN_FORBIDDEN);
  }
  return router.createUrlTree(['/admin', firstMod.key, firstMod.menu[0].path]);
};

/** Vào /staff -> chuyển tới trang Đơn từ (hoặc menu đầu tiên được phép của nhân viên) */
export const staffHomeGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  const firstMod = session.allowedModules()[0];
  if (!firstMod || firstMod.menu.length === 0) {
    return router.createUrlTree(STAFF_FORBIDDEN);
  }
  const preferred = firstMod.menu.find((m) => m.path === 'don-tu') ?? firstMod.menu[0];
  return router.createUrlTree(['/staff', preferred.path]);
};

/**
 * Chặn ở bước canMatch theo Lớp 1 (Module / Cục):
 * Không có quyền vào cục nào thì bundle của cục đó không được tải về luôn.
 */
export const adminModuleGuard: CanMatchFn = (route) => {
  const key = route.data?.['module'] as AdminModuleKey | undefined;
  const session = inject(AdminSession);
  const allowed = !!key && session.can(key);
  return allowed ? true : inject(Router).createUrlTree(ADMIN_FORBIDDEN);
};

/**
 * Chặn theo Lớp 2 (Menu / Permission bên trong cục):
 * Ngăn người dùng gõ tay URL của menu đã bị ẩn trên Sidebar.
 */
export const adminPermissionGuard: CanActivateFn = (route) => {
  const session = inject(AdminSession);
  const router = inject(Router);
  const perm = route.data?.['permission'] as string | undefined;
  const anyPerms = route.data?.['anyPermissions'] as readonly string[] | undefined;
  const minLevel = route.data?.['minLevel'] as number | undefined;

  const allowed = session.canAccessMenuItem({
    label: '',
    path: '',
    icon: 'dashboard',
    permission: perm,
    anyPermissions: anyPerms,
    minLevel,
  });

  if (allowed) return true;
  return router.createUrlTree(session.isStaffPortal() ? STAFF_FORBIDDEN : ADMIN_FORBIDDEN);
};
