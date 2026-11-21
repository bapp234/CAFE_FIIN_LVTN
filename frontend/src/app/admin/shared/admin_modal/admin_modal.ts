import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { LucideAlertTriangle, LucideCheckCircle, LucideHelpCircle } from '@lucide/angular';

@Component({
  selector: 'app-admin-modal',
  templateUrl: './admin_modal.html',
  styleUrl: './admin_modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideAlertTriangle, LucideHelpCircle, LucideCheckCircle],
})
export class AdminModal {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly message = input<string>('');
  readonly confirmText = input<string>('Xác nhận');
  readonly cancelText = input<string>('Hủy bỏ');
  readonly variant = input<'danger' | 'warning' | 'primary'>('danger');
  readonly isLoading = input<boolean>(false);

  readonly confirm = output<void>();
  readonly cancel = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen() && !this.isLoading()) {
      this.cancel.emit();
    }
  }
}
