import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { AdminModuleKey } from './admin_modules';
import { AdminPortal, AdminUser } from './admin_session';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface AuthUserApiDto {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  mustChangePassword: boolean;
  employeeId?: number | null;
  employeeCode?: string | null;
  position: string;
  branchId?: number | null;
  branchCode?: string | null;
  branchName?: string | null;
  hierarchyLevel: number;
  approvalLevel: number;
  portal: AdminPortal;
  sessionToken: string;
  roleDisplay: string;
  roles: string[];
  permissions: string[];
  modules: AdminModuleKey[];
}

export interface AuthLoginError {
  message: string;
  code?: string;
  redirectUrl?: string;
  expectedPortal?: AdminPortal;
}

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5107/api/v1/auth';

  login(identifier: string, password: string, portal: AdminPortal): Observable<AdminUser> {
    return this.http
      .post<ApiResponse<AuthUserApiDto>>(
        `${this.baseUrl}/login`,
        { identifier: identifier.trim(), password, portal },
        { withCredentials: true }
      )
      .pipe(
        map((res) => this.mapDtoToUser(res.data)),
        catchError((err: HttpErrorResponse) => {
          const body = err.error as Record<string, unknown> | null;
          const loginErr: AuthLoginError = {
            message:
              (typeof body?.['message'] === 'string' && body['message']) ||
              (err.status === 0
                ? 'Không thể kết nối máy chủ Backend API (http://localhost:5107).'
                : 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.'),
            code: typeof body?.['code'] === 'string' ? body['code'] : undefined,
            redirectUrl: typeof body?.['redirectUrl'] === 'string' ? body['redirectUrl'] : undefined,
            expectedPortal:
              body?.['expectedPortal'] === 'staff' || body?.['expectedPortal'] === 'admin'
                ? (body['expectedPortal'] as AdminPortal)
                : undefined,
          };
          return throwError(() => loginErr);
        })
      );
  }

  me(): Observable<AdminUser | null> {
    return this.http
      .get<ApiResponse<AuthUserApiDto>>(`${this.baseUrl}/me`, { withCredentials: true })
      .pipe(
        map((res) => (res?.success && res.data ? this.mapDtoToUser(res.data) : null)),
        catchError((err: HttpErrorResponse) => {
          // Chỉ coi là mất phiên khi server trả 401/403 thật sự; lỗi mạng (0) hoặc 5xx lúc backend đang build/restart thì giữ phiên
          if (err.status === 401 || err.status === 403) {
            return of(null);
          }
          return throwError(() => err);
        })
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<ApiResponse<boolean>>(`${this.baseUrl}/logout`, {}, { withCredentials: true })
      .pipe(
        map(() => void 0),
        catchError(() => of(void 0))
      );
  }

  changePassword(currentPassword: string, newPassword: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(
        `${this.baseUrl}/change-password`,
        { currentPassword, newPassword },
        { withCredentials: true }
      )
      .pipe(
        map((res) => !!res?.success),
        catchError((err: HttpErrorResponse) => {
          const msg = err.error?.message || 'Không thể đổi mật khẩu.';
          return throwError(() => new Error(msg));
        })
      );
  }

  private mapDtoToUser(dto: AuthUserApiDto): AdminUser {
    return {
      id: String(dto.userId),
      userId: dto.userId,
      username: dto.username,
      name: dto.fullName,
      email: dto.email || `${dto.username}@fiin.vn`,
      phoneNumber: dto.phoneNumber ?? undefined,
      role: dto.roleDisplay || dto.position || dto.roles[0] || 'Nhân viên',
      position: dto.position || '',
      employeeId: dto.employeeId ?? undefined,
      employeeCode: dto.employeeCode ?? undefined,
      branchId: dto.branchId ?? undefined,
      branchCode: dto.branchCode ?? undefined,
      branchName: dto.branchName ?? undefined,
      hierarchyLevel: dto.hierarchyLevel || 1,
      approvalLevel: dto.approvalLevel || 0,
      portal: dto.portal || (dto.hierarchyLevel >= 3 ? 'admin' : 'staff'),
      sessionToken: dto.sessionToken || '',
      roles: dto.roles ?? [],
      permissions: dto.permissions ?? [],
      modules: dto.modules ?? [],
      mustChangePassword: !!dto.mustChangePassword,
    };
  }
}
