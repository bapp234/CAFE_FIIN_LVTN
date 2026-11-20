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
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideAlertTriangle,
  LucideCalendar,
  LucideCheck,
  LucideDownload,
  LucidePlus,
  LucideRotateCcw,
  LucideUser,
  LucideWallet,
  LucideX,
} from '@lucide/angular';
import { AdminSession } from '../../../../../core/admin_session';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminDrawer } from '../../../../../shared/admin_drawer/admin_drawer';
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
  GridSort,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { Employee } from '../../../models/employee';
import { AttendancePeriodStatus, HrmEmployeeApi } from '../../../services/hrm_employee_api';
import {
  EmployeeMonthlyQuotaItem,
  HrmPayrollApi,
  SalaryAdvanceItem,
} from '../../../services/hrm_payroll_api';
import { getCurrentYearMonth, getTodayIsoDate } from '../../../utils/hrm_date_helpers';

@Component({
  selector: 'app-payroll-advance-list',
  templateUrl: './payroll_advance_list.html',
  styleUrl: './payroll_advance_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    LucideAlertTriangle,
    LucideCalendar,
    LucideCheck,
    LucideDownload,
    LucidePlus,
    LucideRotateCcw,
    LucideUser,
    LucideWallet,
    LucideX,
    AdminDrawer,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class PayrollAdvanceList {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly session = inject(AdminSession);
  private readonly toastService = inject(AdminToastService);

  // ---- Bộ lọc & Sắp xếp ----
  readonly searchQuery = signal('');
  readonly selectedPeriod = signal(getCurrentYearMonth());
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);
  readonly statusFilter = signal('all');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);

  // ---- Dữ liệu thật từ DB ----
  readonly employees = signal<Employee[]>([]);
  readonly advances = signal<SalaryAdvanceItem[]>([]);
  readonly quotas = signal<EmployeeMonthlyQuotaItem[]>([]);
  readonly attendancePeriodStatus = signal<AttendancePeriodStatus | null>(null);
  readonly isAttendanceLocked = computed(() => this.attendancePeriodStatus()?.isLocked ?? false);

  // ---- Drawer lập phiếu tạm ứng ----
  readonly isDrawerOpen = signal(false);
  readonly isSaving = signal(false);
  readonly drawerError = signal('');
  readonly selectedEmployeeId = signal<string>('');
  readonly quickAmounts = [500000, 1000000, 1500000, 2000000];

  readonly advanceForm = new FormGroup({
    employeeId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    requestDate: new FormControl(getTodayIsoDate(), { nonNullable: true, validators: [Validators.required] }),
    amount: new FormControl(1000000, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(100000)],
    }),
    paymentMethod: new FormControl('Chuyển khoản', { nonNullable: true }),
    reason: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
  });

  // ---- Modal xác nhận Duyệt / Từ chối / Xin hủy / Duyệt hủy ----
  readonly processingAction = signal<'approve' | 'reject' | 'request_cancel' | 'approve_cancel' | 'reject_cancel' | null>(null);
  readonly targetAdvance = signal<SalaryAdvanceItem | null>(null);
  readonly decisionNote = signal('');
  readonly decisionError = signal('');
  readonly isProcessing = signal(false);

  readonly selectedEmployee = computed<Employee | null>(() => {
    const idStr = this.selectedEmployeeId();
    if (!idStr) return null;
    return this.employees().find((e) => String(e.employeeId ?? e.id) === idStr) ?? null;
  });

  readonly selectedEmployeeBank = computed<string>(() => {
    const emp = this.selectedEmployee();
    if (!emp) return 'Chưa cập nhật';
    const bank = (emp.bankName || '').trim();
    const acc = (emp.bankAccountNumber || '').trim();
    if (bank && acc) return `${bank} - ${acc}`;
    return acc || bank || 'Chưa cập nhật';
  });

  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly employeeComboOptions = computed<ComboOption[]>(() =>
    this.employees().map((emp) => ({
      value: String(emp.employeeId ?? emp.id),
      label: `${emp.code} — ${emp.fullName}`,
    }))
  );

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
    { value: 'pending', label: 'Chờ phê duyệt' },
    { value: 'cancel_pending', label: 'Xin hủy đơn (Chờ duyệt)' },
    { value: 'approved', label: 'Đã chi tạm ứng' },
    { value: 'cancelled', label: 'Đã hủy đơn' },
    { value: 'rejected', label: 'Đã từ chối' },
    { value: 'deducted', label: 'Đã trừ vào lương' },
  ];

  // =========================================================================
  // CỘT & DÒNG BẢNG DANH SÁCH TẠM ỨNG LƯƠNG + 6 CỘT HẠN MỨC OT & PHÉP NĂM
  // =========================================================================
  readonly advanceColumns: GridColumn[] = [
    { key: 'advanceCode', label: 'Mã phiếu', type: 'code', width: '7.5rem', sortable: true },
    { key: 'employeeCode', label: 'Mã NV', type: 'code', width: '6.25rem', sortable: true },
    {
      key: 'employeeName',
      label: 'Họ và tên nhân sự',
      type: 'text',
      bold: true,
      minWidth: '12rem',
      sortable: true,
      subKey: 'position',
    },
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '8.75rem', sortable: true },
    { key: 'requestDate', label: 'Ngày ứng', type: 'date', width: '7.25rem', sortable: true },
    { key: 'period', label: 'Kỳ khấu trừ', type: 'code', width: '7rem', sortable: true },
    {
      key: 'amount',
      label: 'Số tiền tạm ứng',
      type: 'currency',
      align: 'right',
      width: '8.75rem',
      bold: true,
      tone: 'success',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'otMonthlyLimit',
      label: 'Hạn mức tháng (giờ)',
      type: 'number',
      align: 'right',
      width: '8.5rem',
      suffix: 'h',
      sortable: true,
    },
    {
      key: 'otApprovedHours',
      label: 'Giờ OT đã duyệt',
      type: 'number',
      align: 'right',
      width: '8rem',
      suffix: 'h',
      tone: 'info',
      sortable: true,
    },
    {
      key: 'otPendingHours',
      label: 'Giờ OT chờ duyệt',
      type: 'number',
      align: 'right',
      width: '8.25rem',
      suffix: 'h',
      tone: 'muted',
      sortable: true,
    },
    {
      key: 'otTotalRegisteredHours',
      label: 'Tổng giờ OT đăng ký',
      type: 'number',
      align: 'right',
      width: '9rem',
      suffix: 'h',
      bold: true,
      sortable: true,
    },
    {
      key: 'otRemainingHours',
      label: 'Hạn mức còn lại (giờ)',
      type: 'number',
      align: 'right',
      width: '9.25rem',
      suffix: 'h',
      bold: true,
      tone: 'success',
      sortable: true,
    },
    {
      key: 'otWarningBadge',
      label: 'Cảnh báo',
      type: 'badge',
      align: 'center',
      width: '9.25rem',
      sortable: true,
      badgeMap: {
        within: { label: 'Trong hạn mức', variant: 'success' },
        near: { label: 'Sắp chạm trần (>=80%)', variant: 'warning' },
        exceeded_pending: { label: 'Vượt hạn mức (Chờ duyệt)', variant: 'warning' },
        maxed: { label: 'Đã đạt tối đa', variant: 'danger' },
      },
    },
    {
      key: 'annualLeaveRemainingText',
      label: 'Phép năm còn lại',
      type: 'text',
      align: 'right',
      width: '8rem',
      bold: true,
    },
    { key: 'paymentMethod', label: 'Hình thức chi', type: 'text', width: '8rem' },
    { key: 'reason', label: 'Lý do tạm ứng', type: 'text', minWidth: '12rem', tone: 'muted' },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'badge',
      align: 'center',
      width: '9.25rem',
      sortable: true,
      badgeMap: {
        pending: { label: 'Chờ duyệt', variant: 'warning' },
        cancel_pending: { label: 'Xin hủy đơn', variant: 'warning' },
        approved: { label: 'Đã chi ứng', variant: 'info' },
        cancelled: { label: 'Đã hủy đơn', variant: 'neutral' },
        rejected: { label: 'Đã từ chối', variant: 'danger' },
        deducted: { label: 'Đã khấu trừ', variant: 'success' },
      },
    },
  ];

  readonly advanceRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    const sf = this.statusFilter();

    return this.advances()
      .filter((item) => {
        const matchStatus = sf === 'all' || item.status === sf;
        const matchKw =
          !kw ||
          item.advanceCode.toLowerCase().includes(kw) ||
          item.employeeName.toLowerCase().includes(kw) ||
          item.employeeCode.toLowerCase().includes(kw) ||
          item.reason.toLowerCase().includes(kw);
        return matchStatus && matchKw;
      })
      .map((item) => {
        const limit = item.otMonthlyLimit ?? 40;
        const approved = item.otApprovedHours ?? 0;
        const pending = item.otPendingHours ?? 0;
        const totalReg = item.otTotalRegisteredHours ?? approved + pending;
        const remaining = item.otRemainingHours ?? Math.max(0, limit - approved);
        const leaveRem = item.annualLeaveRemainingDays ?? 12;
        const leaveTot = item.annualLeaveTotalDays ?? 12;

        let otWarningBadge = 'within';
        if (approved >= limit) {
          otWarningBadge = 'maxed';
        } else if (totalReg > limit) {
          otWarningBadge = 'exceeded_pending';
        } else if (approved >= limit * 0.8) {
          otWarningBadge = 'near';
        }

        return {
          ...item,
          otMonthlyLimit: limit,
          otApprovedHours: approved,
          otPendingHours: pending,
          otTotalRegisteredHours: totalReg,
          otRemainingHours: remaining,
          otWarningBadge,
          annualLeaveRemainingText: `${leaveRem}/${leaveTot} ngày`,
        };
      });
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadEmployees();
        this.loadAdvanceData();
      });
    });
  }

  private getCurrentActorName(): string {
    return this.session.user()?.name || 'Quản lý';
  }

  loadEmployees(): void {
    const branchId = this.branchService.selectedBranchId();
    this.employeeApi
      .getEmployees({ page: 1, size: 200, branchId, status: 'working' })
      .subscribe({
        next: (res) => this.employees.set(res.items),
        error: () => {},
      });
  }

  loadAdvanceData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();
    const period = this.selectedPeriod();

    const branchIdNum = branchId === 'all' ? null : this.employeeApi.normalizeBranchId(branchId);
    this.employeeApi.getAttendancePeriodStatus(branchIdNum, period).subscribe({
      next: (st) => this.attendancePeriodStatus.set(st),
      error: () => this.attendancePeriodStatus.set(null),
    });

    this.payrollApi.getEmployeeMonthlyQuotas(period, branchId).subscribe({
      next: (list) => this.quotas.set(list),
      error: () => this.quotas.set([]),
    });

    this.payrollApi.getSalaryAdvances(period, branchId).subscribe({
      next: (items) => {
        this.advances.set(items);
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.toastService.error(err.message || 'Không thể tải danh sách tạm ứng lương.');
      },
    });
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  onPeriodChange(p: string): void {
    this.selectedPeriod.set(p);
    this.loadAdvanceData();
  }

  onStatusFilterChange(st: string): void {
    this.statusFilter.set(st);
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.loadEmployees();
    this.loadAdvanceData();
    this.toastService.success('Đã làm mới danh sách tạm ứng lương!');
  }

  // =========================================================================
  // DRAWER TẠO PHIẾU TẠM ỨNG (NỐI API + DATABASE)
  // =========================================================================
  openCreateAdvanceDrawer(): void {
    const firstEmp = this.employees()[0];
    const defaultEmpId = firstEmp ? String(firstEmp.employeeId ?? firstEmp.id) : '';
    const todayInPeriod = `${this.selectedPeriod()}-15`;

    this.drawerError.set('');
    this.selectedEmployeeId.set(defaultEmpId);
    this.advanceForm.reset({
      employeeId: defaultEmpId,
      requestDate: todayInPeriod,
      amount: 1000000,
      paymentMethod: 'Chuyển khoản',
      reason: '',
    });
    this.isDrawerOpen.set(true);
  }

  closeCreateDrawer(): void {
    if (this.isSaving()) return;
    this.isDrawerOpen.set(false);
  }

  onEmployeeSelectChange(empId: string): void {
    this.selectedEmployeeId.set(empId);
    this.advanceForm.controls.employeeId.setValue(empId);
    this.drawerError.set('');
  }

  selectPaymentMethod(method: 'Chuyển khoản' | 'Tiền mặt tại quỹ'): void {
    if (this.isSaving()) return;
    this.advanceForm.controls.paymentMethod.setValue(method);
    this.drawerError.set('');
  }

  selectQuickAmount(amount: number): void {
    if (this.isSaving()) return;
    this.advanceForm.controls.amount.setValue(amount);
    this.advanceForm.controls.amount.markAsDirty();
    this.drawerError.set('');
  }

  saveAdvance(): void {
    if (this.isSaving()) return;

    if (this.advanceForm.invalid) {
      this.advanceForm.markAllAsTouched();
      this.drawerError.set('Vui lòng chọn nhân sự, nhập số tiền từ 100.000₫ và lý do (tối thiểu 3 ký tự).');
      return;
    }

    const val = this.advanceForm.getRawValue();
    const numericEmployeeId = Number(val.employeeId);
    if (!Number.isFinite(numericEmployeeId) || numericEmployeeId <= 0) {
      this.drawerError.set('Không xác định được mã nhân sự hợp lệ.');
      return;
    }

    this.isSaving.set(true);
    this.drawerError.set('');

    this.payrollApi
      .createSalaryAdvance({
        employeeId: numericEmployeeId,
        periodMonth: this.selectedPeriod(),
        requestDate: val.requestDate,
        amount: Number(val.amount),
        paymentMethod: val.paymentMethod,
        reason: val.reason.trim(),
        createdBy: this.getCurrentActorName(),
      })
      .subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.isDrawerOpen.set(false);
          this.toastService.success(`Đã tạo phiếu tạm ứng ${res.advanceCode} thành công!`);
          this.loadAdvanceData();
        },
        error: (err: Error) => {
          this.isSaving.set(false);
          this.drawerError.set(err.message || 'Không thể lưu phiếu tạm ứng lương.');
        },
      });
  }

  // =========================================================================
  // PHÊ DUYỆT / TỪ CHỐI / XIN HỦY / DUYỆT HỦY PHIẾU TẠM ỨNG (NỐI API + DATABASE)
  // =========================================================================
  canApproveAdvance(): boolean {
    if (this.isAttendanceLocked()) return false;
    return this.session.canApprove();
  }

  canRequestCancelAdvance(row: GridRow): boolean {
    if (this.isAttendanceLocked()) return false;
    return row['status'] === 'approved';
  }

  openProcessModal(
    row: GridRow,
    action: 'approve' | 'reject' | 'request_cancel' | 'approve_cancel' | 'reject_cancel'
  ): void {
    const advanceId = Number(row['advanceId']);
    const item = this.advances().find((a) => a.advanceId === advanceId) ?? null;
    if (!item) return;

    this.targetAdvance.set(item);
    this.processingAction.set(action);
    this.decisionNote.set('');
    this.decisionError.set('');
  }

  closeProcessModal(): void {
    if (this.isProcessing()) return;
    this.processingAction.set(null);
    this.targetAdvance.set(null);
    this.decisionNote.set('');
    this.decisionError.set('');
  }

  getProcessModalTitle(): string {
    switch (this.processingAction()) {
      case 'approve':
        return 'Phê duyệt phiếu tạm ứng';
      case 'reject':
        return 'Từ chối phiếu tạm ứng';
      case 'request_cancel':
        return 'Xin hủy phiếu tạm ứng đã duyệt';
      case 'approve_cancel':
        return 'Duyệt yêu cầu xin hủy phiếu tạm ứng';
      case 'reject_cancel':
        return 'Từ chối yêu cầu hủy phiếu tạm ứng';
      default:
        return 'Xử lý phiếu tạm ứng';
    }
  }

  getProcessModalMessage(): string {
    const item = this.targetAdvance();
    if (!item) return '';
    const amountStr = item.amount.toLocaleString('vi-VN');
    switch (this.processingAction()) {
      case 'approve':
        return `Xác nhận phê duyệt chi tạm ứng ${amountStr}₫ cho nhân sự ${item.employeeName} (${item.advanceCode})?`;
      case 'reject':
        return `Bạn đang từ chối phiếu tạm ứng ${item.advanceCode} của ${item.employeeName}. Vui lòng nhập lý do từ chối.`;
      case 'request_cancel':
        return `Khi bạn gửi yêu cầu xin hủy phiếu tạm ứng ${item.advanceCode} (${amountStr}₫), cấp duyệt của ${item.employeeName} sẽ nhận lại đơn với trạng thái "Xin hủy đơn" để xét duyệt.`;
      case 'approve_cancel':
        return `Xác nhận đồng ý hủy phiếu tạm ứng ${item.advanceCode} (${amountStr}₫) theo yêu cầu xin hủy của ${item.employeeName}?`;
      case 'reject_cancel':
        return `Từ chối yêu cầu xin hủy và giữ nguyên hiệu lực đã duyệt cho phiếu tạm ứng ${item.advanceCode} của ${item.employeeName}?`;
      default:
        return '';
    }
  }

  confirmProcessAdvance(): void {
    if (this.isProcessing()) return;
    const item = this.targetAdvance();
    const action = this.processingAction();
    if (!item || !action) return;

    const note = this.decisionNote().trim();
    if ((action === 'reject' || action === 'request_cancel') && note.length < 3) {
      this.decisionError.set(
        action === 'request_cancel'
          ? 'Vui lòng nhập lý do xin hủy phiếu tạm ứng (tối thiểu 3 ký tự).'
          : 'Vui lòng nhập lý do từ chối phiếu tạm ứng (tối thiểu 3 ký tự).'
      );
      return;
    }

    this.isProcessing.set(true);
    this.decisionError.set('');

    this.payrollApi
      .processSalaryAdvance(item.advanceId, {
        action,
        approverName: this.getCurrentActorName(),
        note: note || undefined,
      })
      .subscribe({
        next: () => {
          this.isProcessing.set(false);
          this.processingAction.set(null);
          this.targetAdvance.set(null);
          const msgMap: Record<string, string> = {
            approve: `Đã phê duyệt phiếu tạm ứng ${item.advanceCode}!`,
            reject: `Đã từ chối phiếu tạm ứng ${item.advanceCode}.`,
            request_cancel: `Đã gửi yêu cầu xin hủy phiếu ${item.advanceCode} lên cấp duyệt!`,
            approve_cancel: `Đã chấp thuận hủy phiếu tạm ứng ${item.advanceCode}!`,
            reject_cancel: `Đã từ chối yêu cầu hủy, giữ nguyên hiệu lực phiếu ${item.advanceCode}.`,
          };
          this.toastService.success(msgMap[action] || 'Cập nhật phiếu tạm ứng thành công.');
          this.loadAdvanceData();
        },
        error: (err: Error) => {
          this.isProcessing.set(false);
          this.decisionError.set(err.message || 'Không thể xử lý phiếu tạm ứng.');
        },
      });
  }

  getProcessedTooltip(row: GridRow): string {
    const by = row['approvedBy'] ? `Bởi: ${row['approvedBy']}` : '';
    const note = row['decisionNote'] ? `Ghi chú: ${row['decisionNote']}` : '';
    return [by, note].filter(Boolean).join(' • ');
  }

  // =========================================================================
  // XUẤT EXCEL
  // =========================================================================
  openExportConfirm(): void {
    if (this.advanceRows().length === 0) {
      this.toastService.warning('Không có dữ liệu tạm ứng lương để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportAdvancesExcel(): void {
    const rows = this.advanceRows();
    if (rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Mã phiếu',
      'Mã NV',
      'Họ và tên',
      'Chi nhánh',
      'Ngày ứng',
      'Kỳ khấu trừ',
      'Số tiền ứng',
      'Hạn mức tháng (giờ)',
      'Giờ OT đã duyệt',
      'Giờ OT chờ duyệt',
      'Tổng giờ OT đăng ký',
      'Hạn mức còn lại (giờ)',
      'Cảnh báo',
      'Phép năm còn lại',
      'Hình thức',
      'Lý do',
      'Trạng thái',
    ];

    const payloadRows = rows.map((r) => ({
      'Mã phiếu': String(r['advanceCode'] ?? ''),
      'Mã NV': String(r['employeeCode'] ?? ''),
      'Họ và tên': String(r['employeeName'] ?? ''),
      'Chi nhánh': String(r['branchName'] ?? ''),
      'Ngày ứng': String(r['requestDate'] ?? ''),
      'Kỳ khấu trừ': String(r['period'] ?? ''),
      'Số tiền ứng': Number(r['amount'] ?? 0),
      'Hạn mức tháng (giờ)': Number(r['otMonthlyLimit'] ?? 40),
      'Giờ OT đã duyệt': Number(r['otApprovedHours'] ?? 0),
      'Giờ OT chờ duyệt': Number(r['otPendingHours'] ?? 0),
      'Tổng giờ OT đăng ký': Number(r['otTotalRegisteredHours'] ?? 0),
      'Hạn mức còn lại (giờ)': Number(r['otRemainingHours'] ?? 40),
      'Cảnh báo': String(r['otWarningStatus'] ?? 'Trong hạn mức'),
      'Phép năm còn lại': String(r['annualLeaveRemainingText'] ?? ''),
      'Hình thức': String(r['paymentMethod'] ?? ''),
      'Lý do': String(r['reason'] ?? ''),
      'Trạng thái': String(r['status'] ?? ''),
    }));

    const fileName = `Fiin_HRM_Tam_Ung_Luong_${this.selectedPeriod()}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Advances',
        sheetName: 'Tạm ứng lương',
        reportTitle: `DANH SÁCH TẠM ỨNG LƯƠNG KỲ ${this.selectedPeriod()}`,
        summaryLabel: 'Tổng số phiếu tạm ứng:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.isExportConfirmOpen.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất ${rows.length} phiếu tạm ứng lương ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel tạm ứng lương. Vui lòng thử lại.');
        },
      });
  }
}
