import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonOrderComponent } from '../../components/button_order/button_order';
import { InputFloatingComponent } from '../../components/input_floating/input_floating';
import {
  CustomerAuthApiError,
  CustomerAuthService,
} from '../../services/customer_auth_service';

type AuthMode = 'login' | 'register' | 'forgot' | 'verify-email' | 'reset-password';

/** Kiểm tra mật khẩu nhập lại có khớp không (validator cấp group). */
function matchPasswords(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

/** Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx */
const PHONE_PATTERN = /^(0|\+84)\d{9}$/;

const FIELD_LABELS: Record<string, string> = {
  fullName: 'Họ và tên',
  phone: 'Số điện thoại',
  email: 'Email',
  password: 'Mật khẩu',
  confirmPassword: 'Mật khẩu nhập lại',
};

@Component({
  selector: 'app-auth',
  imports: [ReactiveFormsModule, RouterLink, ButtonOrderComponent, InputFloatingComponent],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageAuth implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(CustomerAuthService);

  readonly bgImage = '/assets/images/hero/slide-02-desktop.webp';

  // ---- Trạng thái giao diện ----
  readonly mode = signal<AuthMode>('login');
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');
  readonly devActionLink = signal<string | null>(null);
  readonly unverifiedEmail = signal<string | null>(null);
  readonly actionToken = signal('');
  readonly showPassword = signal(false);

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Tạo tài khoản';
      case 'forgot':
        return 'Quên mật khẩu?';
      case 'verify-email':
        return 'Xác thực tài khoản';
      case 'reset-password':
        return 'Đặt lại mật khẩu';
      default:
        return 'Chào mừng trở lại';
    }
  });

  readonly subtitle = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Đăng ký để tích điểm và đặt món nhanh hơn tại Cà Phê Fiin.';
      case 'forgot':
        return 'Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.';
      case 'verify-email':
        return 'Hệ thống đang kiểm tra liên kết xác thực Gmail của bạn.';
      case 'reset-password':
        return 'Nhập mật khẩu mới cho tài khoản Cà Phê Fiin của bạn.';
      default:
        return 'Đăng nhập để tiếp tục thưởng thức vị cà phê phin truyền thống.';
    }
  });

  // ---- Forms ----
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [true],
  });

  readonly registerForm = this.fb.nonNullable.group(
    {
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
      agree: [false, [Validators.requiredTrue]],
    },
    { validators: matchPasswords },
  );

  readonly forgotForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.nonNullable.group(
    {
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: matchPasswords },
  );

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const modeParam = (params.get('mode') || '').toLowerCase();
      const tokenParam = params.get('token') || '';

      if (modeParam === 'register') {
        this.setMode('register');
      } else if (modeParam === 'forgot' || modeParam === 'forgot-password') {
        this.setMode('forgot');
      } else if (modeParam === 'verify-email' && tokenParam) {
        this.setMode('verify-email');
        this.actionToken.set(tokenParam);
        void this.executeVerifyEmail(tokenParam);
      } else if (modeParam === 'reset-password' && tokenParam) {
        this.setMode('reset-password');
        this.actionToken.set(tokenParam);
      }
    });
  }

  // ---- Điều hướng giữa các chế độ ----
  setMode(mode: AuthMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.errorMsg.set('');
    this.successMsg.set('');
    this.devActionLink.set(null);
    this.unverifiedEmail.set(null);
    this.showPassword.set(false);
    this.loading.set(false);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  // ---- Submit ----
  onLogin(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }
    const { email, password } = this.loginForm.getRawValue();
    this.run(async () => {
      await this.authService.login(email, password);
      this.successMsg.set('Đăng nhập thành công! Đang chuyển hướng...');
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
      setTimeout(() => void this.router.navigateByUrl(returnUrl), 600);
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { fullName, phone, email, password } = this.registerForm.getRawValue();
    this.run(async () => {
      const res = await this.authService.register({
        fullName,
        phoneNumber: phone,
        email,
        password,
      });
      this.successMsg.set(res.message);
      this.devActionLink.set(res.data.devActionLink ?? null);
      this.registerForm.reset();
    });
  }

  onResendVerification(): void {
    const email = this.unverifiedEmail() || this.loginForm.getRawValue().email;
    if (!email) return;
    this.run(async () => {
      const res = await this.authService.resendVerification(email);
      this.unverifiedEmail.set(null);
      this.successMsg.set(res.message);
      this.devActionLink.set(res.data.devActionLink ?? null);
    });
  }

  onForgot(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }
    const { email } = this.forgotForm.getRawValue();
    this.run(async () => {
      const res = await this.authService.forgotPassword(email);
      this.successMsg.set(res.message);
      this.devActionLink.set(res.data.devActionLink ?? null);
    });
  }

  onResetPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }
    const token = this.actionToken();
    const { password } = this.resetForm.getRawValue();
    this.run(async () => {
      const msg = await this.authService.resetPassword(token, password);
      this.successMsg.set(msg);
      this.resetForm.reset();
      setTimeout(() => this.setMode('login'), 1500);
    });
  }

  private async executeVerifyEmail(token: string): Promise<void> {
    await this.run(async () => {
      const msg = await this.authService.verifyEmail(token);
      this.successMsg.set(msg);
    });
  }

  // ---- Hiển thị lỗi từng trường ----
  fieldError(form: FormGroup, name: string): string {
    const ctrl = form.get(name);
    if (!ctrl || !ctrl.touched || !ctrl.errors) {
      // Lỗi cấp group (mật khẩu không khớp) hiển thị ở ô nhập lại
      if (name === 'confirmPassword' && ctrl?.touched && form.hasError('mismatch')) {
        return 'Mật khẩu nhập lại không khớp.';
      }
      return '';
    }
    const label = FIELD_LABELS[name] ?? 'Trường này';
    const e = ctrl.errors;
    if (e['required'] || e['requiredTrue']) {
      return name === 'agree' ? 'Bạn cần đồng ý với điều khoản.' : `Vui lòng nhập ${label.toLowerCase()}.`;
    }
    if (e['email']) return 'Email chưa đúng định dạng.';
    if (e['minlength']) return `${label} cần tối thiểu ${e['minlength'].requiredLength} ký tự.`;
    if (e['pattern']) return 'Số điện thoại chưa hợp lệ (ví dụ: 0901234567).';
    return 'Giá trị chưa hợp lệ.';
  }

  isInvalid(form: FormGroup, name: string): boolean {
    return this.fieldError(form, name) !== '';
  }

  // ---- Helpers ----
  private async run(task: () => Promise<void>): Promise<void> {
    this.errorMsg.set('');
    this.successMsg.set('');
    this.devActionLink.set(null);
    this.unverifiedEmail.set(null);
    this.loading.set(true);
    try {
      await task();
    } catch (err) {
      if (err instanceof CustomerAuthApiError) {
        this.errorMsg.set(err.message);
        if (err.code === 'EMAIL_NOT_VERIFIED') {
          this.unverifiedEmail.set(err.email || this.loginForm.getRawValue().email);
        }
      } else {
        this.errorMsg.set('Có lỗi xảy ra, vui lòng thử lại sau.');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
