import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideShieldAlert } from '@lucide/angular';
import { AdminSession } from '../../core/admin_session';

/** Hiện khi vào module mà tài khoản không được cấp quyền, hoặc tài khoản chưa có module nào */
@Component({
  selector: 'app-admin-forbidden',
  imports: [RouterLink, LucideShieldAlert],
  templateUrl: './admin_forbidden.html',
  styleUrl: './admin_forbidden.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminForbidden {
  private readonly session = inject(AdminSession);

  /** Module đầu tiên được phép, để gợi ý quay lại. Null nếu tài khoản chưa có module nào */
  protected readonly firstAllowed = computed(() => this.session.allowedModules()[0] ?? null);

  protected signOut(): void {
    this.session.signOut();
  }
}
