import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { LucideLayoutGrid } from '@lucide/angular';

/** Phần đầu của khung sidebar: icon + tiêu đề */
@Component({
  selector: 'app-sidebar-header',
  imports: [LucideLayoutGrid],
  templateUrl: './sidebar_header.html',
  styleUrl: './sidebar_header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarHeaderComponent {
  readonly title = input<string>('Danh mục');
}
