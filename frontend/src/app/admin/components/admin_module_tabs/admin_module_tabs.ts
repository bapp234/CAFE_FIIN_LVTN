import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AdminModule } from '../../core/admin_modules';
import { AdminIconComponent } from '../admin_icon/admin_icon';

/** Các tab chuyển module (CMS, CRM, HRM, ERP). Chỉ truyền vào những module tài khoản được phép. */
@Component({
  selector: 'app-admin-module-tabs',
  imports: [RouterLink, RouterLinkActive, AdminIconComponent],
  templateUrl: './admin_module_tabs.html',
  styleUrl: './admin_module_tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminModuleTabsComponent {
  readonly modules = input.required<readonly AdminModule[]>();
}
