import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideAward,
  LucideCheck,
  LucideChevronDown,
  LucideChevronUp,
  LucideClock,
  LucideCopy,
  LucideCreditCard,
  LucideGift,
  LucidePhone,
  LucideSparkles,
  LucideStar,
} from '@lucide/angular';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';

export interface MemberTier {
  id: string;
  name: string;
  tagline: string;
  spendRequirement: string;
  earnRate: string;
  badgeLabel: string;
  isFeatured: boolean;
  benefits: string[];
}

export interface LoyaltyVoucher {
  id: string;
  code: string;
  discountDisplay: string;
  title: string;
  condition: string;
  expiry: string;
  category: 'all' | 'discount' | 'shipping' | 'special';
  stampText: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-page-membership',
  imports: [
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    LucideAward,
    LucideGift,
    LucideStar,
    LucideSparkles,
    LucideCopy,
    LucideCheck,
    LucideChevronDown,
    LucideChevronUp,
    LucideCreditCard,
    LucideArrowRight,
    LucideClock,
    LucidePhone,
  ],
  templateUrl: './membership.html',
  styleUrl: './membership.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageMembership {
  readonly activeCategory = signal<'all' | 'discount' | 'shipping' | 'special'>('all');
  readonly copiedCode = signal<string | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly tiers: MemberTier[] = [
    {
      id: 'dong-dieu',
      name: 'Đồng Điệu',
      tagline: 'Khởi đầu mối duyên ngộ cà phê',
      spendRequirement: 'Đăng ký mới (0đ)',
      earnRate: '3%',
      badgeLabel: 'HẠNG KHỞI ĐIỂM',
      isFeatured: false,
      benefits: [
        'Tích 3% giá trị đơn hàng thành Hạt Cà Phê.',
        'Tặng ngay voucher giảm 20% cho đơn hàng đầu tiên.',
        'Đồng bộ điểm thưởng tức thì khi mua online và tại quầy.',
      ],
    },
    {
      id: 'tri-ky',
      name: 'Tri Kỷ',
      tagline: 'Gắn kết hương vị quen thuộc',
      spendRequirement: 'Chi tiêu từ 500.000đ / năm',
      earnRate: '5%',
      badgeLabel: 'HẠNG BẠN THÂN',
      isFeatured: false,
      benefits: [
        'Tích 5% giá trị đơn hàng thành Hạt Cà Phê.',
        'Miễn phí vận chuyển cho mọi đơn hàng từ 99.000đ.',
        'Tặng 01 phần Bánh Mì Que giòn rụm vào tuần sinh nhật.',
      ],
    },
    {
      id: 'co-nhan',
      name: 'Cố Nhân',
      tagline: 'Thấu hiểu từng giọt phin sánh mịn',
      spendRequirement: 'Chi tiêu từ 2.000.000đ / năm',
      earnRate: '8%',
      badgeLabel: 'HẠNG THÂN THIẾT',
      isFeatured: true,
      benefits: [
        'Tích 8% giá trị đơn hàng thành Hạt Cà Phê.',
        'Tặng 01 ly thức uống bất kỳ miễn phí trong tháng sinh nhật.',
        'Ưu tiên chế biến tại quầy vào khung giờ cao điểm.',
        'Nhận voucher độc quyền định kỳ mỗi tháng.',
      ],
    },
    {
      id: 'tam-giao',
      name: 'Tâm Giao',
      tagline: 'Tri âm tri kỷ — Đỉnh cao đặc quyền',
      spendRequirement: 'Chi tiêu từ 5.000.000đ / năm',
      earnRate: '10%',
      badgeLabel: 'HẠNG ĐẶC BIỆT',
      isFeatured: false,
      benefits: [
        'Tích 10% giá trị mọi đơn hàng (online lẫn offline).',
        'Chiết khấu trực tiếp 10% cho toàn bộ đơn hàng tại quầy.',
        'Thư mời thưởng thức miễn phí các dòng hạt cà phê mùa vụ mới.',
        'Quà tặng lưu niệm bình giữ nhiệt Cà Phê Fiin cuối năm.',
      ],
    },
  ];

  readonly vouchers: LoyaltyVoucher[] = [
    {
      id: 'v1',
      code: 'FIINWELCOME20',
      discountDisplay: 'GIẢM 20%',
      title: 'Voucher Chào Mừng Bạn Mới',
      condition: 'Áp dụng cho đơn hàng đầu tiên từ 60.000đ',
      expiry: 'Hạn dùng: 30 ngày kể từ ngày kích hoạt',
      category: 'discount',
      stampText: 'BẠN MỚI',
    },
    {
      id: 'v2',
      code: 'FREESHIP99K',
      discountDisplay: 'FREESHIP',
      title: 'Miễn Phí Giao Hàng Tận Tay',
      condition: 'Đơn từ 99.000đ, tối đa 5km',
      expiry: 'Áp dụng cả tuần (06:30 – 22:30)',
      category: 'shipping',
      stampText: 'GIAO TẬN NƠI',
    },
    {
      id: 'v3',
      code: 'PHINXUA15K',
      discountDisplay: 'GIẢM 15K',
      title: 'Ưu Đãi Cà Phê Buổi Sáng',
      condition: 'Áp dụng cho dòng Cà Phê Phin truyền thống từ 45.000đ',
      expiry: 'Khung giờ: 06:30 – 10:30 hàng ngày',
      category: 'discount',
      stampText: 'ĐIỂM TÂM',
    },
    {
      id: 'v4',
      code: 'COMBO2TANG1',
      discountDisplay: 'MUA 2 TẶNG 1',
      title: 'Hẹn Hò Bạn Bè — Mua 2 Tặng 1',
      condition: 'Tặng 01 Bạc Xỉu Đá khi mua từ 2 món nước bất kỳ',
      expiry: 'Áp dụng từ Thứ 2 đến Thứ 6',
      category: 'special',
      stampText: 'TRI KỶ',
    },
    {
      id: 'v5',
      code: 'BANHQUEFREE',
      discountDisplay: 'TẶNG BÁNH',
      title: 'Thưởng Thức Vị Ký Ức',
      condition: 'Tặng 01 Bánh Mì Que Chấm Sữa cho hóa đơn từ 80.000đ',
      expiry: 'Hạn dùng đến hết 31/12/2026',
      category: 'special',
      stampText: 'KÝ ỨC',
    },
    {
      id: 'v6',
      code: 'VIPDISCOUNT10',
      discountDisplay: 'GIẢM 10%',
      title: 'Đặc Quyền Hội Viên Cố Nhân & Tâm Giao',
      condition: 'Không giới hạn giá trị đơn hàng tối thiểu',
      expiry: 'Dành riêng hội viên thân thiết',
      category: 'discount',
      stampText: 'HỘI VIÊN',
    },
  ];

  readonly faqs = signal<FaqItem[]>([
    {
      id: 'faq-1',
      question: 'Làm thế nào để đăng ký trở thành Hội viên Cà Phê Fiin?',
      answer:
        'Quý Khách chỉ cần cung cấp Số Điện Thoại khi đặt hàng trực tuyến trên website, hoặc đọc SĐT cho thu ngân khi mua trực tiếp tại quầy. Hệ thống sẽ tự động kích hoạt tài khoản hạng Đồng Điệu ngay lập tức mà không cần thủ tục phức tạp.',
      isOpen: true,
    },
    {
      id: 'faq-2',
      question: 'Hạt Cà Phê tích lũy được tính như thế nào và có hạn dùng không?',
      answer:
        'Cứ mỗi 1.000đ chi tiêu thực tế (sau giảm giá), Quý Khách sẽ nhận được số lượng Hạt Cà Phê tương ứng theo tỷ lệ hạng thẻ (3% - 10%). Hạt Cà Phê có giá trị sử dụng trong suốt năm dương lịch và được tổng kết vào ngày 31/12 hàng năm.',
      isOpen: false,
    },
    {
      id: 'faq-3',
      question: 'Tôi có thể dùng Hạt Cà Phê để làm gì?',
      answer:
        'Quý Khách có thể dùng Hạt Cà Phê để trừ trực tiếp vào hóa đơn thanh toán cho các lần mua tiếp theo (quy đổi 100 Hạt = 1.000đ), hoặc tích lũy để đổi các phần quà lưu niệm mang dấu ấn Cà Phê Fiin như Phin Nhôm truyền thống, Ly Sứ cổ điển hoặc Bình Giữ Nhiệt.',
      isOpen: false,
    },
    {
      id: 'faq-4',
      question: 'Mua hàng tại quầy và mua online có được cộng dồn điểm tích lũy không?',
      answer:
        'Hoàn toàn có! Hệ thống bán hàng tại quầy (máy POS) và hệ thống đặt hàng online của Cà Phê Fiin được kết nối đồng bộ theo thời gian thực (Real-time). Khi Quý Khách đọc SĐT hoặc đưa mã QR hội viên, toàn bộ lịch sử chi tiêu và điểm hạt sẽ được cập nhật đồng nhất.',
      isOpen: false,
    },
    {
      id: 'faq-5',
      question: 'Làm sao để tôi thăng hạng thành viên lên Tri Kỷ, Cố Nhân và Tâm Giao?',
      answer:
        'Hệ thống tự động cộng dồn doanh số chi tiêu của Quý Khách trong vòng 12 tháng. Khi tổng chi tiêu đạt các mốc 500.000đ, 2.000.000đ và 5.000.000đ, tài khoản sẽ tự động thăng hạng tương ứng và mở khóa toàn bộ đặc quyền mới ngay trong đơn hàng kế tiếp.',
      isOpen: false,
    },
  ]);

  readonly filteredVouchers = computed(() => {
    const cat = this.activeCategory();
    if (cat === 'all') {
      return this.vouchers;
    }
    return this.vouchers.filter((v) => v.category === cat);
  });

  constructor(private readonly router: Router) {}

  selectCategory(cat: 'all' | 'discount' | 'shipping' | 'special'): void {
    this.activeCategory.set(cat);
  }

  toggleFaq(id: string): void {
    this.faqs.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, isOpen: !item.isOpen } : item
      )
    );
  }

  copyVoucherCode(code: string): void {
    navigator.clipboard?.writeText(code).then(() => {
      this.copiedCode.set(code);
      this.toastMessage.set(`Đã sao chép mã ${code} vào bộ nhớ tạm!`);
      setTimeout(() => {
        this.copiedCode.set(null);
        this.toastMessage.set(null);
      }, 2500);
    });
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }
}

