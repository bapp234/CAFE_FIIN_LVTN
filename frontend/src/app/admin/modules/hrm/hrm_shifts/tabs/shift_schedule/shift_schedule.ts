import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import {
  LucideCalendar,
  LucideCheck,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideDownload,
  LucideLock,
  LucideRotateCcw,
  LucideUnlock,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminSession } from '../../../../../core/admin_session';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import {
  AdminGridTableComponent,
  GridBadge,
  GridBadgeVariant,
  GridColumn,
  GridRow,
  GridSort,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { Employee } from '../../../models/employee';
import { ShiftAssignment, ShiftTemplate } from '../../../models/shift';
import { HrmEmployeeApi, getPositionLevel } from '../../../services/hrm_employee_api';
import { HrmShiftApi, ShiftScheduleWeekStatus } from '../../../services/hrm_shift_api';
import {
  HrmLockConfirmPayload,
  HrmLockModalComponent,
} from '../../../components/hrm_lock_modal/hrm_lock_modal';
import { getCurrentWeekMondayIso, getCurrentYearMonth } from '../../../utils/hrm_date_helpers';

interface WeekDayMeta {
  key: string;
  iso: string;
  dayName: string;
  displayDate: string;
  columnLabel: string;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Tính danh sách các tuần (Thứ 2 -> Chủ Nhật) giao với tháng/năm được chọn */
function buildWeeksOfMonth(yearMonth: string): ComboOption[] {
  const [y, m] = yearMonth.split('-').map(Number);
  const firstDayOfMonth = new Date(y, m - 1, 1);
  const lastDayOfMonth = new Date(y, m, 0);

  // Tìm ngày Thứ Hai đầu tiên (có thể nằm ở cuối tháng trước)
  const dayOfWeek = firstDayOfMonth.getDay(); // 0 (CN) -> 6 (T7)
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const currentMonday = new Date(firstDayOfMonth);
  currentMonday.setDate(firstDayOfMonth.getDate() + diffToMonday);

  const options: ComboOption[] = [];
  let weekIdx = 1;

  while (currentMonday <= lastDayOfMonth) {
    const sunday = new Date(currentMonday);
    sunday.setDate(currentMonday.getDate() + 6);

    const mondayIso = toIsoDate(currentMonday);
    options.push({
      value: mondayIso,
      label: `T${weekIdx} (${formatShortDate(currentMonday)}–${formatShortDate(sunday)})`,
    });

    currentMonday.setDate(currentMonday.getDate() + 7);
    weekIdx++;
  }

  return options;
}

@Component({
  selector: 'app-shift-schedule',
  templateUrl: './shift_schedule.html',
  styleUrl: './shift_schedule.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideCalendar,
    LucideCheck,
    LucideChevronLeft,
    LucideChevronRight,
    LucideClock,
    LucideDownload,
    LucideLock,
    LucideRotateCcw,
    LucideUnlock,
    LucideUpload,
    LucideX,
    AdminModal,
    AdminDrawer,
    AdminButtonComponent,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
    HrmLockModalComponent,
  ],
})
export class ShiftSchedule {
  readonly adminSession = inject(AdminSession);
  readonly branchService = inject(AdminBranchService);
  private readonly shiftApi = inject(HrmShiftApi);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);

  // ---- Template Ref cho ô Thứ / Ngày ----
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly dayCellTemplate = viewChild<TemplateRef<any>>('dayCellTemplate');

  // ---- Bộ lọc & Chọn Tháng/Năm + Tuần ----
  readonly selectedMonth = signal<string>(getCurrentYearMonth().split('-')[1]);
  readonly selectedYear = signal<string>(getCurrentYearMonth().split('-')[0]);
  readonly selectedMonthYear = computed<string>(() => `${this.selectedYear()}-${this.selectedMonth()}`);
  readonly weekStart = signal<string>(getCurrentWeekMondayIso());
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);
  readonly isImportConfirmOpen = signal(false);
  readonly isImporting = signal(false);
  readonly pendingImportItems = signal<Array<{ emp: Employee; day: WeekDayMeta; shiftCode: string }>>([]);
  readonly pendingImportEmployeeCount = signal(0);

  // ---- Dữ liệu gốc & Phân trang cuộn lười 50 nhân sự ----
  readonly employees = signal<Employee[]>([]);
  readonly templates = signal<ShiftTemplate[]>([]);
  readonly assignments = signal<ShiftAssignment[]>([]);
  readonly searchQuery = signal('');
  readonly empPage = signal(1);
  readonly empPageSize = 50;
  readonly hasMoreEmployees = signal(true);
  readonly isLoadingMore = signal(false);

  // ---- Chọn dòng trên GridTable & Xếp ca hàng loạt ----
  readonly selectedEmployeeCodes = signal<string[]>([]);
  readonly bulkDayIso = signal<string>('');
  readonly bulkShiftCode = signal<string>('OFF');
  readonly isBulkAssigning = signal(false);

  readonly bulkDayOptions = computed<ComboOption[]>(() =>
    this.weekDaysMeta().map((d) => ({
      value: d.iso,
      label: d.columnLabel,
    }))
  );

  readonly bulkShiftOptions = computed<ComboOption[]>(() => [
    { value: 'OFF', label: 'OFF · Nghỉ / Hủy ca' },
    ...this.templates().map((t) => ({
      value: t.code,
      label: `${t.code} · ${t.name} (${t.startTime}–${t.endTime})`,
    })),
  ]);

  readonly effectiveBulkDayIso = computed<string>(() => {
    const cur = this.bulkDayIso();
    const days = this.weekDaysMeta();
    if (cur && days.some((d) => d.iso === cur)) return cur;
    return days[0]?.iso || '';
  });

  // ---- Modal Chọn Ca Nhanh Cho Ô Ngày ----
  readonly isShiftPickerOpen = signal(false);
  readonly pickingEmployee = signal<Employee | null>(null);
  readonly pickingDay = signal<WeekDayMeta | null>(null);
  readonly currentShiftCode = computed(() => {
    const emp = this.pickingEmployee();
    const day = this.pickingDay();
    if (!emp || !day) return '';
    return this.getEmployeeShiftCodeOnDate(emp.id, day.iso);
  });

  // ---- Trạng thái Khóa ca tuần (Cấp 1 trong 3 Cấp Khóa) ----
  readonly weekStatus = signal<ShiftScheduleWeekStatus | null>(null);
  readonly isWeekLocked = computed(() => this.weekStatus()?.isLocked ?? false);
  readonly isCheckingWeekStatus = signal(false);
  readonly isLockingWeek = signal(false);
  readonly isUnlockingWeek = signal(false);
  readonly isLockWeekConfirmOpen = signal(false);
  readonly isUnlockWeekConfirmOpen = signal(false);

  // Chỉ Quản lý chi nhánh, Nhân sự hoặc Admin (Cấp >= 3) mới được Khóa / Mở khóa tuần
  readonly canLockOrUnlockWeek = computed(() => {
    const user = this.adminSession.user();
    if (!user) return false;
    return getPositionLevel(user.role || '') >= 3;
  });

  // ---- Drawer phân ca cho nhân viên (dự phòng) ----
  readonly isAssignDrawerOpen = signal(false);
  readonly editingEmployee = signal<Employee | null>(null);

  // ---- Tùy chọn Combobox Chi nhánh ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  // ---- Danh sách Tháng (Tháng 01 - 12) ----
  readonly monthOptions: ComboOption[] = [
    { value: '01', label: 'Tháng 01' },
    { value: '02', label: 'Tháng 02' },
    { value: '03', label: 'Tháng 03' },
    { value: '04', label: 'Tháng 04' },
    { value: '05', label: 'Tháng 05' },
    { value: '06', label: 'Tháng 06' },
    { value: '07', label: 'Tháng 07' },
    { value: '08', label: 'Tháng 08' },
    { value: '09', label: 'Tháng 09' },
    { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' },
    { value: '12', label: 'Tháng 12' },
  ];

  // ---- Danh sách Năm (Cho phép chọn các năm cũ từ 2020 - 2030) ----
  readonly yearOptions: ComboOption[] = (() => {
    const list: ComboOption[] = [];
    for (let y = 2030; y >= 2020; y--) {
      list.push({
        value: String(y),
        label: `Năm ${y}`,
      });
    }
    return list;
  })();

  // ---- Ô 2: Danh sách các Tuần trong Tháng/Năm đang chọn ----
  readonly weekOptions = computed<ComboOption[]>(() =>
    buildWeeksOfMonth(this.selectedMonthYear())
  );

  // =========================================================================
  // METADATA 7 NGÀY TRONG TUẦN & ĐỊNH NGHĨA CỘT CHO ADMIN-GRID-TABLE
  // =========================================================================
  readonly weekDaysMeta = computed<WeekDayMeta[]>(() => {
    const [y, m, day] = this.weekStart().split('-').map(Number);
    const start = new Date(y, m - 1, day);
    const names = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = toIsoDate(d);
      const displayDate = formatShortDate(d);
      return {
        key: `day_${i}`,
        iso,
        dayName: names[i],
        displayDate,
        columnLabel: `${names[i]} (${displayDate})`,
      };
    });
  });

  readonly weekRangeLabel = computed(() => {
    const days = this.weekDaysMeta();
    if (!days.length) return '';
    return `${days[0].displayDate} – ${days[6].displayDate}`;
  });

  private readonly shiftBadgeMap = computed<Record<string, GridBadge>>(() => {
    const map: Record<string, GridBadge> = {
      OFF: { label: 'Nghỉ', variant: 'neutral' },
    };
    const colorToVariant: Record<string, GridBadgeVariant> = {
      emerald: 'success',
      amber: 'warning',
      indigo: 'info',
      rose: 'danger',
      sky: 'info',
    };
    for (const t of this.templates()) {
      map[t.code] = {
        label: `${t.code} (${t.startTime}–${t.endTime})`,
        variant: colorToVariant[t.color || 'emerald'] ?? 'success',
      };
    }
    return map;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly scheduleCellTemplates = computed<Record<string, TemplateRef<any>>>(() => {
    const tpl = this.dayCellTemplate();
    if (!tpl) return {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map: Record<string, TemplateRef<any>> = {};
    for (let i = 0; i < 7; i++) {
      map[`day_${i}`] = tpl;
    }
    return map;
  });

  readonly scheduleColumns = computed<GridColumn[]>(() => {
    const badgeMap = this.shiftBadgeMap();
    const dayCols: GridColumn[] = this.weekDaysMeta().map((d) => ({
      key: d.key,
      label: d.columnLabel,
      type: 'badge',
      align: 'center',
      minWidth: '8.5rem',
      badgeMap,
      editable: true, // Kích hoạt custom cell template để bấm chọn ca trực tiếp
    }));

    return [
      { key: 'code', label: 'Mã NV', type: 'code', width: '6.5rem', align: 'center', sortable: true, mono: true },
      {
        key: 'fullName',
        label: 'Họ và tên',
        type: 'text',
        bold: true,
        minWidth: '12rem',
        sortable: true,
        subKey: 'position',
      },
      { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '8.5rem', sortable: true },
      { key: 'weekSummary', label: 'Tổng tuần', type: 'pill', width: '7.5rem', align: 'center', sortable: true },
      ...dayCols,
    ];
  });

  readonly scheduleRows = computed<GridRow[]>(() => {
    const days = this.weekDaysMeta();
    const tmpls = this.templates();
    const q = this.searchQuery().trim().toLowerCase();

    // Tối ưu tra cứu O(1) theo khóa employeeId_date
    const asgMap = new Map<string, ShiftAssignment>();
    for (const a of this.assignments()) {
      if (a.status !== 'cancelled') {
        asgMap.set(`${a.employeeId}_${a.date}`, a);
      }
    }

    const tmplHoursMap = new Map<string, number>();
    for (const t of tmpls) {
      tmplHoursMap.set(t.id, t.standardHours);
      tmplHoursMap.set(t.code, t.standardHours);
    }

    const sortedEmployees = [...this.employees()]
      .filter((emp) => {
        if (!q) return true;
        return (
          (emp.code || '').toLowerCase().includes(q) ||
          (emp.fullName || '').toLowerCase().includes(q) ||
          (emp.position || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.code || '').localeCompare(b.code || '', 'vi'));

    const rows: GridRow[] = [];

    for (const emp of sortedEmployees) {
      let totalShifts = 0;
      let totalHours = 0;

      const row: GridRow = {
        _raw: emp,
        id: emp.id,
        code: emp.code,
        fullName: emp.fullName,
        position: emp.position || 'Nhân viên',
        branchName: emp.branchName || 'Mặc định',
      };

      for (const d of days) {
        const found = asgMap.get(`${emp.id}_${d.iso}`);
        if (found) {
          row[d.key] = found.shiftCode;
          totalShifts++;
          const stdHours = tmplHoursMap.get(found.shiftId) ?? tmplHoursMap.get(found.shiftCode) ?? 5.5;
          totalHours += stdHours;
        } else {
          row[d.key] = 'OFF';
        }
      }

      const roundedHours = Math.round(totalHours * 100) / 100;
      row['totalShifts'] = totalShifts;
      row['totalHours'] = roundedHours;
      row['weekSummary'] = `${totalShifts} ca · ${roundedHours}h`;
      rows.push(row);
    }

    return rows;
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadScheduleData();
        this.loadWeekStatus();
      });
    });
  }

  loadScheduleData(): void {
    this.isLoading.set(true);
    this.empPage.set(1);
    this.hasMoreEmployees.set(true);
    const branchId = this.branchService.selectedBranchId();

    this.employeeApi
      .getEmployees({ page: 1, size: this.empPageSize, branchId, status: 'working', q: this.searchQuery() })
      .subscribe((res) => {
        this.employees.set(res.items);
        this.hasMoreEmployees.set(res.items.length >= this.empPageSize && res.items.length < res.total);
      });

    this.shiftApi
      .getShiftTemplates(branchId)
      .subscribe((res) => this.templates.set(res));

    const [y, m, day] = this.weekStart().split('-').map(Number);
    const endD = new Date(y, m - 1, day);
    endD.setDate(endD.getDate() + 6);
    const end = toIsoDate(endD);

    this.shiftApi
      .getWeekSchedule({ branchId, startDate: this.weekStart(), endDate: end })
      .subscribe({
        next: (res) => {
          this.assignments.set(res);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });

    this.loadWeekStatus();
  }

  loadWeekStatus(): void {
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? 1 : (this.employeeApi.normalizeBranchId(rawBranch) || 1);
    const startDate = this.weekStart();

    this.isCheckingWeekStatus.set(true);
    this.shiftApi.getShiftScheduleWeekStatus(branchId, startDate).subscribe({
      next: (status) => {
        this.weekStatus.set(status);
        this.isCheckingWeekStatus.set(false);
      },
      error: () => {
        this.isCheckingWeekStatus.set(false);
      },
    });
  }

  readonly lockWeekError = signal('');
  readonly unlockWeekError = signal('');

  openLockWeekConfirm(): void {
    if (!this.canLockOrUnlockWeek()) {
      this.toastService.warning('Bạn không có quyền khóa lịch ca tuần.');
      return;
    }
    if (this.isWeekLocked() || this.isLockingWeek()) return;
    this.lockWeekError.set('');
    this.isLockWeekConfirmOpen.set(true);
  }

  openUnlockWeekConfirm(): void {
    if (!this.canLockOrUnlockWeek()) {
      this.toastService.warning('Chỉ Quản lý cửa hàng, Nhân sự hoặc Quản trị viên mới có quyền mở khóa ca tuần.');
      return;
    }
    if (!this.isWeekLocked() || this.isUnlockingWeek()) return;
    this.unlockWeekError.set('');
    this.isUnlockWeekConfirmOpen.set(true);
  }

  executeLockWeek(payload: HrmLockConfirmPayload): void {
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? 0 : (this.employeeApi.normalizeBranchId(rawBranch) ?? 0);
    const startDate = this.weekStart();
    const lockedBy = this.adminSession.user()?.name || 'manager';

    this.isLockingWeek.set(true);
    this.lockWeekError.set('');
    this.shiftApi
      .lockShiftSchedule({
        branchId,
        startDate,
        lockedBy,
        password: payload.password,
      })
      .subscribe({
        next: () => {
          this.isLockingWeek.set(false);
          this.isLockWeekConfirmOpen.set(false);
          this.toastService.success(`Đã khóa lịch ca tuần ${this.weekRangeLabel()}!`);
          this.loadWeekStatus();
        },
        error: (err: Error) => {
          this.isLockingWeek.set(false);
          this.lockWeekError.set(err.message || 'Không thể khóa lịch ca tuần.');
        },
      });
  }

  executeUnlockWeek(payload: HrmLockConfirmPayload): void {
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? 0 : (this.employeeApi.normalizeBranchId(rawBranch) ?? 0);
    const startDate = this.weekStart();
    const unlockedBy = this.adminSession.user()?.name || 'manager';

    this.isUnlockingWeek.set(true);
    this.unlockWeekError.set('');
    this.shiftApi
      .unlockShiftSchedule({
        branchId,
        startDate,
        password: payload.password,
        unlockReason: payload.reason,
        unlockedBy,
      })
      .subscribe({
        next: () => {
          this.isUnlockingWeek.set(false);
          this.isUnlockWeekConfirmOpen.set(false);
          this.toastService.success(`Đã mở khóa lịch ca tuần ${this.weekRangeLabel()}!`);
          this.loadWeekStatus();
        },
        error: (err: Error) => {
          this.isUnlockingWeek.set(false);
          this.unlockWeekError.set(err.message || 'Không thể mở khóa lịch ca tuần.');
        },
      });
  }

  // =========================================================================
  // ĐIỀU KHIỂN CHUYỂN TUẦN TỚI / LÙI (WEEK NAVIGATION STEPPER)
  // =========================================================================
  goToPreviousWeek(): void {
    const [y, m, d] = this.weekStart().split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - 7);
    this.applyNewWeek(date);
  }

  goToNextWeek(): void {
    const [y, m, d] = this.weekStart().split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() + 7);
    this.applyNewWeek(date);
  }

  private applyNewWeek(mondayDate: Date): void {
    const newWeekIso = toIsoDate(mondayDate);
    const newMonth = String(mondayDate.getMonth() + 1).padStart(2, '0');
    const newYear = String(mondayDate.getFullYear());

    this.weekStart.set(newWeekIso);
    if (this.selectedMonth() !== newMonth) {
      this.selectedMonth.set(newMonth);
    }
    if (this.selectedYear() !== newYear) {
      this.selectedYear.set(newYear);
    }

    this.loadScheduleData();
  }

  // =========================================================================
  // SỰ KIỆN CHỌN THÁNG/NĂM & CHỌN TUẦN TỰ DO
  // =========================================================================
  onMonthChange(month: string): void {
    this.selectedMonth.set(month);
    this.updateWeekSelection();
  }

  onYearChange(year: string): void {
    this.selectedYear.set(year);
    this.updateWeekSelection();
  }

  private updateWeekSelection(): void {
    const ym = this.selectedMonthYear();
    const weeks = buildWeeksOfMonth(ym);
    if (weeks.length > 0) {
      const firstInMonth = weeks.find((w) => w.value.startsWith(ym)) ?? weeks[0];
      this.weekStart.set(firstInMonth.value);
    }
    this.loadScheduleData();
  }

  onWeekSelectChange(mondayIso: string): void {
    this.weekStart.set(mondayIso);
    this.loadScheduleData();
  }

  // =========================================================================
  // CHỌN CA NHANH TRỰC TIẾP KHI BẤM VÀO Ô THỨ / NGÀY TRÊN BẢNG
  // =========================================================================
  openShiftPicker(row: GridRow, col: GridColumn, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }

    if (this.isWeekLocked()) {
      this.toastService.warning('Lịch ca tuần này đã bị khóa. Vui lòng mở khóa trước khi điều chỉnh ca làm.');
      return;
    }

    const emp = row['_raw'] as Employee | undefined;
    if (!emp) return;

    const dayMeta = this.weekDaysMeta().find((d) => d.key === col.key);
    if (!dayMeta) return;

    this.pickingEmployee.set(emp);
    this.pickingDay.set(dayMeta);
    this.isShiftPickerOpen.set(true);
  }

  closeShiftPicker(): void {
    this.isShiftPickerOpen.set(false);
    this.pickingEmployee.set(null);
    this.pickingDay.set(null);
  }

  selectShiftForPicking(shiftCode: string): void {
    const emp = this.pickingEmployee();
    const day = this.pickingDay();
    if (!emp || !day) return;

    const existing = this.assignments().find(
      (a) => a.employeeId === emp.id && a.date === day.iso && a.status !== 'cancelled'
    );

    if (!shiftCode || shiftCode === 'OFF') {
      if (existing) {
        this.shiftApi.removeShiftAssignment(existing.id).subscribe({
          next: () => {
            this.assignments.update((list) => list.filter((a) => a.id !== existing.id));
            this.toastService.info(`Đã chuyển sang Nghỉ ngày ${day.displayDate} cho ${emp.fullName}`);
            this.closeShiftPicker();
          },
          error: (err) => this.toastService.error(err.message),
        });
      } else {
        this.closeShiftPicker();
      }
      return;
    }

    const tmpl = this.templates().find((t) => t.code === shiftCode);
    if (!tmpl) return;

    const newAsg: ShiftAssignment = {
      id: existing ? existing.id : `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.fullName,
      branchId: emp.branchId,
      date: day.iso,
      shiftId: tmpl.id,
      shiftCode: tmpl.code,
      shiftName: tmpl.name,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
      registeredBy: 'manager',
      status: 'scheduled',
    };

    this.shiftApi.saveShiftAssignment(newAsg).subscribe({
      next: (saved) => {
        this.assignments.update((list) => [
          ...list.filter((a) => !(a.employeeId === emp.id && a.date === day.iso)),
          saved,
        ]);
        this.toastService.success(
          `Đã xếp ${saved.shiftCode} cho ${saved.employeeName} (${day.dayName} ${day.displayDate})`
        );
        this.closeShiftPicker();
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  getShiftColorVariant(val: string): string {
    if (!val || val === 'OFF') return 'neutral';
    const tmpl = this.templates().find((t) => t.code === val);
    return tmpl?.color || 'emerald';
  }

  // =========================================================================
  // XUẤT DANH SÁCH CA LÀM CỦA TẤT CẢ NHÂN VIÊN TRONG TUẦN
  // =========================================================================
  openExportConfirm(): void {
    if (this.scheduleRows().length === 0) {
      this.toastService.warning('Không có dữ liệu lịch phân ca để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportWeeklyScheduleExcel(): void {
    const rows = this.scheduleRows();
    if (rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const days = this.weekDaysMeta();
    const headers = [
      'Mã NV',
      'Họ và tên',
      'Chức vụ',
      'Chi nhánh',
      ...days.map((d) => `${d.dayName} (${d.displayDate})`),
      'Tổng số ca',
      'Tổng giờ công',
    ];

    const payloadRows = rows.map((r) => {
      const record: Record<string, unknown> = {
        'Mã NV': String(r['code'] ?? ''),
        'Họ và tên': String(r['fullName'] ?? ''),
        'Chức vụ': String(r['position'] ?? ''),
        'Chi nhánh': String(r['branchName'] ?? ''),
      };
      for (const d of days) {
        record[`${d.dayName} (${d.displayDate})`] = String(r[d.key] || 'OFF');
      }
      record['Tổng số ca'] = Number(r['totalShifts'] ?? 0);
      record['Tổng giờ công'] = `${r['totalHours'] ?? 0}h`;
      return record;
    });

    const endIso = days.length > 0 ? days[6].iso : '';
    const fileName = `Fiin_HRM_Lich_Ca_Tuan_${this.weekStart()}_den_${endIso}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Shift_Schedule',
        sheetName: 'Lịch ca tuần',
        reportTitle: `LỊCH PHÂN CA TUẦN (${this.weekRangeLabel()})`,
        summaryLabel: 'Tổng số nhân sự:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.isExportConfirmOpen.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success('Đã xuất bảng lịch ca làm việc tuần ra tệp Excel!');
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel lịch ca tuần. Vui lòng thử lại.');
        },
      });
  }

  // =========================================================================
  // NHẬP LỊCH CA TUẦN TỪ FILE EXCEL (.XLSX)
  // =========================================================================
  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    if (this.isWeekLocked()) {
      this.toastService.warning('Tuần này đã khóa ca, không thể nhập lịch từ Excel.');
      return;
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.toastService.warning('Vui lòng chọn tệp Excel (.xlsx).');
      return;
    }

    this.isImporting.set(true);
    this.employeeApi.parseExcelRows(file).subscribe({
      next: ({ headers, rows }) => {
        this.isImporting.set(false);
        const days = this.weekDaysMeta();
        const empByCode = new Map(
          this.employees().map((e) => [e.code.trim().toUpperCase(), e])
        );
        const validShiftCodes = new Set(
          this.templates().map((t) => t.code.trim().toUpperCase())
        );

        const items: Array<{ emp: Employee; day: WeekDayMeta; shiftCode: string }> = [];
        const matchedEmpCodes = new Set<string>();

        for (const row of rows) {
          const rawCode = (row['Mã NV'] || row['Mã nhân viên'] || row['MaNhanVien'] || '').trim().toUpperCase();
          if (!rawCode) continue;
          const emp = empByCode.get(rawCode);
          if (!emp) continue;

          for (const day of days) {
            const colKey =
              headers.find((h) => h.trim() === `${day.dayName} (${day.displayDate})`) ||
              headers.find((h) => h.includes(day.displayDate)) ||
              headers.find((h) => h.toLowerCase().startsWith(day.dayName.toLowerCase()));
            if (!colKey) continue;

            const cellVal = (row[colKey] ?? '').trim().toUpperCase();
            const normalized = !cellVal || cellVal === 'OFF' || cellVal === '-' ? 'OFF' : cellVal;
            if (normalized !== 'OFF' && !validShiftCodes.has(normalized)) continue;

            const currentExisting = this.assignments().find(
              (a) => a.employeeId === emp.id && a.date === day.iso && a.status !== 'cancelled'
            );
            const currentCode = currentExisting?.shiftCode?.toUpperCase() || 'OFF';
            if (currentCode === normalized) continue;

            items.push({ emp, day, shiftCode: normalized });
            matchedEmpCodes.add(emp.code);
          }
        }

        if (items.length === 0) {
          this.toastService.info('Không có thay đổi phân ca hợp lệ nào cần cập nhật từ tệp Excel.');
          return;
        }

        this.pendingImportItems.set(items);
        this.pendingImportEmployeeCount.set(matchedEmpCodes.size);
        this.isImportConfirmOpen.set(true);
      },
      error: () => {
        this.isImporting.set(false);
        this.toastService.error('Không thể đọc dữ liệu từ tệp Excel. Vui lòng kiểm tra lại định dạng.');
      },
    });
  }

  confirmImportScheduleExcel(): void {
    const items = this.pendingImportItems();
    if (items.length === 0) {
      this.isImportConfirmOpen.set(false);
      return;
    }

    this.isImporting.set(true);
    const ops = items
      .map(({ emp, day, shiftCode }) => {
        const existing = this.assignments().find(
          (a) => a.employeeId === emp.id && a.date === day.iso && a.status !== 'cancelled'
        );
        if (shiftCode === 'OFF') {
          return existing ? this.shiftApi.removeShiftAssignment(existing.id) : null;
        }
        const tmpl = this.templates().find((t) => t.code.toUpperCase() === shiftCode);
        if (!tmpl) return null;
        const newAsg: ShiftAssignment = {
          id: existing ? existing.id : `asg-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          employeeId: emp.id,
          employeeCode: emp.code,
          employeeName: emp.fullName,
          branchId: emp.branchId,
          date: day.iso,
          shiftId: tmpl.id,
          shiftCode: tmpl.code,
          shiftName: tmpl.name,
          startTime: tmpl.startTime,
          endTime: tmpl.endTime,
          registeredBy: 'manager',
          status: 'scheduled',
        };
        return this.shiftApi.saveShiftAssignment(newAsg);
      })
      .filter((op): op is NonNullable<typeof op> => op !== null);

    if (ops.length === 0) {
      this.isImporting.set(false);
      this.isImportConfirmOpen.set(false);
      return;
    }

    forkJoin(ops).subscribe({
      next: () => {
        this.isImporting.set(false);
        this.isImportConfirmOpen.set(false);
        this.pendingImportItems.set([]);
        this.toastService.success(`Đã nhập thành công ${ops.length} lượt phân ca từ tệp Excel!`);
        this.loadScheduleData();
      },
      error: () => {
        this.isImporting.set(false);
        this.toastService.error('Có lỗi xảy ra khi lưu lịch phân ca từ Excel.');
      },
    });
  }

  // =========================================================================
  // SỰ KIỆN BẢNG LƯỚI & DRAWER PHÂN CA
  // =========================================================================
  onRowClick(row: GridRow): void {
    const code = String(row['code']);
    const current = this.selectedEmployeeCodes();
    if (current.includes(code)) {
      this.selectedEmployeeCodes.set(current.filter((c) => c !== code));
    } else {
      this.selectedEmployeeCodes.set([...current, code]);
    }
  }

  clearSelection(): void {
    this.selectedEmployeeCodes.set([]);
  }

  isAllSelected(): boolean {
    const rows = this.scheduleRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeCodes.set(this.scheduleRows().map((r) => String(r['code'])));
    }
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  openAssignDrawer(row: GridRow): void {
    const emp = row['_raw'] as Employee | undefined;
    if (!emp) return;
    this.editingEmployee.set(emp);
    this.isAssignDrawerOpen.set(true);
  }

  getEmployeeShiftCodeOnDate(employeeId: string, isoDate: string): string {
    const found = this.assignments().find(
      (a) => a.employeeId === employeeId && a.date === isoDate && a.status !== 'cancelled'
    );
    return found ? found.shiftCode : '';
  }

  onSelectShiftForDay(emp: Employee, isoDate: string, event: Event): void {
    const select = event.target as HTMLSelectElement;
    const shiftCode = select.value;

    const existing = this.assignments().find(
      (a) => a.employeeId === emp.id && a.date === isoDate && a.status !== 'cancelled'
    );

    if (!shiftCode) {
      if (existing) {
        this.shiftApi.removeShiftAssignment(existing.id).subscribe({
          next: () => {
            this.assignments.update((list) => list.filter((a) => a.id !== existing.id));
            this.toastService.info(`Đã hủy ca ngày ${isoDate} của ${emp.fullName}`);
          },
          error: (err) => this.toastService.error(err.message),
        });
      }
      return;
    }

    const tmpl = this.templates().find((t) => t.code === shiftCode);
    if (!tmpl) return;

    const newAsg: ShiftAssignment = {
      id: existing ? existing.id : `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      employeeId: emp.id,
      employeeCode: emp.code,
      employeeName: emp.fullName,
      branchId: emp.branchId,
      date: isoDate,
      shiftId: tmpl.id,
      shiftCode: tmpl.code,
      shiftName: tmpl.name,
      startTime: tmpl.startTime,
      endTime: tmpl.endTime,
      registeredBy: 'manager',
      status: 'scheduled',
    };

    this.shiftApi.saveShiftAssignment(newAsg).subscribe({
      next: (saved) => {
        this.assignments.update((list) => [
          ...list.filter((a) => !(a.employeeId === emp.id && a.date === isoDate)),
          saved,
        ]);
        this.toastService.success(
          `Đã xếp ${saved.shiftCode} cho ${saved.employeeName} (${saved.date})`
        );
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
    this.empPage.set(1);
    this.hasMoreEmployees.set(true);
    const branchId = this.branchService.selectedBranchId();
    this.employeeApi
      .getEmployees({ page: 1, size: this.empPageSize, branchId, status: 'working', q: kw })
      .subscribe((res) => {
        this.employees.set(res.items);
        this.hasMoreEmployees.set(res.items.length >= this.empPageSize && res.items.length < res.total);
      });
  }

  onScrollToBottom(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMoreEmployees()) return;
    this.isLoadingMore.set(true);
    const nextPage = this.empPage() + 1;
    const branchId = this.branchService.selectedBranchId();

    this.employeeApi
      .getEmployees({ page: nextPage, size: this.empPageSize, branchId, status: 'working', q: this.searchQuery() })
      .subscribe({
        next: (res) => {
          this.empPage.set(nextPage);
          const combined = [...this.employees(), ...(res.items || [])];
          this.employees.set(combined);
          this.hasMoreEmployees.set(res.items.length >= this.empPageSize && combined.length < res.total);
          this.isLoadingMore.set(false);
        },
        error: () => this.isLoadingMore.set(false),
      });
  }

  applyBulkShiftAssignment(): void {
    if (this.isWeekLocked()) {
      this.toastService.warning('Lịch ca tuần này đã bị khóa, không thể xếp ca.');
      return;
    }

    const codes = new Set(this.selectedEmployeeCodes());
    const targets = this.employees().filter((e) => codes.has(e.code));
    const dayIso = this.effectiveBulkDayIso();
    const shiftCode = this.bulkShiftCode();
    if (targets.length === 0 || !dayIso) return;

    this.isBulkAssigning.set(true);

    if (!shiftCode || shiftCode === 'OFF') {
      const removals = targets
        .map((emp) =>
          this.assignments().find((a) => a.employeeId === emp.id && a.date === dayIso && a.status !== 'cancelled')
        )
        .filter((a): a is ShiftAssignment => !!a)
        .map((a) => this.shiftApi.removeShiftAssignment(a.id));

      if (removals.length === 0) {
        this.isBulkAssigning.set(false);
        this.toastService.info('Các nhân sự đã chọn đều đang nghỉ ngày này.');
        return;
      }

      forkJoin(removals).subscribe({
        next: () => {
          const targetEmpIds = new Set(targets.map((t) => t.id));
          this.assignments.update((list) =>
            list.filter((a) => !(targetEmpIds.has(a.employeeId) && a.date === dayIso))
          );
          this.isBulkAssigning.set(false);
          this.toastService.success(`Đã chuyển sang Nghỉ ngày ${dayIso} cho ${targets.length} nhân sự!`);
          this.clearSelection();
        },
        error: (err: Error) => {
          this.isBulkAssigning.set(false);
          this.toastService.error(err.message || 'Không thể hủy ca hàng loạt.');
        },
      });
      return;
    }

    const tmpl = this.templates().find((t) => t.code === shiftCode);
    if (!tmpl) {
      this.isBulkAssigning.set(false);
      return;
    }

    const calls = targets.map((emp) => {
      const existing = this.assignments().find(
        (a) => a.employeeId === emp.id && a.date === dayIso && a.status !== 'cancelled'
      );
      const newAsg: ShiftAssignment = {
        id: existing ? existing.id : `asg-${Date.now()}-${emp.id}-${Math.floor(Math.random() * 1000)}`,
        employeeId: emp.id,
        employeeCode: emp.code,
        employeeName: emp.fullName,
        branchId: emp.branchId,
        date: dayIso,
        shiftId: tmpl.id,
        shiftCode: tmpl.code,
        shiftName: tmpl.name,
        startTime: tmpl.startTime,
        endTime: tmpl.endTime,
        registeredBy: 'manager',
        status: 'scheduled',
      };
      return this.shiftApi.saveShiftAssignment(newAsg);
    });

    forkJoin(calls).subscribe({
      next: (savedList) => {
        const targetEmpIds = new Set(targets.map((t) => t.id));
        this.assignments.update((list) => [
          ...list.filter((a) => !(targetEmpIds.has(a.employeeId) && a.date === dayIso)),
          ...savedList,
        ]);
        this.isBulkAssigning.set(false);
        this.toastService.success(`Đã xếp ca ${tmpl.code} ngày ${dayIso} cho ${targets.length} nhân sự!`);
        this.clearSelection();
      },
      error: (err: Error) => {
        this.isBulkAssigning.set(false);
        this.toastService.error(err.message || 'Có lỗi xảy ra khi xếp ca hàng loạt.');
      },
    });
  }

  onMonthYearInput(value: string): void {
    if (!value || !value.includes('-')) return;
    const [y, m] = value.split('-');
    if (y && m) {
      this.selectedYear.set(y);
      this.selectedMonth.set(m);
      const weeks = buildWeeksOfMonth(`${y}-${m}`);
      if (weeks.length > 0) {
        this.weekStart.set(weeks[0].value);
        this.loadScheduleData();
      }
    }
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  refreshTab(): void {
    const [year, month] = getCurrentYearMonth().split('-');
    this.searchQuery.set('');
    this.selectedMonth.set(month);
    this.selectedYear.set(year);
    this.weekStart.set(getCurrentWeekMondayIso());
    this.selectedEmployeeCodes.set([]);
    this.loadScheduleData();
    this.toastService.success('Đã làm mới bảng lịch phân ca tuần!');
  }
}