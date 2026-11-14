import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ButtonOrderComponent } from '../../components/button_order/button_order';
import { InputFloatingComponent } from '../../components/input_floating/input_floating';

type AuthMode = 'login' | 'register' | 'forgot';

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
export class PageAuth {
  private readonly fb = inject(FormBuilder);

  readonly bgImage = '/assets/images/hero/slide-02-desktop.webp';

  // ---- Trạng thái giao diện ----
  readonly mode = signal<AuthMode>('login');
  readonly loading = signal(false);
  readonly errorMsg = signal('');
  readonly successMsg = signal('');
  readonly showPassword = signal(false);

  readonly title = computed(() => {
    switch (this.mode()) {
      case 'register':
        return 'Tạo tài khoản';
      case 'forgot':
        return 'Quên mật khẩu?';
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

  // ---- Điều hướng giữa các chế độ ----
  setMode(mode: AuthMode): void {
    if (this.mode() === mode) return;
    this.mode.set(mode);
    this.errorMsg.set('');
    this.successMsg.set('');
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
    const { email, password, remember } = this.loginForm.getRawValue();
    this.run(async () => {
      // TODO: thay bằng AuthService.login({ email, password, remember })
      await this.fakeRequest();
      void [email, password, remember];
      this.successMsg.set('Đăng nhập thành công! Đang chuyển hướng...');
      // TODO: this.router.navigateByUrl('/');
    });
  }

  onRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const { fullName, phone, email, password } = this.registerForm.getRawValue();
    this.run(async () => {
      // TODO: thay bằng AuthService.register({ fullName, phone, email, password })
      await this.fakeRequest();
      void [fullName, phone, email, password];
      this.successMsg.set('Đăng ký thành công! Bạn có thể đăng nhập ngay.');
      this.registerForm.reset();
      setTimeout(() => this.setMode('login'), 1500);
    });
  }

  onForgot(): void {
    if (this.forgotForm.invalid) {
      this.forgotForm.markAllAsTouched();
      return;
    }
    const { email } = this.forgotForm.getRawValue();
    this.run(async () => {
      // TODO: thay bằng AuthService.forgotPassword(email)
      await this.fakeRequest();
      this.successMsg.set(`Đã gửi liên kết đặt lại mật khẩu tới ${email}. Hãy kiểm tra hộp thư.`);
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
    this.loading.set(true);
    try {
      await task();
    } catch {
      this.errorMsg.set('Có lỗi xảy ra, vui lòng thử lại sau.');
    } finally {
      this.loading.set(false);
    }
  }

  /** Giả lập gọi API. Xóa khi nối backend thật. */
  private fakeRequest(ms = 900): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
