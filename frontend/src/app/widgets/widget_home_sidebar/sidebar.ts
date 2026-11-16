import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  signal,
} from '@angular/core';
import { CategoryGroupComponent } from '../../components/category_group/category_group';
import { CategoryItem } from '../../components/category_item/category_item';

// Giữ export cũ để nơi khác import CategoryItem từ đây vẫn chạy
export type { CategoryItem } from '../../components/category_item/category_item';

export const DEFAULT_CATEGORY_TREE: CategoryItem[] = [
  {
    id: 'ca-phe',
    name: 'Cà Phê',
    icon: 'coffee',
    children: [
      { id: 'phindi', name: 'PhinDi', icon: 'bean' },
      { id: 'ca-phe-dong-goi', name: 'Cà Phê Đóng Gói', icon: 'package' },
    ],
  },
  {
    id: 'tra',
    name: 'Trà',
    icon: 'leaf',
    children: [{ id: 'matchadi', name: 'MatchaDi', icon: 'sprout' }],
  },
  {
    id: 'banh-ngot',
    name: 'Bánh Ngọt',
    icon: 'cake',
    children: [{ id: 'banh-mi-que', name: 'Bánh Mì Que', icon: 'wheat' }],
  },
  {
    id: 'thuc-uong-khac',
    name: 'Thức Uống Khác',
    icon: 'cup-soda',
    children: [
      { id: 'freeze', name: 'Freeze', icon: 'ice-cream' },
      { id: 'binh-giu-nhiet', name: 'Bình Giữ Nhiệt', icon: 'glass-water' },
    ],
  },
];

/** Dưới mốc này sidebar là khung thả xuống đè lên nội dung, từ mốc này trở lên nằm cố định cạnh nội dung */
const OVERLAY_QUERY = '(max-width: 1023.98px)';

@Component({
  selector: 'app-widget-home-sidebar',
  imports: [CategoryGroupComponent],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'onEscape()' },
})
export class WidgetHomeSidebar {
  readonly categories = input.required<CategoryItem[]>();
  readonly isOpen = input<boolean>(true);
  /** Chế độ dropdown nổi trên các trang khác trang Home */
  readonly isDropdown = input<boolean>(false);

  /** Sidebar tự xin đóng (xảy ra khi chọn mục ở dạng dropdown hoặc mobile) */
  readonly closed = output<void>();

  /** Danh mục đang được chọn (tô sáng) */
  protected readonly activeId = signal<string | null>(null);

  /** Chỉ bật hiệu ứng mở/đóng sau lần hiển thị đầu, để lúc vào trang không bị chạy hiệu ứng */
  protected readonly ready = signal(false);

  constructor() {
    afterNextRender(() => this.ready.set(true));
  }

  protected onSelected(id: string): void {
    this.activeId.set(id);

    // Bấm nhóm lớn có mục con thì giữ khung mở để người dùng thấy các mục con vừa bung ra
    const opensChildren = !!this.categories().find((c) => c.id === id)?.children?.length;
    if ((this.isOverlay() || this.isDropdown()) && !opensChildren) {
      this.closed.emit();
    }
  }

  protected onBackdropClick(): void {
    this.closed.emit();
  }

  protected onEscape(): void {
    if (this.isOpen() && (this.isOverlay() || this.isDropdown())) {
      this.closed.emit();
    }
  }

  private isOverlay(): boolean {
    return typeof window !== 'undefined' && window.matchMedia(OVERLAY_QUERY).matches;
  }
}
