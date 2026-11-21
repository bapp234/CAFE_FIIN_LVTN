import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  PLATFORM_ID,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import gsap from 'gsap';

@Component({
  selector: 'app-widget-landing-hero',
  imports: [],
  templateUrl: './landingHero.html',
  styleUrl: './landingHero.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingHero {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly heroImg = viewChild<ElementRef<HTMLElement>>('heroImg');
  readonly heroMarquee = viewChild<ElementRef<HTMLElement>>('heroMarquee');

  readonly heroImage = '/assets/images/hero/slide-02-desktop.webp';
  readonly heroAlt = 'Không gian hoài niệm bên tách cà phê vợt nóng hổi tại Cà Phê Fiin';
  readonly marqueeItems = [
    'CÀ PHÊ FIIN - SINCE 2016',
    'HƯƠNG VỊ CŨ',
    'ĐẬM VỊ XƯA',
  ];

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      const imgEl = this.heroImg()?.nativeElement;
      const marqueeEl = this.heroMarquee()?.nativeElement;
      if (!imgEl) return;

      const animCtx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

        tl.from(imgEl, {
          scale: 0.88,
          autoAlpha: 0,
          duration: 0.95,
          clearProps: 'transform,opacity,visibility',
        });

        if (marqueeEl) {
          tl.from(
            marqueeEl,
            {
              y: 16,
              autoAlpha: 0,
              duration: 0.55,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.45'
          );
        }
      });

      this.destroyRef.onDestroy(() => {
        animCtx.revert();
      });
    });
  }
}
