import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

export interface ComboBoxOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-combo-box-multi',
  standalone: true,
  templateUrl: './combo_box_multi.html',
  styleUrl: './combo_box_multi.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboBoxMultiComponent {
  readonly options = input<ComboBoxOption[]>([]);
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('');
  readonly searchPlaceholder = input<string>('Tìm kiếm...');

  readonly valueChange = output<string>();

  readonly isOpen = signal(false);
  readonly searchQuery = signal('');

  readonly selectedLabel = computed(() => {
    const val = this.value();
    if (!val) return this.placeholder();
    return this.options().find((o) => o.value === val)?.label ?? this.placeholder();
  });

  readonly filteredOptions = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.options();
    return this.options().filter((o) => o.label.toLowerCase().includes(q));
  });

  toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
    if (!this.isOpen()) {
      this.searchQuery.set('');
    }
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  selectOption(val: string): void {
    this.valueChange.emit(val);
    this.isOpen.set(false);
    this.searchQuery.set('');
  }
}
