import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import { WidgetHeader } from '../../widgets/widget_header/header';
import {
  WidgetHomeSidebar,
  DEFAULT_CATEGORY_TREE,
} from '../../widgets/widget_home_sidebar/sidebar';
import { WidgetHomeHero, HeroSlideItem } from '../../widgets/widget_home_hero/hero';
import { WidgetHomeVouchers } from '../../widgets/widget_home_vouchers/vouchers';
import { WidgetHomeShelf } from '../../widgets/widget_home_shelf/shelf';
import { WidgetProductModal, CustomizedItem } from '../../widgets/widget_product_modal/modal';
import { WidgetHomePairing, PairingComboSelection } from '../../widgets/widget_home_pairing/pairing';
import { CustomerOrderService } from '../../services/customer_order_service';
import { CustomerAuthService } from '../../services/customer_auth_service';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  badge?: 'BÁN CHẠY!' | 'THỬ NGAY!' | 'MỚI' | 'GIÁ MỚI' | '-50%' | string;
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
  children?: Category[];
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
    WidgetLandingFooter,
    WidgetHeader,
    WidgetHomeSidebar,
    WidgetHomeHero,
    WidgetHomeVouchers,
    WidgetHomeShelf,
    WidgetProductModal,
    WidgetHomePairing
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHome {
  private readonly router = inject(Router);
  private readonly orderService = inject(CustomerOrderService);
  private readonly authService = inject(CustomerAuthService);

  readonly isSidebarOpen = signal<boolean>(true);
  readonly currentSlide = signal<number>(0);

  readonly selectedProduct = signal<Product | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly categories: Category[] = DEFAULT_CATEGORY_TREE;

  readonly vouchers = signal<Voucher[]>([
    { code: 'BIGORDER20%', discount: 'GIẢM 20%', condition: 'Giảm 20% cho hóa đơn từ 8 triệu' },
    { code: 'BIGORDER15%', discount: 'GIẢM 15%', condition: 'Giảm 15% cho hóa đơn từ 5 triệu' },
    { code: 'BIGORDER10%', discount: 'GIẢM 10%', condition: 'Giảm 10% cho hóa đơn từ 2.5 triệu' },
    { code: 'BIGORDER5%', discount: 'GIẢM 5%', condition: 'Giảm 5% cho hóa đơn từ 1 triệu' },
  ]);

  readonly phinProducts: Product[] = [
    { id: 'p1', name: 'Phin Sữa Đá', brand: 'CÀ PHÊ FIIN', price: 29000, image: '/assets/images/hero/slide-01-desktop.webp', badge: 'BÁN CHẠY!', category: 'ca-phe' },
    { id: 'p2', name: 'Phin Đen Đá', brand: 'CÀ PHÊ FIIN', price: 29000, image: '/assets/images/hero/slide-02-desktop.webp', badge: 'BÁN CHẠY!', category: 'ca-phe' },
    { id: 'p3', name: 'Bạc Xỉu Đá', brand: 'CÀ PHÊ FIIN', price: 29000, image: '/assets/images/hero/slide-03-desktop.webp', badge: 'THỬ NGAY!', category: 'ca-phe' },
    { id: 'p4', name: 'Phin Sữa Nóng', brand: 'CÀ PHÊ FIIN', price: 29000, image: '/assets/images/hero/slide-01-desktop.webp', category: 'ca-phe' },
    { id: 'p5', name: 'Phin Đen Nóng', brand: 'CÀ PHÊ FIIN', price: 29000, image: '/assets/images/hero/slide-02-desktop.webp', category: 'ca-phe' },
  ];

  readonly memoryBanner = {
    badge: 'Mới',
    sub: 'BÁNH MÌ QUE',
    title: 'CHẤM',
    desc: 'SỮA ĐẶC, PHIN SỮA NÓNG, BẠC XỈU NÓNG',
    image: '/assets/images/newsletter/fiin-newsletter.png',
  };

  readonly pastryProducts: Product[] = [
    { id: 'm1', name: 'Bánh Mì Que Chấm Sữa', brand: 'HIGHLANDS COFFEE', price: 14000, image: '/assets/images/newsletter/fiin-newsletter.png', badge: 'MỚI', category: 'banh-mi-que' },
    { id: 'm2', name: 'Bánh Mì Que Pate Truyền Thống', brand: 'HIGHLANDS COFFEE', price: 19000, image: '/assets/images/hero/slide-03-desktop.webp', badge: 'BÁN CHẠY!', category: 'banh-mi-que' },
  ];

  readonly heroSlides: HeroSlideItem[] = [
    { title: 'MỘT CHẤT PHIN TỪ 1999', subtitle: 'PHIN SỮA ĐÁ', desc: 'Hương vị cà phê đậm đà kết hợp cùng sữa đặc béo ngậy truyền thống.', image: '/assets/images/hero/slide-01-desktop.webp' },
    { title: 'HƯƠNG VỊ VỢT XƯA', subtitle: 'BẠC XỈU BA TẦNG', desc: 'Nét tinh tế giao thoa giữa văn hoá cà phê Sài Gòn và phong cách hiện đại.', image: '/assets/images/hero/slide-02-desktop.webp', link: '/uu-dai' },
    { title: 'ĐẬM ĐÀ NGUYÊN BẢN', subtitle: 'PHIN ĐEN ĐÁ', desc: 'Nguyên chất vị đắng mộc mạc của hạt Robusta & Arabica chọn lọc.', image: '/assets/images/hero/slide-03-desktop.webp' },
  ];

  toggleSidebar(): void { this.isSidebarOpen.update((v) => !v); }
  nextSlide(): void { this.currentSlide.update((i) => (i + 1) % this.heroSlides.length); }
  prevSlide(): void { this.currentSlide.update((i) => (i - 1 + this.heroSlides.length) % this.heroSlides.length); }
  goToSlide(index: number): void { this.currentSlide.set(index); }

  onHeroSlideClick(index: number): void {
    const heroProductMap: Record<number, Product> = {
      0: this.phinProducts[0], // Phin Sữa Đá
      1: this.phinProducts[2], // Bạc Xỉu Đá
      2: this.phinProducts[1], // Phin Đen Đá
    };
    const product = heroProductMap[index] ?? this.phinProducts[0];
    this.openProductModal(product);
  }

  copyVoucher(code: string): void {
    navigator.clipboard?.writeText(code);
    this.vouchers.update((list) => list.map((v) => (v.code === code ? { ...v, copied: true } : v)));
    this.triggerToast(`Đã sao chép mã: ${code}`);
    setTimeout(() => {
      this.vouchers.update((list) => list.map((v) => (v.code === code ? { ...v, copied: false } : v)));
    }, 2500);
  }

  openProductModal(product: Product): void {
    this.router.navigate(['/san-pham', product.id]);
  }
  closeProductModal(): void { this.selectedProduct.set(null); }

  onProductCustomized(item: CustomizedItem): void {
    this.closeProductModal();
    this.router.navigate(['/san-pham', item.product.id]);
  }

  scrollToTop(): void { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  private triggerToast(msg: string): void {
    this.toastMessage.set(msg);
    setTimeout(() => this.toastMessage.set(null), 2800);
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'đ';
  }

  onPairingComboAdded(combo: PairingComboSelection): void {
    this.router.navigate(['/san-pham']);
    this.triggerToast(`Combo ${combo.food.name} + ${combo.drink.name} có sẵn trên Thực đơn!`);
  }
}