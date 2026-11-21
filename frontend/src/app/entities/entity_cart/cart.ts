import { Injectable, computed, signal } from '@angular/core';
import { ProductItem } from '../entity_product/product';

export interface CartItem {
  product: ProductItem;
  size: 'S' | 'M' | 'L';
  sugar?: string;
  ice?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  note?: string;
}

const STORAGE_KEY = 'fiin_coffee_cart';

@Injectable({
  providedIn: 'root',
})
export class CartService {
  readonly items = signal<CartItem[]>(this.loadCart());

  readonly count = computed(() =>
    this.items().reduce((sum, i) => sum + i.quantity, 0)
  );

  readonly total = computed(() =>
    this.items().reduce((sum, i) => sum + i.totalPrice, 0)
  );

  private loadCart(): CartItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private persist(items: CartItem[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Ignored in restricted environments
    }
  }

  addItem(item: CartItem): void {
    this.items.update((current) => {
      const idx = current.findIndex(
        (c) =>
          c.product.id === item.product.id &&
          c.size === item.size &&
          c.sugar === item.sugar &&
          c.ice === item.ice
      );
      let updated: CartItem[];
      if (idx >= 0) {
        updated = [...current];
        const existing = updated[idx];
        const newQty = existing.quantity + item.quantity;
        updated[idx] = {
          ...existing,
          quantity: newQty,
          totalPrice: newQty * existing.unitPrice,
        };
      } else {
        updated = [...current, item];
      }
      this.persist(updated);
      return updated;
    });
  }

  removeItem(index: number): void {
    this.items.update((current) => {
      const updated = current.filter((_, i) => i !== index);
      this.persist(updated);
      return updated;
    });
  }

  updateQuantity(index: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(index);
      return;
    }
    this.items.update((current) => {
      const updated = [...current];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          quantity,
          totalPrice: quantity * updated[index].unitPrice,
        };
      }
      this.persist(updated);
      return updated;
    });
  }

  clearCart(): void {
    this.items.set([]);
    this.persist([]);
  }
}
