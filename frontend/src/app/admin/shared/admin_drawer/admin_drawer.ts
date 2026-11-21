import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  input,
  output,
} from '@angular/core';
import { LucideX } from '@lucide/angular';

@Component({
  selector: 'app-admin-drawer',
  templateUrl: './admin_drawer.html',
  styleUrl: './admin_drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideX],
})
export class AdminDrawer {
  readonly isOpen = input.required<boolean>();
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly width = input<string>('28rem');

  readonly close = output<void>();

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.close.emit();
    }
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
