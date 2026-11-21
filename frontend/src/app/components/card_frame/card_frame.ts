import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type CardFrameVariant = 'ticket' | 'dashed' | 'solid' | 'vintage';
export type CardFrameBg = 'white' | 'card' | 'cream';
export type CardFrameRadius = 'none' | 'sm' | 'md' | 'lg';

/**
 * CardFrameComponent - Khung thẻ đa năng tái sử dụng.
 *
 * Cung cấp khung bao viền, bo góc, bóng đổ và các hiệu ứng tương tác:
 * - Nâng nhẹ 3D khi hover (micro-elevation)
 * - Vệt sáng lướt qua (shimmer sweep)
 * - Đổi viền sang màu chủ đạo (đỏ cổ điển / xanh đậm)
 * - Tùy chọn rãnh vé xé (ticket notches), viền đứt (dashed), viền đôi (vintage)
 *
 * Dùng được cho Voucher, Sản phẩm, Thẻ bài viết, Ưu đãi, Thông báo...
 */
@Component({
  selector: 'app-card-frame',
  standalone: true,
  templateUrl: './card_frame.html',
  styleUrl: './card_frame.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CardFrameComponent {
  /** Kiểu viền & cấu trúc: 'ticket' (vé có rãnh khuyết), 'dashed' (viền đứt vintage), 'solid' (viền liền), 'vintage' (viền đôi cổ điển) */
  readonly variant = input<CardFrameVariant>('ticket');

  /** Màu nền khung: 'white' (trắng ngà), 'card' (be thẻ card), 'cream' (be ấm) */
  readonly bg = input<CardFrameBg>('white');

  /** Bật hiệu ứng nâng thẻ, đổ bóng sâu và vệt sáng khi hover / focus */
  readonly interactive = input<boolean>(true);

  /** Độ bo góc khung */
  readonly radius = input<CardFrameRadius>('md');
}
