import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

@Component({
  selector: 'app-widget-landing-newsletter',
  standalone: true,
  imports: [],
  templateUrl: './widget_landingNewsletter.html',
  styleUrl: './widget_landingNewsletter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetLandingNewsletter {
  readonly emailValue = signal<string>('');
  readonly statusMessage = signal<string | null>(null);
  readonly isError = signal<boolean>(false);

  onInputChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.emailValue.set(val);
    if (this.statusMessage()) {
      this.statusMessage.set(null);
    }
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    const email = this.emailValue().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      this.isError.set(true);
      this.statusMessage.set('Vui lòng nhập địa chỉ email hợp lệ.');
      return;
    }

    this.isError.set(false);
    this.statusMessage.set(`Cảm ơn bạn! Đã ghi nhận email ${email}.`);
    this.emailValue.set('');
  }
}
