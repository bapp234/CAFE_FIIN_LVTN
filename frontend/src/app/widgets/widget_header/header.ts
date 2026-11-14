import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DOCUMENT } from '@angular/common';
import { BrandLogoComponent } from '../../components/brand_logo/brand_logo';
import { SearchBoxComponent } from '../../components/search_box/search_box';
import { CircleButtonComponent } from '../../components/circle_button/circle_button';
import { CartButtonComponent } from '../../components/cart_button/cart_button';

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


  readonly cartCount = input<number>(0);
  readonly isSidebarOpen = input<boolean>(true);

  readonly toggleSidebar = output<void>();
  readonly toggleCart = output<void>();

  readonly isMobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((v) => !v);
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
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

