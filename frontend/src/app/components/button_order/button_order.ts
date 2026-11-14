import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-button-order',
  imports: [RouterLink],
  templateUrl: './button_order.html',
  styleUrl: './button_order.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    '[class.is-full-width]': 'fullWidth()',
  },
})
export class ButtonOrderComponent {
  readonly text = input<string>('Đặt món ngay');
  readonly type = input<'link' | 'button' | 'submit'>('link');
  readonly routerLink = input<string | null>('/home');
  readonly disabled = input<boolean>(false);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly fullWidth = input<boolean>(false);
}
