import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideAlertTriangle,
  LucideEye,
  LucideEyeOff,
  LucideKeyRound,
  LucideLock,
  LucideUnlock,
} from '@lucide/angular';
import { AdminModal } from '../../../../shared/admin_modal/admin_modal';

export interface HrmLockConfirmPayload {
  password: string;
  reason: string;
}

const MIN_UNLOCK_REASON_LENGTH = 5;

@Component({
  selector: 'app-hrm-lock-modal',
  templateUrl: './hrm_lock_modal.html',
  styleUrl: './hrm_lock_modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideAlertTriangle,
    LucideEye,
    LucideEyeOff,
    LucideKeyRound,
    LucideLock,
    LucideUnlock,
    AdminModal,
  ],
})
export class HrmLockModalComponent {
  readonly isOpen = input<boolean>(false);
  readonly mode = input<'lock' | 'unlock'>('lock');
  readonly title = input<string>('Xác nhận');
  readonly description = input<string>('');
  readonly periodLabel = input<string>('');
  readonly isLoading = input<boolean>(false);
  readonly errorMessage = input<string>('');

  readonly confirmed = output<HrmLockConfirmPayload>();
  readonly cancelled = output<void>();

  readonly passwordInput = viewChild<ElementRef<HTMLInputElement>>('passwordInput');
  readonly reasonInput = viewChild<ElementRef<HTMLTextAreaElement>>('reasonInput');

  readonly password = signal('');
  readonly reason = signal('');
  readonly showPassword = signal(false);
  readonly localError = signal('');
  readonly invalidField = signal<'password' | 'reason' | null>(null);

  readonly minReasonLength = MIN_UNLOCK_REASON_LENGTH;

  readonly passwordFieldId = computed(() => `hrmLockPassword-${this.mode()}`);
  readonly reasonFieldId = computed(() => `hrmUnlockReason-${this.mode()}`);

  readonly resolvedDescription = computed(() => {
    const custom = this.description().trim();
    if (custom) return custom;
    return this.mode() === 'lock'
      ? 'Sau khi khóa, dữ liệu trong kỳ này sẽ chuyển sang chế độ chỉ đọc để đảm bảo tính nhất quán.'
      : 'Mở khóa sẽ cho phép chỉnh sửa lại dữ liệu kỳ này. Vui lòng nhập lý do để lưu nhật ký kiểm soát.';
  });

  readonly reasonTrimmedLength = computed(() => this.reason().trim().length);
  readonly isReasonValid = computed(() => this.reasonTrimmedLength() >= MIN_UNLOCK_REASON_LENGTH);
  readonly displayError = computed(() => this.localError() || this.errorMessage());

  constructor() {
    effect((onCleanup) => {
      if (this.isOpen()) {
        this.password.set('');
        this.reason.set('');
        this.showPassword.set(false);
        this.localError.set('');
        this.invalidField.set(null);

        const timer = setTimeout(() => {
          this.passwordInput()?.nativeElement.focus();
        }, 0);
        onCleanup(() => clearTimeout(timer));
      }
    });
  }

  onPasswordChange(value: string): void {
    this.password.set(value);
    if (this.invalidField() === 'password' || this.localError()) {
      this.localError.set('');
      this.invalidField.set(null);
    }
  }

  onReasonChange(value: string): void {
    this.reason.set(value);
    if (this.invalidField() === 'reason' || this.localError()) {
      this.localError.set('');
      this.invalidField.set(null);
    }
  }

  togglePasswordVisibility(): void {
    if (this.isLoading()) return;
    this.showPassword.update((v) => !v);
  }

  onPasswordEnter(): void {
    if (this.isLoading()) return;
    if (this.mode() === 'lock') {
      this.onConfirm();
    } else {
      this.reasonInput()?.nativeElement.focus();
    }
  }

  onReasonKeydown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      this.onConfirm();
    }
  }

  onConfirm(): void {
    if (this.isLoading()) return;

    const pwd = this.password().trim();
    const rsn = this.reason().trim();

    if (!pwd) {
      this.localError.set('Vui lòng nhập mật khẩu xác nhận.');
      this.invalidField.set('password');
      this.passwordInput()?.nativeElement.focus();
      return;
    }

    if (this.mode() === 'unlock' && rsn.length < MIN_UNLOCK_REASON_LENGTH) {
      this.localError.set(
        `Vui lòng nhập lý do mở khóa (tối thiểu ${MIN_UNLOCK_REASON_LENGTH} ký tự).`
      );
      this.invalidField.set('reason');
      this.reasonInput()?.nativeElement.focus();
      return;
    }

    this.localError.set('');
    this.invalidField.set(null);
    this.confirmed.emit({ password: pwd, reason: rsn });
  }

  onCancel(): void {
    if (this.isLoading()) return;
    this.localError.set('');
    this.invalidField.set(null);
    this.cancelled.emit();
  }
}
