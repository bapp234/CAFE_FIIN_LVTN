import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAlertCircle,
  LucideArrowRight,
  LucideEye,
  LucideEyeOff,
  LucideLock,
  LucideMail,
  LucideShieldCheck,
  LucideSparkles,
} from '@lucide/angular';
import { BrandLogoComponent } from '../../../components/brand_logo/brand_logo';
import { AdminAuthService, AdminDemoAccount, DEMO_ADMIN_ACCOUNTS } from '../../core/admin_auth_service';
import { AdminSession } from '../../core/admin_session';

@Component({
  selector: 'app-admin-login',
  templateUrl: './admin_login.html',
  styleUrl: './admin_login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    BrandLogoComponent,
    LucideMail,
    LucideLock,
    LucideEye,
    LucideEyeOff,
    LucideArrowRight,
    LucideShieldCheck,
    LucideAlertCircle,
    LucideSparkles,
  ],
})
export class AdminLogin {
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  readonly email = signal('admin@fiin.vn');
  readonly password = signal('admin');
  readonly showPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly demoAccounts = DEMO_ADMIN_ACCOUNTS;

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }

  selectDemoAccount(acc: AdminDemoAccount, autoSubmit = false): void {
    this.email.set(acc.email);
    this.password.set(acc.password);
    this.errorMessage.set(null);

    if (autoSubmit) {
      this.onSubmit();
    }
  }

  onSubmit(): void {
    const mail = this.email().trim();
    const pass = this.password();

    if (!mail || !pass) {
      this.errorMessage.set('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.session.login(mail, pass).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
      },
    });
  }
}
