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
import { RouterLink } from '@angular/router';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export interface SideNewsItem {
  id: string;
  tag: string;
  title: string;
  date: string;
  image: string;
  alt: string;
}

@Component({
  selector: 'app-widget-landing-news',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './widget_landingNews.html',
  styleUrl: './widget_landingNews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingNews {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);

  readonly newsSection = viewChild<ElementRef<HTMLElement>>('newsSection');

  readonly mainStory = {
    image: 'https://images.unsplash.com/photo-1442512595331-e89e73853f31?auto=format&fit=crop&w=1400&q=85',
    alt: 'Tách cà phê phin rang mộc bên bàn gỗ sáng sớm',
    caption: 'Xưởng rang mẻ hạt mới cho mùa cuối năm.',
    tag: 'TIN MỚI • ĐẶC BIỆT',
    title: 'Ra mắt dòng cà phê rang mộc mùa đông',
    pullQuote: '“Mười năm, vẫn một ly cà phê”',
    pullNote: '— Tự sự của người rang hạt Fiin',
    col1: 'Hương thơm dịu nhẹ của hạt cà phê rang mộc chờ bạn mỗi sớm mai tại quán. Chúng tôi chọn lọc từ những vùng cao nguyên để giữ vị nguyên bản đậm đà.',
    col2: 'Mỗi mẻ rang được theo dõi cẩn trọng để hạt chín đều từ trong ra ngoài, mang đến nốt sô-cô-la đen ấm áp và hậu vị ngọt thanh tự nhiên.',
  };

  readonly sideStories: SideNewsItem[] = [
    {
      id: 'n1',
      tag: 'ƯU ĐÃI',
      title: 'Giảm 20% cho đơn đặt trước qua website',
      date: '07.11.2026',
      image: '/assets/images/hero/slide-01-desktop.webp',
      alt: 'Ưu đãi đặt món trực tuyến Cà Phê Fiin',
    },
    {
      id: 'n2',
      tag: 'SỰ KIỆN',
      title: 'Buổi chia sẻ pha phin cuối tuần tại quán',
      date: '04.11.2026',
      image: '/assets/images/hero/slide-02-desktop.webp',
      alt: 'Buổi giao lưu pha chế cà phê thủ công',
    },
    {
      id: 'n3',
      tag: 'NGHỆ THUẬT',
      title: 'Ba cách pha cho một hạt cà phê',
      date: '01.11.2026',
      image: '/assets/images/hero/slide-03-desktop.webp',
      alt: 'Ba phương pháp pha chế cà phê truyền thống',
    },
  ];

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) return;

      const sectionEl = this.newsSection()?.nativeElement;
      if (!sectionEl) return;

      const animCtx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: 'power3.out' },
          scrollTrigger: {
            trigger: sectionEl,
            start: 'top 78%',
            once: true,
          },
        });

        tl.from('[data-news-masthead]', {
          y: -22,
          autoAlpha: 0,
          duration: 0.6,
          clearProps: 'transform,opacity,visibility',
        })
          .from(
            '[data-news-lead]',
            {
              y: 28,
              autoAlpha: 0,
              duration: 0.7,
              clearProps: 'transform,opacity,visibility',
            },
            '-=0.35'
          )
          .from(
            '[data-news-side]',
            {
              x: 24,
              autoAlpha: 0,
              duration: 0.55,
              stagger: 0.12,
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
}
