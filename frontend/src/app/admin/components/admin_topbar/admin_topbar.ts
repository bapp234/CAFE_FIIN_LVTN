import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMenu, LucideX } from '@lucide/angular';
import { BrandLogoComponent } from '../../../components/brand_logo/brand_logo';
import { AdminModule } from '../../core/admin_modules';
import { AdminUser } from '../../core/admin_session';
import { AdminModuleTabsComponent } from '../admin_module_tabs/admin_module_tabs';
import { AdminUserMenuComponent } from '../admin_user_menu/admin_user_menu';

/** Thanh trên cùng của admin: logo, tab chuyển module, menu người dùng, nút mở menu trên điện thoại */
@Component({
  selector: 'app-admin-topbar',
  imports: [
    RouterLink,
    LucideMenu,
    LucideX,
    BrandLogoComponent,
    AdminModuleTabsComponent,
    AdminUserMenuComponent,
  ],
  templateUrl: './admin_topbar.html',
  styleUrl: './admin_topbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTopbarComponent {
  readonly modules = input.required<readonly AdminModule[]>();
  readonly user = input<AdminUser | null>(null);
  /** Có sidebar để mở không (trang báo không có quyền thì không có) */
  readonly hasMenu = input<boolean>(false);
  readonly menuOpen = input<boolean>(false);

  readonly menuToggle = output<void>();
  readonly signOut = output<void>();
}
