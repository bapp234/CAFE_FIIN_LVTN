import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

@Component({
  selector: 'app-admin-status-badge',
  templateUrl: './admin_status_badge.html',
  styleUrl: './admin_status_badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
})
export class AdminStatusBadge {
  readonly label = input.required<string>();
  readonly variant = input<BadgeVariant>('neutral');
  readonly dot = input<boolean>(true);
  readonly size = input<'sm' | 'md'>('md');
}
