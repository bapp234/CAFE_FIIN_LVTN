import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideChevronUp,
  LucidePhone,
  LucideShoppingCart,
  LucideX,
} from '@lucide/angular';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetHomeSidebar } from '../../widgets/widget_home_sidebar/sidebar';
import { WidgetHomeHero, HeroSlideItem } from '../../widgets/widget_home_hero/hero';
import { WidgetHomeVouchers } from '../../widgets/widget_home_vouchers/vouchers';
import { WidgetHomeShelf } from '../../widgets/widget_home_shelf/shelf';
import { WidgetProductModal, CustomizedItem } from '../../widgets/widget_product_modal/modal';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  badge?: 'BÁN CHẠY!' | 'THỬ NGAY!' | 'MỚI';
  category: string;
}

export interface Voucher {
  code: string;
  discount: string;
  condition: string;
  copied?: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface CartItem {
  product: Product;
  size: 'S' | 'M' | 'L';
  sugar: string;
  ice: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Component({
  selector: 'app-page-home',
  imports: [
    CommonModule,
    LucideChevronUp,
    LucidePhone,
    LucideShoppingCart,
    LucideX,
    WidgetLandingFooter,
    WidgetHeader,
    WidgetHomeSidebar,
    WidgetHomeHero,
    WidgetHomeVouchers,
    WidgetHomeShelf,
    WidgetProductModal,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHome {
  readonly isSidebarOpen = signal<boolean>(true);
  readonly currentSlide = signal<number>(0);

  readonly cart = signal<CartItem[]>([]);
  readonly isCartOpen = signal<boolean>(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly cartCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0)
  );
  readonly cartTotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.totalPrice, 0)
  );

  readonly categories: Category[] = [
    { id: 'ca-phe', name: 'Cà Phê', icon: '☕' },
    { id: 'tra', name: 'Trà', icon: '🍵' },
    { id: 'freeze', name: 'Freeze', icon: '🍧' },
    { id: 'phindi', name: 'PhinDi', icon: '☕' },
    { id: 'banh-mi-que', name: 'Bánh Mì Que', icon: '🥖' },
    { id: 'banh-ngot', name: 'Bánh Ngọt', icon: '🍰' },
    { id: 'thuc-uong-khac', name: 'Thức Uống Khác', icon: '🧃' },
    { id: 'matchadi', name: 'MatchaDi', icon: '🍵' },
    { id: 'binh-giu-nhiet', name: 'Bình Giữ Nhiệt', icon: '🍶' },
    { id: 'ca-phe-dong-goi', name: 'Cà Phê Đóng Gói', icon: '📦' },
  ];

  readonly vouchers = signal<Voucher[]>([
    { code: 'BIGORDER20%', discount: 'GIẢM 20%', condition: 'Giảm 20% cho hóa đơn từ 8 triệu' },
    { code: 'BIGORDER15%', discount: 'GIẢM 15%', condition: 'Giảm 15% cho hóa đơn từ 5 triệu' },
    { code: 'BIGORDER10%', discount: 'GIẢM 10%', condition: 'Giảm 10% cho hóa đơn từ 2.5 triệu' },
    { code: 'BIGORDER5%', discount: 'GIẢM 5%', condition: 'Giảm 5% cho hóa đơn từ 1 triệu' },
  ]);

  readonly phinProducts: Product[] = [
    { id: 'p1', name: 'Phin Sữa Đá', brand: 'HIGHLANDS COFFEE', price: 29000, image: '/assets/images/hero/slide-01-desktop.webp', badge: 'BÁN CHẠY!', category: 'ca-phe' },
    { id: 'p2', name: 'Phin Đen Đá', brand: 'HIGHLANDS COFFEE', price: 29000, image: '/assets/images/hero/slide-02-desktop.webp', badge: 'BÁN CHẠY!', category: 'ca-phe' },
    { id: 'p3', name: 'Bạc Xỉu Đá', brand: 'HIGHLANDS COFFEE', price: 29000, image: '/assets/images/hero/slide-03-desktop.webp', badge: 'THỬ NGAY!', category: 'ca-phe' },
    { id: 'p4', name: 'Phin Sữa Nóng', brand: 'HIGHLANDS COFFEE', price: 29000, image: '/assets/images/hero/slide-01-desktop.webp', category: 'ca-phe' },
    { id: 'p5', name: 'Phin Đen Nóng', brand: 'HIGHLANDS COFFEE', price: 29000, image: '/assets/images/hero/slide-02-desktop.webp', category: 'ca-phe' },
  ];

  readonly memoryBanner = {
    badge: 'Mới',
    sub: 'BÁNH MÌ QUE',
    title: 'CHẤM',
    desc: 'SỮA ĐẶC, PHIN SỮA NÓNG, BẠC XỈU NÓNG',
    image: '/assets/images/newsletter/fiin-newsletter.png',
  };

  readonly memoryProducts: Product[] = [
    { id: 'm1', name: 'Bánh Mì Que Chấm Sữa', brand: 'HIGHLANDS COFFEE', price: 14000, image: '/assets/images/newsletter/fiin-newsletter.png', badge: 'MỚI', category: 'banh-mi-que' },
    { id: 'm2', name: 'Bánh Mì Que Chấm Cà Phê', brand: 'HIGHLANDS COFFEE', price: 38000, image: '/assets/images/hero/slide-03-desktop.webp', category: 'banh-mi-que' },
  ];

  readonly heroSlides: HeroSlideItem[] = [
    { title: 'MỘT CHẤT PHIN TỪ 1999', subtitle: 'PHIN SỮA ĐÁ', desc: 'Hương vị cà phê đậm đà kết hợp cùng sữa đặc béo ngậy truyền thống.', image: '/assets/images/hero/slide-01-desktop.webp' },
    { title: 'HƯƠNG VỊ VỢT XƯA', subtitle: 'BẠC XỈU BA TẦNG', desc: 'Nét tinh tế giao thoa giữa văn hoá cà phê Sài Gòn và phong cách hiện đại.', image: '/assets/images/hero/slide-02-desktop.webp' },
  ];

  toggleSidebar(): void { this.isSidebarOpen.update((v) => !v); }
  nextSlide(): void { this.currentSlide.update((i) => (i + 1) % this.heroSlides.length); }
  prevSlide(): void { this.currentSlide.update((i) => (i - 1 + this.heroSlides.length) % this.heroSlides.length); }

  copyVoucher(code: string): void {
    navigator.clipboard?.writeText(code);
    this.vouchers.update((list) => list.map((v) => (v.code === code ? { ...v, copied: true } : v)));
    this.triggerToast(`Đã sao chép mã: ${code}`);
    setTimeout(() => {
      this.vouchers.update((list) => list.map((v) => (v.code === code ? { ...v, copied: false } : v)));
    }, 2500);
  }

  openProductModal(product: Product): void { this.selectedProduct.set(product); }
  closeProductModal(): void { this.selectedProduct.set(null); }

  onProductCustomized(item: CustomizedItem): void {
    this.cart.update((current) => [...current, item]);
    this.closeProductModal();
    this.triggerToast(`Đã thêm "${item.product.name}" vào giỏ hàng!`);
  }

  toggleCart(): void { this.isCartOpen.update((v) => !v); }
  removeFromCart(index: number): void {
    this.cart.update((list) => list.filter((_, i) => i !== index));
    this.triggerToast('Đã xóa món khỏi giỏ hàng.');
  }

  scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  private triggerToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 2800);
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'đ';
  }
}