import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucidePlus,
  LucideRotateCcw,
  LucideX,
} from '@lucide/angular';
import { AdminSession } from '../../../../../core/admin_session';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminFormField } from '../../../../../shared/admin_form_field/admin_form_field';
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
import { Employee } from '../../../models/employee';
import {
  AttendancePeriodStatus,
  EmployeePermissionSettingItem,
  HrmEmployeeApi,
  LeaveRequestItem,
  LeaveTypeItem,
} from '../../../services/hrm_employee_api';
import { EmployeeMonthlyQuotaItem, HrmPayrollApi } from '../../../services/hrm_payroll_api';
import { RequestCreateDrawerComponent } from '../../components/request_create_drawer/request_create_drawer';
import { getTodayIsoDate } from '../../../utils/hrm_date_helpers';
import {
  buildEmployeeComboOptions,
  canUserRequestCancelOnApprovedRow,
  compareRequestPriority,
  getCurrentUsername,
  getEmployeeNumericId,
  resolveApproversForEmployee,
  resolveScopedEmployees,
} from '../../request_helpers';

@Component({
  selector: 'app-request-leave-tab',
  templateUrl: './request_leave.html',
  styleUrl: './request_leave.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideX,
    AdminFormField,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
    RequestCreateDrawerComponent,
  ],
})
export class RequestLeaveTab implements OnInit {
  readonly branchService = inject(AdminBranchService);
  private readonly adminSession = inject(AdminSession);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly toastService = inject(AdminToastService);

  readonly searchQuery = signal('');
  readonly selectedMonth = signal('11');
  readonly selectedYear = signal('2026');
  readonly statusFilter = signal('all');
  readonly employeeFilter = signal('all');
  readonly selectedPeriodMonth = computed(() => `${this.selectedYear()}-${this.selectedMonth()}`);

  readonly isLoading = signal(false);
  readonly isSubmitting = signal(false);
  readonly isLoadingApprovers = signal(false);

  readonly items = signal<LeaveRequestItem[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly quotas = signal<EmployeeMonthlyQuotaItem[]>([]);
  readonly periodStatus = signal<AttendancePeriodStatus | null>(null);
  readonly isPeriodLocked = computed(() => this.periodStatus()?.isLocked ?? false);
  readonly isSelfOnly = signal(false);
  readonly permissionMatrix = signal<EmployeePermissionSettingItem[]>([]);
  readonly leaveCatalog = signal<LeaveTypeItem[]>([]);

  // ---- Drawer Tạo đơn nghỉ phép ----
  readonly isCreateOpen = signal(false);
  readonly formEmployeeId = signal<number>(0);
  readonly formFromDate = signal<string>(getTodayIsoDate());
  readonly formToDate = signal<string>(getTodayIsoDate());
  readonly formLeaveCode = signal<string>('LV-PHEP');
  readonly formReason = signal<string>('');

  readonly selectedLeaveInfo = computed(() =>
    this.leaveCatalog().find((c) => c.leaveCode === this.formLeaveCode()) ?? null
  );

  readonly selectedEmployee = computed(() => {
    const id = this.formEmployeeId();
    return this.employees().find((e) => getEmployeeNumericId(e) === id) ?? null;
  });

  readonly selectedEmployeeQuota = computed<EmployeeMonthlyQuotaItem | null>(() => {
    const id = this.formEmployeeId();
    if (!id) return null;
    return this.quotas().find((q) => q.employeeId === id) ?? null;
  });

  readonly requestedDays = computed<number>(() => {
    const f = this.formFromDate();
    const t = this.formToDate();
    if (!f || !t) return 0;
    const d1 = new Date(f);
    const d2 = new Date(t);
    const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 0;
  });

  readonly quotaBlockReason = computed<string>(() => {
    const q = this.selectedEmployeeQuota();
    if (this.isPeriodLocked() || q?.isAttendanceLocked) {
      return `Bảng công kỳ ${this.selectedPeriodMonth()} đã khóa, không thể lập đơn nghỉ phép mới.`;
    }
    const days = this.requestedDays();
    if (days <= 0) {
      return 'Ngày kết thúc nghỉ phải lớn hơn hoặc bằng ngày bắt đầu.';
    }
    const info = this.selectedLeaveInfo();
    const deductAnnual = info?.deductAnnualLeave ?? this.formLeaveCode() === 'LV-PHEP';
    const allowNeg = info?.allowNegativeBalance ?? false;
    if (deductAnnual && !allowNeg && q) {
      if (q.annualLeaveRemainingDays <= 0) {
        return `Nhân sự đã dùng hết quỹ phép năm (${q.annualLeaveTotalDays} ngày). Vui lòng chọn mã Nghỉ không lương (LV-KHONG-LUONG).`;
      }
      if (days > q.annualLeaveRemainingDays) {
        return `Số ngày xin nghỉ (${days} ngày) vượt quá quỹ phép năm còn lại (${q.annualLeaveRemainingDays} ngày).`;
      }
    }
    return '';
  });

  readonly selectedApprovers = computed(() =>
    resolveApproversForEmployee(this.selectedEmployee(), this.permissionMatrix())
  );

  readonly employeeFilterOptions = computed<ComboOption[]>(() =>
    buildEmployeeComboOptions(this.employees(), !this.isSelfOnly())
  );

  readonly monthOptions: ComboOption[] = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { value: m, label: `Tháng ${m}` };
  });

  readonly yearOptions: ComboOption[] = Array.from({ length: 7 }, (_, i) => {
    const y = String(2028 - i);
    return { value: y, label: `Năm ${y}` };
  });

  readonly statusOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ duyệt' },
    { value: 'cancel_pending', label: 'Xin hủy đơn (Chờ duyệt)' },
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'cancelled', label: 'Đã hủy đơn' },
    { value: 'rejected', label: 'Từ chối' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'employeeCode', label: 'Mã NV', type: 'code', width: '6.5rem' },
    {
      key: 'fullName',
      label: 'Họ và tên nhân sự',
      type: 'text',
      bold: true,
      minWidth: '13rem',
      subKey: 'position',
    },
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', width: '10rem' },
    { key: 'fromDate', label: 'Từ ngày', type: 'date', width: '7.5rem' },
    { key: 'toDate', label: 'Đến ngày', type: 'date', width: '7.5rem' },
    { key: 'leaveDays', label: 'Số ngày', type: 'number', align: 'right', width: '6.25rem', bold: true, suffix: ' ngày' },
    { key: 'leaveCode', label: 'Mã phép (LV)', type: 'code', width: '8.5rem', subKey: 'leaveName' },
    { key: 'paidText', label: 'Chế độ lương', type: 'text', align: 'right', width: '8rem', bold: true },
    { key: 'reason', label: 'Lý do xin nghỉ', type: 'text', minWidth: '14rem' },
    {
      key: 'approvalStatus',
      label: 'Trạng thái',
      type: 'badge',
      align: 'center',
      width: '8.75rem',
      badgeMap: {
        pending: { label: 'Chờ duyệt', variant: 'warning' },
        cancel_pending: { label: 'Xin hủy đơn', variant: 'warning' },
        approved: { label: 'Đã duyệt', variant: 'success' },
        cancelled: { label: 'Đã hủy đơn', variant: 'neutral' },
        rejected: { label: 'Từ chối', variant: 'danger' },
      },
    },
  ];

  readonly scopedItems = computed(() => {
    const empFilter = this.employeeFilter();
    return this.items().filter((item) => {
      if (empFilter !== 'all' && String(item.employeeId) !== empFilter) {
        return false;
      }
      return true;
    });
  });

  readonly gridRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    const st = this.statusFilter();

    return this.scopedItems()
      .filter((item) => {
        const matchSt = st === 'all' || item.approvalStatus.toLowerCase() === st;
        const matchKw =
          !kw ||
          item.employeeCode.toLowerCase().includes(kw) ||
          item.fullName.toLowerCase().includes(kw) ||
          item.leaveCode.toLowerCase().includes(kw) ||
          item.reason.toLowerCase().includes(kw);
        return matchSt && matchKw;
      })
      .sort((a, b) =>
        compareRequestPriority(
          a.approvalStatus,
          b.approvalStatus,
          a.fromDate || a.createdAt,
          b.fromDate || b.createdAt
        )
      )
      .map((item) => ({
        _raw: item,
        leaveId: item.leaveId,
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        position: item.position,
        branchName: item.branchName,
        fromDate: item.fromDate,
        toDate: item.toDate,
        leaveDays: item.leaveDays,
        leaveCode: item.leaveCode,
        leaveName: item.leaveName,
        paidText: item.isPaid ? `Hưởng ${item.paidPercent}%` : 'Không lương',
        reason: item.note ? `${item.reason} (${item.note})` : item.reason,
        approvalStatus: item.approvalStatus.toLowerCase(),
      }));
  });

  readonly pendingCount = computed(
    () => this.scopedItems().filter((i) => i.approvalStatus.toLowerCase() === 'pending').length
  );

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      this.selectedMonth();
      this.selectedYear();
      untracked(() => {
        this.loadRequests();
        this.loadScopedEmployees(branchId);
      });
    });
  }

  ngOnInit(): void {
    this.employeeApi.getLeaveTypes().subscribe({
      next: (list) => {
        const active = list.filter((i) => i.isActive);
        this.leaveCatalog.set(active);
        if (active.length > 0) this.formLeaveCode.set(active[0].leaveCode);
      },
    });

    this.isLoadingApprovers.set(true);
    this.employeeApi.getPermissionMatrix().subscribe({
      next: (matrix) => {
        this.permissionMatrix.set(matrix);
        this.isLoadingApprovers.set(false);
      },
      error: () => this.isLoadingApprovers.set(false),
    });
  }

  loadScopedEmployees(branchId?: string): void {
    const currentUser = this.adminSession.user();
    this.employeeApi
      .getEmployeesByHierarchy({
        currentUsername: getCurrentUsername(currentUser),
        branchId,
        pageIndex: 1,
        pageSize: 200,
      })
      .subscribe({
        next: (res) => {
          const { items, isSelfOnly } = resolveScopedEmployees(res.items, currentUser);
          this.employees.set(items);
          this.isSelfOnly.set(isSelfOnly);

          if (items.length > 0) {
            const firstId = getEmployeeNumericId(items[0]);
            const hasCurrent = items.some((e) => getEmployeeNumericId(e) === this.formEmployeeId());
            if (!hasCurrent || isSelfOnly) {
              this.formEmployeeId.set(firstId);
            }
            if (isSelfOnly) {
              this.employeeFilter.set(String(firstId));
            } else if (
              this.employeeFilter() !== 'all' &&
              !items.some((e) => String(getEmployeeNumericId(e)) === this.employeeFilter())
            ) {
              this.employeeFilter.set('all');
            }
          }
        },
      });
  }

  loadRequests(): void {
    this.isLoading.set(true);
    const period = this.selectedPeriodMonth();
    const branchId = this.branchService.selectedBranchId();

    const branchIdNum = branchId === 'all' ? null : this.employeeApi.normalizeBranchId(branchId);
    this.employeeApi.getAttendancePeriodStatus(branchIdNum, period).subscribe({
      next: (st) => this.periodStatus.set(st),
      error: () => this.periodStatus.set(null),
    });

    this.payrollApi.getEmployeeMonthlyQuotas(period, branchId).subscribe({
      next: (list) => this.quotas.set(list),
      error: () => this.quotas.set([]),
    });

    this.employeeApi
      .getLeaveRequests(period, branchId)
      .subscribe({
        next: (list) => {
          this.items.set(list);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.isLoading.set(false);
          this.toastService.error(err.message);
        },
      });
  }

  refresh(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    if (!this.isSelfOnly()) {
      this.employeeFilter.set('all');
    }
    this.loadRequests();
    this.toastService.success('Đã làm mới danh sách đơn xin nghỉ phép.');
  }

  openCreateDrawer(): void {
    this.formReason.set('');
    const empFilter = this.employeeFilter();
    if (empFilter !== 'all') {
      const num = Number(empFilter);
      if (!isNaN(num) && num > 0) {
        this.formEmployeeId.set(num);
      }
    } else if (!this.formEmployeeId() && this.employees().length > 0) {
      this.formEmployeeId.set(getEmployeeNumericId(this.employees()[0]));
    }
    this.isCreateOpen.set(true);
  }

  submitCreate(): void {
    const block = this.quotaBlockReason();
    if (block) {
      this.toastService.error(block);
      return;
    }

    if (!this.formEmployeeId() || !this.formFromDate() || !this.formToDate() || !this.formReason().trim()) {
      this.toastService.warning('Vui lòng chọn nhân sự, ngày nghỉ và nhập lý do xin nghỉ.');
      return;
    }

    this.isSubmitting.set(true);
    this.employeeApi
      .createLeaveRequest({
        employeeId: Number(this.formEmployeeId()),
        fromDate: this.formFromDate(),
        toDate: this.formToDate(),
        leaveCode: this.formLeaveCode(),
        reason: this.formReason().trim(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isCreateOpen.set(false);
          this.toastService.success('Đã gửi đơn xin nghỉ phép mới (Chờ duyệt). Quỹ phép chỉ bị trừ sau khi đơn được duyệt.');
          this.loadRequests();
        },
        error: (err: Error) => {
          this.isSubmitting.set(false);
          this.toastService.error(err.message);
        },
      });
  }

  canApproveRow(row: GridRow): boolean {
    if (this.isPeriodLocked()) return false;
    if (row['approvalStatus'] !== 'pending') return false;
    return this.adminSession.canApprove();
  }

  canRequestCancelRow(row: GridRow): boolean {
    if (this.isPeriodLocked()) return false;
    if (row['approvalStatus'] !== 'approved') return false;
    const raw = row['_raw'] as LeaveRequestItem;
    return canUserRequestCancelOnApprovedRow(
      raw.employeeId,
      raw.employeeCode,
      this.adminSession.user(),
      this.employees()
    );
  }

  canProcessCancelRow(row: GridRow): boolean {
    if (this.isPeriodLocked()) return false;
    if (row['approvalStatus'] !== 'cancel_pending') return false;
    return this.adminSession.canApprove();
  }

  processRow(
    row: GridRow,
    action: 'approved' | 'rejected' | 'request_cancel' | 'approve_cancel' | 'reject_cancel'
  ): void {
    const raw = row['_raw'] as LeaveRequestItem;
    const approverName = this.adminSession.user()?.name || 'Quản lý nhân sự';
    const note =
      action === 'request_cancel'
        ? `Nhân sự ${raw.fullName} gửi yêu cầu xin hủy đơn nghỉ phép đã duyệt.`
        : undefined;
    this.employeeApi
      .processLeaveRequest(raw.leaveId, { action, approverName, note })
      .subscribe({
        next: () => {
          const msgMap: Record<string, string> = {
            approved: `Đã duyệt đơn nghỉ phép của ${raw.fullName}!`,
            rejected: `Đã từ chối đơn nghỉ phép của ${raw.fullName}.`,
            request_cancel: `Đã gửi yêu cầu xin hủy đơn nghỉ phép của ${raw.fullName} lên cấp duyệt!`,
            approve_cancel: `Đã đồng ý hủy đơn nghỉ phép và hoàn lại ${raw.leaveDays} ngày phép cho ${raw.fullName}!`,
            reject_cancel: `Đã từ chối yêu cầu hủy, giữ nguyên đơn nghỉ phép đã duyệt của ${raw.fullName}.`,
          };
          this.toastService.success(msgMap[action] || 'Cập nhật đơn nghỉ phép thành công.');
          this.loadRequests();
        },
        error: (err: Error) => {
          this.toastService.error(err.message);
          this.loadRequests();
        },
      });
  }
}
