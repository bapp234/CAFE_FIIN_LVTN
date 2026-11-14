import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideChevronRight } from '@lucide/angular';
import { CategoryIconComponent } from '../category_icon/category_icon';

export interface CategoryItem {
  id: string;
  name: string;
  /** Khóa icon Lucide, xem CategoryIconKey (vd 'coffee', 'leaf') */
  icon: string;
}

/** Một dòng danh mục: chip icon + tên + mũi tên. Bấm để cuộn tới section có id tương ứng. */
@Component({
  selector: 'app-category-item',
  imports: [CategoryIconComponent, LucideChevronRight],
  templateUrl: './category_item.html',
  styleUrl: './category_item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryItemComponent {
  readonly category = input.required<CategoryItem>();
  readonly active = input<boolean>(false);

  /** Phát ra id danh mục vừa được bấm */
  readonly selected = output<string>();

  onClick(): void {
    this.selected.emit(this.category().id);
  }
}
