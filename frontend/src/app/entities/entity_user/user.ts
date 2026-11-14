import { Injectable, computed, signal } from '@angular/core';
import { Observable, delay, of, tap, throwError } from 'rxjs';

export interface User {
  id: number;
  username: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  role: 'Customer' | 'Staff' | 'Manager' | 'Admin';
  createdAt?: string;
}

export interface LoginRequest {
  identifier: string; // Tên đăng nhập hoặc Số điện thoại / Email
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  fullName: string;
  phoneNumber: string;
  email?: string;
  username: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export interface ForgotPasswordRequest {
  identifier: string; // Email hoặc SĐT đã đăng ký
}

export interface ResetPasswordRequest {
  identifier: string;
  otpCode: string;
  newPassword: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresIn: number;
}

const STORAGE_KEY = 'fiin_coffee_auth_user';

// Mock danh sách tài khoản sẵn có
const INITIAL_MOCK_USERS: User[] = [
  {
    id: 1,
    username: 'khachquen01',
    fullName: 'Nguyễn Văn An',
    phoneNumber: '0901234567',
    email: 'vanan@gmail.com',
    role: 'Customer',
    createdAt: '2026-10-15T08:00:00Z',
  },
  {
    id: 2,
    username: 'thungan01',
    fullName: 'Lê Thị Thu',
    phoneNumber: '0912345678',
    email: 'thungan01@caphefiin.vn',
    role: 'Staff',
    createdAt: '2026-10-10T08:00:00Z',
  },
];

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly _currentUser = signal<User | null>(this.loadUserFromStorage());
  private readonly _mockUsers = signal<User[]>(INITIAL_MOCK_USERS);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => !!this._currentUser());

  private loadUserFromStorage(): User | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as User;
      }
    } catch {
      // LocalStorage có thể không khả dụng trong môi trường SSR/bảo mật
    }
    return null;
  }

  private saveUserToStorage(user: User | null): void {
    try {
      if (user) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Bỏ qua lỗi lưu trữ cục bộ
    }
  }

  /**
   * Đăng nhập tài khoản khách hàng (Mock Service giả lập gọi Backend API)
   */
  login(request: LoginRequest): Observable<AuthResponse> {
    const ident = request.identifier.trim().toLowerCase();
    
    // Tìm kiếm trong mock users (khớp username, sđt hoặc email)
    const existing = this._mockUsers().find(
      (u) =>
        u.username.toLowerCase() === ident ||
        u.phoneNumber === ident ||
        (u.email && u.email.toLowerCase() === ident)
    );

    // Mật khẩu mặc định kiểm tra đơn giản cho mock: bất kỳ mật khẩu nào >= 6 ký tự
    if (request.password.length < 6) {
      return throwError(() => new Error('Mật khẩu phải chứa ít nhất 6 ký tự.'));
    }

    const matchedUser: User = existing ?? {
      id: Math.floor(Math.random() * 1000) + 10,
      username: ident.includes('@') ? ident.split('@')[0] : ident,
      fullName: 'Khách Quen Sài Gòn',
      phoneNumber: !ident.includes('@') && /^\d+$/.test(ident) ? ident : '0909998888',
      email: ident.includes('@') ? ident : undefined,
      role: 'Customer',
      createdAt: new Date().toISOString(),
    };

    const response: AuthResponse = {
      token: 'fiin_mock_jwt_token_' + Date.now(),
      user: matchedUser,
      expiresIn: 86400,
    };

    return of(response).pipe(
      delay(400),
      tap((res) => {
        this._currentUser.set(res.user);
        if (request.rememberMe !== false) {
          this.saveUserToStorage(res.user);
        }
      })
    );
  }

  /**
   * Đăng ký tài khoản khách quen mới
   */
  register(request: RegisterRequest): Observable<AuthResponse> {
    if (request.password !== request.confirmPassword) {
      return throwError(() => new Error('Mật khẩu xác nhận không trùng khớp.'));
    }

    if (!request.acceptTerms) {
      return throwError(() => new Error('Bạn cần đồng ý với điều khoản sử dụng.'));
    }

    const newUser: User = {
      id: Math.floor(Math.random() * 10000) + 100,
      username: request.username.trim(),
      fullName: request.fullName.trim(),
      phoneNumber: request.phoneNumber.trim(),
      email: request.email?.trim() || undefined,
      role: 'Customer',
      createdAt: new Date().toISOString(),
    };

    // Bổ sung vào danh sách mock
    this._mockUsers.update((users) => [...users, newUser]);

    const response: AuthResponse = {
      token: 'fiin_mock_jwt_token_' + Date.now(),
      user: newUser,
      expiresIn: 86400,
    };

    return of(response).pipe(
      delay(500),
      tap((res) => {
        this._currentUser.set(res.user);
        this.saveUserToStorage(res.user);
      })
    );
  }

  /**
   * Yêu cầu mã OTP khôi phục mật khẩu
   */
  requestOtp(identifier: string): Observable<boolean> {
    if (!identifier || identifier.trim().length < 4) {
      return throwError(() => new Error('Vui lòng nhập Email hoặc Số điện thoại hợp lệ.'));
    }

    return of(true).pipe(delay(400));
  }

  /**
   * Đặt lại mật khẩu mới với OTP
   */
  resetPassword(request: ResetPasswordRequest): Observable<boolean> {
    if (request.otpCode.trim() !== '123456' && request.otpCode.trim().length !== 6) {
      return throwError(() => new Error('Mã xác thực không chính xác (Thử mã: 123456).'));
    }

    if (request.newPassword.length < 6) {
      return throwError(() => new Error('Mật khẩu mới phải có ít nhất 6 ký tự.'));
    }

    return of(true).pipe(delay(500));
  }

  /**
   * Đăng xuất
   */
  logout(): void {
    this._currentUser.set(null);
    this.saveUserToStorage(null);
  }
}
