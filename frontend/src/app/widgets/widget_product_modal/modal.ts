import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    computed,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
    LucideCheck,
    LucideCupSoda,
    LucideFileEdit,
    LucideMinus,
    LucidePlus,
    LucideShoppingBag,
    LucideX,
} from '@lucide/angular';
import gsap from 'gsap';
import { Product } from '../../pages/page_home/home';

export interface ToppingOption {
    id: string;
    name: string;
    price: number;
}

export interface CustomizedItem {
    product: Product;
    size: 'S' | 'M' | 'L';
    sugar: string;
    ice: string;
    toppings?: ToppingOption[];
    note?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
}

@Component({
    selector: 'app-widget-product-modal',
    imports: [
        FormsModule,
        LucideX,
        LucidePlus,
        LucideMinus,
        LucideShoppingBag,
        LucideCheck,
        LucideCupSoda,
        LucideFileEdit,
    ],
    templateUrl: './modal.html',
    styleUrl: './modal.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetProductModal implements AfterViewInit, OnDestroy {
    readonly product = input.required<Product>();

    readonly closeModal = output<void>();
    readonly addToCart = output<CustomizedItem>();

    readonly backdropRef = viewChild.required<ElementRef<HTMLElement>>('backdrop');
    readonly sheetRef = viewChild.required<ElementRef<HTMLElement>>('modalSheet');
    readonly qtyRef = viewChild.required<ElementRef<HTMLElement>>('qtyEl');
    readonly totalRef = viewChild.required<ElementRef<HTMLElement>>('totalEl');

    // Danh sách Size chuẩn F&B
    readonly sizeOptions: Array<{ code: 'S' | 'M' | 'L'; label: string; volume: string; diff: number }> = [
        { code: 'S', label: 'Nhỏ', volume: '350ml', diff: -5000 },
        { code: 'M', label: 'Vừa', volume: '470ml', diff: 0 },
        { code: 'L', label: 'Lớn', volume: '600ml', diff: 10000 },
    ];

    // Danh sách Topping phổ biến
    readonly availableToppings: ToppingOption[] = [
        { id: 't1', name: 'Thạch Cà Phê Phin', price: 10000 },
        { id: 't2', name: 'Kem Phô Mai Macchiato', price: 12000 },
        { id: 't3', name: 'Hạt Sen Vàng', price: 10000 },
        { id: 't4', name: 'Trân Châu Đường Đen', price: 8000 },
    ];

    // State Signals
    readonly modalSize = signal<'S' | 'M' | 'L'>('M');
    readonly modalSugar = signal<string>('100%');
    readonly modalIce = signal<string>('100%');
    readonly selectedToppingIds = signal<string[]>([]);
    readonly note = signal<string>('');
    readonly modalQuantity = signal<number>(1);
    readonly isClosing = signal<boolean>(false);

    // Tính giá Topping đang chọn
    readonly selectedToppings = computed(() =>
        this.availableToppings.filter((t) => this.selectedToppingIds().includes(t.id))
    );

    readonly toppingsTotal = computed(() =>
        this.selectedToppings().reduce((sum, t) => sum + t.price, 0)
    );

    // Đơn giá 1 ly (Giá gốc + chênh lệch Size + Topping)
    readonly unitPrice = computed(() => {
        const sizeObj = this.sizeOptions.find((s) => s.code === this.modalSize());
        const sizeDiff = sizeObj ? sizeObj.diff : 0;
        return this.product().price + sizeDiff + this.toppingsTotal();
    });

    // Tổng tiền cuối cùng
    readonly totalPrice = computed(() => this.unitPrice() * this.modalQuantity());

    private gsapCtx?: gsap.Context;

    ngAfterViewInit(): void {
        const isMobile = window.innerWidth < 640;

        this.gsapCtx = gsap.context(() => {
            const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

            tl.fromTo(
                this.backdropRef().nativeElement,
                { opacity: 0 },
                { opacity: 1, duration: 0.25 }
            ).fromTo(
                this.sheetRef().nativeElement,
                isMobile
                    ? { y: '100%', opacity: 1 }
                    : { y: 32, scale: 0.96, opacity: 0 },
                isMobile
                    ? { y: '0%', duration: 0.38, ease: 'power4.out' }
                    : { y: 0, scale: 1, opacity: 1, duration: 0.38, ease: 'back.out(1.2)' },
                '-=0.15'
            );
        }, this.backdropRef().nativeElement);
    }

    ngOnDestroy(): void {
        this.gsapCtx?.revert();
    }

    handleClose(): void {
        if (this.isClosing()) return;
        this.isClosing.set(true);
        const isMobile = window.innerWidth < 640;

        const tl = gsap.timeline({
            onComplete: () => this.closeModal.emit(),
        });

        tl.to(this.sheetRef().nativeElement, {
            y: isMobile ? '100%' : 20,
            scale: isMobile ? 1 : 0.96,
            opacity: isMobile ? 1 : 0,
            duration: 0.24,
            ease: 'power2.in',
        }).to(
            this.backdropRef().nativeElement,
            { opacity: 0, duration: 0.18 },
            '-=0.12'
        );
    }

    changeSize(size: 'S' | 'M' | 'L', event: MouseEvent): void {
        if (this.modalSize() === size) return;
        this.modalSize.set(size);
        this.pulseElement(event.currentTarget as HTMLElement);
        this.bumpPrice();
    }

    changeSugar(sugar: string, event: MouseEvent): void {
        if (this.modalSugar() === sugar) return;
        this.modalSugar.set(sugar);
        this.pulseElement(event.currentTarget as HTMLElement);
    }

    changeIce(ice: string, event: MouseEvent): void {
        if (this.modalIce() === ice) return;
        this.modalIce.set(ice);
        this.pulseElement(event.currentTarget as HTMLElement);
    }

    toggleTopping(id: string, event: MouseEvent): void {
        this.selectedToppingIds.update((ids) =>
            ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]
        );
        this.pulseElement(event.currentTarget as HTMLElement);
        this.bumpPrice();
    }

    isToppingSelected(id: string): boolean {
        return this.selectedToppingIds().includes(id);
    }

    increment(): void {
        this.modalQuantity.update((q) => q + 1);
        this.bumpQty();
        this.bumpPrice();
    }

    decrement(): void {
        if (this.modalQuantity() <= 1) return;
        this.modalQuantity.update((q) => q - 1);
        this.bumpQty();
        this.bumpPrice();
    }

    submit(): void {
        gsap.to('.btn-add-order', {
            scale: 0.96,
            duration: 0.1,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                this.addToCart.emit({
                    product: this.product(),
                    size: this.modalSize(),
                    sugar: this.modalSugar(),
                    ice: this.modalIce(),
                    toppings: this.selectedToppings(),
                    note: this.note().trim() || undefined,
                    quantity: this.modalQuantity(),
                    unitPrice: this.unitPrice(),
                    totalPrice: this.totalPrice(),
                });
            },
        });
    }

    formatPrice(p: number): string {
        return p.toLocaleString('vi-VN') + 'đ';
    }

    private pulseElement(el: HTMLElement): void {
        gsap.fromTo(el, { scale: 0.95 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' });
    }

    private bumpQty(): void {
        gsap.fromTo(this.qtyRef().nativeElement, { scale: 1.3 }, { scale: 1, duration: 0.22 });
    }

    private bumpPrice(): void {
        gsap.fromTo(
            this.totalRef().nativeElement,
            { y: -4, opacity: 0.5 },
            { y: 0, opacity: 1, duration: 0.22 }
        );
    }
}