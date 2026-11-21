import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideDownload,
  LucideLock,
  LucideRotateCcw,
  LucideUnlock,
} from '@lucide/angular';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminSession } from '../../../../../core/admin_session';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../../../components/admin_combo_box/admin_combo_box';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import {
  AttendanceMonthlySummaryItem,
  AttendancePeriodStatus,
  HrmEmployeeApi,
} from '../../../services/hrm_employee_api';
import {
  HrmLockConfirmPayload,
  HrmLockModalComponent,
} from '../../../components/hrm_lock_modal/hrm_lock_modal';

@Component({
  selector: 'app-attendance-monthly-summary',
  templateUrl: './attendance_monthly_summary.html',
  styleUrl: './attendance_monthly_summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideDownload,
    LucideLock,
    LucideRotateCcw,
    LucideUnlock,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
    HrmLockModalComponent,
  ],
})
export class AttendanceMonthlySummary {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);
  private readonly session = inject(AdminSession);
  private readonly router = inject(Router);

  // ---- Bộ lọc ----
  readonly searchQuery = signal('');
  readonly selectedMonth = signal('11');
  readonly selectedYear = signal('2026');
  readonly selectedMonthYear = computed(() => `${this.selectedYear()}-${this.selectedMonth()}`);
  readonly isLoading = signal(false);

  // ---- Dữ liệu & Lựa chọn ----
  readonly summaryItems = signal<AttendanceMonthlySummaryItem[]>([]);
  readonly selectedEmployeeCodes = signal<string[]>([]);

  // ---- Xuất Excel ----
  readonly isExporting = signal(false);
  readonly isExportConfirmOpen = signal(false);

  // ---- Trạng thái Khóa kỳ công 3 Cấp ----
  readonly periodStatus = signal<AttendancePeriodStatus | null>(null);
  readonly isPeriodLocked = computed(() => this.periodStatus()?.isLocked ?? false);
  readonly isCheckingStatus = signal(false);

  // ---- Modal & Action Khóa kỳ công ----
  readonly isLockConfirmOpen = signal(false);
  readonly isLocking = signal(false);
  readonly lockError = signal('');

  // ---- Modal & Action Mở khóa kỳ công ----
  readonly isUnlockModalOpen = signal(false);
  readonly isUnlocking = signal(false);
  readonly unlockError = signal('');

  // ---- Tùy chọn Combobox ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

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

  readonly yearOptions: ComboOption[] = (() => {
    const list: ComboOption[] = [];
    for (let y = 2030; y >= 2020; y--) {
      list.push({ value: String(y), label: `Năm ${y}` });
    }
    return list;
  })();

  // =========================================================================
  // CỘT & DÒNG CHO BẢNG TỔNG HỢP CÔNG THÁNG (KHÔNG CHO PHÉP SORT CỘT)
  // =========================================================================
  readonly monthlySummaryColumns: GridColumn[] = [
    { key: 'code', label: 'Mã NV', type: 'code', width: '6.5rem' },
    {
      key: 'fullName',
      label: 'Họ và tên nhân sự',
      type: 'text',
      bold: true,
      minWidth: '13rem',
      subKey: 'position',
    },
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '9rem' },
    {
      key: 'workingStatus',
      label: 'Trạng thái làm việc',
      type: 'badge',
      align: 'center',
      width: '9.5rem',
      badgeMap: {
        working: { label: 'Đang làm việc', variant: 'success' },
        active: { label: 'Đang làm việc', variant: 'success' },
        probation: { label: 'Thử việc', variant: 'info' },
        on_leave: { label: 'Nghỉ phép', variant: 'warning' },
        resigned: { label: 'Đã nghỉ việc', variant: 'danger' },
      },
    },
    {
      key: 'standardDays',
      label: 'Công chuẩn',
      type: 'number',
      align: 'right',
      width: '6.75rem',
      suffix: ' công',
    },
    {
      key: 'workDays',
      label: 'Ngày công',
      type: 'number',
      align: 'right',
      width: '6.75rem',
      bold: true,
      tone: 'dark',
      suffix: ' công',
    },
    {
      key: 'workHours',
      label: 'Giờ công',
      type: 'number',
      align: 'right',
      width: '6.75rem',
      bold: true,
      tone: 'success',
      suffix: 'h',
    },
    {
      key: 'totalWorkHours',
      label: 'Tổng giờ công',
      type: 'number',
      align: 'right',
      width: '7.5rem',
      bold: true,
      tone: 'dark',
      suffix: 'h',
    },
    {
      key: 'paidLeaveDays',
      label: 'Nghỉ hưởng lương',
      type: 'number',
      align: 'right',
      width: '8.75rem',
      suffix: ' ngày',
    },
    {
      key: 'unpaidLeaveDays',
      label: 'Nghỉ không lương',
      type: 'number',
      align: 'right',
      width: '8.75rem',
      tone: 'muted',
      suffix: ' ngày',
    },
    {
      key: 'otNormalHours',
      label: 'Tăng ca ngày thường',
      type: 'number',
      align: 'right',
      width: '9.75rem',
      tone: 'info',
      suffix: 'h',
    },
    {
      key: 'otWeekendHours',
      label: 'Tăng ca ngày nghỉ',
      type: 'number',
      align: 'right',
      width: '9.75rem',
      tone: 'info',
      suffix: 'h',
    },
    {
      key: 'otHolidayHours',
      label: 'Tăng ca ngày lễ',
      type: 'number',
      align: 'right',
      width: '9.75rem',
      tone: 'info',
      suffix: 'h',
    },
    {
      key: 'earlyLateCount',
      label: 'Đi sớm về trễ',
      type: 'number',
      align: 'right',
      width: '7.5rem',
      suffix: ' lần',
    },
    {
      key: 'missingPunchCount',
      label: 'Quên chấm công',
      type: 'number',
      align: 'right',
      width: '8.25rem',
      suffix: ' lần',
      tone: 'muted',
    },
  ];

  readonly monthlySummaryRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();

    return this.summaryItems()
      .filter((item) => {
        if (!kw) return true;
        return (
          item.fullName.toLowerCase().includes(kw) ||
          item.employeeCode.toLowerCase().includes(kw)
        );
      })
      .map((item) => ({
        _raw: item,
        id: String(item.employeeId),
        code: item.employeeCode,
        fullName: item.fullName,
        position: item.position || 'Nhân viên',
        branchName: item.branchName || 'Mặc định',
        workingStatus: item.workingStatus || 'working',
        standardDays: item.standardDays,
        workDays: item.workDays,
        workHours: item.workHours,
        totalWorkHours: item.totalWorkHours,
        paidLeaveDays: item.paidLeaveDays,
        unpaidLeaveDays: item.unpaidLeaveDays,
        otNormalHours: item.otNormalHours,
        otWeekendHours: item.otWeekendHours,
        otHolidayHours: item.otHolidayHours,
        earlyLateCount: item.earlyLateCount,
        missingPunchCount: item.missingPunchCount,
      }));
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      this.selectedMonth();
      this.selectedYear();
      untracked(() => {
        this.loadMonthlySummary();
        this.loadPeriodStatus();
      });
    });
  }

  loadMonthlySummary(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();
    const periodMonth = this.selectedMonthYear();

    this.employeeApi
      .getAttendanceMonthlySummary(periodMonth, branchId)
      .subscribe({
        next: (items) => {
          this.summaryItems.set(items);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.summaryItems.set([]);
          this.isLoading.set(false);
          this.toastService.error(err.message || 'Không thể tải bảng tổng hợp công tháng.');
        },
      });
  }

  loadPeriodStatus(): void {
    this.isCheckingStatus.set(true);
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? null : this.employeeApi.normalizeBranchId(rawBranch);
    const periodMonth = this.selectedMonthYear();

    this.employeeApi.getAttendancePeriodStatus(branchId, periodMonth).subscribe({
      next: (status) => {
        this.periodStatus.set(status);
        this.isCheckingStatus.set(false);
      },
      error: () => {
        this.isCheckingStatus.set(false);
      },
    });
  }

  openLockConfirm(): void {
    if (this.isPeriodLocked() || this.isLocking()) return;
    this.lockError.set('');
    this.isLockConfirmOpen.set(true);
  }

  executeLockPeriod(payload: HrmLockConfirmPayload): void {
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? 0 : (this.employeeApi.normalizeBranchId(rawBranch) ?? 0);
    const periodMonth = this.selectedMonthYear();

    const lockedBy = this.session.user()?.name || 'Quản trị viên';

    this.isLocking.set(true);
    this.lockError.set('');
    this.employeeApi
      .lockAttendancePeriod({
        branchId,
        periodMonth,
        lockedBy,
        password: payload.password,
      })
      .subscribe({
        next: () => {
          this.isLocking.set(false);
          this.isLockConfirmOpen.set(false);
          this.toastService.success(`Đã chốt và khóa bảng công tháng ${periodMonth}!`);
          this.loadPeriodStatus();
        },
        error: (err: Error) => {
          this.isLocking.set(false);
          this.lockError.set(err.message || 'Không thể khóa bảng công.');
        },
      });
  }

  openUnlockModal(): void {
    if (!this.isPeriodLocked() || this.isUnlocking()) return;
    this.unlockError.set('');
    this.isUnlockModalOpen.set(true);
  }

  closeUnlockModal(): void {
    if (this.isUnlocking()) return;
    this.isUnlockModalOpen.set(false);
    this.unlockError.set('');
  }

  executeUnlockPeriod(payload: HrmLockConfirmPayload): void {
    const rawBranch = this.branchService.selectedBranchId();
    const branchId = rawBranch === 'all' ? 0 : (this.employeeApi.normalizeBranchId(rawBranch) ?? 0);
    const periodMonth = this.selectedMonthYear();

    const unlockedBy = this.session.user()?.name || 'Quản trị viên';

    this.isUnlocking.set(true);
    this.unlockError.set('');

    this.employeeApi
      .unlockAttendancePeriod({
        branchId,
        periodMonth,
        unlockPassword: payload.password,
        unlockReason: payload.reason,
        unlockedBy,
      })
      .subscribe({
        next: () => {
          this.isUnlocking.set(false);
          this.isUnlockModalOpen.set(false);
          this.toastService.success(`Đã mở khóa bảng công tháng ${periodMonth}!`);
          this.loadPeriodStatus();
        },
        error: (err: Error) => {
          this.isUnlocking.set(false);
          this.unlockError.set(err.message || 'Mở khóa thất bại.');
        },
      });
  }

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
    const rows = this.monthlySummaryRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeCodes.set(this.monthlySummaryRows().map((r) => String(r['code'])));
    }
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  onMonthChange(m: string): void {
    this.selectedMonth.set(m);
    this.loadMonthlySummary();
  }

  onYearChange(y: string): void {
    this.selectedYear.set(y);
    this.loadMonthlySummary();
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.selectedMonth.set('11');
    this.selectedYear.set('2026');
    this.selectedEmployeeCodes.set([]);
    this.loadMonthlySummary();
    this.loadPeriodStatus();
    this.toastService.success('Đã làm mới bảng công tổng hợp theo tháng!');
  }

  viewPersonalTimesheet(row: GridRow): void {
    const empCode = String(row['code']);
    void this.router.navigate(['/admin/hrm/cham-cong/cong-ca-nhan'], {
      queryParams: {
        emp: empCode,
        month: this.selectedMonth(),
        year: this.selectedYear(),
      },
    });
  }

  openExportConfirm(): void {
    if (this.isExporting()) return;
    this.isExportConfirmOpen.set(true);
  }

  executeExportExcel(): void {
    this.isExportConfirmOpen.set(false);
    const selected = this.selectedEmployeeCodes();
    const rows =
      selected.length > 0
        ? this.monthlySummaryRows().filter((r) => selected.includes(String(r['code'])))
        : this.monthlySummaryRows();

    if (rows.length === 0) {
      this.toastService.warning('Không có dữ liệu tổng hợp công tháng để xuất Excel.');
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và tên',
      'Chức vụ',
      'Chi nhánh',
      'Trạng thái làm việc',
      'Công chuẩn (công)',
      'Ngày công (công)',
      'Giờ công (h)',
      'Tổng giờ công (h)',
      'Nghỉ hưởng lương (ngày)',
      'Nghỉ không lương (ngày)',
      'Tăng ca ngày thường (h)',
      'Tăng ca ngày nghỉ (h)',
      'Tăng ca ngày lễ (h)',
      'Đi sớm về trễ (lần)',
      'Quên chấm công (lần)',
    ];

    const payloadRows = rows.map((r) => ({
      'Mã NV': String(r['code'] ?? ''),
      'Họ và tên': String(r['fullName'] ?? ''),
      'Chức vụ': String(r['position'] ?? ''),
      'Chi nhánh': String(r['branchName'] ?? ''),
      'Trạng thái làm việc':
        r['workingStatus'] === 'probation'
          ? 'Thử việc'
          : r['workingStatus'] === 'resigned'
            ? 'Đã nghỉ việc'
            : 'Đang làm việc',
      'Công chuẩn (công)': Number(r['standardDays'] ?? 0),
      'Ngày công (công)': Number(r['workDays'] ?? 0),
      'Giờ công (h)': `${r['workHours'] ?? 0}h`,
      'Tổng giờ công (h)': `${r['totalWorkHours'] ?? 0}h`,
      'Nghỉ hưởng lương (ngày)': Number(r['paidLeaveDays'] ?? 0),
      'Nghỉ không lương (ngày)': Number(r['unpaidLeaveDays'] ?? 0),
      'Tăng ca ngày thường (h)': `${r['otNormalHours'] ?? 0}h`,
      'Tăng ca ngày nghỉ (h)': `${r['otWeekendHours'] ?? 0}h`,
      'Tăng ca ngày lễ (h)': `${r['otHolidayHours'] ?? 0}h`,
      'Đi sớm về trễ (lần)': Number(r['earlyLateCount'] ?? 0),
      'Quên chấm công (lần)': Number(r['missingPunchCount'] ?? 0),
    }));

    const fileName = `Fiin_HRM_Tong_Hop_Cong_Thang_${this.selectedMonthYear()}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Attendance_Monthly',
        sheetName: 'Tổng hợp công tháng',
        reportTitle: `BẢNG TỔNG HỢP CÔNG THÁNG ${this.selectedMonthYear()}`,
        summaryLabel: 'Tổng số nhân sự:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất báo cáo tổng hợp công ${rows.length} nhân sự ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel tổng hợp công tháng.');
        },
      });
  }
}