import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  LucideDownload,
  LucideEye,
  LucideFileSpreadsheet,
  LucideInbox,
  LucidePrinter,
  LucideSearch,
  LucideTrash2,
  LucideUpload,
} from '@lucide/angular';
import { SortDirection, TableColumn } from '../../../shared/models/page';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { AdminSession } from '../../../core/admin_session';
import { AdminPageHeader } from '../../../shared/admin_page_header/admin_page_header';
import { AdminModal } from '../../../shared/admin_modal/admin_modal';
import { BadgeVariant } from '../../../shared/admin_status_badge/admin_status_badge';
import { Employee } from '../models/employee';
import { HrmEmployeeApi } from '../services/hrm_employee_api';

@Component({
  selector: 'app-hrm-employees',
  templateUrl: './hrm_employees.html',
  styleUrl: './hrm_employees.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideEye,
    LucideTrash2,
    LucideFileSpreadsheet,
    LucideDownload,
    LucideUpload,
    LucidePrinter,
    LucideSearch,
    LucideInbox,
    AdminPageHeader,
    AdminModal,
  ],
})
export class HrmEmployees {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);
  private readonly adminSession = inject(AdminSession);
  private readonly router = inject(Router);

  readonly employees = signal<Employee[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly size = signal(20);
  readonly searchQuery = signal('');
  readonly statusFilter = signal('all');
  readonly positionFilter = signal('all');
  readonly sortBy = signal('code');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);

  // Trạng thái Bảng dữ liệu dạng lưới
  readonly selectedEmployeeId = signal<string | null>(null);

  // Modal thôi việc
  readonly isModalOpen = signal(false);
  readonly employeeToResign = signal<Employee | null>(null);

  // Thống kê nhanh chân bảng lưới
  readonly activeWorkingCount = computed(() =>
    this.employees().filter((e) => e.status === 'active' || e.status === 'working').length
  );

  readonly resignedCount = computed(() =>
    this.employees().filter((e) => e.status === 'resigned').length
  );

  readonly averageHourlyRate = computed(() => {
    const list = this.employees();
    if (!list.length) return 0;
    const sum = list.reduce((acc, e) => acc + (e.hourlyRate || 0), 0);
    return Math.round(sum / list.length);
  });

  readonly totalAllowance = computed(() =>
    this.employees().reduce((acc, e) => acc + (e.allowance || 0), 0)
  );

  readonly columns: TableColumn<Employee>[] = [
    { key: 'code', label: 'Mã NV', sortable: true, width: '6.5rem' },
    { key: 'fullName', label: 'Họ và tên & CCCD', sortable: true },
    { key: 'branchName', label: 'Chi nhánh', sortable: true },
    { key: 'position', label: 'Chức vụ', sortable: true },
    { key: 'contractName', label: 'Hợp đồng & Lương/giờ', sortable: true },
    { key: 'phone', label: 'Số điện thoại & Ngân hàng' },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actions', label: 'Thao tác', align: 'center', width: '6.5rem' },
  ];

  constructor() {
    effect(() => {
      // Tự động load lại khi chi nhánh trên topbar thay đổi
      const branchId = this.branchService.selectedBranchId();
      this.page.set(1);
      this.loadEmployees();
    });
  }

  loadEmployees(): void {
    this.isLoading.set(true);

    const currentUser = this.adminSession.user();
    const currentUserRole = currentUser?.role;
    const currentUsername = currentUser?.email ? currentUser.email.split('@')[0] : (currentUser?.name || 'admin');

    this.employeeApi
      .getEmployees(
        {
          page: this.page(),
          size: this.size(),
          q: this.searchQuery(),
          branchId: this.branchService.selectedBranchId(),
          status: this.statusFilter(),
          position: this.positionFilter(),
          sortBy: this.sortBy(),
          sortOrder: this.sortOrder(),
        },
        currentUserRole,
        currentUsername
      )
      .subscribe({
        next: (res) => {
          this.employees.set(res.items);
          this.total.set(res.total);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  selectRow(emp: Employee, _idx?: number): void {
    this.selectedEmployeeId.set(emp.employeeCode || emp.code);
  }

  onSortToggle(key: string): void {
    if (this.sortBy() === key) {
      this.sortOrder.update((curr) => (curr === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(key);
      this.sortOrder.set('asc');
    }
    this.loadEmployees();
  }

  exportExcel(): void {
    this.toastService.info('Đang kết xuất tệp Excel danh sách nhân sự "Fiin_HRM_Employees_2026.xlsx"...');
  }

  importExcel(): void {
    this.toastService.info('Tính năng nạp danh sách nhân sự từ tệp Excel (.xlsx) đang phát triển.');
  }

  printSpreadsheet(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  viewProfile(emp: Employee, event?: Event): void {
    if (event) event.stopPropagation();
    const id = emp.employeeId || emp.code;
    void this.router.navigate(['/admin/hrm/ho-so-nhan-vien'], { queryParams: { id } });
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
    this.page.set(1);
    this.loadEmployees();
  }

  onStatusFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(val);
    this.page.set(1);
    this.loadEmployees();
  }

  onPositionFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.positionFilter.set(val);
    this.page.set(1);
    this.loadEmployees();
  }

  onResetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.positionFilter.set('all');
    this.page.set(1);
    this.loadEmployees();
  }

  onSortChange(evt: { key: string; order: SortDirection }): void {
    this.sortBy.set(evt.key);
    this.sortOrder.set(evt.order);
    this.loadEmployees();
  }

  confirmResign(emp: Employee, event?: Event): void {
    if (event) event.stopPropagation();
    this.employeeToResign.set(emp);
    this.isModalOpen.set(true);
  }

  executeResign(): void {
    const emp = this.employeeToResign();
    if (!emp) return;

    this.employeeApi.changeStatus(emp.employeeId || emp.id, 'resigned').subscribe({
      next: () => {
        this.toastService.warning(`Đã cập nhật trạng thái thôi việc cho nhân viên "${emp.fullName}".`);
        this.isModalOpen.set(false);
        this.employeeToResign.set(null);
        this.loadEmployees();
      },
    });
  }

  getStatusBadge(status: string): { label: string; variant: BadgeVariant } {
    switch (status) {
      case 'active':
      case 'working':
        return { label: 'Đang làm việc', variant: 'success' };
      case 'probation':
        return { label: 'Đang thử việc', variant: 'warning' };
      case 'resigned':
        return { label: 'Đã thôi việc', variant: 'danger' };
      default:
        return { label: status, variant: 'neutral' };
    }
  }
}
