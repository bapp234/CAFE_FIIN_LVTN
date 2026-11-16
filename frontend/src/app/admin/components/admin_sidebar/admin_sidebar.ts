import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LucideExternalLink } from '@lucide/angular';
import { AdminModule } from '../../core/admin_modules';
import { AdminIconComponent } from '../admin_icon/admin_icon';

/**
 * Menu bên trái theo module đang chọn.
 * Từ 1024px nằm cố định cạnh nội dung; dưới 1024px là ngăn kéo trượt từ trái, có lớp nền mờ.
 */
@Component({
  selector: 'app-admin-sidebar',
  imports: [RouterLink, RouterLinkActive, LucideExternalLink, AdminIconComponent],
  templateUrl: './admin_sidebar.html',
  styleUrl: './admin_sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class AdminSidebarComponent {
  readonly module = input.required<AdminModule>();
  /** Chỉ có ý nghĩa ở dạng ngăn kéo (dưới 1024px) */
  readonly isOpen = input<boolean>(false);

  readonly closed = output<void>();

  protected onEscape(): void {
    if (this.isOpen()) {
      this.closed.emit();
    }
  }
}
