import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import {
  LucideCalendar,
  LucideChevronLeft,
  LucideChevronRight,
  LucideChevronsLeft,
  LucideChevronsRight,
} from '@lucide/angular';

export interface DatePickerCell {
  iso: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  isDisabled: boolean;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Date -> 'yyyy-MM-dd' theo giờ địa phương (tránh lệch ngày do toISOString dùng UTC). */
export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'yyyy-MM-dd' -> Date (giờ địa phương), trả về null nếu không hợp lệ. */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function addMonths(d: Date, n: number): Date {
  const first = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  return new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysInMonth));
}

/**
 * Chọn ngày dùng chung cho toàn bộ trang admin. Giá trị là chuỗi 'yyyy-MM-dd'.
 *
 * Ví dụ:
 *   <app-admin-date-picker
 *     [value]="dateFilter()"
 *     (valueChange)="onDateFilterChange($event)"
 *     ariaLabel="Chọn ngày đối soát"
 *   />
 * hoặc: <app-admin-date-picker [(value)]="dateFilter" [clearable]="true" />
 *
 * Có thể bấm biểu tượng lịch để chọn, hoặc gõ tay theo dạng dd/mm/yyyy
 * (tự thêm dấu "/"; Enter hoặc rời khỏi ô để xác nhận, Esc để hủy).
 */
@Component({
  selector: 'app-admin-date-picker',
  templateUrl: './admin_date_picker.html',
  styleUrl: './admin_date_picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LucideCalendar,
    LucideChevronLeft,
    LucideChevronRight,
    LucideChevronsLeft,
    LucideChevronsRight,
  ],
  host: {
    '(document:click)': 'onDocumentClick($event)',
  },
})
export class AdminDatePickerComponent {
  private static nextId = 0;

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly value = model<string>('');
  readonly placeholder = input('dd/mm/yyyy');
  readonly ariaLabel = input('');
  /** Ngày nhỏ nhất / lớn nhất được chọn, dạng 'yyyy-MM-dd'. */
  readonly min = input('');
  readonly max = input('');
  readonly clearable = input(false);
  readonly disabled = input(false);

  readonly isOpen = signal(false);
  readonly viewYear = signal(new Date().getFullYear());
  readonly viewMonth = signal(new Date().getMonth());
  readonly focusedIso = signal('');
  /** Nội dung đang gõ trong ô (dd/mm/yyyy). */
  readonly text = signal('');
  readonly invalid = signal(false);

  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('dateInput');

  readonly uid = `admin-date-${++AdminDatePickerComponent.nextId}`;
  readonly weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  readonly monthLabel = computed(() => `Tháng ${this.viewMonth() + 1}, ${this.viewYear()}`);

  readonly displayValue = computed(() => {
    const d = parseIsoDate(this.value());
    return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '';
  });

  /** Lưới 6 tuần x 7 ngày, bắt đầu từ thứ Hai. */
  readonly weeks = computed<DatePickerCell[][]>(() => {
    const y = this.viewYear();
    const m = this.viewMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const today = toIsoDate(new Date());
    const selected = this.value();
    const min = this.min();
    const max = this.max();

    const weeks: DatePickerCell[][] = [];
    for (let w = 0; w < 6; w++) {
      const row: DatePickerCell[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(y, m, 1 - offset + w * 7 + d);
        const iso = toIsoDate(date);
        row.push({
          iso,
          day: date.getDate(),
          inMonth: date.getMonth() === m,
          isToday: iso === today,
          isSelected: iso === selected,
          isDisabled: (!!min && iso < min) || (!!max && iso > max),
        });
      }
      weeks.push(row);
    }
    return weeks;
  });

  readonly panelId = `${this.uid}-panel`;

  constructor() {
    // Đồng bộ ô nhập mỗi khi giá trị thật thay đổi (chọn lịch, set từ ngoài, xác nhận khi gõ)
    effect(() => {
      this.text.set(this.displayValue());
      this.invalid.set(false);
    });
  }

  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  open(): void {
    if (this.disabled() || this.isOpen()) return;
    this.setFocus(parseIsoDate(this.value()) ?? new Date(), false);
    this.isOpen.set(true);
    this.focusCell();
  }

  close(returnFocus = false): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    if (returnFocus) {
      this.host.nativeElement.querySelector<HTMLElement>('.dp-input')?.focus();
    }
  }

  pick(cell: DatePickerCell): void {
    if (cell.isDisabled) return;
    this.value.set(cell.iso);
    this.close(true);
  }

  pickToday(): void {
    const iso = toIsoDate(new Date());
    const min = this.min();
    const max = this.max();
    if ((min && iso < min) || (max && iso > max)) return;
    this.value.set(iso);
    this.close(true);
  }

  clear(): void {
    this.value.set('');
    this.close(true);
  }

  /** Nút điều hướng: đổi tháng/năm đang xem, không cướp focus của nút. */
  shift(months: number): void {
    const cur = parseIsoDate(this.focusedIso()) ?? new Date();
    this.setFocus(addMonths(cur, months), false);
  }

  onInput(event: Event): void {
    const el = event.target as HTMLInputElement;
    const deleting = (event as InputEvent).inputType?.startsWith('delete') ?? false;

    // Dán chuỗi dạng yyyy-MM-dd thì đổi sang dd/MM/yyyy
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.value.trim());
    const raw = iso ? `${iso[3]}${iso[2]}${iso[1]}` : el.value;

    const digits = raw.replace(/\D/g, '').slice(0, 8);
    const formatted = this.formatDigits(digits, !deleting);
    el.value = formatted; // gán thẳng vì signal có thể không đổi nên binding không cập nhật lại DOM
    this.text.set(formatted);
    this.invalid.set(false);

    const parsed = this.parseText(formatted);
    if (parsed && this.isOpen()) this.setFocus(parseIsoDate(parsed)!, false);
  }

  onInputBlur(): void {
    this.commit(true);
  }

  onInputKeydown(event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.commit(false)) this.close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.isOpen() ? this.focusCell() : this.open();
    }
  }

  onGridKeydown(event: KeyboardEvent): void {
    const cur = parseIsoDate(this.focusedIso()) ?? new Date();
    let next: Date | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        next = addDays(cur, -1);
        break;
      case 'ArrowRight':
        next = addDays(cur, 1);
        break;
      case 'ArrowUp':
        next = addDays(cur, -7);
        break;
      case 'ArrowDown':
        next = addDays(cur, 7);
        break;
      case 'Home':
        next = addDays(cur, -((cur.getDay() + 6) % 7));
        break;
      case 'End':
        next = addDays(cur, 6 - ((cur.getDay() + 6) % 7));
        break;
      case 'PageUp':
        next = addMonths(cur, event.shiftKey ? -12 : -1);
        break;
      case 'PageDown':
        next = addMonths(cur, event.shiftKey ? 12 : 1);
        break;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const cell = this.weeks()
          .flat()
          .find((c) => c.iso === this.focusedIso());
        if (cell) this.pick(cell);
        return;
      }
      default:
        return;
    }

    event.preventDefault();
    this.setFocus(next, true);
  }

  onEscape(event: Event): void {
    if (this.isOpen()) {
      event.preventDefault();
      this.close(true);
    } else if (this.text() !== this.displayValue() || this.invalid()) {
      this.revert();
    }
  }

  onFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (this.isOpen() && next && !this.host.nativeElement.contains(next)) {
      this.close();
    }
  }

  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.host.nativeElement.contains(event.target as Node)) {
      this.close();
    }
  }

  /** 'ddmm' -> 'dd/mm', thêm dấu '/' tự động khi đang gõ tới (không thêm khi đang xóa). */
  private formatDigits(digits: string, appendSlash: boolean): string {
    const d = digits.slice(0, 2);
    const m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    let out = d;
    if (digits.length > 2 || (appendSlash && digits.length === 2)) out += '/' + m;
    if (digits.length > 4 || (appendSlash && digits.length === 4)) out += '/' + y;
    return out;
  }

  /** 'dd/mm/yyyy' -> 'yyyy-MM-dd' nếu hợp lệ và nằm trong min/max, ngược lại null. */
  private parseText(text: string): string | null {
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
    if (!m) return null;
    const iso = `${m[3]}-${m[2]}-${m[1]}`;
    if (!parseIsoDate(iso)) return null;
    const min = this.min();
    const max = this.max();
    if ((min && iso < min) || (max && iso > max)) return null;
    return iso;
  }

  /** Xác nhận nội dung đã gõ. Trả về true nếu hợp lệ. */
  private commit(revertOnInvalid: boolean): boolean {
    const text = this.text().trim();

    if (!text) {
      if (this.clearable()) {
        this.invalid.set(false);
        this.value.set('');
        return true;
      }
      this.revert();
      return false;
    }

    const iso = this.parseText(text);
    if (iso) {
      this.invalid.set(false);
      if (iso !== this.value()) this.value.set(iso);
      else this.setText(this.displayValue());
      return true;
    }

    if (revertOnInvalid) this.revert();
    else this.invalid.set(true);
    return false;
  }

  private revert(): void {
    this.invalid.set(false);
    this.setText(this.displayValue());
  }

  private setText(text: string): void {
    this.text.set(text);
    const el = this.inputEl()?.nativeElement;
    if (el) el.value = text;
  }

  private setFocus(date: Date, focusCell: boolean): void {
    this.focusedIso.set(toIsoDate(date));
    this.viewYear.set(date.getFullYear());
    this.viewMonth.set(date.getMonth());
    if (focusCell) this.focusCell();
  }

  private focusCell(): void {
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector<HTMLElement>(`[data-date="${this.focusedIso()}"]`)
          ?.focus();
      },
      { injector: this.injector }
    );
  }
}
