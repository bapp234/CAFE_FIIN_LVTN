import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface MenuCategoryDto {
  categoryId: number;
  parentCategoryId?: number | null;
  categoryName: string;
  slug: string;
  sortOrder: number;
}

export interface MenuProductDto {
  productId: number;
  categoryId: number;
  categoryName: string;
  categorySlug: string;
  productName: string;
  productSlug: string;
  basePrice: number;
  imageUrl: string;
  description: string;
  isFeatured: boolean;
  isAvailable: boolean;
}

export interface MenuVariantDto {
  variantId: number;
  productId: number;
  sizeName: string;
  sku: string;
  price: number;
  isDefault: boolean;
}

export interface MenuToppingDto {
  toppingId: number;
  toppingName: string;
  price: number;
  imageUrl?: string | null;
}

export interface MenuResponseDto {
  categories: MenuCategoryDto[];
  products: MenuProductDto[];
  variants: MenuVariantDto[];
  toppings: MenuToppingDto[];
}

export interface DbCartItemDto {
  cartItemId: number;
  variantId: number;
  productId: number;
  productName: string;
  imageUrl: string;
  sizeName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  notes?: string | null;
}

export interface CustomerVoucherDto {
  customerVoucherId: number;
  voucherId: number;
  voucherCode: string;
  voucherName: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  status: string;
  claimedAt: string;
  expiredAt?: string | null;
}

export interface AvailableVoucherDto {
  voucherId: number;
  voucherCode: string;
  voucherName: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  pointsRequired: number;
  endDate?: string | null;
}

export interface VoucherWalletDto {
  myVouchers: CustomerVoucherDto[];
  availableVouchers: AvailableVoucherDto[];
}

export interface CustomerOrderDto {
  orderId: number;
  orderCode: string;
  orderType: string;
  orderStatus: string;
  paymentStatus: string;
  subTotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  cancelReason?: string | null;
  createdAt: string;
  itemsSummary: string;
}

export interface PlaceOrderResultDto {
  orderId: number;
  orderCode: string;
  totalAmount: number;
}

const API_BASE = 'http://localhost:5107/api/v1';

function pick<T>(row: Record<string, unknown>, camel: string, pascal: string, fallback: T): T {
  const v = row[camel] ?? row[pascal];
  return (v !== undefined && v !== null ? v : fallback) as T;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerOrderService {
  private readonly http = inject(HttpClient);

  readonly menu = signal<MenuResponseDto | null>(null);
  readonly cartItems = signal<DbCartItemDto[]>([]);
  readonly isCartOpen = signal<boolean>(false);
  readonly wallet = signal<VoucherWalletDto>({ myVouchers: [], availableVouchers: [] });
  readonly myOrders = signal<CustomerOrderDto[]>([]);

  readonly cartCount = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.quantity, 0)
  );
  readonly cartSubtotal = computed(() =>
    this.cartItems().reduce((sum, item) => sum + item.lineTotal, 0)
  );

  openCart(): void {
    this.isCartOpen.set(true);
  }

  closeCart(): void {
    this.isCartOpen.set(false);
  }

  toggleCart(): void {
    this.isCartOpen.update((v) => !v);
  }

  async getMenu(force = false): Promise<MenuResponseDto> {
    const cached = this.menu();
    if (cached && !force) {
      return cached;
    }
    const res = await firstValueFrom(
      this.http.get<{ data: Record<string, Record<string, unknown>[]> }>(`${API_BASE}/menu`, {
        withCredentials: true,
      })
    );
    const raw = res.data || {};
    const cats = (raw['categories'] ?? raw['Categories'] ?? []).map((r) => ({
      categoryId: Number(pick(r, 'categoryId', 'CategoryId', 0)),
      parentCategoryId: pick<number | null>(r, 'parentCategoryId', 'ParentCategoryId', null),
      categoryName: String(pick(r, 'categoryName', 'CategoryName', '')),
      slug: String(pick(r, 'slug', 'Slug', '')),
      sortOrder: Number(
        pick(r, 'sortOrder', 'SortOrder', pick(r, 'displayOrder', 'DisplayOrder', 0))
      ),
    }));
    const prods = (raw['products'] ?? raw['Products'] ?? []).map((r) => ({
      productId: Number(pick(r, 'productId', 'ProductId', 0)),
      categoryId: Number(pick(r, 'categoryId', 'CategoryId', 0)),
      categoryName: String(pick(r, 'categoryName', 'CategoryName', '')),
      categorySlug: String(pick(r, 'categorySlug', 'CategorySlug', '')),
      productName: String(pick(r, 'productName', 'ProductName', '')),
      productSlug: String(pick(r, 'productSlug', 'ProductSlug', '')),
      basePrice: Number(pick(r, 'basePrice', 'BasePrice', 0)),
      imageUrl: String(pick(r, 'imageUrl', 'ImageUrl', '/assets/images/hero/slide-01-desktop.webp')),
      description: String(pick(r, 'description', 'Description', '')),
      isFeatured: Boolean(pick(r, 'isFeatured', 'IsFeatured', false)),
      isAvailable: Boolean(pick(r, 'isAvailable', 'IsAvailable', true)),
    }));
    const vars = (raw['variants'] ?? raw['Variants'] ?? []).map((r) => ({
      variantId: Number(pick(r, 'variantId', 'VariantId', 0)),
      productId: Number(pick(r, 'productId', 'ProductId', 0)),
      sizeName: String(pick(r, 'sizeName', 'SizeName', 'M')),
      sku: String(pick(r, 'sku', 'Sku', '')),
      price: Number(
        pick(r, 'basePrice', 'BasePrice', pick(r, 'price', 'Price', 0))
      ),
      isDefault: Boolean(pick(r, 'isDefault', 'IsDefault', false)),
    }));
    const tops = (raw['toppings'] ?? raw['Toppings'] ?? []).map((r) => ({
      toppingId: Number(pick(r, 'toppingId', 'ToppingId', 0)),
      toppingName: String(pick(r, 'toppingName', 'ToppingName', '')),
      price: Number(pick(r, 'price', 'Price', 0)),
      imageUrl: pick<string | null>(r, 'imageUrl', 'ImageUrl', null),
    }));

    const parsed: MenuResponseDto = {
      categories: cats,
      products: prods,
      variants: vars,
      toppings: tops,
    };
    this.menu.set(parsed);
    return parsed;
  }

  async loadCart(): Promise<DbCartItemDto[]> {
    try {
      const res = await firstValueFrom(
        this.http.get<{ data: Record<string, unknown>[] }>(`${API_BASE}/customer/cart`, {
          withCredentials: true,
        })
      );
      const list = (res.data ?? []).map((r) => ({
        cartItemId: Number(pick(r, 'cartItemId', 'CartItemId', 0)),
        variantId: Number(pick(r, 'variantId', 'VariantId', 0)),
        productId: Number(pick(r, 'productId', 'ProductId', 0)),
        productName: String(pick(r, 'productName', 'ProductName', '')),
        imageUrl: String(pick(r, 'imageUrl', 'ImageUrl', '/assets/images/hero/slide-01-desktop.webp')),
        sizeName: String(pick(r, 'sizeName', 'SizeName', 'M')),
        unitPrice: Number(pick(r, 'unitPrice', 'UnitPrice', 0)),
        quantity: Number(pick(r, 'quantity', 'Quantity', 1)),
        lineTotal: Number(pick(r, 'lineTotal', 'LineTotal', 0)),
        notes: pick<string | null>(r, 'notes', 'Notes', null),
      }));
      this.cartItems.set(list);
      return list;
    } catch {
      return this.cartItems();
    }
  }

  async addToCart(variantId: number, quantity = 1, notes?: string): Promise<void> {
    await firstValueFrom(
      this.http.post(
        `${API_BASE}/customer/cart/add`,
        { variantId, quantity, notes: notes ?? null },
        { withCredentials: true }
      )
    );
    await this.loadCart();
  }

  async updateCartItemQuantity(cartItemId: number, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.removeCartItem(cartItemId);
      return;
    }
    await firstValueFrom(
      this.http.put(
        `${API_BASE}/customer/cart/${cartItemId}`,
        { quantity },
        { withCredentials: true }
      )
    );
    await this.loadCart();
  }

  async removeCartItem(cartItemId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${API_BASE}/customer/cart/${cartItemId}`, {
        withCredentials: true,
      })
    );
    await this.loadCart();
  }

  async loadVoucherWallet(): Promise<VoucherWalletDto> {
    const res = await firstValueFrom(
      this.http.get<{ data: Record<string, Record<string, unknown>[]> }>(
        `${API_BASE}/customer/vouchers`,
        { withCredentials: true }
      )
    );
    const raw = res.data || {};
    const myVouchers = (raw['myVouchers'] ?? raw['MyVouchers'] ?? []).map((r) => ({
      customerVoucherId: Number(pick(r, 'customerVoucherId', 'CustomerVoucherId', 0)),
      voucherId: Number(pick(r, 'voucherId', 'VoucherId', 0)),
      voucherCode: String(pick(r, 'voucherCode', 'VoucherCode', '')),
      voucherName: String(pick(r, 'voucherName', 'VoucherName', '')),
      discountType: String(pick(r, 'discountType', 'DiscountType', 'FixedAmount')),
      discountValue: Number(pick(r, 'discountValue', 'DiscountValue', 0)),
      minOrderAmount: Number(pick(r, 'minOrderAmount', 'MinOrderAmount', 0)),
      maxDiscountAmount: pick<number | null>(r, 'maxDiscountAmount', 'MaxDiscountAmount', null),
      status: String(pick(r, 'status', 'Status', 'Available')),
      claimedAt: String(pick(r, 'claimedAt', 'ClaimedAt', '')),
      expiredAt: pick<string | null>(r, 'expiredAt', 'ExpiredAt', null),
    }));
    const availableVouchers = (raw['availableVouchers'] ?? raw['AvailableVouchers'] ?? []).map((r) => ({
      voucherId: Number(pick(r, 'voucherId', 'VoucherId', 0)),
      voucherCode: String(pick(r, 'voucherCode', 'VoucherCode', '')),
      voucherName: String(pick(r, 'voucherName', 'VoucherName', '')),
      description: pick<string | null>(r, 'description', 'Description', null),
      discountType: String(pick(r, 'discountType', 'DiscountType', 'FixedAmount')),
      discountValue: Number(pick(r, 'discountValue', 'DiscountValue', 0)),
      minOrderAmount: Number(pick(r, 'minOrderAmount', 'MinOrderAmount', 0)),
      maxDiscountAmount: pick<number | null>(r, 'maxDiscountAmount', 'MaxDiscountAmount', null),
      pointsRequired: Number(pick(r, 'pointsRequired', 'PointsRequired', 0)),
      endDate: pick<string | null>(r, 'endDate', 'EndDate', null),
    }));
    const result = { myVouchers, availableVouchers };
    this.wallet.set(result);
    return result;
  }

  async redeemVoucher(voucherId: number): Promise<number> {
    const res = await firstValueFrom(
      this.http.post<{ data: Record<string, unknown> }>(
        `${API_BASE}/customer/vouchers/${voucherId}/redeem`,
        {},
        { withCredentials: true }
      )
    );
    await this.loadVoucherWallet();
    const raw = res.data || {};
    return Number(pick(raw, 'loyaltyPoints', 'LoyaltyPoints', 0));
  }

  async placeOrder(
    orderType: 'OnlineDelivery' | 'OnlinePickUp',
    customerVoucherId?: number | null,
    branchId?: number | null
  ): Promise<PlaceOrderResultDto> {
    const res = await firstValueFrom(
      this.http.post<{ data: Record<string, unknown> }>(
        `${API_BASE}/customer/orders`,
        {
          orderType,
          customerVoucherId: customerVoucherId ?? null,
          branchId: branchId ?? 1,
        },
        { withCredentials: true }
      )
    );
    const raw = res.data || {};
    await Promise.all([this.loadCart(), this.loadMyOrders(), this.loadVoucherWallet()]);
    return {
      orderId: Number(pick(raw, 'orderId', 'OrderId', 0)),
      orderCode: String(pick(raw, 'orderCode', 'OrderCode', '')),
      totalAmount: Number(pick(raw, 'totalAmount', 'TotalAmount', 0)),
    };
  }

  async loadMyOrders(): Promise<CustomerOrderDto[]> {
    const res = await firstValueFrom(
      this.http.get<{ data: Record<string, unknown>[] }>(`${API_BASE}/customer/orders`, {
        withCredentials: true,
      })
    );
    const list = (res.data ?? []).map((r) => ({
      orderId: Number(pick(r, 'orderId', 'OrderId', 0)),
      orderCode: String(pick(r, 'orderCode', 'OrderCode', '')),
      orderType: String(pick(r, 'orderType', 'OrderType', 'OnlineDelivery')),
      orderStatus: String(pick(r, 'orderStatus', 'OrderStatus', 'Pending')),
      paymentStatus: String(pick(r, 'paymentStatus', 'PaymentStatus', 'Unpaid')),
      subTotal: Number(pick(r, 'subTotal', 'SubTotal', 0)),
      discountAmount: Number(pick(r, 'discountAmount', 'DiscountAmount', 0)),
      shippingFee: Number(pick(r, 'shippingFee', 'ShippingFee', 0)),
      totalAmount: Number(pick(r, 'totalAmount', 'TotalAmount', 0)),
      cancelReason: pick<string | null>(r, 'cancelReason', 'CancelReason', null),
      createdAt: String(pick(r, 'createdAt', 'CreatedAt', '')),
      itemsSummary: String(pick(r, 'itemsSummary', 'ItemsSummary', '')),
    }));
    this.myOrders.set(list);
    return list;
  }

  async cancelOrReturnOrder(orderId: number, reason: string): Promise<string> {
    const res = await firstValueFrom(
      this.http.post<{ message: string }>(
        `${API_BASE}/customer/orders/${orderId}/cancel`,
        { reason },
        { withCredentials: true }
      )
    );
    await this.loadMyOrders();
    return res.message ?? 'Đã xử lý yêu cầu.';
  }
}
