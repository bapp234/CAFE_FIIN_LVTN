import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from '../../components/admin_sidebar/admin_sidebar';
import { AdminTopbarComponent } from '../../components/admin_topbar/admin_topbar';
import { AdminNav } from '../../core/admin_nav';
import { AdminSession } from '../../core/admin_session';
import { AdminToast } from '../../shared/admin_toast/admin_toast';
import { AdminBranchService } from '../../shared/services/admin_branch_service';

/** Khung chung của trang quản trị (/admin) và cổng nhân viên (/staff) */
@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, AdminTopbarComponent, AdminSidebarComponent, AdminToast],
  templateUrl: './admin_layout.html',
  styleUrl: './admin_layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLayout {
  private readonly session = inject(AdminSession);
  private readonly nav = inject(AdminNav);
  private readonly branchService = inject(AdminBranchService);

  protected readonly modules = this.session.allowedModules;
  protected readonly user = this.session.user;
  protected readonly activeModule = this.nav.activeModule;
  protected readonly isStaffPortal = this.session.isStaffPortal;

  /** Ngăn kéo menu trên màn hình nhỏ */
  protected readonly isMenuOpen = signal(false);

  constructor() {
    effect(() => {
      if (!this.activeModule()) {
        this.isMenuOpen.set(false);
      }
    });

    effect(() => {
      this.branchService.syncWithUser(this.session.user());
    });
  }

  protected toggleMenu(): void {
    this.isMenuOpen.update((v) => !v);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected signOut(): void {
    this.session.signOut();
  }
}
