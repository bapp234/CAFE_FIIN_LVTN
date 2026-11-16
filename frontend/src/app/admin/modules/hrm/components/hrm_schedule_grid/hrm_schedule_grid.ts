import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideCalendar,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucidePlus,
  LucideX,
} from '@lucide/angular';
import { ShiftAssignment, ShiftTemplate } from '../../models/shift';
import { Employee } from '../../models/employee';

export interface DayColumn {
  dayName: string; // 'Thứ 2', 'Thứ 3', ...
  fullDate: string; // 'YYYY-MM-DD'
  displayDate: string; // '09/11'
  isToday: boolean;
}

@Component({
  selector: 'app-hrm-schedule-grid',
  templateUrl: './hrm_schedule_grid.html',
  styleUrl: './hrm_schedule_grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideChevronLeft,
    LucideChevronRight,
    LucideX,
    LucideClock,
    LucidePlus,
    LucideCalendar,
  ],
})
export class HrmScheduleGrid {
  readonly employees = input.required<Employee[]>();
  readonly shiftTemplates = input.required<ShiftTemplate[]>();
  readonly assignments = input.required<ShiftAssignment[]>();
  readonly weekStart = input.required<string>(); // 'YYYY-MM-DD' (Thứ hai)

  readonly assignShift = output<{ employee: Employee; date: string; shift: ShiftTemplate }>();
  readonly removeShift = output<string>();
  readonly changeWeek = output<'prev' | 'next' | 'today'>();

  // Slot dropdown mở nhanh
  readonly activeSlot = signal<{ empId: string; date: string } | null>(null);

  // Sinh 7 ngày trong tuần từ weekStart
  readonly daysOfWeek = computed<DayColumn[]>(() => {
    const start = new Date(this.weekStart());
    const dayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const todayStr = '2026-11-15';

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];
      const display = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
      return {
        dayName: dayLabels[i],
        fullDate: iso,
        displayDate: display,
        isToday: iso === todayStr,
      };
    });
  });

  // Nhãn khoảng thời gian tuần
  readonly weekRangeLabel = computed(() => {
    const start = new Date(this.weekStart());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    const f1 = `${start.getDate().toString().padStart(2, '0')}/${(start.getMonth() + 1).toString().padStart(2, '0')}/${start.getFullYear()}`;
    const f2 = `${end.getDate().toString().padStart(2, '0')}/${(end.getMonth() + 1).toString().padStart(2, '0')}/${end.getFullYear()}`;
    return `${f1} – ${f2}`;
  });

  // Tổng số ca đã xếp trong tuần
  readonly totalScheduledShifts = computed(() => {
    return this.assignments().filter((a) => a.status !== 'cancelled').length;
  });

  // Tổng số giờ công chuẩn đã xếp trong tuần
  readonly totalScheduledHours = computed(() => {
    const asgs = this.assignments().filter((a) => a.status !== 'cancelled');
    const tmpls = this.shiftTemplates();
    let sum = 0;
    asgs.forEach((a) => {
      const t = tmpls.find((tmpl) => tmpl.id === a.shiftId || tmpl.code === a.shiftCode);
      sum += t ? t.standardHours : 5.5;
    });
    return sum;
  });

  getAssignment(empId: string, date: string): ShiftAssignment | undefined {
    return this.assignments().find(
      (a) => a.employeeId === empId && a.date === date && a.status !== 'cancelled'
    );
  }

  toggleSlotDropdown(empId: string, date: string, event: Event): void {
    event.stopPropagation();
    const cur = this.activeSlot();
    if (cur && cur.empId === empId && cur.date === date) {
      this.activeSlot.set(null);
    } else {
      this.activeSlot.set({ empId, date });
    }
  }

  closeSlotDropdown(): void {
    this.activeSlot.set(null);
  }

  onSelectShift(emp: Employee, date: string, shift: ShiftTemplate): void {
    this.activeSlot.set(null);
    this.assignShift.emit({ employee: emp, date, shift });
  }

  onDeleteAssignment(asgId: string, event: Event): void {
    event.stopPropagation();
    this.removeShift.emit(asgId);
  }
}
