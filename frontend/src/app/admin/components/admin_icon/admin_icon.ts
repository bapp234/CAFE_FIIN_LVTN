import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideBanknote,
  LucideBoxes,
  LucideCalendarClock,
  LucideChartColumn,
  LucideClock,
  LucideFileText,
  LucideFolderTree,
  LucideHandshake,
  LucideImage,
  LucideLayoutDashboard,
  LucideNewspaper,
  LucidePackage,
  LucideReceipt,
  LucideShoppingBasket,
  LucideStar,
  LucideTicket,
  LucideTruck,
  LucideUserCog,
  LucideUsers,
  LucideUsersRound,
  LucideWarehouse,
} from '@lucide/angular';
import { AdminIconKey } from '../../core/admin_modules';

/**
 * Hiển thị icon Lucide theo khóa, ví dụ <app-admin-icon name="article" />.
 * Chỉnh cỡ bằng biến CSS --icon-size trên phần tử cha. Khóa lạ rơi về icon bảng điều khiển.
 */
@Component({
  selector: 'app-admin-icon',
  imports: [
    LucideBanknote,
    LucideBoxes,
    LucideCalendarClock,
    LucideChartColumn,
    LucideClock,
    LucideFileText,
    LucideFolderTree,
    LucideHandshake,
    LucideImage,
    LucideLayoutDashboard,
    LucideNewspaper,
    LucidePackage,
    LucideReceipt,
    LucideShoppingBasket,
    LucideStar,
    LucideTicket,
    LucideTruck,
    LucideUserCog,
    LucideUsers,
    LucideUsersRound,
    LucideWarehouse,
  ],
  templateUrl: './admin_icon.html',
  styleUrl: './admin_icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminIconComponent {
  readonly name = input<AdminIconKey | string>('dashboard');
}
