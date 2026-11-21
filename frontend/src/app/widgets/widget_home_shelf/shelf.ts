import {
    AfterViewInit,
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    input,
    output,
    viewChild,
} from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideArrowUpRight, LucideFlame, LucidePlus, LucideSparkles } from '@lucide/angular';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Product } from '../../pages/page_home/home';

gsap.registerPlugin(ScrollTrigger);

@Component({
    selector: 'app-widget-home-shelf',
    imports: [
        CommonModule,
        RouterLink,
        NgTemplateOutlet,
        LucidePlus,
        LucideArrowUpRight,
        LucideSparkles,
        LucideFlame,
    ],
    templateUrl: './shelf.html',
    styleUrl: './shelf.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeShelf implements AfterViewInit, OnDestroy {
    readonly title = input.required<string>();
    readonly icon = input<string | null>(null);
    readonly sectionId = input<string>('');
    readonly products = input.required<Product[]>();

    readonly bannerLead = input<{
        badge: string;
        sub: string;
        title: string;
        desc: string;
        image: string;
    } | null>(null);

    readonly selectProduct = output<Product>();

    readonly sectionRef = viewChild.required<ElementRef<HTMLElement>>('sectionEl');
    private gsapCtx?: gsap.Context;

    ngAfterViewInit(): void {
        this.gsapCtx = gsap.context(() => {
            const el = this.sectionRef().nativeElement;

            gsap.from('.gsap-shelf-header', {
                y: 16,
                opacity: 0,
                duration: 0.55,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: el,
                    start: 'top 90%',
                    once: true,
                },
            });

            gsap.from('.gsap-shelf-card', {
                y: 28,
                opacity: 0,
                duration: 0.6,
                stagger: { amount: 0.35, from: 'start' },
                ease: 'power3.out',
                clearProps: 'transform',
                scrollTrigger: {
                    trigger: '.gsap-shelf-grid',
                    start: 'top 88%',
                    once: true,
                },
            });
        }, this.sectionRef().nativeElement);
    }

    ngOnDestroy(): void {
        this.gsapCtx?.revert();
    }

    handleSelect(product: Product, event: MouseEvent): void {
        const card = (event.currentTarget as HTMLElement).closest('.product-card') as HTMLElement;
        if (card) {
            gsap.fromTo(
                card,
                { scale: 0.97 },
                {
                    scale: 1,
                    duration: 0.3,
                    ease: 'back.out(2)',
                    onComplete: () => this.selectProduct.emit(product),
                }
            );
        } else {
            this.selectProduct.emit(product);
        }
    }

    formatPrice(price: number): string {
        return price.toLocaleString('vi-VN') + 'đ';
    }
}