import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  signal,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface SignatureDrink {
  id: string;
  code: string;
  name: string;
  price: string;
  description: string;
  cupStyle: 'muoi' | 'bac-xiu' | 'trung' | 'phin';
  badge?: string;
  isHot?: boolean;
}

@Component({
  selector: 'app-widget-landing-signature',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './widget_landingSignature.html',
  styleUrl: './widget_landingSignature.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingSignature {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly counterSection = viewChild<ElementRef<HTMLElement>>('counterSection');
  readonly activeIndex = signal<number>(1);

  readonly drinks: SignatureDrink[] = [
    {
      id: 'sig-1',
      code: '01',
      name: 'Cà phê muối',
      price: '35.000đ',
      description: 'Lớp kem mặn béo nhẹ hòa quyện nền phin đậm đà',
      cupStyle: 'muoi',
      isHot: false,
    },
    {
      id: 'sig-2',
      code: '02',
      name: 'Bạc xỉu nóng',
      price: '32.000đ',
      description: 'Sữa đặc sánh mịn cùng hương cà phê phin ấm nồng',
      cupStyle: 'bac-xiu',
      badge: 'ĐƯỢC YÊU THÍCH NHẤT',
      isHot: true,
    },
    {
      id: 'sig-3',
      code: '03',
      name: 'Cà phê trứng',
      price: '42.000đ',
      description: 'Kem trứng đánh bông mịn màng thơm nức mũi',
      cupStyle: 'trung',
      isHot: true,
    },
    {
      id: 'sig-4',
      code: '04',
      name: 'Cà phê rang mộc',
      price: '38.000đ',
      description: 'Vị nguyên bản tinh tế, hậu vị ngọt thanh tự nhiên',
      cupStyle: 'phin',
      isHot: false,
    },
  ];

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      const sectionEl = this.counterSection()?.nativeElement;
      if (!sectionEl) return;

      const animCtx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 76%',
            once: true,
          },
        });

        tl.from('[data-sig-header]', {
          y: -20,
          autoAlpha: 0,
          duration: 0.55,
          clearProps: 'transform,opacity,visibility',
        })
          .from(
            '[data-sig-plaque]',
            {
              y: -20,
              autoAlpha: 0,
              duration: 0.5,
              stagger: 0.09,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.3'
          )
          .from(
            '[data-sig-stem]',
            {
              scaleY: 0,
              transformOrigin: 'top center',
              duration: 0.4,
              stagger: 0.08,
              clearProps: 'transform',
            },
            '-=0.35'
          )
          .from(
            '[data-sig-cup]',
            {
              y: 26,
              scale: 0.9,
              autoAlpha: 0,
              duration: 0.6,
              stagger: 0.09,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.35'
          )
          .from(
            '[data-sig-counter]',
            {
              scaleX: 0.5,
              autoAlpha: 0,
              duration: 0.6,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.45'
          );
      }, sectionEl);

      this.destroyRef.onDestroy(() => {
        animCtx.revert();
      });
    });
  }

  selectDrink(index: number): void {
    if (index === this.activeIndex()) return;
    this.activeIndex.set(index);
    this.pulseSelectedCup(index);
  }

  private pulseSelectedCup(index: number): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    const sectionEl = this.counterSection()?.nativeElement;
    if (!sectionEl) return;
    const cups = sectionEl.querySelectorAll<HTMLElement>('[data-sig-cup]');
    const target = cups[index];
    if (target) {
      gsap.fromTo(
        target,
        { y: 6, scale: 0.96 },
        { y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.7)', clearProps: 'transform' }
      );
    }
  }
}
