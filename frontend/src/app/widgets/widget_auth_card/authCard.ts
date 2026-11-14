import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideAlertCircle,
  LucideArrowLeft,
  LucideCheckCircle2,
  LucideCoffee,
  LucideEye,
  LucideEyeOff,
  LucideLock,
  LucideMail,
  LucidePhone,
  LucideShieldCheck,
  LucideUser,
} from '@lucide/angular';
import { UserService } from '../../entities/entity_user/user';

export type AuthMode = 'login' | 'register' | 'forgot-password';

@Component({
  selector: 'app-widget-auth-card',
  imports: [
    ReactiveFormsModule,
    LucideUser,
    LucideLock,
    LucideMail,
    LucidePhone,
    LucideEye,
    LucideEyeOff,
    LucideArrowLeft,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideShieldCheck,
    LucideCoffee,
  ],
  templateUrl: './authCard.html',
  styleUrl: './authCard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetAuthCard implements OnInit {
  private readonly userService = inject(UserService);
  private readonly router = inject(Router);

  // Input ban đầu từ trang (nếu có query param ?mode=)
  readonly initialMode = input<AuthMode>('login');
  readonly returnUrl = input<string>('/');

  // Event thông báo khi đăng nhập thành công
  readonly authenticated = output<void>();

  // State quản lý luồng
  readonly currentMode = signal<AuthMode>('login');
  readonly showPassword = signal<boolean>(false);
  readonly showConfirmPassword = signal<boolean>(false);
  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  // Bước trong Quên mật khẩu: 1 = Nhập Email/SĐT, 2 = Nhập OTP và Mật khẩu mới
  readonly forgotStep = signal<1 | 2>(1);
  readonly maskedTarget = signal<string>('');

  // 1. Form Đăng nhập
  readonly loginForm = new FormGroup({
    identifier: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    rememberMe: new FormControl<boolean>(true, { nonNullable: true }),
  });

  // 2. Form Đăng ký
  readonly registerForm = new FormGroup({
    fullName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    phoneNumber: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^(0|\+84)[3|5|7|8|9][0-9]{8}$/),
      ],
    }),
    email: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    username: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(4),
        Validators.pattern(/^[a-zA-Z0-9_]+$/),
      ],
    }),
    password: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    acceptTerms: new FormControl<boolean>(false, {
      nonNullable: true,
      validators: [Validators.requiredTrue],
    }),
  });

  // 3. Form Quên mật khẩu - Bước 1
  readonly forgotRequestForm = new FormGroup({
    identifier: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4)],
    }),
  });

  // 4. Form Quên mật khẩu - Bước 2
  readonly resetPasswordForm = new FormGroup({
    otpCode: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(6),
        Validators.maxLength(6),
        Validators.pattern(/^[0-9]{6}$/),
      ],
    }),
    newPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
    confirmNewPassword: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    if (this.initialMode()) {
      this.currentMode.set(this.initialMode());
    }
  }

  setMode(mode: AuthMode): void {
    this.currentMode.set(mode);
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showPassword.set(false);
    this.showConfirmPassword.set(false);

    if (mode === 'forgot-password') {
      this.forgotStep.set(1);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((v) => !v);
  }

  onLoginSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage.set('Kính mời quý khách kiểm tra lại các mục thông tin.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { identifier, password, rememberMe } = this.loginForm.getRawValue();

    this.userService
      .login({
        identifier,
        password,
        rememberMe,
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.successMessage.set(`Xin chào quý khách ${res.user.fullName}! Đăng nhập thành công.`);
          setTimeout(() => {
            this.authenticated.emit();
            this.router.navigateByUrl(this.returnUrl());
          }, 600);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'Đăng nhập không thành công, vui lòng thử lại.');
        },
      });
  }

  onRegisterSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.errorMessage.set('Kính mời quý khách hoàn thiện đầy đủ các mục thông tin.');
      return;
    }

    const val = this.registerForm.getRawValue();

    if (val.password !== val.confirmPassword) {
      this.errorMessage.set('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.userService
      .register({
        fullName: val.fullName,
        phoneNumber: val.phoneNumber,
        email: val.email || undefined,
        username: val.username,
        password: val.password,
        confirmPassword: val.confirmPassword,
        acceptTerms: val.acceptTerms,
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.successMessage.set(
            `Kính chúc mừng quý khách ${res.user.fullName} đã mở thẻ khách quen thành công!`
          );
          setTimeout(() => {
            this.authenticated.emit();
            this.router.navigateByUrl(this.returnUrl());
          }, 800);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'Mở tài khoản không thành công, vui lòng thử lại.');
        },
      });
  }

  onForgotRequestSubmit(): void {
    if (this.forgotRequestForm.invalid) {
      this.forgotRequestForm.markAllAsTouched();
      this.errorMessage.set('Vui lòng điền Số điện thoại hoặc Email đã đăng ký.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { identifier } = this.forgotRequestForm.getRawValue();

    this.userService.requestOtp(identifier).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.maskedTarget.set(identifier);
        this.forgotStep.set(2);
        this.successMessage.set(
          `Mã xác thực tạm thời (123456) đã được gửi đến: ${identifier}`
        );
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Không thể gửi mã xác thực, vui lòng kiểm tra lại.');
      },
    });
  }

  onResetPasswordSubmit(): void {
    if (this.resetPasswordForm.invalid) {
      this.resetPasswordForm.markAllAsTouched();
      this.errorMessage.set('Vui lòng kiểm tra mã xác thực và mật khẩu mới.');
      return;
    }

    const { otpCode, newPassword, confirmNewPassword } =
      this.resetPasswordForm.getRawValue();

    if (newPassword !== confirmNewPassword) {
      this.errorMessage.set('Mật khẩu mới xác nhận không trùng khớp.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.userService
      .resetPassword({
        identifier: this.maskedTarget(),
        otpCode,
        newPassword,
      })
      .subscribe({
        next: () => {
          this.isLoading.set(false);
          this.successMessage.set('Đổi mật khẩu thành công! Kính mời quý khách đăng nhập lại.');
          setTimeout(() => {
            this.setMode('login');
          }, 1000);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.message || 'Đặt lại mật khẩu thất bại.');
        },
      });
  }
}
