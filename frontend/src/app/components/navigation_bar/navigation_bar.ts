import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-navigation-bar',
  templateUrl: './navigation_bar.html',
  styleUrl: './navigation_bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class NavigationBarComponent {}

