import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { WidgetCartDrawer } from './widgets/widget_cart_drawer/cart_drawer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, WidgetCartDrawer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  protected readonly title = signal('coffee-shop-web');

  protected readonly isCustomerRoute = computed(() => {
    const url = this.router.url;
    return !url.startsWith('/admin') && !url.startsWith('/staff');
  });
}
