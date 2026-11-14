import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import {
  CategoryItem,
  CategoryItemComponent,
} from '../../components/category_item/category_item';
import { SidebarHeaderComponent } from '../../components/sidebar_header/sidebar_header';

// Giữ export cũ để nơi khác import CategoryItem từ đây vẫn chạy
export type { CategoryItem } from '../../components/category_item/category_item';

@Component({
  selector: 'app-widget-home-sidebar',
  imports: [SidebarHeaderComponent, CategoryItemComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeSidebar {
  readonly categories = input.required<CategoryItem[]>();
  readonly isOpen = input<boolean>(true);
  readonly title = input<string>('Danh mục');

  /** Danh mục đang được chọn (tô sáng) */
  protected readonly activeId = signal<string | null>(null);

  protected onSelected(id: string): void {
    this.activeId.set(id);
  }
}
