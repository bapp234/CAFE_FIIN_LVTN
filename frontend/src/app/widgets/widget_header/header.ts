import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import gsap from 'gsap';
import { BrandLogoComponent } from '../../components/brand_logo/brand_logo';
import { SearchBoxComponent } from '../../components/search_box/search_box';
import { CircleButtonComponent } from '../../components/circle_button/circle_button';
import { CartButtonComponent } from '../../components/cart_button/cart_button';
import { WidgetHeaderSubbar } from '../widget_header_subbar/subbar';

import {
  LucideMenu,
  LucidePhone,
  LucideUser,
  LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-widget-header',
  imports: [
    RouterLink,
    BrandLogoComponent,
    SearchBoxComponent,
    CircleButtonComponent,
    CartButtonComponent,
    WidgetHeaderSubbar,
    LucidePhone,
    LucideUser,
    LucideMenu,
    LucideX,
  ],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHeader {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly cartCount = input<number>(0);
  readonly isSidebarOpen = input<boolean>(true);

  readonly toggleSidebar = output<void>();
  readonly toggleCart = output<void>();

  readonly isMobileMenuOpen = signal<boolean>(false);
  private mobileMenuTl: gsap.core.Timeline | null = null;

  constructor() {
    afterNextRender(() => {
      const q = gsap.utils.selector(this.host.nativeElement);
      const mm = gsap.matchMedia();

      // Tôn trọng người dùng bật "giảm chuyển động" trong hệ điều hành
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out', duration: 0.6 },
          // Gỡ style inline để không đè lên hover/transition trong CSS
          onComplete: () => {
            this.host.nativeElement.classList.add('header-rendered');
            gsap.set(
              q(
                '.header-main-row, .brand-link, .header-search, .header-actions > *'
              ),
              {
                clearProps: 'all',
              }
            );
          },
        });

        tl.from(q('.header-main-row'), { y: -20, autoAlpha: 0 })
          .from(q('.brand-link'), { x: -20, autoAlpha: 0 }, '<0.1')
          .from(q('.header-search'), { scale: 0.96, autoAlpha: 0 }, '<0.1')
          .from(q('.header-actions > *'), { y: -12, autoAlpha: 0, stagger: 0.08 }, '<0.05');
      });

      this.destroyRef.onDestroy(() => {
        mm.revert();
        if (this.mobileMenuTl) {
          this.mobileMenuTl.kill();
        }
      });
    });
  }

  toggleMobileMenu(): void {
    if (this.isMobileMenuOpen()) {
      this.closeMobileMenu();
    } else {
      this.openMobileMenu();
    }
  }

  openMobileMenu(): void {
    if (this.isMobileMenuOpen()) return;
    this.isMobileMenuOpen.set(true);

    const panel = this.host.nativeElement.querySelector('.mobile-nav-panel');
    if (!panel) return;
    const items = panel.querySelectorAll('.mobile-search-wrap, .mobile-nav-item');

    if (this.mobileMenuTl) {
      this.mobileMenuTl.kill();
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(panel, { autoAlpha: 1, pointerEvents: 'auto', clipPath: 'none', y: 0 });
      gsap.set(items, { autoAlpha: 1, y: 0 });
      return;
    }

    this.mobileMenuTl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        gsap.set(panel, { clearProps: 'clipPath,transform' });
        gsap.set(items, { clearProps: 'transform' });
        this.mobileMenuTl = null;
      },
    });

    this.mobileMenuTl
      .set(panel, { autoAlpha: 1, pointerEvents: 'auto' })
      .fromTo(
        panel,
        { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', y: -14 },
        { clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)', y: 0, duration: 0.38 }
      )
      .fromTo(
        items,
        { autoAlpha: 0, y: -10 },
        { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.3 },
        '-=0.22'
      );
  }

  closeMobileMenu(): void {
    if (!this.isMobileMenuOpen()) return;
    this.isMobileMenuOpen.set(false);

    const panel = this.host.nativeElement.querySelector('.mobile-nav-panel');
    if (!panel) return;
    const items = panel.querySelectorAll('.mobile-search-wrap, .mobile-nav-item');

    if (this.mobileMenuTl) {
      this.mobileMenuTl.kill();
    }

    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(panel, { autoAlpha: 0, pointerEvents: 'none' });
      return;
    }

    this.mobileMenuTl = gsap.timeline({
      defaults: { ease: 'power2.in', duration: 0.22 },
      onComplete: () => {
        gsap.set(panel, { autoAlpha: 0, pointerEvents: 'none' });
        this.mobileMenuTl = null;
      },
    });

    this.mobileMenuTl
      .to(items, { autoAlpha: 0, y: -8, stagger: 0.02 })
      .to(
        panel,
        { clipPath: 'polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)', y: -8 },
        '-=0.12'
      );
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onToggleCart(): void {
    this.toggleCart.emit();
  }

  onSearch(query: string): void {
    const q = (query || '').trim();
    if (q) {
      this.router.navigate(['/tim-kiem'], { queryParams: { q } });
    } else {
      this.router.navigate(['/tim-kiem']);
    }
    this.closeMobileMenu();
  }

  onReloadPage(event: Event): void {
    event.preventDefault();
    this.closeMobileMenu();
    this.document.defaultView?.location.reload();
  }
}
