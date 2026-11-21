import {
  ChangeDetectionStrategy,
  Component,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideArrowLeft,
  LucideChevronRight,
  LucideChevronUp,
  LucideClock,
  LucideCreditCard,
  LucideFileText,
  LucideMapPin,
  LucidePhone,
  LucideTruck,
} from '@lucide/angular';
import { WidgetHeader } from '../../widgets/widget_header/header';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';

interface PolicyTocItem {
  id: string;
  title: string;
  icon: string;
}

@Component({
  selector: 'app-page-policy',
  imports: [
    RouterLink,
    WidgetHeader,
    WidgetLandingFooter,
    LucidePhone,
    LucideTruck,
    LucideCreditCard,
    LucideFileText,
    LucideMapPin,
    LucideChevronRight,
    LucideChevronUp,
    LucideArrowLeft,
    LucideAlertTriangle,
    LucideClock,
  ],
  templateUrl: './policy.html',
  styleUrl: './policy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PagePolicy {
  readonly activeSection = signal<string>('pham-vi');

  readonly tocItems: PolicyTocItem[] = [
    { id: 'pham-vi', title: '1. Phạm vi giao hàng & vận chuyển', icon: 'truck' },
    { id: 'hoan-tra', title: '2. Chính sách hoàn trả & hoàn tiền', icon: 'rotate-ccw' },
    { id: 'doi-tra', title: '3. Chính sách đổi trả & đền bù', icon: 'shield-check' },
    { id: 'quy-trinh', title: '4. Quy trình đổi trả 3 bước', icon: 'file-text' },
    { id: 'nguoi-dung', title: '5. Chính sách tài khoản người dùng', icon: 'user' },
    { id: 'thanh-toan', title: '6. Phương thức thanh toán', icon: 'credit-card' },
    { id: 'phi-van-chuyen', title: '7. Chính sách phí vận chuyển', icon: 'truck' },
    { id: 'hinh-thuc-dat-hang', title: '8. Kênh đặt hàng & hỗ trợ', icon: 'phone' },
  ];

  constructor(private readonly router: Router) {}

  scrollToSection(sectionId: string): void {
    this.activeSection.set(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  navigateToHome(): void {
    this.router.navigate(['/home']);
  }
}
