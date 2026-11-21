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
import {
  LucideDownload,
  LucideEye,
  LucideLock,
  LucideRotateCcw,
  LucideSparkles,
  LucideUnlock,
} from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminSession } from '../../../../../core/admin_session';
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
  GridSort,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { PayrollPeriod, PayrollSlip } from '../../../models/payroll';
import { AttendancePeriodStatus, HrmEmployeeApi } from '../../../services/hrm_employee_api';
import { HrmPayrollApi } from '../../../services/hrm_payroll_api';
import { getCurrentYearMonth } from '../../../utils/hrm_date_helpers';
import { HrmPayrollSlipModal } from '../../../components/hrm_payroll_slip_modal/hrm_payroll_slip_modal';
import {
  HrmLockConfirmPayload,
  HrmLockModalComponent,
} from '../../../components/hrm_lock_modal/hrm_lock_modal';

@Component({
  selector: 'app-payroll-payout-list',
  templateUrl: './payroll_payout_list.html',
  styleUrl: './payroll_payout_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideDownload,
    LucideEye,
    LucideLock,
    LucideUnlock,
    LucideRotateCcw,
    LucideSparkles,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
    HrmPayrollSlipModal,
    HrmLockModalComponent,
  ],
})
export class PayrollPayoutList {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly toastService = inject(AdminToastService);
  private readonly session = inject(AdminSession);

  // ---- Bộ lọc & Sắp xếp ----
  readonly selectedPeriod = signal<string>(getCurrentYearMonth());
  readonly statusFilter = signal<string>('all');
  readonly searchQuery = signal('');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);

  // ---- Dữ liệu gốc ----
  readonly periods = signal<PayrollPeriod[]>([]);
  readonly slips = signal<PayrollSlip[]>([]);
  readonly selectedEmployeeCodes = signal<string[]>([]);
  readonly attendancePeriodStatus = signal<AttendancePeriodStatus | null>(null);
  readonly isAttendanceLocked = computed(() => this.attendancePeriodStatus()?.isLocked ?? false);

  // ---- Modal Duyệt & Phiếu lương ----
  readonly isApproveModalOpen = signal(false);
  readonly isApproving = signal(false);
  readonly approveError = signal('');
  readonly isUnlockModalOpen = signal(false);
  readonly isUnlocking = signal(false);
  readonly unlockError = signal('');
  readonly isSlipModalOpen = signal(false);
  readonly selectedSlip = signal<PayrollSlip | null>(null);

  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly periodOptions: ComboOption[] = (() => {
    const list: ComboOption[] = [];
    for (const year of [2025, 2026, 2027]) {
      for (let month = 1; month <= 12; month++) {
        const mm = String(month).padStart(2, '0');
        list.push({ value: `${year}-${mm}`, label: `Kỳ ${mm}/${year}` });
      }
    }
    return list;
  })();

  readonly statusFilterOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'paid', label: 'Đã chi trả' },
    { value: 'approved', label: 'Đã duyệt (Khóa)' },
    { value: 'draft', label: 'Bản nháp' },
  ];

  readonly currentPeriodRecord = computed<PayrollPeriod | undefined>(() => {
    const period = this.selectedPeriod();
    const branchId = this.branchService.selectedBranchId();
    return this.periods().find(
      (p) => p.period === period && (branchId === 'all' || p.branchId === branchId || p.branchId === 'all')
    );
  });

  readonly isPeriodLocked = computed<boolean>(
    () => this.currentPeriodRecord()?.isLocked ?? false
  );

  // =========================================================================
  // CẤU HÌNH CỘT & DÒNG CHO BẢNG DANH SÁCH TRẢ LƯƠNG
  // =========================================================================
  readonly payoutColumns: GridColumn[] = [
    { key: 'employeeCode', label: 'Mã NV', type: 'code', width: '6.5rem', sortable: true },
    {
      key: 'employeeName',
      label: 'Họ và tên nhân sự',
      type: 'text',
      bold: true,
      minWidth: '13rem',
      sortable: true,
      subKey: 'position',
    },
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '9.5rem', sortable: true },
    {
      key: 'hourlyRate',
      label: 'Đơn giá / giờ',
      type: 'currency',
      align: 'right',
      width: '7.5rem',
      suffix: ' ₫/h',
      sortable: true,
    },
    {
      key: 'standardWorkHours',
      label: 'Giờ chuẩn',
      type: 'number',
      align: 'right',
      width: '6.5rem',
      suffix: 'h',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'overtimeHours',
      label: 'Giờ OT',
      type: 'number',
      align: 'right',
      width: '6rem',
      suffix: 'h',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'overtimePay',
      label: 'Tiền OT (x1.5)',
      type: 'currency',
      align: 'right',
      width: '8rem',
      tone: 'info',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'allowance',
      label: 'Phụ cấp & Trợ cấp',
      type: 'currency',
      align: 'right',
      width: '8.5rem',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'deductions',
      label: 'Khấu trừ (BH/Thuế/Ứng)',
      type: 'currency',
      align: 'right',
      width: '9.5rem',
      tone: 'muted',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'netPay',
      label: 'Thực lĩnh (NET)',
      type: 'currency',
      align: 'right',
      width: '9rem',
      bold: true,
      tone: 'success',
      sortable: true,
      summary: 'sum',
    },
  ];

  readonly payoutRows = computed<GridRow[]>(() => {
    const sf = this.statusFilter();
    const kw = this.searchQuery().trim().toLowerCase();

    return this.slips()
      .filter((slip) => {
        const matchStatus = sf === 'all' || slip.status === sf;
        const matchKw =
          !kw ||
          slip.employeeName.toLowerCase().includes(kw) ||
          slip.employeeCode.toLowerCase().includes(kw) ||
          (slip.position && slip.position.toLowerCase().includes(kw));
        return matchStatus && matchKw;
      })
      .map((slip) => {
        const deductions = (slip.deduction || 0) + (slip.advance || 0);

        return {
          _raw: slip,
          id: slip.id,
          employeeCode: slip.employeeCode,
          employeeName: slip.employeeName,
          position: slip.position,
          branchName: slip.branchName,
          hourlyRate: slip.hourlyRate,
          standardWorkHours: slip.standardWorkHours,
          overtimeHours: slip.overtimeHours,
          overtimePay: slip.overtimePay,
          allowance: slip.allowance,
          deductions,
          netPay: slip.netPay,
          status: slip.status || 'draft',
        };
      });
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadPayrollData();
      });
    });
  }

  loadPayrollData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();
    const period = this.selectedPeriod();

    this.loadAttendancePeriodStatus(branchId, period);

    this.payrollApi
      .getPayrollSlips({
        page: 1,
        size: 100,
        period,
        branchId,
        q: this.searchQuery(),
      })
      .subscribe({
        next: (res) => {
          this.slips.set(res.items);
          const loadedPeriod = this.payrollApi.getLastLoadedPeriod();
          this.periods.set(loadedPeriod ? [loadedPeriod] : []);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onRowClick(row: GridRow): void {
    const code = String(row['employeeCode']);
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
    const rows = this.payoutRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['employeeCode'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeCodes.set(this.payoutRows().map((r) => String(r['employeeCode'])));
    }
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  onPeriodChange(period: string): void {
    this.selectedPeriod.set(period);
    this.loadPayrollData();
  }

  onStatusFilterChange(status: string): void {
    this.statusFilter.set(status);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.selectedEmployeeCodes.set([]);
    this.loadPayrollData();
    this.toastService.success('Đã làm mới danh sách trả lương!');
  }

  private loadAttendancePeriodStatus(branchId: string, period: string): void {
    const branchIdNum = branchId === 'all' ? null : this.employeeApi.normalizeBranchId(branchId);
    this.employeeApi.getAttendancePeriodStatus(branchIdNum, period).subscribe({
      next: (status) => this.attendancePeriodStatus.set(status),
      error: () => this.attendancePeriodStatus.set(null),
    });
  }

  recalculatePayroll(): void {
    const period = this.selectedPeriod();
    if (!this.isAttendanceLocked()) {
      this.toastService.warning(
        `Bảng công tháng ${period} chưa được chốt khóa. Vui lòng khóa bảng công trước khi tính lương!`
      );
      return;
    }

    const branchId = this.branchService.selectedBranchId();

    this.isLoading.set(true);
    this.payrollApi.generatePayroll(period, branchId).subscribe({
      next: (res) => {
        this.toastService.success(`Đã hoàn tất tính toán bảng lương kỳ ${res.period}!`);
        this.loadPayrollData();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  confirmApprove(): void {
    this.approveError.set('');
    this.isApproveModalOpen.set(true);
  }

  executeApprove(payload: HrmLockConfirmPayload): void {
    const p = this.currentPeriodRecord();
    if (!p || !Number(p.id)) {
      this.approveError.set('Không tìm thấy kỳ lương hợp lệ để khóa. Vui lòng tính lương hoặc tải lại dữ liệu.');
      return;
    }

    this.isApproving.set(true);
    this.approveError.set('');
    const approver = this.session.user()?.name || 'Quản trị viên';
    this.payrollApi.approvePayroll(p.id, approver, payload.password).subscribe({
      next: () => {
        this.isApproving.set(false);
        this.toastService.success(`Đã khóa kỳ lương ${p.period} thành công!`);
        this.isApproveModalOpen.set(false);
        this.loadPayrollData();
      },
      error: (err: Error) => {
        this.isApproving.set(false);
        this.approveError.set(err.message || 'Không thể khóa kỳ lương.');
      },
    });
  }

  confirmUnlock(): void {
    this.unlockError.set('');
    this.isUnlockModalOpen.set(true);
  }

  executeUnlock(payload: HrmLockConfirmPayload): void {
    const p = this.currentPeriodRecord();
    if (!p || !Number(p.id)) {
      this.unlockError.set('Không tìm thấy kỳ lương hợp lệ để mở khóa. Vui lòng tải lại dữ liệu.');
      return;
    }

    this.isUnlocking.set(true);
    this.unlockError.set('');
    const unlockedBy = this.session.user()?.name || 'Quản trị viên';
    this.payrollApi.unlockPayroll(p.id, unlockedBy, payload.reason, payload.password).subscribe({
      next: () => {
        this.isUnlocking.set(false);
        this.toastService.success(`Đã mở khóa kỳ lương ${p.period} thành công!`);
        this.isUnlockModalOpen.set(false);
        this.loadPayrollData();
      },
      error: (err: Error) => {
        this.isUnlocking.set(false);
        this.unlockError.set(err.message || 'Không thể mở khóa kỳ lương.');
      },
    });
  }

  viewSlipFromRow(row: GridRow): void {
    const slip = row['_raw'] as PayrollSlip | undefined;
    if (!slip) return;
    this.selectedSlip.set(slip);
    this.isSlipModalOpen.set(true);
  }

  openExportConfirm(): void {
    if (this.payoutRows().length === 0) {
      this.toastService.warning('Không có dữ liệu trả lương để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportPayoutExcel(): void {
    const rows = this.payoutRows();
    if (rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và tên',
      'Chức vụ',
      'Chi nhánh',
      'Đơn giá/giờ',
      'Giờ chuẩn',
      'Giờ OT',
      'Tiền OT',
      'Phụ cấp',
      'Khấu trừ',
    ];

    const payloadRows = rows.map((r) => ({
      'Mã NV': String(r['employeeCode'] ?? ''),
      'Họ và tên': String(r['employeeName'] ?? ''),
      'Chức vụ': String(r['position'] ?? ''),
      'Chi nhánh': String(r['branchName'] ?? ''),
      'Đơn giá/giờ': Number(r['hourlyRate'] ?? 0),
      'Giờ chuẩn': Number(r['standardWorkHours'] ?? 0),
      'Giờ OT': Number(r['overtimeHours'] ?? 0),
      'Tiền OT': Number(r['overtimePay'] ?? 0),
      'Phụ cấp': Number(r['allowance'] ?? 0),
      'Khấu trừ': Number(r['deductions'] ?? 0),
    }));

    const fileName = `Fiin_HRM_Bang_Tra_Luong_${this.selectedPeriod()}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Payouts',
        sheetName: 'Trả lương',
        reportTitle: `BẢNG CHI TRẢ LƯƠNG NHÂN VIÊN KỲ ${this.selectedPeriod()}`,
        summaryLabel: 'Tổng số nhân viên:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.isExportConfirmOpen.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất bảng trả lương kỳ ${this.selectedPeriod()} ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel bảng trả lương. Vui lòng thử lại.');
        },
      });
  }
}
