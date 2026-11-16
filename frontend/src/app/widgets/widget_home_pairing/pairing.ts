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
import { CommonModule } from '@angular/common';
import {
    LucideCheck,
    LucideCoffee,
    LucideCroissant,
    LucidePlus,
    LucideShoppingBag,
    LucideSparkles,
} from '@lucide/angular';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Product } from '../../pages/page_home/home';

gsap.registerPlugin(ScrollTrigger);

export interface PairingComboSelection {
    food: Product;
    drink: Product;
    comboPrice: number;
    savedAmount: number;
}

@Component({
    selector: 'app-widget-home-pairing',
    imports: [
        CommonModule,
        LucideSparkles,
        LucideCoffee,
        LucideCroissant,
        LucidePlus,
        LucideCheck,
        LucideShoppingBag,
    ],
    templateUrl: './pairing.html',
    styleUrl: './pairing.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomePairing implements AfterViewInit, OnDestroy {
    readonly sectionId = input<string>('goc-diem-tam');
    readonly badge = input<string>('BỮA SÁNG CHUẨN GU');
    readonly title = input<string>('GÓC ĐIỂM TÂM SÀI GÒN');
    readonly subtitle = input<string>('Ghép đôi Bánh Mì Que giòn rụm cùng Phin đậm đà — Tiết kiệm ngay 15%');
    readonly heroImage = input.required<string>();

    // Danh sách bánh & danh sách cà phê gợi ý ghép cặp
    readonly foodItems = input.required<Product[]>();
    readonly drinkOptions = input.required<Product[]>();

    // Sự kiện khi bấm vào 1 món lẻ hoặc thêm cả Combo
    readonly selectSingleProduct = output<Product>();
    readonly addComboToCart = output<PairingComboSelection>();

    readonly sectionRef = viewChild.required<ElementRef<HTMLElement>>('pairingSection');
    readonly priceBoxRef = viewChild.required<ElementRef<HTMLElement>>('comboPriceEl');

    // State chọn món để ghép cặp
    readonly selectedFoodIndex = signal<number>(0);
    readonly selectedDrinkIndex = signal<number>(0);

    readonly activeFood = computed(() => this.foodItems()[this.selectedFoodIndex()] ?? this.foodItems()[0]);
    readonly activeDrink = computed(() => this.drinkOptions()[this.selectedDrinkIndex()] ?? this.drinkOptions()[0]);

    // Tính giá gốc, giá giảm 15% (làm tròn hàng nghìn) và số tiền tiết kiệm
    readonly originalTotal = computed(() => (this.activeFood()?.price ?? 0) + (this.activeDrink()?.price ?? 0));
    readonly comboPrice = computed(() => Math.round((this.originalTotal() * 0.85) / 1000) * 1000);
    readonly savedAmount = computed(() => this.originalTotal() - this.comboPrice());

    private gsapCtx?: gsap.Context;

    ngAfterViewInit(): void {
        this.gsapCtx = gsap.context(() => {
            const el = this.sectionRef().nativeElement;

            gsap.from('.gsap-pairing-reveal', {
                y: 24,
                opacity: 0,
                duration: 0.6,
                stagger: 0.1,
                ease: 'power3.out',
                clearProps: 'transform',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 86%',
                    once: true,
                },
            });
        }, this.sectionRef().nativeElement);
    }

    ngOnDestroy(): void {
        this.gsapCtx?.revert();
    }

    chooseFood(index: number): void {
        if (this.selectedFoodIndex() === index) return;
        this.selectedFoodIndex.set(index);
        this.animatePriceChange();
    }

    chooseDrink(index: number): void {
        if (this.selectedDrinkIndex() === index) return;
        this.selectedDrinkIndex.set(index);
        this.animatePriceChange();
    }

    onAddCombo(event: MouseEvent): void {
        const food = this.activeFood();
        const drink = this.activeDrink();
        if (!food || !drink) return;

        gsap.fromTo(
            event.currentTarget as HTMLElement,
            { scale: 0.95 },
            {
                scale: 1,
                duration: 0.28,
                ease: 'back.out(2)',
                onComplete: () => {
                    this.addComboToCart.emit({
                        food,
                        drink,
                        comboPrice: this.comboPrice(),
                        savedAmount: this.savedAmount(),
                    });
                },
            }
        );
    }

    formatPrice(price: number): string {
        return price.toLocaleString('vi-VN') + 'đ';
    }

    private animatePriceChange(): void {
        gsap.fromTo(
            this.priceBoxRef().nativeElement,
            { y: -6, opacity: 0.4 },
            { y: 0, opacity: 1, duration: 0.25, ease: 'power2.out' }
        );
    }
}