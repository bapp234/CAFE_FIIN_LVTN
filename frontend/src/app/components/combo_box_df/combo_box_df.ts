import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { ComboBoxOption } from '../combo_box_multi/combo_box_multi';

@Component({
  selector: 'app-combo-box-df',
  standalone: true,
  templateUrl: './combo_box_df.html',
  styleUrl: './combo_box_df.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComboBoxDfComponent {
  readonly options = input<ComboBoxOption[]>([]);
  readonly value = input<string>('');
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('');

  readonly valueChange = output<string>();

  readonly isOpen = signal(false);

  readonly selectedLabel = computed(() => {
    const val = this.value();
    if (!val) return this.placeholder();
    return this.options().find((o) => o.value === val)?.label ?? this.placeholder();
  });

  toggle(): void {
    if (this.disabled()) return;
    this.isOpen.update((v) => !v);
  }

  selectOption(val: string): void {
    this.valueChange.emit(val);
    this.isOpen.set(false);
  }
}
