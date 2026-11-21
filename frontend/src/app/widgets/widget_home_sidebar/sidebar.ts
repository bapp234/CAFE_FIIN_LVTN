import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CategoryGroupComponent } from '../../components/category_group/category_group';
import { CategoryItem } from '../../components/category_item/category_item';
import { CustomerOrderService, MenuCategoryDto } from '../../services/customer_order_service';

// Giữ export cũ để nơi khác import CategoryItem từ đây vẫn chạy
export type { CategoryItem } from '../../components/category_item/category_item';

function inferSidebarIcon(name: string, slug = ''): string {
  const s = `${name} ${slug}`.toLowerCase();
  if (s.includes('đá xay') || s.includes('freeze') || s.includes('kem')) return 'ice-cream';
  if (s.includes('đặc sản') || s.includes('vùng miền') || s.includes('hạt')) return 'bean';
  if (s.includes('đóng gói')) return 'package';
  if (s.includes('trà sữa')) return 'cup-soda';
  if (s.includes('matcha')) return 'sprout';
  if (s.includes('trà')) return 'leaf';
  if (s.includes('bánh mì')) return 'wheat';
  if (s.includes('bánh')) return 'cake';
  if (s.includes('bình') || s.includes('nước')) return 'glass-water';
  if (s.includes('cà phê') || s.includes('phin')) return 'coffee';
  return 'coffee';
}

export function buildCategoryTreeFromDb(dbCategories: MenuCategoryDto[]): CategoryItem[] {
  if (!dbCategories.length) return [];

  const sorted = [...dbCategories].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.categoryId - b.categoryId
  );

  const nodeMap = new Map<number, CategoryItem>();
  for (const c of sorted) {
    nodeMap.set(c.categoryId, {
      id: c.slug || String(c.categoryId),
      name: c.categoryName,
      icon: inferSidebarIcon(c.categoryName, c.slug),
    });
  }

  const roots: CategoryItem[] = [];
  for (const c of sorted) {
    const node = nodeMap.get(c.categoryId)!;
    const parentId = c.parentCategoryId ?? null;
    if (parentId && nodeMap.has(parentId) && parentId !== c.categoryId) {
      const parent = nodeMap.get(parentId)!;
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }

  return roots;
}

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
  private readonly orderService = inject(CustomerOrderService);

  readonly categories = input<CategoryItem[]>([]);
  readonly isOpen = input<boolean>(true);
  /** Chế độ dropdown nổi trên các trang khác trang Home */
  readonly isDropdown = input<boolean>(false);

  /** Sidebar tự xin đóng (xảy ra khi chọn mục ở dạng dropdown hoặc mobile) */
  readonly closed = output<void>();

  /** Danh sách danh mục ưu tiên lấy từ Database (dbo.Categories), fallback về input/mock khi chưa tải xong */
  protected readonly effectiveCategories = computed<CategoryItem[]>(() => {
    const dbCats = this.orderService.menu()?.categories ?? [];
    if (dbCats.length > 0) {
      return buildCategoryTreeFromDb(dbCats);
    }
    const provided = this.categories();
    return provided.length > 0 ? provided : DEFAULT_CATEGORY_TREE;
  });

  /** Danh mục đang được chọn (tô sáng) */
  protected readonly activeId = signal<string | null>(null);

  /** Chỉ bật hiệu ứng mở/đóng sau lần hiển thị đầu, để lúc vào trang không bị chạy hiệu ứng */
  protected readonly ready = signal(false);

  constructor() {
    if (!this.orderService.menu()) {
      void this.orderService.getMenu().catch(() => {});
    }
    afterNextRender(() => this.ready.set(true));
  }

  protected onSelected(id: string): void {
    this.activeId.set(id);

    // Bấm nhóm lớn có mục con thì giữ khung mở để người dùng thấy các mục con vừa bung ra
    const opensChildren = !!this.effectiveCategories().find((c) => c.id === id)?.children?.length;
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
