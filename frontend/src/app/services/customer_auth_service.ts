import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface CustomerAuthUser {
  userId: number;
  customerId: number | null;
  username: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  isEmailVerified: boolean;
  portal: string;
  sessionToken: string;
  roles: string[];
}

export interface CustomerProfile {
  customerId: number;
  userId: number;
  username: string;
  fullName: string;
  phoneNumber?: string | null;
  email?: string | null;
  defaultAddress?: string | null;
  membershipTier: string;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpent: number;
  dateOfBirth?: string | null;
  gender?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthActionResponse {
  sentViaSmtp?: boolean;
  devActionLink?: string | null;
  alreadyVerified?: boolean;
  userId?: number;
  customerId?: number;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  code?: string;
  email?: string;
}

export class CustomerAuthApiError extends Error {
  readonly code?: string;
  readonly email?: string;

  constructor(message: string, code?: string, email?: string) {
    super(message);
    this.code = code;
    this.email = email;
  }
}

const TAB_SESSION_STORAGE_KEY = 'fiin_customer_tab_session_id';

@Injectable({ providedIn: 'root' })
export class CustomerAuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5107/api/v1/auth';
  private readonly customerUrl = 'http://localhost:5107/api/v1/customer';

  readonly user = signal<CustomerAuthUser | null>(null);
  readonly isAuthenticated = computed(() => this.user() !== null);
  private loadPromise: Promise<CustomerAuthUser | null> | null = null;

  private getSessionHeaders(): HttpHeaders {
    const token =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(TAB_SESSION_STORAGE_KEY)
        : null;
    return token ? new HttpHeaders({ 'X-Tab-Session-Id': token }) : new HttpHeaders();
  }

  private saveSessionToken(token: string): void {
    if (typeof sessionStorage !== 'undefined' && token) {
      sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, token);
    }
  }

  private clearSessionToken(): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
    }
  }

  private toApiError(err: unknown, fallback: string): CustomerAuthApiError {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as Partial<ApiResponse<unknown>> | null;
      return new CustomerAuthApiError(
        body?.message || fallback,
        body?.code,
        body?.email,
      );
    }
    return new CustomerAuthApiError(fallback);
  }

  async login(identifier: string, password: string): Promise<CustomerAuthUser> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<CustomerAuthUser>>(
          `${this.baseUrl}/login`,
          { identifier, password, portal: 'customer' },
          { withCredentials: true },
        ),
      );
      this.saveSessionToken(res.data.sessionToken);
      this.user.set(res.data);
      return res.data;
    } catch (err) {
      throw this.toApiError(err, 'Đăng nhập thất bại. Vui lòng thử lại.');
    }
  }

  async register(payload: {
    fullName: string;
    phoneNumber: string;
    email: string;
    password: string;
  }): Promise<{ message: string; data: AuthActionResponse }> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<AuthActionResponse>>(`${this.baseUrl}/register`, payload),
      );
      return { message: res.message, data: res.data ?? {} };
    } catch (err) {
      throw this.toApiError(err, 'Không thể đăng ký tài khoản.');
    }
  }

  async resendVerification(email: string): Promise<{ message: string; data: AuthActionResponse }> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<AuthActionResponse>>(`${this.baseUrl}/resend-verification`, { email }),
      );
      return { message: res.message, data: res.data ?? {} };
    } catch (err) {
      throw this.toApiError(err, 'Không thể gửi lại liên kết xác thực.');
    }
  }

  async verifyEmail(token: string): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/verify-email`, { token }),
      );
      return res.message;
    } catch (err) {
      throw this.toApiError(err, 'Liên kết xác thực không hợp lệ hoặc đã hết hạn.');
    }
  }

  async forgotPassword(email: string): Promise<{ message: string; data: AuthActionResponse }> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<AuthActionResponse>>(`${this.baseUrl}/forgot-password`, { email }),
      );
      return { message: res.message, data: res.data ?? {} };
    } catch (err) {
      throw this.toApiError(err, 'Không thể gửi yêu cầu đặt lại mật khẩu.');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<string> {
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<boolean>>(`${this.baseUrl}/reset-password`, {
          token,
          newPassword,
        }),
      );
      return res.message;
    } catch (err) {
      throw this.toApiError(err, 'Không thể đặt lại mật khẩu.');
    }
  }

  async loadMe(): Promise<CustomerAuthUser | null> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CustomerAuthUser>>(`${this.baseUrl}/me`, {
          withCredentials: true,
          headers: this.getSessionHeaders(),
        }),
      );
      if (res.data?.portal === 'customer') {
        this.user.set(res.data);
        return res.data;
      }
      return null;
    } catch {
      this.user.set(null);
      return null;
    }
  }

  ensureLoaded(): Promise<CustomerAuthUser | null> {
    if (this.user()) {
      return Promise.resolve(this.user());
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadMe().finally(() => {
        this.loadPromise = null;
      });
    }
    return this.loadPromise;
  }

  async getProfile(): Promise<CustomerProfile> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<CustomerProfile>>(`${this.customerUrl}/profile`, {
          withCredentials: true,
          headers: this.getSessionHeaders(),
        }),
      );
      return res.data;
    } catch (err) {
      throw this.toApiError(err, 'Không thể tải thông tin hồ sơ khách hàng.');
    }
  }

  async updateProfile(payload: {
    fullName: string;
    phoneNumber?: string | null;
    email?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
  }): Promise<CustomerProfile> {
    try {
      const res = await firstValueFrom(
        this.http.put<ApiResponse<CustomerProfile>>(`${this.customerUrl}/profile`, payload, {
          withCredentials: true,
          headers: this.getSessionHeaders(),
        }),
      );
      const current = this.user();
      if (current && res.data) {
        this.user.set({
          ...current,
          fullName: res.data.fullName,
          phoneNumber: res.data.phoneNumber,
          email: res.data.email ?? current.email,
        });
      }
      return res.data;
    } catch (err) {
      throw this.toApiError(err, 'Không thể cập nhật hồ sơ khách hàng.');
    }
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${this.baseUrl}/logout`,
          {},
          { withCredentials: true, headers: this.getSessionHeaders() },
        ),
      );
    } finally {
      this.clearSessionToken();
      this.user.set(null);
    }
  }
}
