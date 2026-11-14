import { ChangeDetectionStrategy, Component } from '@angular/core';
import { BrandLogoComponent } from '../../components/brand_logo/brand_logo';

@Component({
  selector: 'app-widget-landing-footer',
  imports: [BrandLogoComponent],
  templateUrl: './landingFooter.html',
  styleUrl: './landingFooter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingFooter { }

