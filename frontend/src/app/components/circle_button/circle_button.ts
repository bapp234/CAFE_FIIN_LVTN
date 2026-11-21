import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
} from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Nút tròn có icon + 2 dòng chữ, hiệu ứng icon trượt từ trên xuống khi hover.
 *
 * Icon truyền qua ng-template có ref #icon:
 *
 *   <app-circle-button link="/login" subLabel="Tài khoản" label="Đăng nhập">
 *     <ng-template #icon><svg lucideUser></svg></ng-template>
 *   </app-circle-button>
 *
 * - `link`: điều hướng nội bộ (routerLink)
 * - `href`: link ngoài hoặc tel:, mailto:
 */
@Component({
  selector: 'app-circle-button',
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './circle_button.html',
  styleUrl: './circle_button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CircleButtonComponent {
  readonly icon = contentChild<TemplateRef<unknown>>('icon');

  readonly link = input<string | null>(null);
  readonly href = input<string | null>(null);

  readonly subLabel = input<string>('');
  readonly label = input.required<string>();
  /** true: chữ chính đậm và to hơn (kiểu hotline); false: nhẹ hơn (kiểu đăng nhập) */
  readonly boldLabel = input<boolean>(true);
  readonly ariaLabel = input<string | null>(null);

  protected readonly computedAriaLabel = computed(
    () => this.ariaLabel() ?? [this.subLabel(), this.label()].filter(Boolean).join(' '),
  );
}
