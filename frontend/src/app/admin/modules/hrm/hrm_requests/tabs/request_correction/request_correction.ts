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
  AttendanceCorrectionRequestItem,
  AttendancePeriodStatus,
  EmployeePermissionSettingItem,
  HrmEmployeeApi,
} from '../../../services/hrm_employee_api';
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
  selector: 'app-request-correction-tab',
  templateUrl: './request_correction.html',
  styleUrl: './request_correction.css',
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
export class RequestCorrectionTab implements OnInit {
  readonly branchService = inject(AdminBranchService);
  private readonly adminSession = inject(AdminSession);
  private readonly employeeApi = inject(HrmEmployeeApi);
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

  readonly items = signal<AttendanceCorrectionRequestItem[]>([]);
  readonly employees = signal<Employee[]>([]);
  readonly periodStatus = signal<AttendancePeriodStatus | null>(null);
  readonly isPeriodLocked = computed(() => this.periodStatus()?.isLocked ?? false);
  readonly isSelfOnly = signal(false);
  readonly permissionMatrix = signal<EmployeePermissionSettingItem[]>([]);

  // ---- Drawer Tạo đơn bù công ----
  readonly isCreateOpen = signal(false);
  readonly formEmployeeId = signal<number>(0);
  readonly formWorkDate = signal<string>(getTodayIsoDate());
  readonly formCheckIn = signal<string>('08:00');
  readonly formCheckOut = signal<string>('17:00');
  readonly formReason = signal<string>('');

  readonly selectedEmployee = computed(() => {
    const id = this.formEmployeeId();
    return this.employees().find((e) => getEmployeeNumericId(e) === id) ?? null;
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
    { value: 'approved', label: 'Đã duyệt (Đã bù công)' },
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
    { key: 'workDate', label: 'Ngày bù công', type: 'date', width: '8rem' },
    { key: 'scheduledRange', label: 'Ca chuẩn', type: 'text', align: 'center', width: '7.5rem', mono: true },
    { key: 'requestedRange', label: 'Giờ đề xuất', type: 'text', align: 'center', width: '8rem', mono: true, bold: true },
    { key: 'requestedHours', label: 'Giờ thô', type: 'number', align: 'right', width: '6rem', bold: true, tone: 'success', suffix: 'h' },
    { key: 'reason', label: 'Lý do giải trình / Bù công', type: 'text', minWidth: '15rem' },
    {
      key: 'approvalStatus',
      label: 'Trạng thái',
      type: 'badge',
      align: 'center',
      width: '8.75rem',
      badgeMap: {
        pending: { label: 'Chờ duyệt', variant: 'warning' },
        cancel_pending: { label: 'Xin hủy đơn', variant: 'warning' },
        approved: { label: 'Đã bù công', variant: 'success' },
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
          item.reason.toLowerCase().includes(kw);
        return matchSt && matchKw;
      })
      .sort((a, b) =>
        compareRequestPriority(
          a.approvalStatus,
          b.approvalStatus,
          a.workDate || a.createdAt,
          b.workDate || b.createdAt
        )
      )
      .map((item) => ({
        _raw: item,
        requestId: item.requestId,
        employeeCode: item.employeeCode,
        fullName: item.fullName,
        position: item.position,
        branchName: item.branchName,
        workDate: item.workDate,
        scheduledRange: `${item.scheduledStart} - ${item.scheduledEnd}`,
        requestedRange: `${item.requestedCheckIn} - ${item.requestedCheckOut}`,
        requestedHours: item.requestedHours,
        reason: item.approverNote ? `${item.reason} (${item.approverNote})` : item.reason,
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

    this.employeeApi
      .getCorrectionRequests(period, branchId)
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
    this.toastService.success('Đã làm mới danh sách đơn bù công.');
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
    if (!this.formEmployeeId() || !this.formWorkDate() || !this.formReason().trim()) {
      this.toastService.warning('Vui lòng chọn nhân sự, ngày bù công và nhập lý do giải trình.');
      return;
    }

    this.isSubmitting.set(true);
    this.employeeApi
      .createCorrectionRequest({
        employeeId: Number(this.formEmployeeId()),
        workDate: this.formWorkDate(),
        requestedCheckIn: this.formCheckIn(),
        requestedCheckOut: this.formCheckOut(),
        reason: this.formReason().trim(),
      })
      .subscribe({
        next: () => {
          this.isSubmitting.set(false);
          this.isCreateOpen.set(false);
          this.toastService.success('Đã gửi đơn bù công mới (Chờ duyệt).');
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
    const raw = row['_raw'] as AttendanceCorrectionRequestItem;
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
    const raw = row['_raw'] as AttendanceCorrectionRequestItem;
    const approverName = this.adminSession.user()?.name || 'Quản lý nhân sự';
    const note =
      action === 'request_cancel'
        ? `Nhân sự ${raw.fullName} gửi yêu cầu xin hủy đơn bù công đã duyệt.`
        : undefined;
    this.employeeApi
      .processCorrectionRequest(raw.requestId, { action, approverName, note })
      .subscribe({
        next: () => {
          const msgMap: Record<string, string> = {
            approved: `Đã duyệt và cập nhật công thực tế cho ${raw.fullName}!`,
            rejected: `Đã từ chối đơn bù công của ${raw.fullName}.`,
            request_cancel: `Đã gửi yêu cầu xin hủy đơn bù công của ${raw.fullName} lên cấp duyệt!`,
            approve_cancel: `Đã đồng ý hủy đơn bù công và hoàn tác giờ công của ${raw.fullName}!`,
            reject_cancel: `Đã từ chối yêu cầu hủy, giữ nguyên đơn bù công đã duyệt của ${raw.fullName}.`,
          };
          this.toastService.success(msgMap[action] || 'Cập nhật đơn bù công thành công.');
          this.loadRequests();
        },
        error: (err: Error) => {
          this.toastService.error(err.message);
          this.loadRequests();
        },
      });
  }
}
