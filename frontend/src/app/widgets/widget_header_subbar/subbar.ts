import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideMenu } from '@lucide/angular';
import gsap from 'gsap';

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
  imports: [RouterLink, LucideMenu],
  templateUrl: './subbar.html',
  styleUrl: './subbar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetHeaderSubbar {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly isSidebarOpen = input<boolean>(true);
  readonly links = input<SubbarLink[]>(DEFAULT_SUBBAR_LINKS);
  readonly toggleSidebar = output<void>();

  constructor() {
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
}
