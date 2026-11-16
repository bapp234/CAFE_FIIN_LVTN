import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { LucideMenu } from '@lucide/angular';
import gsap from 'gsap';
import { filter } from 'rxjs';
import {
  CategoryItem,
  DEFAULT_CATEGORY_TREE,
  WidgetHomeSidebar,
} from '../widget_home_sidebar/sidebar';

export interface SubbarLink {
  label: string;
  path: string;
}

export const DEFAULT_SUBBAR_LINKS: SubbarLink[] = [
  { label: 'Thực đơn', path: '/san-pham' },
  { label: 'Chuyện phiếm & Tin tức', path: '/tin-tuc' },
  { label: 'Ưu đãi thành viên', path: '/uu-dai' },
  { label: 'Chính sách đổi trả', path: '/chinh-sach-doi-tra' },
  { label: 'Liên hệ', path: '/lien-he' },
];

@Component({
  selector: 'app-widget-header-subbar',
  imports: [RouterLink, LucideMenu, WidgetHomeSidebar],
  templateUrl: './subbar.html',
  styleUrl: './subbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHeaderSubbar {
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSidebarOpen = input<boolean>(false);
  readonly categories = input<CategoryItem[]>(DEFAULT_CATEGORY_TREE);
  readonly links = input<SubbarLink[]>(DEFAULT_SUBBAR_LINKS);
  readonly toggleSidebar = output<void>();
  readonly closeSidebar = output<void>();

  /** Trang chủ thì dùng sidebar dạng inline/ngăn kéo có sẵn, các trang khác dùng dạng dropdown */
  protected readonly isHome = computed(() => {
    const url = this.router.url.split('?')[0].split('#')[0];
    return url === '' || url === '/' || url === '/home';
  });

  protected readonly isDropdownMode = computed(() => !this.isHome());

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (this.isSidebarOpen() && this.isDropdownMode()) {
          this.closeSidebar.emit();
        }
      });

    afterNextRender(() => {
      const el = this.host.nativeElement;
      const q = gsap.utils.selector(el);
      const mm = gsap.matchMedia();

      // Người dùng bật "giảm chuyển động" thì bỏ qua animation
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const items = q('.cat-toggle-btn, .sub-nav-link');

        gsap
          .timeline({
            delay: 0.3, // chờ hàng chính của header vào trước
            defaults: { ease: 'power2.out' },
            onComplete: () => {
              el.classList.add('subbar-rendered');
              // gỡ style inline để không đè lên hover/transition trong CSS
              gsap.set([q('.header-sub-bar'), items], {
                clearProps: 'transform,opacity,visibility',
              });
            },
          })
          .from(q('.header-sub-bar'), { y: -16, autoAlpha: 0, duration: 0.7 })
          .from(items, { y: -8, autoAlpha: 0, duration: 0.5, stagger: 0.06 }, '-=0.45');
      });

      this.destroyRef.onDestroy(() => mm.revert());
    });
  }

  onToggleSidebar(): void {
    this.toggleSidebar.emit();
  }

  onCloseDropdown(): void {
    this.closeSidebar.emit();
  }
}
