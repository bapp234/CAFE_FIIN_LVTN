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
import { CustomerAuthService } from '../../services/customer_auth_service';
import { CustomerOrderService, MenuVariantDto } from '../../services/customer_order_service';

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
  ],
  templateUrl: './productDetail.html',
  styleUrl: './productDetail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageProductDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authService = inject(CustomerAuthService);
  private readonly orderService = inject(CustomerOrderService);
  readonly cartService = inject(CartService);

  readonly currentVariants = signal<MenuVariantDto[]>([]);

  readonly currentProduct = signal<ProductItem>(MOCK_PRODUCTS[0]);
  readonly selectedSize = signal<'S' | 'M' | 'L'>('S');
  readonly selectedSugar = signal<string>('100%');
  readonly selectedIce = signal<string>('100%');
  readonly quantity = signal<number>(1);
  readonly activeImageIndex = signal<number>(0);
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

  // Calculated unit price with size modifier from API variants or fallback
  readonly unitPrice = computed(() => {
    const variants = this.currentVariants();
    const size = this.selectedSize();
    const matched = variants.find(
      (v) => v.sizeName.toUpperCase() === size.toUpperCase()
    );
    if (matched && matched.price > 0) {
      return matched.price;
    }
    const base = this.currentProduct().price;
    if (variants.length <= 1) return base;
    if (size === 'M') return base + 6000;
    if (size === 'L') return base + 10000;
    return base;
  });

  // Total price for current quantity
  readonly totalPrice = computed(() => {
    return this.unitPrice() * this.quantity();
  });

  readonly cartCount = computed(() => this.orderService.cartCount());
  readonly cartTotal = computed(() => this.orderService.cartSubtotal());
  readonly cartItems = computed(() => this.orderService.cartItems());

  constructor() {
    const sub = this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || 'p2';
      void this.loadProduct(id);
    });
    this.destroyRef.onDestroy(() => sub.unsubscribe());
  }

  private async loadProduct(id: string): Promise<void> {
    let found = getProductById(id);
    this.currentVariants.set([]);
    try {
      const menu = await this.orderService.getMenu();
      const numId = Number(id);
      const dbProd = menu.products.find(
        (p) => p.productId === numId || p.productSlug === id
      );
      if (dbProd) {
        const variants = menu.variants.filter((v) => v.productId === dbProd.productId);
        this.currentVariants.set(variants);
        const defVar = variants.find((v) => v.isDefault) ?? variants[0];
        found = {
          id: String(dbProd.productId),
          name: dbProd.productName,
          brand: 'CÀ PHÊ FIIN',
          price: defVar && defVar.price > 0 ? defVar.price : dbProd.basePrice,
          image: dbProd.imageUrl || '/assets/images/hero/slide-01-desktop.webp',
          category: dbProd.categorySlug || 'ca-phe',
          servingType: 'both',
          description: dbProd.description || 'Hương vị cà phê Sài Gòn truyền thống.',
        };
      }
    } catch {
      // fallback to mock
    }

    if (!found) {
      found = MOCK_PRODUCTS[0];
    }

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
      ids = [currentId, ...ids.filter((i) => i !== currentId)].slice(0, 8);
      localStorage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(ids));

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

  async addToCart(): Promise<boolean> {
    const user = await this.authService.ensureLoaded();
    if (!user) {
      await this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
      return false;
    }

    const size = this.selectedSize();
    const variants = this.currentVariants();
    const matchedVar =
      variants.find((v) => v.sizeName.toUpperCase() === size.toUpperCase()) ??
      variants[0];

    if (!matchedVar) {
      this.showToast('Không tìm thấy phiên bản kích cỡ của món.');
      return false;
    }

    const note = `Đường: ${this.selectedSugar()}, Đá: ${this.selectedIce()}`;
    await this.orderService.addToCart(matchedVar.variantId, this.quantity(), note);
    await this.orderService.loadCart();

    this.showToast(
      `Đã thêm ${this.quantity()}x ${this.currentProduct().name} (Size ${this.selectedSize()}) vào giỏ!`
    );
    this.orderService.openCart();
    return true;
  }

  async buyNow(): Promise<void> {
    const added = await this.addToCart();
    if (!added) {
      return;
    }

    const created = await this.orderService.placeOrder('OnlineDelivery');
    await this.orderService.loadMyOrders();
    this.showToast(`Đặt hàng thành công! Mã đơn: ${created.orderCode}`);
    await this.router.navigate(['/tai-khoan'], { queryParams: { tab: 'orders' } });
  }

  async quickAdd(product: ProductItem, event: MouseEvent): Promise<void> {
    event.stopPropagation();
    const user = await this.authService.ensureLoaded();
    if (!user) {
      await this.router.navigate(['/auth'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const menu = await this.orderService.getMenu();
    const prodId = Number(product.id);
    const prodVariants = menu.variants.filter((v) => v.productId === prodId);
    const targetVar = prodVariants.find((v) => v.isDefault) ?? prodVariants[0];

    if (!targetVar) {
      const localItem: CartItem = {
        product,
        size: 'S',
        quantity: 1,
        unitPrice: product.price,
        totalPrice: product.price,
      };
      this.cartService.addItem(localItem);
      this.showToast(`Đã thêm ${product.name} vào giỏ hàng!`);
      return;
    }

    await this.orderService.addToCart(targetVar.variantId, 1);
    await this.orderService.loadCart();
    this.showToast(`Đã thêm ${product.name} vào giỏ hàng!`);
  }

  openProductDetail(productId: string): void {
    void this.router.navigate(['/san-pham', productId]);
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