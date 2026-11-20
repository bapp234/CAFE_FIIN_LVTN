import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideAlertCircle,
  LucideArrowRight,
  LucideEye,
  LucideEyeOff,
  LucideLock,
  LucideMail,
  LucideShieldCheck,
} from '@lucide/angular';
import { BrandLogoComponent } from '../../../components/brand_logo/brand_logo';
import { AuthLoginError } from '../../core/admin_auth_service';
import { AdminPortal, AdminSession } from '../../core/admin_session';

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
  ],
})
export class AdminLogin {
  private readonly session = inject(AdminSession);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly portal = signal<AdminPortal>(
    this.route.snapshot.data?.['portal'] === 'staff' ? 'staff' : 'admin'
  );

  readonly isStaffPortal = computed(() => this.portal() === 'staff');

  readonly identifier = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(
    this.route.snapshot.queryParamMap.get('reason') === 'replaced'
      ? 'Tài khoản vừa được đăng nhập tại một cửa sổ khác. Phiên hiện tại đã tự động đăng xuất.'
      : null
  );
  readonly wrongPortalRedirect = signal<string | null>(null);

  toggleShowPassword(): void {
    this.showPassword.update((val) => !val);
  }

  goToSuggestedPortal(): void {
    const target = this.wrongPortalRedirect() || (this.isStaffPortal() ? '/admin/login' : '/staff/login');
    void this.router.navigateByUrl(target);
  }

  onSubmit(): void {
    const id = this.identifier().trim();
    const pass = this.password();

    if (!id || !pass) {
      this.errorMessage.set('Vui lòng nhập đầy đủ tên đăng nhập / email và mật khẩu.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.wrongPortalRedirect.set(null);

    this.session.login(id, pass, this.portal()).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (err: AuthLoginError | Error) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.message || 'Đăng nhập không thành công. Vui lòng thử lại.');
        if ('code' in err && err.code === 'WRONG_PORTAL' && err.redirectUrl) {
          this.wrongPortalRedirect.set(err.redirectUrl);
        }
      },
    });
  }
}
