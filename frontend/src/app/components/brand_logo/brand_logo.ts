import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-brand-logo',
  templateUrl: './brand_logo.html',
  styleUrl: './brand_logo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class BrandLogoComponent {}

