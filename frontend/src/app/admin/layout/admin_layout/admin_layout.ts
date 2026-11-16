import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminSidebarComponent } from '../../components/admin_sidebar/admin_sidebar';
import { AdminTopbarComponent } from '../../components/admin_topbar/admin_topbar';
import { AdminNav } from '../../core/admin_nav';
import { AdminSession } from '../../core/admin_session';
import { AdminToast } from '../../shared/admin_toast/admin_toast';

/** Khung chung của trang admin: thanh trên, menu trái theo module, vùng nội dung */
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

  protected readonly modules = this.session.allowedModules;
  protected readonly user = this.session.user;
  protected readonly activeModule = this.nav.activeModule;

  /** Ngăn kéo menu trên màn hình nhỏ */
  protected readonly isMenuOpen = signal(false);

  constructor() {
    // Rời module (ví dụ sang trang báo không có quyền) thì đóng ngăn kéo
    effect(() => {
      if (!this.activeModule()) {
        this.isMenuOpen.set(false);
      }
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
