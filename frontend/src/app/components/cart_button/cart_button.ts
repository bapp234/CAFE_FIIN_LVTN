import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { LucideShoppingCart } from '@lucide/angular';

@Component({
  selector: 'app-cart-button',
  imports: [LucideShoppingCart],
  templateUrl: './cart_button.html',
  styleUrl: './cart_button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartButtonComponent {
  /** Số món đang có trong giỏ */
  readonly count = input<number>(0);
  /** Hiện chấm số lượng nhỏ trên icon (cần cho mobile vì không có hover) */
  readonly showBadge = input<boolean>(true);

  readonly clicked = output<void>();

  protected readonly badgeText = computed(() => (this.count() > 99 ? '99+' : String(this.count())));

  protected readonly hoverText = computed(() =>
    this.count() > 0 ? `${this.count()} món trong giỏ` : 'Chưa có món nào',
  );

  protected readonly ariaLabel = computed(() => `Mở giỏ hàng, ${this.hoverText()}`);

  onClick(): void {
    this.clicked.emit();
  }
}
