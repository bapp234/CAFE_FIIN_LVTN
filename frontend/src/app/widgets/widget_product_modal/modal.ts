import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { LucideX } from '@lucide/angular';
import { Product } from '../../pages/page_home/home';

export interface CustomizedItem {
    product: Product;
    size: 'S' | 'M' | 'L';
    sugar: string;
    ice: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

@Component({
    selector: 'app-widget-product-modal',
    imports: [LucideX],
    templateUrl: './modal.html',
    styleUrl: './modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetProductModal {
    readonly product = input.required<Product>();

    readonly closeModal = output<void>();
    readonly addToCart = output<CustomizedItem>();

    readonly modalSize = signal<'S' | 'M' | 'L'>('M');
    readonly modalSugar = signal<string>('100%');
    readonly modalIce = signal<string>('100%');
    readonly modalQuantity = signal<number>(1);

    changeSize(size: 'S' | 'M' | 'L'): void { this.modalSize.set(size); }
    changeSugar(sugar: string): void { this.modalSugar.set(sugar); }
    changeIce(ice: string): void { this.modalIce.set(ice); }
    increment(): void { this.modalQuantity.update((q) => q + 1); }
    decrement(): void { this.modalQuantity.update((q) => (q > 1 ? q - 1 : 1)); }

    getUnitPrice(): number {
        let p = this.product().price;
        if (this.modalSize() === 'L') p += 10000;
        if (this.modalSize() === 'S') p -= 5000;
        return p;
    }

    getTotalPrice(): number {
        return this.getUnitPrice() * this.modalQuantity();
    }

    submit(): void {
        const unitPrice = this.getUnitPrice();
        const qty = this.modalQuantity();
        this.addToCart.emit({
            product: this.product(),
            size: this.modalSize(),
            sugar: this.modalSugar(),
            ice: this.modalIce(),
            quantity: qty,
            unitPrice,
            totalPrice: unitPrice * qty,
        });
    }

    formatPrice(p: number): string {
        return p.toLocaleString('vi-VN') + 'đ';
    }
}