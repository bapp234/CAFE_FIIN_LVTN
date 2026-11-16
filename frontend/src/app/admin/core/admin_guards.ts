import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AdminModuleKey } from './admin_modules';
import { AdminSession } from './admin_session';

const FORBIDDEN = ['/admin', 'khong-co-quyen'];

/** Chưa đăng nhập thì chuyển hướng về trang đăng nhập quản trị /admin/login */
export const adminAuthGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  return session.user() ? true : router.createUrlTree(['/admin', 'login']);
};

/** Đã đăng nhập quản trị rồi thì không cho vào lại /admin/login nữa mà chuyển vào /admin */
export const adminGuestGuard: CanActivateFn = () => {
  const session = inject(AdminSession);
  const router = inject(Router);
  return session.user() ? router.createUrlTree(['/admin']) : true;
};

/** Vào /admin thì chuyển tới module đầu tiên được phép, không có module nào thì sang trang báo không có quyền */
export const adminHomeGuard: CanActivateFn = () => {
  const first = inject(AdminSession).allowedModules()[0];
  return inject(Router).createUrlTree(first ? ['/admin', first.key] : FORBIDDEN);
};

/**
 * Chặn ở bước canMatch: không có quyền thì mã của module không được tải về luôn.
 * Module cần khai báo data: { module: 'cms' } trên route.
 */
export const adminModuleGuard: CanMatchFn = (route) => {
  const key = route.data?.['module'] as AdminModuleKey | undefined;
  const allowed = !!key && inject(AdminSession).can(key);
  return allowed ? true : inject(Router).createUrlTree(FORBIDDEN);
};
