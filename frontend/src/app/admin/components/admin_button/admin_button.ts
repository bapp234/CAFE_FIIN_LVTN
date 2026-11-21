import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

export type AdminButtonVariant = 'default' | 'primary' | 'danger';
export type AdminButtonType = 'button' | 'submit' | 'reset';

/**
 * Nút bấm dùng chung cho toàn bộ trang admin.
 *
 * Nội dung (icon + chữ) đặt giữa hai thẻ, icon tự có kích thước và màu theo chữ của nút:
 *   <app-admin-button title="Tải xuống tệp Excel" (clicked)="exportExcel()">
 *     <svg lucideDownload aria-hidden="true"></svg>
 *     <span>Xuất Excel</span>
 *   </app-admin-button>
 *
 * Đổi màu khi gọi (nhận mọi giá trị màu CSS: #hex, rgb(), tên màu, var(--...)):
 *   <app-admin-button textColor="#ffffff" bgColor="#8c5b36" (clicked)="save()">Lưu</app-admin-button>
 *
 * Kiểu dựng sẵn: variant="primary" | "danger" (mặc định "default").
 * Màu truyền vào luôn ưu tiên hơn variant.
 * Nếu chỉ truyền bgColor thì màu viền = bgColor, màu hover = bgColor tối đi 8%.
 */
@Component({
  selector: 'app-admin-button',
  templateUrl: './admin_button.html',
  styleUrl: './admin_button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminButtonComponent {
  readonly variant = input<AdminButtonVariant>('default');
  readonly type = input<AdminButtonType>('button');
  readonly disabled = input(false);
  readonly ariaLabel = input('');

  /** Màu chữ (và icon). */
  readonly textColor = input('');
  /** Màu nền. */
  readonly bgColor = input('');
  /** Màu viền, mặc định theo bgColor nếu có. */
  readonly borderColor = input('');
  /** Màu nền khi rê chuột, mặc định là bgColor tối đi 8%. */
  readonly hoverBgColor = input('');

  readonly clicked = output<MouseEvent>();

  readonly border = computed(() => this.borderColor() || this.bgColor());

  readonly hoverBg = computed(() => {
    if (this.hoverBgColor()) return this.hoverBgColor();
    const bg = this.bgColor();
    return bg ? `color-mix(in srgb, ${bg}, black 8%)` : '';
  });

  onClick(event: MouseEvent): void {
    if (!this.disabled()) this.clicked.emit(event);
  }
}
