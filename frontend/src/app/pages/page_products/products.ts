import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  effect,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideCakeSlice,
  LucideCheck,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronUp,
  LucideCoffee,
  LucideCroissant,
  LucideCupSoda,
  LucideFlame,
  LucideLayoutGrid,
  LucideLeaf,
  LucidePhone,
  LucidePlus,
  LucideRotateCcw,
  LucideShoppingBag,
  LucideSlidersHorizontal,
  LucideSnowflake,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import gsap from 'gsap';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import {
  WidgetProductModal,
  CustomizedItem,
  ToppingOption,
} from '../../widgets/widget_product_modal/modal';

export interface ProductItem {
  id: string;
  name: string;
  brand: string;
  price: number;
  image: string;
  badge?: 'BÁN CHẠY!' | 'THỬ NGAY!' | 'MỚI';
  category: string;
  servingType: 'ice' | 'hot' | 'both';
  description: string;
}

export type CategoryIconKey =
  | 'all'
  | 'coffee'
  | 'leaf'
  | 'sparkles'
  | 'snowflake'
  | 'croissant'
  | 'cake'
  | 'cup';

export interface CategoryItem {
  id: string;
  name: string;
  iconKey: CategoryIconKey;
}

export interface CartItem {
  product: ProductItem;
  size: 'S' | 'M' | 'L';
  sugar: string;
  ice: string;
  toppings?: ToppingOption[];
  note?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

@Component({
  selector: 'app-page-products',
  imports: [
    CommonModule,
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    WidgetProductModal,
    LucideSlidersHorizontal,
    LucidePlus,
    LucideX,
    LucideChevronDown,
    LucideChevronUp,
    LucideChevronLeft,
    LucideChevronRight,
    LucidePhone,
    LucideShoppingBag,
    LucideCheck,
    LucideRotateCcw,
    LucideFlame,
    LucideSparkles,
    LucideCoffee,
    LucideLeaf,
    LucideSnowflake,
    LucideCroissant,
    LucideCakeSlice,
    LucideCupSoda,
    LucideLayoutGrid,
  ],
  templateUrl: './products.html',
  styleUrl: './products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageProducts implements AfterViewInit, OnDestroy {
  readonly pageWrapperRef = viewChild.required<ElementRef<HTMLElement>>('pageWrapper');
  readonly gridContainerRef = viewChild<ElementRef<HTMLElement>>('productsGrid');
  readonly categoryTrackRef = viewChild.required<ElementRef<HTMLElement>>('categoryTrack');

  // Filter Signals
  readonly selectedCategory = signal<string>('all');
  readonly selectedPriceRange = signal<'all' | 'under30' | 'from30to45' | 'over45'>('all');
  readonly selectedServing = signal<'all' | 'ice' | 'hot' | 'banchay' | 'moi'>('all');
  readonly selectedSort = signal<'featured' | 'price-asc' | 'price-desc' | 'name-asc'>('featured');

  // UI & Cart Signals
  readonly cart = signal<CartItem[]>([]);
  readonly isCartOpen = signal<boolean>(false);
  readonly selectedProductForModal = signal<ProductItem | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly cartCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.quantity, 0)
  );

  readonly cartTotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.totalPrice, 0)
  );

  readonly categories: CategoryItem[] = [
    { id: 'all', name: 'Tất Cả Thực Đơn', iconKey: 'all' },
    { id: 'ca-phe', name: 'Cà Phê Phin', iconKey: 'coffee' },
    { id: 'tra', name: 'Trà & Trái Cây', iconKey: 'leaf' },
    { id: 'phindi', name: 'PhinDi', iconKey: 'sparkles' },
    { id: 'freeze', name: 'Freeze Đá Xay', iconKey: 'snowflake' },
    { id: 'banh-mi-que', name: 'Bánh Mì Que', iconKey: 'croissant' },
    { id: 'banh-ngot', name: 'Bánh Ngọt', iconKey: 'cake' },
    { id: 'luu-niem', name: 'Quà Lưu Niệm', iconKey: 'cup' },
  ];

  readonly priceOptions: Array<{ id: 'all' | 'under30' | 'from30to45' | 'over45'; label: string }> = [
    { id: 'all', label: 'Tất cả giá' },
    { id: 'under30', label: 'Dưới 30K' },
    { id: 'from30to45', label: '30K – 45K' },
    { id: 'over45', label: 'Trên 45K' },
  ];

  readonly servingOptions: Array<{
    id: 'all' | 'ice' | 'hot' | 'banchay' | 'moi';
    label: string;
    iconType?: 'ice' | 'hot' | 'hot-badge' | 'new-badge';
  }> = [
      { id: 'all', label: 'Mọi đặc tính' },
      { id: 'ice', label: 'Đá lạnh', iconType: 'ice' },
      { id: 'hot', label: 'Nóng ấm', iconType: 'hot' },
      { id: 'banchay', label: 'Bán chạy', iconType: 'hot-badge' },
      { id: 'moi', label: 'Món mới', iconType: 'new-badge' },
    ];

  readonly allProducts: ProductItem[] = [
    {
      id: 'p1',
      name: 'Phin Sữa Đá',
      brand: 'CÀ PHÊ FIIN',
      price: 29000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      badge: 'BÁN CHẠY!',
      category: 'ca-phe',
      servingType: 'ice',
      description: 'Cà phê phin truyền thống hòa quyện cùng sữa đặc béo ngọt sánh đậm.',
    },
    {
      id: 'p2',
      name: 'Phin Đen Đá',
      brand: 'CÀ PHÊ FIIN',
      price: 29000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      badge: 'BÁN CHẠY!',
      category: 'ca-phe',
      servingType: 'ice',
      description: 'Nguyên chất vị đắng mộc mạc của hạt Robusta & Arabica chọn lọc.',
    },
    {
      id: 'p3',
      name: 'Bạc Xỉu Đá Ba Tầng',
      brand: 'CÀ PHÊ FIIN',
      price: 29000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      badge: 'THỬ NGAY!',
      category: 'ca-phe',
      servingType: 'ice',
      description: 'Nét tinh tế giao thoa giữa sữa tươi béo thơm và chút nốt đắng cà phê.',
    },
    {
      id: 'p4',
      name: 'Phin Sữa Nóng',
      brand: 'CÀ PHÊ FIIN',
      price: 29000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      category: 'ca-phe',
      servingType: 'hot',
      description: 'Ấm lòng buổi sớm mai Sài Gòn với ly phin sữa nóng hổi thơm nồng.',
    },
    {
      id: 'p5',
      name: 'Phin Đen Nóng',
      brand: 'CÀ PHÊ FIIN',
      price: 29000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      category: 'ca-phe',
      servingType: 'hot',
      description: 'Từng giọt cà phê đen nóng đậm đà, giữ trọn hương vị nguyên bản.',
    },
    {
      id: 'p6',
      name: 'Cà Phê Trứng Béo Ngậy',
      brand: 'CÀ PHÊ FIIN',
      price: 39000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      badge: 'MỚI',
      category: 'ca-phe',
      servingType: 'hot',
      description: 'Lớp kem trứng đánh bông mịn màng hòa quyện dòng cà phê phin nóng.',
    },
    {
      id: 't1',
      name: 'Trà Sen Vàng Hạt Sen',
      brand: 'CÀ PHÊ FIIN',
      price: 45000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      badge: 'BÁN CHẠY!',
      category: 'tra',
      servingType: 'both',
      description: 'Trà ô long thơm ngát kết hợp hạt sen bùi béo và củ năng giòn ngọt.',
    },
    {
      id: 't2',
      name: 'Trà Thạch Đào Mát Lạnh',
      brand: 'CÀ PHÊ FIIN',
      price: 45000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      category: 'tra',
      servingType: 'ice',
      description: 'Vị trà thanh mát hòa cùng miếng đào ngâm giòn ngọt và thạch đào dẻo dai.',
    },
    {
      id: 't3',
      name: 'Trà Thanh Đào Hương Nhài',
      brand: 'CÀ PHÊ FIIN',
      price: 42000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      category: 'tra',
      servingType: 'ice',
      description: 'Hương hoa nhài thoang thoảng cùng vị đào thanh khiết giải nhiệt tức thì.',
    },
    {
      id: 'pd1',
      name: 'PhinDi Hạnh Nhân',
      brand: 'CÀ PHÊ FIIN',
      price: 45000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      badge: 'BÁN CHẠY!',
      category: 'phindi',
      servingType: 'ice',
      description: 'Cà phê phin thế hệ mới kết hợp sốt hạnh nhân thơm bùi hấp dẫn.',
    },
    {
      id: 'pd2',
      name: 'PhinDi Kem Sữa',
      brand: 'CÀ PHÊ FIIN',
      price: 45000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      category: 'phindi',
      servingType: 'ice',
      description: 'Lớp kem sữa béo ngậy phủ trên nền cà phê phin đậm đà thơm ngát.',
    },
    {
      id: 'pd3',
      name: 'PhinDi Choco Đậm Vị',
      brand: 'CÀ PHÊ FIIN',
      price: 45000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      category: 'phindi',
      servingType: 'ice',
      description: 'Sự hòa quyện tuyệt hảo giữa cacao nguyên chất và cà phê phin.',
    },
    {
      id: 'fz1',
      name: 'Freeze Cà Phê Phin Béo',
      brand: 'CÀ PHÊ FIIN',
      price: 49000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      badge: 'THỬ NGAY!',
      category: 'freeze',
      servingType: 'ice',
      description: 'Đá xay mát lạnh từ cốt cà phê phin đậm đà cùng thạch cà phê dai giòn.',
    },
    {
      id: 'fz2',
      name: 'Freeze Trà Xanh Kem Bông',
      brand: 'CÀ PHÊ FIIN',
      price: 49000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      category: 'freeze',
      servingType: 'ice',
      description: 'Matcha Nhật Bản xay nhuyễn mát lạnh phủ lớp kem tươi bồng bềnh.',
    },
    {
      id: 'm1',
      name: 'Bánh Mì Que Chấm Sữa',
      brand: 'CÀ PHÊ FIIN',
      price: 14000,
      image: '/assets/images/newsletter/fiin-newsletter.png',
      badge: 'MỚI',
      category: 'banh-mi-que',
      servingType: 'both',
      description: 'Vỏ bánh mì que nướng giòn rụm chấm cùng sữa đặc béo ngậy tuổi thơ.',
    },
    {
      id: 'm2',
      name: 'Bánh Mì Que Chấm Cà Phê',
      brand: 'CÀ PHÊ FIIN',
      price: 38000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      category: 'banh-mi-que',
      servingType: 'both',
      description: 'Combo bánh mì que giòn nóng chấm cùng ly cà phê phin đậm nốt xưa.',
    },
    {
      id: 'm3',
      name: 'Bánh Mì Que Pate Cay Hải Phòng',
      brand: 'CÀ PHÊ FIIN',
      price: 19000,
      image: '/assets/images/newsletter/fiin-newsletter.png',
      badge: 'BÁN CHẠY!',
      category: 'banh-mi-que',
      servingType: 'both',
      description: 'Nhân pate gan béo ngậy thơm nức mũi cùng tương ớt cay nồng đậm vị.',
    },
    {
      id: 'b1',
      name: 'Bánh Mousse Cacao Đậm Vị',
      brand: 'CÀ PHÊ FIIN',
      price: 35000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      category: 'banh-ngot',
      servingType: 'both',
      description: 'Mousse cacao mềm mịn tan ngay trên đầu lưỡi, độ ngọt vừa phải.',
    },
    {
      id: 'b2',
      name: 'Bánh Phô Mai Chanh Dây',
      brand: 'CÀ PHÊ FIIN',
      price: 35000,
      image: '/assets/images/hero/slide-02-desktop.webp',
      category: 'banh-ngot',
      servingType: 'both',
      description: 'Vị chua thanh mát của chanh dây hòa quyện lớp phô mai béo ngậy.',
    },
    {
      id: 'ln1',
      name: 'Phin Nhôm Cà Phê Fiin Xưa',
      brand: 'CÀ PHÊ FIIN',
      price: 55000,
      image: '/assets/images/hero/slide-03-desktop.webp',
      badge: 'MỚI',
      category: 'luu-niem',
      servingType: 'both',
      description: 'Phin nhôm dập hoa văn cổ điển, lỗ thoát li ti cho dòng phin chuẩn vị.',
    },
    {
      id: 'ln2',
      name: 'Bình Giữ Nhiệt Fiin Sài Gòn 500ml',
      brand: 'CÀ PHÊ FIIN',
      price: 185000,
      image: '/assets/images/hero/slide-01-desktop.webp',
      category: 'luu-niem',
      servingType: 'both',
      description: 'Inox 304 giữ nhiệt 12 giờ, thiết kế retro mộc mạc tiện lợi mang theo.',
    },
  ];

  readonly categoryCounts = computed(() => {
    const map: Record<string, number> = { all: this.allProducts.length };
    for (const p of this.allProducts) {
      map[p.category] = (map[p.category] ?? 0) + 1;
    }
    return map;
  });

  readonly filteredProducts = computed(() => {
    let list = [...this.allProducts];
    const cat = this.selectedCategory();
    const price = this.selectedPriceRange();
    const serving = this.selectedServing();
    const sort = this.selectedSort();

    if (cat !== 'all') {
      list = list.filter((p) => p.category === cat);
    }

    if (price === 'under30') {
      list = list.filter((p) => p.price < 30000);
    } else if (price === 'from30to45') {
      list = list.filter((p) => p.price >= 30000 && p.price <= 45000);
    } else if (price === 'over45') {
      list = list.filter((p) => p.price > 45000);
    }

    if (serving === 'ice') {
      list = list.filter((p) => p.servingType === 'ice' || p.servingType === 'both');
    } else if (serving === 'hot') {
      list = list.filter((p) => p.servingType === 'hot' || p.servingType === 'both');
    } else if (serving === 'banchay') {
      list = list.filter((p) => p.badge === 'BÁN CHẠY!');
    } else if (serving === 'moi') {
      list = list.filter((p) => p.badge === 'MỚI' || p.badge === 'THỬ NGAY!');
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

  readonly hasActiveFilters = computed(() => {
    return (
      this.selectedCategory() !== 'all' ||
      this.selectedPriceRange() !== 'all' ||
      this.selectedServing() !== 'all'
    );
  });

  private gsapCtx?: gsap.Context;
  private isFirstRender = true;

  constructor(private readonly router: Router) {
    effect(() => {
      const items = this.filteredProducts();
      if (this.isFirstRender) {
        this.isFirstRender = false;
        return;
      }
      if (items.length > 0) {
        requestAnimationFrame(() => {
          const grid = this.gridContainerRef()?.nativeElement;
          if (!grid) return;
          gsap.fromTo(
            grid.querySelectorAll('.catalog-product-card'),
            { y: 16, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.36,
              stagger: 0.03,
              ease: 'power2.out',
              clearProps: 'transform',
            }
          );
        });
      }
    });
  }

  ngAfterViewInit(): void {
    this.gsapCtx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      tl.from('.gsap-top-reveal', {
        y: 14,
        opacity: 0,
        duration: 0.42,
        stagger: 0.06,
      }).from(
        '.catalog-product-card',
        {
          y: 20,
          opacity: 0,
          duration: 0.45,
          stagger: 0.035,
          clearProps: 'transform',
        },
        '-=0.22'
      );
    }, this.pageWrapperRef().nativeElement);
  }

  ngOnDestroy(): void {
    this.gsapCtx?.revert();
  }

  // Điều khiển cuộn ngang dải danh mục
  scrollCategories(direction: 'left' | 'right'): void {
    const track = this.categoryTrackRef().nativeElement;
    const distance = direction === 'left' ? -280 : 280;
    track.scrollBy({ left: distance, behavior: 'smooth' });
  }

  onCategorySelect(catId: string): void {
    this.selectedCategory.set(catId);
  }

  onPriceSelect(range: 'all' | 'under30' | 'from30to45' | 'over45'): void {
    this.selectedPriceRange.set(range);
  }

  onServingSelect(serving: 'all' | 'ice' | 'hot' | 'banchay' | 'moi'): void {
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

  resetAllFilters(): void {
    this.selectedCategory.set('all');
    this.selectedPriceRange.set('all');
    this.selectedServing.set('all');
    this.selectedSort.set('featured');
  }

  openProductModal(product: ProductItem, event?: MouseEvent): void {
    if (event) {
      const card = (event.currentTarget as HTMLElement).closest('.catalog-product-card') as HTMLElement;
      if (card) {
        gsap.fromTo(
          card,
          { scale: 0.98 },
          {
            scale: 1,
            duration: 0.18,
            ease: 'back.out(2)',
            onComplete: () => this.router.navigate(['/san-pham', product.id]),
          }
        );
        return;
      }
    }
    this.router.navigate(['/san-pham', product.id]);
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
      toppings: item.toppings,
      note: item.note,
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

  getToppingsText(toppings?: ToppingOption[]): string {
    if (!toppings || toppings.length === 0) return '';
    return toppings.map((t) => t.name).join(', ');
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