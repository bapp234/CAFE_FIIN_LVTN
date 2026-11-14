import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { WidgetLandingHeader } from '../../widgets/widget_landingHeader/landingHeader';
import { WidgetLandingHero } from '../../widgets/widget_landingHero/landingHero';
import { WidgetLandingFooter } from '../../widgets/widget_landingFooter/landingFooter';
import { WidgetLandingAbout } from '../../widgets/widget_landingAbout/landingAbout';
import { WidgetLandingNews } from '../../widgets/widget_landingNews/widget_landingNews';
import { WidgetLandingSignature } from '../../widgets/widget_landingSignature/widget_landingSignature';
import { WidgetLandingNewsletter } from '../../widgets/widget_landingNewsletter/widget_landingNewsletter';

@Component({
  selector: 'app-page-landing',
  imports: [
    WidgetLandingHeader,
    WidgetLandingHero,
    WidgetLandingAbout,
    WidgetLandingSignature,
    WidgetLandingNews,
    WidgetLandingNewsletter,
    WidgetLandingFooter,
  ],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageLanding implements OnInit {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  ngOnInit(): void {
    this.titleService.setTitle('Cà Phê Sài Gòn - Hương Vị Truyền Thống Giữa Lòng Thành Phố');

    this.metaService.updateTag({
      name: 'description',
      content: 'Trang giới thiệu không gian và thực đơn cà phê Sài Gòn truyền thống. Thưởng thức hương vị cà phê đậm đà và đặt hàng trực tuyến tiện lợi.'
    });

    this.metaService.updateTag({
      property: 'og:title',
      content: 'Cà Phê Sài Gòn - Hương Vị Truyền Thống'
    });

    this.metaService.updateTag({
      property: 'og:description',
      content: 'Khám phá câu chuyện cà phê phin, không gian ấm cúng và thực đơn đồ uống phong phú.'
    });

    this.metaService.updateTag({
      property: 'og:type',
      content: 'website'
    });
  }
}