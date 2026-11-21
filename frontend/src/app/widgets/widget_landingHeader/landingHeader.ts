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
import gsap from 'gsap';
import { BrandLogoComponent } from '../../components/brand_logo/brand_logo';
import { ButtonOrderComponent } from '../../components/button_order/button_order';
import { NavigationBarComponent } from '../../components/navigation_bar/navigation_bar';
import { LucideMenu, LucideX } from '@lucide/angular';

@Component({
  selector: 'app-widget-landing-header',
  imports: [
    ButtonOrderComponent,
    BrandLogoComponent,
    NavigationBarComponent,
    LucideMenu,
    LucideX,
  ],
  templateUrl: './landingHeader.html',
  styleUrl: './landingHeader.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingHeader {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly headerEl = viewChild<ElementRef<HTMLElement>>('headerEl');
  readonly isMenuOpen = signal(false);
  readonly isScrolled = signal(false);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      const onScroll = () => {
        this.isScrolled.set(window.scrollY > 80);
      };

      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });

      const headerNative = this.headerEl()?.nativeElement;
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let animCtx: gsap.Context | undefined;

      if (headerNative && !reduceMotion) {
        animCtx = gsap.context(() => {
          const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

          tl.from(headerNative, {
            y: -48,
            autoAlpha: 0,
            duration: 0.65,
            clearProps: 'transform,opacity,visibility',
          }).from(
            '[data-header-item]',
            {
              y: -14,
              autoAlpha: 0,
              duration: 0.45,
              stagger: 0.08,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.35'
          );
        }, headerNative);
      }

      this.destroyRef.onDestroy(() => {
        window.removeEventListener('scroll', onScroll);
        animCtx?.revert();
      });
    });
  }

  toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
