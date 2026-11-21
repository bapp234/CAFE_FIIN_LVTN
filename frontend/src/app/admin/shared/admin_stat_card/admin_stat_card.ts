import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  LucideActivity,
  LucideAlertTriangle,
  LucideClock,
  LucideDollarSign,
  LucideTrendingDown,
  LucideTrendingUp,
  LucideUsers,
} from '@lucide/angular';

@Component({
  selector: 'app-admin-stat-card',
  templateUrl: './admin_stat_card.html',
  styleUrl: './admin_stat_card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LucideTrendingUp,
    LucideTrendingDown,
    LucideUsers,
    LucideClock,
    LucideDollarSign,
    LucideAlertTriangle,
    LucideActivity,
  ],
})
export class AdminStatCard {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly diff = input<string>('');
  readonly trend = input<'up' | 'down' | 'neutral'>('neutral');
  readonly trendLabel = input<string>('so với kỳ trước');
  readonly icon = input<'users' | 'clock' | 'dollar' | 'alert' | 'activity'>('activity');
}
