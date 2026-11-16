import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideCalendar,
  LucideDownload,
  LucideEye,
  LucideFileSpreadsheet,
  LucideInbox,
  LucideLock,
  LucidePrinter,
  LucideSearch,
  LucideSparkles,
} from '@lucide/angular';
import { SortDirection, TableColumn } from '../../../shared/models/page';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminPageHeader } from '../../../shared/admin_page_header/admin_page_header';
import { AdminStatusBadge, BadgeVariant } from '../../../shared/admin_status_badge/admin_status_badge';
import { AdminModal } from '../../../shared/admin_modal/admin_modal';
import { AdminSession } from '../../../core/admin_session';
import { PayrollPeriod, PayrollSlip } from '../models/payroll';
import { HrmPayrollApi } from '../services/hrm_payroll_api';
import { HrmPayrollSlipModal } from '../components/hrm_payroll_slip_modal/hrm_payroll_slip_modal';

@Component({
  selector: 'app-hrm-payroll',
  templateUrl: './hrm_payroll.html',
  styleUrl: './hrm_payroll.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCalendar,
    LucideLock,
    LucideSparkles,
    LucideEye,
    LucideFileSpreadsheet,
    LucideDownload,
    LucidePrinter,
    LucideSearch,
    LucideInbox,
    AdminPageHeader,
    AdminStatusBadge,
    AdminModal,
    HrmPayrollSlipModal,
  ],
})
export class HrmPayroll {
  readonly branchService = inject(AdminBranchService);
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly toastService = inject(AdminToastService);
  private readonly session = inject(AdminSession);

  readonly selectedPeriod = signal<string>('2026-11');
  readonly periods = signal<PayrollPeriod[]>([]);
  readonly slips = signal<PayrollSlip[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly size = signal(20);
  readonly searchQuery = signal('');
  readonly isLoading = signal(false);

  // Chọn dòng trong bảng lưới
  readonly selectedSlipId = signal<string | null>(null);
  readonly sortBy = signal<string>('code');
  readonly sortOrder = signal<SortDirection>('asc');

  // Active period record
  readonly currentPeriodRecord = computed<PayrollPeriod | undefined>(() => {
    const period = this.selectedPeriod();
    const branchId = this.branchService.selectedBranchId();
    return this.periods().find((p) => p.period === period && (p.branchId === branchId || p.branchId === 'all'));
  });

  readonly isPeriodLocked = computed<boolean>(() => {
    return this.currentPeriodRecord()?.isLocked ?? false;
  });

  // KPI Metrics & Thống kê chân bảng
  readonly totalStandardHours = computed<number>(() => {
    return this.slips().reduce((acc, cur) => acc + (cur.standardWorkHours || 0), 0);
  });

  readonly totalOtHours = computed<number>(() => {
    return this.slips().reduce((acc, cur) => acc + (cur.overtimeHours || 0), 0);
  });

  readonly totalAllowance = computed<number>(() => {
    return this.slips().reduce((acc, cur) => acc + (cur.allowance || 0), 0);
  });

  readonly totalNetPayroll = computed<number>(() => {
    return this.slips().reduce((acc, cur) => acc + (cur.netPay || 0), 0);
  });

  readonly totalOvertimePay = computed<number>(() => {
    return this.slips().reduce((acc, cur) => acc + (cur.overtimePay || 0), 0);
  });

  // Modal confirm approve/lock
  readonly isApproveModalOpen = signal(false);

  // Payslip modal
  readonly isSlipModalOpen = signal(false);
  readonly selectedSlip = signal<PayrollSlip | null>(null);

  readonly columns: TableColumn<PayrollSlip>[] = [
    { key: 'employeeCode', label: 'Mã NV', width: '6.5rem' },
    { key: 'employeeName', label: 'Họ và tên' },
    { key: 'branchName', label: 'Chi nhánh' },
    { key: 'position', label: 'Chức vụ' },
    {
      key: 'hourlyRate',
      label: 'Đơn giá/h',
      align: 'right',
      render: (r) => r.hourlyRate.toLocaleString('vi-VN') + 'đ',
    },
    {
      key: 'standardWorkHours',
      label: 'Giờ chuẩn',
      align: 'center',
      render: (r) => r.standardWorkHours + 'h',
    },
    {
      key: 'overtimeHours',
      label: 'Giờ OT',
      align: 'center',
      render: (r) => (r.overtimeHours > 0 ? `+${r.overtimeHours}h` : '—'),
    },
    {
      key: 'overtimePay',
      label: 'Tiền OT (x1.5)',
      align: 'right',
      render: (r) => (r.overtimePay > 0 ? `+${r.overtimePay.toLocaleString('vi-VN')}đ` : '—'),
    },
    {
      key: 'allowance',
      label: 'Phụ cấp',
      align: 'right',
      render: (r) => (r.allowance > 0 ? `+${r.allowance.toLocaleString('vi-VN')}đ` : '—'),
    },
    {
      key: 'netPay',
      label: 'Thực nhận (Net)',
      align: 'right',
      render: (r) => r.netPay.toLocaleString('vi-VN') + 'đ',
    },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actions', label: 'Phiếu lương', align: 'center', width: '6.5rem' },
  ];

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      this.page.set(1);
      this.loadPayrollData();
    });
  }

  loadPayrollData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();
    const period = this.selectedPeriod();

    this.payrollApi.getPayrollPeriods().subscribe((periods) => {
      this.periods.set(periods);
    });

    this.payrollApi
      .getPayrollSlips({
        page: this.page(),
        size: this.size(),
        period,
        branchId,
        q: this.searchQuery(),
      })
      .subscribe((res) => {
        this.slips.set(res.items);
        this.total.set(res.total);
        this.isLoading.set(false);
      });
  }

  onPeriodChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.selectedPeriod.set(val);
    this.page.set(1);
    this.loadPayrollData();
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
    this.page.set(1);
    this.loadPayrollData();
  }

  onResetFilters(): void {
    this.searchQuery.set('');
    this.page.set(1);
    this.loadPayrollData();
  }

  selectSlip(slip: PayrollSlip): void {
    this.selectedSlipId.set(slip.id);
  }

  onSortToggle(key: string): void {
    if (this.sortBy() === key) {
      this.sortOrder.update((curr) => (curr === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key);
      this.sortOrder.set('asc');
    }
  }

  exportExcel(): void {
    this.toastService.info(`Đang kết xuất bảng lương kỳ ${this.selectedPeriod()} ra tệp Excel (.xlsx)...`);
  }

  printPayroll(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  recalculatePayroll(): void {
    const period = this.selectedPeriod();
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
    this.isApproveModalOpen.set(true);
  }

  executeApprove(): void {
    const p = this.currentPeriodRecord();
    if (!p) return;

    const approver = this.session.user()?.name || 'Trần Thị Mai';
    this.payrollApi.approvePayroll(p.id, approver).subscribe({
      next: () => {
        this.toastService.success(`Đã phê duyệt và KHÓA kỳ lương ${p.period} thành công!`);
        this.isApproveModalOpen.set(false);
        this.loadPayrollData();
      },
      error: (err) => this.toastService.error(err.message),
    });
  }

  viewSlip(slip: PayrollSlip, event?: Event): void {
    if (event) event.stopPropagation();
    this.selectedSlip.set(slip);
    this.isSlipModalOpen.set(true);
  }

  getStatusBadge(status: string): { label: string; variant: BadgeVariant } {
    switch (status) {
      case 'paid':
        return { label: 'Đã chi trả', variant: 'success' };
      case 'approved':
        return { label: 'Đã duyệt (Đã khóa)', variant: 'info' };
      default:
        return { label: 'Bản nháp', variant: 'warning' };
    }
  }
}
