import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideChevronDown, LucideLogOut } from '@lucide/angular';
import { AdminUser } from '../../core/admin_session';

/** Nút avatar + tên người dùng, bấm mở khung nhỏ có nút đăng xuất. Bấm ra ngoài hoặc Esc để đóng. */
@Component({
  selector: 'app-admin-user-menu',
  imports: [LucideChevronDown, LucideLogOut],
  templateUrl: './admin_user_menu.html',
  styleUrl: './admin_user_menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'close()',
  },
})
export class AdminUserMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly user = input<AdminUser | null>(null);
  readonly signOut = output<void>();

  protected readonly open = signal(false);

  /** Hai chữ cái cuối của tên, ví dụ "Nguyễn Văn An" -> "VA" */
  protected readonly initials = computed(() => {
    const name = this.user()?.name?.trim() ?? '';
    return (
      name
        .split(/\s+/)
        .slice(-2)
        .map((w) => w.charAt(0))
        .join('')
        .toUpperCase() || '?'
    );
  });

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected close(): void {
    this.open.set(false);
  }

  protected onSignOut(): void {
    this.close();
    this.signOut.emit();
  }

  protected onDocumentClick(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }
}
