import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay, tap } from 'rxjs/operators';
import { AdminModuleKey } from './admin_modules';
import { AdminUser } from './admin_session';

export interface AdminDemoAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  modules: AdminModuleKey[];
  badge: string;
  description: string;
}

export const DEMO_ADMIN_ACCOUNTS: readonly AdminDemoAccount[] = [
  {
    id: 'u-super-admin',
    name: 'Nguyễn Văn An',
    email: 'admin@fiin.vn',
    password: 'admin',
    role: 'Quản trị viên toàn hệ thống',
    modules: ['cms', 'crm', 'hrm', 'erp'],
    badge: 'Toàn quyền',
    description: 'Truy cập đầy đủ 4 phân hệ: CMS, CRM, HRM, ERP.',
  },
  {
    id: 'u-hrm-manager',
    name: 'Trần Thị Mai',
    email: 'hr@fiin.vn',
    password: 'admin',
    role: 'Trưởng phòng Nhân sự',
    modules: ['hrm'],
    badge: 'Chỉ HRM',
    description: 'Quản lý nhân viên, lịch làm việc, dữ liệu chấm công và tính lương.',
  },
  {
    id: 'u-business-manager',
    name: 'Lê Hoàng Nam',
    email: 'kinhdoanh@fiin.vn',
    password: 'admin',
    role: 'Quản lý Bán hàng & Marketing',
    modules: ['cms', 'crm'],
    badge: 'CMS + CRM',
    description: 'Quản lý bài viết, banner, danh mục, khách hàng và voucher.',
  },
  {
    id: 'u-erp-manager',
    name: 'Võ Minh Quân',
    email: 'kho@fiin.vn',
    password: 'admin',
    role: 'Quản lý Chuỗi & Kho vận',
    modules: ['erp'],
    badge: 'Chỉ ERP',
    description: 'Quản lý nguyên vật liệu kho chuỗi, nhà cung cấp và nhập mua.',
  },
  {
    id: 'u-guest',
    name: 'Phạm Thu Hà',
    email: 'guest@fiin.vn',
    password: 'admin',
    role: 'Nhân viên tập sự',
    modules: [],
    badge: 'Chưa cấp quyền',
    description: 'Tài khoản thử nghiệm chưa được cấp quyền module nào.',
  },
];

/**
 * Khóa lưu trữ phiên giả lập HttpOnly Cookie trong browser sessionStorage.
 * Trong môi trường có backend thật, cookie được server gắn tự động với cờ HttpOnly,
 * client chỉ cần gọi API với `withCredentials: true`.
 */
const MOCK_COOKIE_SESSION_KEY = 'fiin_admin_mock_httponly_session';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  /**
   * Đọc phiên người dùng hiện tại từ bộ nhớ (mô phỏng gọi GET /api/admin/me với HttpOnly Cookie)
   */
  getInitialUser(): AdminUser | null {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      // Mặc định server-side hoặc môi trường kiểm thử
      return DEMO_ADMIN_ACCOUNTS[0];
    }

    const savedId = window.sessionStorage.getItem(MOCK_COOKIE_SESSION_KEY);
    if (!savedId) {
      // Mặc định nạp tài khoản admin demo nếu chưa đăng xuất
      return DEMO_ADMIN_ACCOUNTS[0];
    }

    if (savedId === 'UNAUTHENTICATED') {
      return null;
    }

    const account = DEMO_ADMIN_ACCOUNTS.find((a) => a.id === savedId);
    return account ? this.toAdminUser(account) : null;
  }

  /**
   * Mô phỏng POST /api/admin/auth/login
   * Backend thật sẽ kiểm tra credentials và gắn HttpOnly Cookie trong Set-Cookie header.
   */
  login(email: string, password: string): Observable<AdminUser> {
    const trimmedEmail = email.trim().toLowerCase();
    const account = DEMO_ADMIN_ACCOUNTS.find(
      (a) => a.email.toLowerCase() === trimmedEmail && a.password === password
    );

    if (!account) {
      return throwError(() => new Error('Email hoặc mật khẩu không chính xác.')).pipe(delay(250));
    }

    const user = this.toAdminUser(account);

    return of(user).pipe(
      delay(300),
      tap(() => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(MOCK_COOKIE_SESSION_KEY, account.id);
        }
      })
    );
  }

  /**
   * Mô phỏng POST /api/admin/auth/logout
   * Backend thật sẽ gửi header Set-Cookie xóa session cookie.
   */
  logout(): Observable<void> {
    return of(void 0).pipe(
      delay(150),
      tap(() => {
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(MOCK_COOKIE_SESSION_KEY, 'UNAUTHENTICATED');
        }
      })
    );
  }

  private toAdminUser(account: AdminDemoAccount): AdminUser {
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      role: account.role,
      modules: [...account.modules],
    };
  }
}
