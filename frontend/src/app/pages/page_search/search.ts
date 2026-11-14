import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideCheck,
  LucideChevronDown,
  LucideChevronUp,
  LucidePhone,
  LucidePlus,
  LucideRotateCcw,
  LucideSearch,
  LucideShoppingCart,
  LucideX,
} from '@lucide/angular';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import {
  WidgetProductModal,
  CustomizedItem,
} from '../../widgets/widget_product_modal/modal';
import {
  MOCK_PRODUCTS,
  PRODUCT_CATEGORIES,
  ProductItem,
} from '../../entities/entity_product/product';

export interface CartItem {
  product: ProductItem;
  size: 'S' | 'M' | 'L';
  sugar: string;
  ice: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Component({
  selector: 'app-page-search',
  imports: [
    CommonModule,
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    WidgetProductModal,
    LucideSearch,
    LucideX,
    LucidePlus,
    LucideRotateCcw,
    LucideChevronDown,
    LucideChevronUp,
    LucidePhone,
    LucideShoppingCart,
    LucideCheck,
  ],
  templateUrl: './search.html',
  styleUrl: './search.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageSearch implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly searchQuery = signal<string>('');
  readonly selectedCategory = signal<string>('all');
  readonly selectedServing = signal<'all' | 'ice' | 'hot' | 'banchay'>('all');
  readonly selectedSort = signal<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');

  readonly cart = signal<CartItem[]>([]);
  readonly isCartOpen = signal<boolean>(false);
  readonly selectedProductForModal = signal<ProductItem | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly allProducts = MOCK_PRODUCTS;
  readonly categories = PRODUCT_CATEGORIES;

  readonly cartCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly cartTotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.totalPrice, 0)
  );

  // Danh sách món khớp với từ khóa tìm kiếm
  readonly matchingProducts = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return this.allProducts;
    }
    return this.allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q)
    );
  });

  // Danh mục có món trong kết quả tìm kiếm để hiện tab lọc nhanh
  readonly activeCategoriesInResults = computed(() => {
    const list = this.matchingProducts();
    const map = new Map<string, number>();
    for (const p of list) {
      map.set(p.category, (map.get(p.category) || 0) + 1);
    }
    return this.categories
      .filter((c) => c.id === 'all' || (map.get(c.id) || 0) > 0)
      .map((c) => ({
        ...c,
        count: c.id === 'all' ? list.length : map.get(c.id) || 0,
      }));
  });

  // Kết quả cuối cùng sau khi lọc category, serving và sắp xếp
  readonly filteredResults = computed(() => {
    let list = [...this.matchingProducts()];
    const cat = this.selectedCategory();
    const serving = this.selectedServing();
    const sort = this.selectedSort();

    if (cat !== 'all') {
      list = list.filter((p) => p.category === cat);
    }

    if (serving === 'ice') {
      list = list.filter((p) => p.servingType === 'ice' || p.servingType === 'both');
    } else if (serving === 'hot') {
      list = list.filter((p) => p.servingType === 'hot' || p.servingType === 'both');
    } else if (serving === 'banchay') {
      list = list.filter((p) => p.badge === 'BÁN CHẠY!');
    }

    if (sort === 'price-asc') {
      list.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      list.sort((a, b) => b.price - a.price);
    } else if (sort === 'name-asc') {
      list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }

    return list;
  });

  // Gợi ý món bán chạy nhất khi không có kết quả
  readonly popularRecommendations = computed(() => {
    return this.allProducts.filter((p) => p.badge === 'BÁN CHẠY!').slice(0, 4);
  });

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((params) => {
        const q = params['q'] || '';
        this.searchQuery.set(q);
        this.selectedCategory.set('all');
      });
  }

  onSearchSubmit(newTerm: string): void {
    const q = (newTerm || '').trim();
    this.searchQuery.set(q);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: q || null },
      queryParamsHandling: 'merge',
    });
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null },
      queryParamsHandling: 'merge',
    });
  }

  setCategory(catId: string): void {
    this.selectedCategory.set(catId);
  }

  setServing(serving: 'all' | 'ice' | 'hot' | 'banchay'): void {
    this.selectedServing.set(serving);
  }

  onSortSelect(e: Event): void {
    const val = (e.target as HTMLSelectElement).value as
      | 'featured'
      | 'price-asc'
      | 'price-desc'
      | 'name-asc';
    this.selectedSort.set(val);
  }

  resetFilters(): void {
    this.selectedCategory.set('all');
    this.selectedServing.set('all');
    this.selectedSort.set('featured');
    this.clearSearch();
  }

  openProductModal(product: ProductItem): void {
    this.selectedProductForModal.set(product);
  }

  closeProductModal(): void {
    this.selectedProductForModal.set(null);
  }

  onProductCustomized(item: CustomizedItem): void {
    const cartItem: CartItem = {
      product: item.product as ProductItem,
      size: item.size,
      sugar: item.sugar,
      ice: item.ice,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
    };
    this.cart.update((cur) => [...cur, cartItem]);
    this.closeProductModal();
    this.triggerToast(`Đã thêm "${item.product.name}" vào giỏ hàng!`);
  }

  toggleCart(): void {
    this.isCartOpen.update((v) => !v);
  }

  removeFromCart(index: number): void {
    this.cart.update((list) => list.filter((_, i) => i !== index));
    this.triggerToast('Đã xóa món khỏi giỏ hàng.');
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }

  private triggerToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 2800);
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'đ';
  }
}
