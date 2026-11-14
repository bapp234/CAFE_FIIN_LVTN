import {
    afterNextRender,
    ChangeDetectionStrategy,
    Component,
    computed,
    DestroyRef,
    effect,
    ElementRef,
    inject,
    Injector,
    input,
    output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideChevronLeft, LucideChevronRight } from '@lucide/angular';
import gsap from 'gsap';

export interface HeroSlideItem {
    title: string;
    subtitle: string;
    desc: string;
    image: string;
    /**
     * Đường dẫn nội bộ mà slide trỏ tới, ví dụ '/uu-dai'.
     * Có `link` thì bấm ảnh sẽ điều hướng bằng routerLink.
     * Không có thì hero phát output `slideClick` để trang cha tự xử lý (vd mở sản phẩm).
     */
    link?: string;
}

/**
 * Hero vào sau header một nhịp ngắn (giây) để hai phần nối tiếp nhau.
 * Header: trượt xuống 20px, 0.6s, power3.out, bắt đầu ở 0s.
 */
const HERO_INTRO_DELAY = 0.2;
const EASE = 'power3.out';
const CLEAR = 'transform,opacity,visibility';

@Component({
    selector: 'app-widget-home-hero',
    imports: [RouterLink, LucideChevronLeft, LucideChevronRight, LucideArrowRight],
    templateUrl: './hero.html',
    styleUrl: './hero.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHomeHero {
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly injector = inject(Injector);
    private readonly destroyRef = inject(DestroyRef);

    private ctx?: gsap.Context;
    private introStarted = false;

    readonly slides = input.required<HeroSlideItem[]>();
    readonly currentSlide = input.required<number>();

    /** Bấm vào ảnh ô lớn khi slide không có `link`, phát ra chỉ số slide */
    readonly slideClick = output<number>();
    readonly prevClick = output<void>();
    readonly nextClick = output<void>();
    /** Bấm ô nhỏ để chuyển sang slide đó, phát ra chỉ số slide */
    readonly selectSlide = output<number>();

    /** Mảng 1 phần tử: giúp @for tạo lại DOM mỗi lần đổi slide để chạy animation vào */
    protected readonly active = computed(() => {
        const slide = this.slides()[this.currentSlide()];
        return slide ? [slide] : [];
    });

    /** Tối đa 2 slide kế tiếp (xoay vòng) hiển thị ở các ô nhỏ */
    protected readonly others = computed(() => {
        const list = this.slides();
        const cur = this.currentSlide();
        const count = Math.min(2, list.length - 1);
        return Array.from({ length: Math.max(count, 0) }, (_, i) => {
            const index = (cur + i + 1) % list.length;
            return { index, slide: list[index] };
        });
    });

    constructor() {
        // Animation vào lần đầu: chỉ chạy ở trình duyệt
        afterNextRender(() => {
            this.ctx = gsap.context(() => {}, this.host.nativeElement);
            if (!this.prefersReducedMotion()) {
                this.playIntro();
            }
            this.introStarted = true;
        });

        // Đổi slide: các ô nhỏ được tạo lại, cho chúng hiện lần lượt
        effect(() => {
            this.currentSlide(); // đăng ký phụ thuộc
            if (!this.introStarted) return; // bỏ qua lần chạy đầu, đã có intro
            afterNextRender(
                () => {
                    if (!this.prefersReducedMotion()) {
                        this.playSideTilesIn();
                    }
                },
                { injector: this.injector },
            );
        });

        this.destroyRef.onDestroy(() => this.ctx?.revert());
    }

    protected pad(n: number): string {
        return String(n).padStart(2, '0');
    }

    private prefersReducedMotion(): boolean {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    private playIntro(): void {
        const q = gsap.utils.selector(this.host.nativeElement);

        this.ctx?.add(() => {
            gsap
                .timeline({ delay: HERO_INTRO_DELAY, defaults: { ease: EASE, duration: 0.7 } })
                // Ô lớn trồi lên và hiện dần
                .from(q('.tile-main'), { y: 28, autoAlpha: 0, scale: 0.985, clearProps: CLEAR })
                // Các ô nhỏ theo sau, lần lượt cách nhau 0.1s
                .from(
                    q('.tile-side'),
                    { y: 28, autoAlpha: 0, scale: 0.985, stagger: 0.1, clearProps: CLEAR },
                    '<0.1',
                )
                // Viên thuốc điều hướng hiện sau cùng khi ô lớn gần xong
                .from(
                    q('.main-controls'),
                    { y: 12, autoAlpha: 0, duration: 0.5, clearProps: CLEAR },
                    '-=0.4',
                );
        });
    }

    private playSideTilesIn(): void {
        const q = gsap.utils.selector(this.host.nativeElement);

        this.ctx?.add(() => {
            gsap.from(q('.tile-side'), {
                y: 20,
                autoAlpha: 0,
                duration: 0.5,
                ease: EASE,
                stagger: 0.08,
                clearProps: CLEAR,
            });
        });
    }
}
