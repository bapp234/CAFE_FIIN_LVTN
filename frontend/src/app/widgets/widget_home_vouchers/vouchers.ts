import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideCheck, LucideCopy } from '@lucide/angular';
import { Voucher } from '../../pages/page_home/home';
import { CardFrameComponent } from '../../components/card_frame/card_frame';

@Component({
  selector: 'app-widget-home-vouchers',
  imports: [LucideCheck, LucideCopy, CardFrameComponent],
  templateUrl: './vouchers.html',
  styleUrl: './vouchers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeVouchers {
  readonly vouchers = input.required<Voucher[]>();
  readonly copyVoucher = output<string>();

  /**
   * Tách phần trăm hoặc giá trị giảm từ chuỗi discount (ví dụ 'GIẢM 20%' -> '20%')
   */
  getDiscountValue(discount: string): string {
    const parts = (discount || '').trim().split(' ');
    return parts.length > 1 ? parts.slice(1).join(' ') : discount;
  }

  /**
   * Lấy tiền tố hiển thị (ví dụ 'GIẢM')
   */
  getDiscountPrefix(discount: string): string {
    const parts = (discount || '').trim().split(' ');
    return parts.length > 1 ? parts[0] : 'GIẢM';
  }
}
