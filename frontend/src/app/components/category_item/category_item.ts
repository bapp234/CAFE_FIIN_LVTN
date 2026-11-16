import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { LucideChevronRight } from '@lucide/angular';
import { CategoryIconComponent } from '../category_icon/category_icon';

export interface CategoryItem {
  id: string;
  name: string;
  /** Khóa icon Lucide, xem CategoryIconKey (vd 'coffee', 'leaf') */
  icon: string;
  /** Mục con (cấp chi tiết). Có thì mục này là nhóm, bấm mũi tên để mở ra */
  children?: CategoryItem[];
}

/**
 * Một dòng trong cây danh mục: chip icon + tên, và nếu là nhóm thì có nút mũi tên mở/thu gọn.
 * level 0 = nhóm lớn, level 1 = mục chi tiết (thụt vào, có đường nối cây).
 */
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
  readonly level = input<0 | 1>(0);
  /** Mục cuối của nhóm: đường nối dọc dừng ở giữa dòng thay vì chạy tiếp xuống */
  readonly isLast = input<boolean>(false);
  /** Có hiện nút mũi tên mở/thu gọn không */
  readonly expandable = input<boolean>(false);
  readonly expanded = input<boolean>(false);

  /** Phát ra id danh mục vừa được bấm (bấm vào tên) */
  readonly selected = output<string>();
  /** Bấm nút mũi tên */
  readonly toggle = output<void>();

  protected readonly toggleLabel = computed(
    () => `${this.expanded() ? 'Thu gọn' : 'Mở rộng'} ${this.category().name}`,
  );

  private readonly router = inject(Router);

  onClick(event: MouseEvent): void {
    this.selected.emit(this.category().id);
    const url = this.router.url.split('?')[0].split('#')[0];
    const isHome = url === '' || url === '/' || url === '/home';
    if (!isHome) {
      event.preventDefault();
      void this.router.navigate(['/'], { fragment: this.category().id });
    }
  }
}
