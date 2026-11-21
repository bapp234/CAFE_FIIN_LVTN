import {
  ChangeDetectionStrategy,
  Component,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideCalendar,
  LucideCheck,
  LucideChevronUp,
  LucideClock,
  LucidePhone,
  LucideShare2,
  LucideX,
} from '@lucide/angular';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';

export interface ArticleItem {
  id: string;
  title: string;
  category: 'van-hoa' | 'pha-che' | 'nong-trai' | 'khuyen-mai';
  categoryLabel: string;
  readTime: string;
  date: string;
  author: string;
  excerpt: string;
  content: string[];
  image: string;
  isFeatured?: boolean;
}

export interface NewsCategory {
  id: string;
  name: string;
  icon: string;
}

@Component({
  selector: 'app-page-news',
  imports: [
    CommonModule,
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    LucideArrowRight,
    LucideCalendar,
    LucideCheck,
    LucideChevronUp,
    LucideClock,
    LucidePhone,
    LucideShare2,
    LucideX,
  ],
  templateUrl: './news.html',
  styleUrl: './news.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageNews {
  readonly selectedCategory = signal<string>('all');
  readonly selectedArticle = signal<ArticleItem | null>(null);
  readonly toastMessage = signal<string | null>(null);

  readonly categories: NewsCategory[] = [
    { id: 'all', name: 'Tất Cả Câu Chuyện', icon: '✦' },
    { id: 'van-hoa', name: 'Văn Hóa Cà Phê Phin', icon: '☕' },
    { id: 'pha-che', name: 'Nghệ Thuật Pha Chế', icon: '🫖' },
    { id: 'nong-trai', name: 'Hạt & Vùng Đất', icon: '🌱' },
    { id: 'khuyen-mai', name: 'Tin Tức & Hoạt Động', icon: '📰' },
  ];

  readonly articles: ArticleItem[] = [
    {
      id: 'bai-1',
      title: 'Một ngày bắt đầu từ hương cà phê phin: Chậm lại để cảm nhận',
      category: 'van-hoa',
      categoryLabel: 'VĂN HÓA CÀ PHÊ',
      readTime: '5 phút đọc',
      date: '07 Tháng 11, 2026',
      author: 'Người Rang Hạt Fiin',
      excerpt:
        'Giữa nhịp sống hối hả của phố thị, tiếng tí tách của giọt cà phê rơi như một nốt trầm lắng đọng giúp ta tìm lại bình yên trong từng hơi thở ban mai.',
      content: [
        'Người Sài Gòn không uống cà phê trong vội vã. Một chiếc phin nhôm truyền thống cần đúng 4 đến 5 phút để nước sôi thẩm thấu qua từng tầng bột cà phê xay mịn, chắt chiu từng giọt sánh nâu đậm đà rơi xuống đáy ly.',
        'Ngồi bên góc bàn gỗ quen thuộc, nhìn dòng người ngược xuôi và ngắm từng giọt cà phê tí tách rơi, dường như mọi âu lo đều nhường chỗ cho sự tĩnh lặng. Hương thơm mộc mạc của Robusta rang củi quyện cùng chút sữa đặc béo ngậy khơi dậy nguồn năng lượng thuần khiết nhất.',
        'Đó không đơn thuần là một thức uống giải khát, mà là nếp sống, là văn hóa kết nối tình người mộc mạc mà Cà Phê Fiin luôn trân trọng gìn giữ qua từng năm tháng.',
      ],
      image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1400&q=85',
      isFeatured: true,
    },
    {
      id: 'bai-2',
      title: 'Hạt cà phê kể chuyện vùng đất: Hành trình từ cao nguyên đỏ',
      category: 'nong-trai',
      categoryLabel: 'HẠT & VÙNG ĐẤT',
      readTime: '4 phút đọc',
      date: '05 Tháng 11, 2026',
      author: 'Bác Nông Dân Cầu Đất',
      excerpt:
        'Mỗi hạt cà phê thu hái chín mọng từ đất đỏ bazan Đắk Lắk và Lâm Đồng mang trong mình linh hồn và thổ nhưỡng của núi rừng đại ngàn.',
      content: [
        'Để tạo nên nốt hương đặc trưng cho từng ly Cà Phê Fiin, chúng tôi chọn lọc thủ công những trái cà phê chín đỏ trên các triền đồi cao nguyên. Phương pháp sơ chế ướt và phơi giàn tự nhiên giữ trọn độ axit thanh khiết và hậu vị ngọt sâu.',
        'Khi được rang ở nhiệt độ chuẩn xác trên lò củi truyền thống, lớp dầu tự nhiên tươm ra bề mặt hạt, tỏa ngát hương sô-cô-la đen và caramel tự nhiên quyến rũ.',
      ],
      image: 'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&w=900&q=85',
    },
    {
      id: 'bai-3',
      title: 'Nghệ thuật của một tách cà phê chậm: Sự kiên nhẫn hóa mỹ vị',
      category: 'pha-che',
      categoryLabel: 'NGHỆ THUẬT PHA CHẾ',
      readTime: '3 phút đọc',
      date: '02 Tháng 11, 2026',
      author: 'Barista Trưởng Fiin',
      excerpt:
        'Chậm lại một nhịp để cảm nhận hương thơm quyến rũ và bí quyết điều chỉnh lượng nước, độ nén phin cho ly cà phê tròn vị.',
      content: [
        'Kỹ thuật ủ bột cà phê là linh hồn của chiếc phin. Tráng nhẹ 20ml nước sôi ở 92°C để bột nở đều trong 30 giây đầu tiên, sau đó mới nhẹ nhàng châm đầy nước và đậy nắp.',
        'Sự kiên nhẫn của người pha chế chính là chiếc cầu nối đưa hương vị nguyên bản từ hạt chạm đến trái tim người thưởng thức.',
      ],
      image: 'https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?auto=format&fit=crop&w=900&q=85',
    },
    {
      id: 'bai-4',
      title: 'Bạc Xỉu ba tầng Chợ Lớn: Nét giao thoa văn hóa độc đáo',
      category: 'van-hoa',
      categoryLabel: 'VĂN HÓA CÀ PHÊ',
      readTime: '4 phút đọc',
      date: '28 Tháng 10, 2026',
      author: 'Ký Sự Phố Hoa',
      excerpt:
        'Ly Bạc Xỉu ba tầng đẹp mắt bắt nguồn từ bà con người Hoa Chợ Lớn, hòa quyện giữa vị ngọt dịu của sữa và chút nốt đắng cà phê.',
      content: [
        'Bạc Tẩy Xỉu Phé — tiếng Quảng Đông có nghĩa là ly sữa nóng thêm chút cà phê cho dậy mùi. Trải qua hàng thập kỷ, ly Bạc Xỉu đã trở thành món nước quốc dân của biết bao thế hệ thanh xuân Sài Gòn.',
        'Tại Cà Phê Fiin, Bạc Xỉu ba tầng được cân bằng tỷ lệ sữa đặc, sữa tươi thanh trùng và lớp cốt phin đánh bọt bồng bềnh, ngọt ngào mà không hề ngấy.',
      ],
      image: '/assets/images/hero/slide-03-desktop.webp',
    },
    {
      id: 'bai-5',
      title: 'Một góc quán nhỏ, nơi những cuộc gặp gỡ tri kỷ bắt đầu',
      category: 'van-hoa',
      categoryLabel: 'VĂN HÓA CÀ PHÊ',
      readTime: '3 phút đọc',
      date: '22 Tháng 10, 2026',
      author: 'Người Kể Chuyện Cũ',
      excerpt:
        'Tiếng quạt trần quay đều, điệu nhạc Trịnh thì thầm và chiếc bàn con bên ô cửa sổ — chốn hẹn bình yên giữa lòng thành phố.',
      content: [
        'Quán cà phê từ lâu đã không chỉ là nơi bán thức uống. Đó là nơi hai người bạn lâu năm tìm lại kỷ niệm thời áo trắng, là nơi người nghệ sĩ chắp bút bản nhạc đầu tay, hay đơn giản là chốn trú chân trốn cơn mưa rào bất chợt.',
      ],
      image: '/assets/images/hero/slide-02-desktop.webp',
    },
    {
      id: 'bai-6',
      title: 'Bánh Mì Que Chấm Sữa: Món điểm tâm đong đầy ký ức tuổi thơ',
      category: 'pha-che',
      categoryLabel: 'ẨM THỰC KÝ ỨC',
      readTime: '3 phút đọc',
      date: '15 Tháng 10, 2026',
      author: 'Bếp Bánh Fiin',
      excerpt:
        'Ổ bánh mì que vỏ nướng giòn rụm, bẻ một mẩu nhỏ chấm ngập vào chén sữa đặc hay ly cà phê phin nóng hổi thơm nức mũi.',
      content: [
        'Không cần cầu kỳ hoa mỹ, ổ bánh mì que chấm sữa nóng luôn gợi nhớ về những buổi sớm được mẹ dắt tay ra đầu ngõ ăn sáng trước giờ đến trường. Một nét mộc mạc sống mãi cùng thời gian.',
      ],
      image: '/assets/images/newsletter/fiin-newsletter.png',
    },
    {
      id: 'bai-7',
      title: 'Khai trương góc quán mới tại Hồ Con Rùa: Tặng 100 ly phin sữa miễn phí',
      category: 'khuyen-mai',
      categoryLabel: 'TIN TỨC & SỰ KIỆN',
      readTime: '2 phút đọc',
      date: '10 Tháng 10, 2026',
      author: 'Ban Truyền Thông Fiin',
      excerpt:
        'Cà Phê Fiin chính thức có mặt tại khu vực Hồ Con Rùa (Quận 3) với nhiều hoạt động giao lưu âm nhạc mộc và quà tặng bất ngờ.',
      content: [
        'Nhân dịp đón chào ngôi nhà mới, Cà Phê Fiin trân trọng gửi tặng 100 ly Phin Sữa Đá cho 100 khách hàng đầu tiên ghé quán, cùng chương trình tích điểm gấp đôi cho thành viên Tâm Giao.',
      ],
      image: '/assets/images/hero/slide-01-desktop.webp',
    },
  ];

  readonly filteredArticles = computed(() => {
    const cat = this.selectedCategory();
    if (cat === 'all') {
      return this.articles;
    }
    return this.articles.filter((a) => a.category === cat);
  });

  readonly featuredArticle = computed(() => {
    return this.articles.find((a) => a.isFeatured) || this.articles[0];
  });

  readonly regularArticles = computed(() => {
    const cat = this.selectedCategory();
    const list = this.filteredArticles();
    if (cat === 'all') {
      return list.filter((a) => !a.isFeatured);
    }
    return list;
  });

  constructor(private readonly router: Router) {}

  selectCategory(catId: string): void {
    this.selectedCategory.set(catId);
  }

  openArticleModal(article: ArticleItem): void {
    this.selectedArticle.set(article);
  }

  closeArticleModal(): void {
    this.selectedArticle.set(null);
  }

  shareArticle(article: ArticleItem): void {
    if (navigator.share) {
      navigator.share({
        title: article.title,
        text: article.excerpt,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.href);
      this.triggerToast('Đã sao chép liên kết bài viết vào bộ nhớ tạm!');
    }
  }

  subscribeNewsletter(email: string): void {
    if (!email || !email.includes('@')) {
      this.triggerToast('Vui lòng nhập địa chỉ thư điện tử (email) hợp lệ.');
      return;
    }
    this.triggerToast(`Cảm ơn bạn! Đã gửi lá thư xác nhận tới ${email}.`);
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
}
