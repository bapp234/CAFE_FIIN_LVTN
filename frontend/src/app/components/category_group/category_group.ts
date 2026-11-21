import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CategoryItem, CategoryItemComponent } from '../category_item/category_item';

/**
 * Một nhánh của cây danh mục: dòng nhóm lớn + danh sách mục chi tiết bên dưới.
 * Nhóm không có `children` thì chỉ hiện một dòng, không có mũi tên.
 */
@Component({
  selector: 'app-category-group',
  imports: [CategoryItemComponent],
  templateUrl: './category_group.html',
  styleUrl: './category_group.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryGroupComponent {
  readonly category = input.required<CategoryItem>();
  readonly activeId = input<string | null>(null);

  /** Phát ra id danh mục vừa được bấm (nhóm lớn hoặc mục chi tiết) */
  readonly selected = output<string>();

  protected readonly children = computed(() => this.category().children ?? []);
  protected readonly hasChildren = computed(() => this.children().length > 0);

  /** Nhóm này đang chứa mục được chọn (chính nó hoặc một mục con) */
  private readonly containsActive = computed(() => {
    const active = this.activeId();
    return !!active && (this.category().id === active || this.children().some((c) => c.id === active));
  });

  /** null = chưa ai bấm mũi tên, khi đó tự mở nếu nhóm đang chứa mục được chọn */
  private readonly manual = signal<boolean | null>(null);
  protected readonly expanded = computed(() => this.manual() ?? this.containsActive());

  protected toggle(): void {
    this.manual.set(!this.expanded());
  }

  /** Bấm vào tên nhóm lớn: mở các mục con ra rồi báo cho cha */
  protected onParentSelected(id: string): void {
    if (this.hasChildren()) {
      this.manual.set(true);
    }
    this.selected.emit(id);
  }
}
