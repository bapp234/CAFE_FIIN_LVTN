import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideMinus,
  LucidePlus,
  LucideShoppingCart,
  LucideX,
} from '@lucide/angular';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import {
  MOCK_PRODUCTS,
  PRODUCT_CATEGORIES,
  ProductItem,
  getPastryRecommendations,
  getProductById,
  getRecentlyViewedFallback,
  getRelatedProducts,
} from '../../entities/entity_product/product';
import { CartItem, CartService } from '../../entities/entity_cart/cart';

const RECENTLY_VIEWED_STORAGE_KEY = 'fiin_recently_viewed_ids';

@Component({
  selector: 'app-page-product-detail',
  imports: [
    CommonModule,
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    LucideChevronLeft,
    LucideChevronRight,
    LucideMinus,
    LucidePlus,
    LucideShoppingCart,
    LucideX,
  ],
  templateUrl: './productDetail.html',
  styleUrl: './productDetail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly cartService = inject(CartService);

  readonly currentProduct = signal<ProductItem>(MOCK_PRODUCTS[0]);
  readonly selectedSize = signal<'S' | 'M' | 'L'>('S');
  readonly selectedSugar = signal<string>('100%');
  readonly selectedIce = signal<string>('100%');
  readonly quantity = signal<number>(1);
  readonly activeImageIndex = signal<number>(0);
  readonly isCartOpen = signal<boolean>(false);
  readonly toastMessage = signal<string | null>(null);

  readonly relatedProducts = signal<ProductItem[]>([]);
  readonly pastryProducts = signal<ProductItem[]>([]);
  readonly recentlyViewed = signal<ProductItem[]>([]);

  // Category name lookup
  readonly categoryName = computed(() => {
    const cat = PRODUCT_CATEGORIES.find(
      (c) => c.id === this.currentProduct().category
    );
    return cat ? cat.name : 'Thực Đơn';
  });

  // Images list for gallery
  readonly galleryImages = computed(() => {
    const p = this.currentProduct();
    if (p.galleryImages && p.galleryImages.length > 0) {
      return p.galleryImages;
    }
    return [p.image];
  });

  // Active displayed image
  readonly activeImage = computed(() => {
    const list = this.galleryImages();
    const idx = this.activeImageIndex();
    return list[idx] ?? list[0] ?? this.currentProduct().image;
  });

  // Calculated unit price with size modifier
  readonly unitPrice = computed(() => {
    const base = this.currentProduct().price;
    const size = this.selectedSize();
    if (size === 'M') return base + 6000;
    if (size === 'L') return base + 10000;
    return base;
  });

  // Total price for current quantity
  readonly totalPrice = computed(() => {
    return this.unitPrice() * this.quantity();
  });

  readonly cartCount = computed(() => this.cartService.count());
  readonly cartTotal = computed(() => this.cartService.total());
  readonly cartItems = computed(() => this.cartService.items());

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || 'p2';
      this.loadProduct(id);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private loadProduct(id: string): void {
    const found = getProductById(id) || MOCK_PRODUCTS[0];
    this.currentProduct.set(found);
    this.selectedSize.set('S');
    this.selectedSugar.set('100%');
    this.selectedIce.set('100%');
    this.quantity.set(1);
    this.activeImageIndex.set(0);

    // Update related & pastry recommendations
    this.relatedProducts.set(getRelatedProducts(found.id, found.category, 5));
    this.pastryProducts.set(getPastryRecommendations(6));

    // Update & track recently viewed products
    this.trackAndLoadRecentlyViewed(found.id);

    // Scroll to top
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private trackAndLoadRecentlyViewed(currentId: string): void {
    if (typeof localStorage === 'undefined') {
      this.recentlyViewed.set(getRecentlyViewedFallback(currentId));
      return;
    }
    try {
      const stored = localStorage.getItem(RECENTLY_VIEWED_STORAGE_KEY);
      let ids: string[] = stored ? JSON.parse(stored) : [];
      // Remove current id from history if present, then unshift
      ids = [currentId, ...ids.filter((i) => i !== currentId)].slice(0, 8);
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(ids));

      // Display other recently viewed (excluding current)
      const list = ids
        .filter((i) => i !== currentId)
        .map((i) => getProductById(i))
        .filter((p): p is ProductItem => !!p)
        .slice(0, 4);

      if (list.length >= 2) {
        this.recentlyViewed.set(list);
      } else {
        this.recentlyViewed.set(getRecentlyViewedFallback(currentId));
      }
    } catch {
      this.recentlyViewed.set(getRecentlyViewedFallback(currentId));
    }
  }

  selectSize(size: 'S' | 'M' | 'L'): void {
    this.selectedSize.set(size);
  }

  selectSugar(sugar: string): void {
    this.selectedSugar.set(sugar);
  }

  selectIce(ice: string): void {
    this.selectedIce.set(ice);
  }

  incrementQuantity(): void {
    this.quantity.update((q) => Math.min(q + 1, 99));
  }

  decrementQuantity(): void {
    this.quantity.update((q) => Math.max(q - 1, 1));
  }

  selectGalleryImage(index: number): void {
    this.activeImageIndex.set(index);
  }

  prevGalleryImage(): void {
    const total = this.galleryImages().length;
    if (total <= 1) return;
    this.activeImageIndex.update((cur) => (cur - 1 + total) % total);
  }

  nextGalleryImage(): void {
    const total = this.galleryImages().length;
    if (total <= 1) return;
    this.activeImageIndex.update((cur) => (cur + 1) % total);
  }

  addToCart(): void {
    const item: CartItem = {
      product: this.currentProduct(),
      size: this.selectedSize(),
      sugar: this.selectedSugar(),
      ice: this.selectedIce(),
      quantity: this.quantity(),
      unitPrice: this.unitPrice(),
      totalPrice: this.totalPrice(),
    };
    this.cartService.addItem(item);
    this.showToast(
      `Đã thêm ${this.quantity()}x ${this.currentProduct().name} (Size ${this.selectedSize()}) vào giỏ!`
    );
  }

  buyNow(): void {
    this.addToCart();
    this.isCartOpen.set(true);
  }

  quickAdd(product: ProductItem, event: MouseEvent): void {
    event.stopPropagation();
    const item: CartItem = {
      product,
      size: 'S',
      quantity: 1,
      unitPrice: product.price,
      totalPrice: product.price,
    };
    this.cartService.addItem(item);
    this.showToast(`Đã thêm ${product.name} vào giỏ hàng!`);
  }

  openProductDetail(productId: string): void {
    this.router.navigate(['/san-pham', productId]);
  }

  toggleCartDrawer(): void {
    this.isCartOpen.update((v) => !v);
  }

  removeFromCart(index: number): void {
    this.cartService.removeItem(index);
  }

  updateCartItemQty(index: number, newQty: number): void {
    this.cartService.updateQuantity(index, newQty);
  }

  showToast(message: string): void {
    this.toastMessage.set(message);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 2800);
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'đ';
  }
}
