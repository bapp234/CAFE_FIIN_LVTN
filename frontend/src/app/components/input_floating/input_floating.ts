import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-input-floating',
  standalone: true,
  templateUrl: './input_floating.html',
  styleUrl: './input_floating.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputFloatingComponent),
      multi: true,
    },
  ],
})
export class InputFloatingComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly id = input<string>('');
  readonly type = input<string>('text');
  readonly autocomplete = input<string>('off');
  readonly placeholder = input<string>(' '); // Placeholder rỗng để hỗ trợ CSS :placeholder-shown
  readonly errorMessage = input<string>('');
  readonly required = input<boolean>(false);

  readonly innerValue = signal<string>('');
  readonly isFocused = signal<boolean>(false);
  readonly showPassword = signal<boolean>(false);
  readonly isDisabled = signal<boolean>(false);

  readonly inputId = computed(
    () => this.id() || 'floating-inp-' + Math.random().toString(36).substring(2, 9),
  );

  /** Tách nhãn thành từng chữ cái để tạo hiệu ứng gợn sóng (Wave animation) */
  readonly labelLetters = computed(() => Array.from(this.label()));

  readonly isFloating = computed(() => this.isFocused() || !!this.innerValue());

  readonly effectiveType = computed(() => {
    if (this.type() === 'password') {
      return this.showPassword() ? 'text' : 'password';
    }
    return this.type();
  });

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(val: any): void {
    this.innerValue.set(val != null ? String(val) : '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.innerValue.set(val);
    this.onChange(val);
  }

  onFocus(): void {
    this.isFocused.set(true);
  }

  onBlur(): void {
    this.isFocused.set(false);
    this.onTouched();
  }

  togglePassword(): void {
    this.showPassword.update((s) => !s);
  }
}
