import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AdminSession, TAB_SESSION_STORAGE_KEY } from './admin_session';

/**
 * Tự động đính kèm HttpOnly Cookie (withCredentials: true) và X-Tab-Session-Id của từng tab.
 * Nếu nhận 401 (tài khoản bị đăng nhập ở cửa sổ khác), tự động đá tab cũ về trang đăng nhập.
 */
export const adminAuthInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AdminSession);
  const isBackendRequest =
    req.url.startsWith('http://localhost:5107/') ||
    req.url.startsWith('https://localhost:') ||
    req.url.startsWith('/api/');

  if (!isBackendRequest) {
    return next(req);
  }

  const tabToken =
    typeof window !== 'undefined' && window.sessionStorage
      ? window.sessionStorage.getItem(TAB_SESSION_STORAGE_KEY)
      : null;

  let cloned = req.withCredentials ? req : req.clone({ withCredentials: true });
  if (tabToken && !cloned.headers.has('X-Tab-Session-Id')) {
    cloned = cloned.clone({
      setHeaders: { 'X-Tab-Session-Id': tabToken },
    });
  }

  const isAuthEndpoint =
    req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/me') ||
    req.url.includes('/api/v1/auth/logout');

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthEndpoint && session.user()) {
        if (err.error?.code === 'SESSION_REPLACED') {
          session.handleSessionReplaced();
        } else {
          session.signOut();
        }
      }
      return throwError(() => err);
    })
  );
};
