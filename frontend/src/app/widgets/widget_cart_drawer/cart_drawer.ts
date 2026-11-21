import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideCoffee,
  LucideMinus,
  LucidePlus,
  LucideShoppingBag,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { CustomerOrderService, DbCartItemDto } from '../../services/customer_order_service';
import { CustomerAuthService } from '../../services/customer_auth_service';

@Component({
  selector: 'app-widget-cart-drawer',
  imports: [
    CommonModule,
    LucideShoppingBag,
    LucideX,
    LucideCoffee,
    LucidePlus,
    LucideMinus,
    LucideTrash2,
  ],
  templateUrl: './cart_drawer.html',
  styleUrl: './cart_drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetCartDrawer {
  private readonly orderService = inject(CustomerOrderService);
  private readonly authService = inject(CustomerAuthService);
  private readonly router = inject(Router);

  readonly isOpen = this.orderService.isCartOpen;
  readonly cartItems = this.orderService.cartItems;
  readonly cartCount = this.orderService.cartCount;
  readonly cartSubtotal = this.orderService.cartSubtotal;
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated());

  close(): void {
    this.orderService.closeCart();
  }

  async increment(item: DbCartItemDto): Promise<void> {
    await this.orderService.updateCartItemQuantity(item.cartItemId, item.quantity + 1);
  }

  async decrement(item: DbCartItemDto): Promise<void> {
    if (item.quantity <= 1) {
      await this.orderService.removeCartItem(item.cartItemId);
    } else {
      await this.orderService.updateCartItemQuantity(item.cartItemId, item.quantity - 1);
    }
  }

  async removeItem(cartItemId: number): Promise<void> {
    await this.orderService.removeCartItem(cartItemId);
  }

  goToProducts(): void {
    this.close();
    void this.router.navigate(['/san-pham']);
  }

  goToLogin(): void {
    this.close();
    void this.router.navigate(['/auth'], {
      queryParams: { returnUrl: '/tai-khoan?tab=cart' },
    });
  }

  goToCheckout(): void {
    this.close();
    if (this.isAuthenticated()) {
      void this.router.navigate(['/tai-khoan'], { queryParams: { tab: 'cart' } });
    } else {
      void this.router.navigate(['/auth'], {
        queryParams: { returnUrl: '/tai-khoan?tab=cart' },
      });
    }
  }

  formatPrice(price: number): string {
    return (price || 0).toLocaleString('vi-VN') + 'đ';
  }
}
