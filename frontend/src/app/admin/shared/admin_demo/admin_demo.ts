import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideBell,
  LucidePlus,
  LucideTrash2,
} from '@lucide/angular';
import { SortDirection, TableColumn } from '../models/page';
import { AdminBranchService } from '../services/admin_branch_service';
import { AdminToastService } from '../services/admin_toast_service';
import { AdminPageHeader } from '../admin_page_header/admin_page_header';
import { AdminStatCard } from '../admin_stat_card/admin_stat_card';
import { AdminStatusBadge, BadgeVariant } from '../admin_status_badge/admin_status_badge';
import { AdminFilterBar } from '../admin_filter_bar/admin_filter_bar';
import { AdminDataTable } from '../admin_data_table/admin_data_table';
import { AdminFormField } from '../admin_form_field/admin_form_field';
import { AdminDrawer } from '../admin_drawer/admin_drawer';
import { AdminModal } from '../admin_modal/admin_modal';

export interface DemoEmployee {
  id: string;
  code: string;
  fullName: string;
  branchId: string;
  branchName: string;
  position: string;
  phone: string;
  status: 'working' | 'probation' | 'resigned';
  statusLabel: string;
  statusVariant: BadgeVariant;
  hourlyRate: number;
  startDate: string;
}

const INITIAL_DEMO_DATA: DemoEmployee[] = [
  {
    id: 'emp-01',
    code: 'NV001',
    fullName: 'Đặng Quốc Anh',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Trưởng ca Pha chế',
    phone: '0901 234 567',
    status: 'working',
    statusLabel: 'Đang làm việc',
    statusVariant: 'success',
    hourlyRate: 35000,
    startDate: '15/01/2025',
  },
  {
    id: 'emp-02',
    code: 'NV002',
    fullName: 'Nguyễn Thị Hương',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Barista Chuyên nghiệp',
    phone: '0902 345 678',
    status: 'working',
    statusLabel: 'Đang làm việc',
    statusVariant: 'success',
    hourlyRate: 28000,
    startDate: '01/03/2025',
  },
  {
    id: 'emp-03',
    code: 'NV003',
    fullName: 'Lê Thanh Tùng',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Quản lý Cửa hàng',
    phone: '0903 456 789',
    status: 'working',
    statusLabel: 'Đang làm việc',
    statusVariant: 'success',
    hourlyRate: 42000,
    startDate: '10/11/2024',
  },
  {
    id: 'emp-04',
    code: 'NV004',
    fullName: 'Phạm Minh Tuấn',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Nhân viên Thu ngân',
    phone: '0904 567 890',
    status: 'probation',
    statusLabel: 'Đang thử việc',
    statusVariant: 'warning',
    hourlyRate: 25000,
    startDate: '15/10/2026',
  },
  {
    id: 'emp-05',
    code: 'NV005',
    fullName: 'Võ Ngọc Bích',
    branchId: 'cn-td',
    branchName: 'Fiin Làng Đại Học',
    position: 'Barista Part-time',
    phone: '0905 678 901',
    status: 'working',
    statusLabel: 'Đang làm việc',
    statusVariant: 'success',
    hourlyRate: 26000,
    startDate: '05/09/2025',
  },
  {
    id: 'emp-06',
    code: 'NV006',
    fullName: 'Hoàng Văn Khang',
    branchId: 'cn-td',
    branchName: 'Fiin Làng Đại Học',
    position: 'Nhân viên Phục vụ',
    phone: '0906 789 012',
    status: 'resigned',
    statusLabel: 'Đã nghỉ việc',
    statusVariant: 'danger',
    hourlyRate: 24000,
    startDate: '20/02/2025',
  },
  {
    id: 'emp-07',
    code: 'NV007',
    fullName: 'Bùi Mỹ Linh',
    branchId: 'cn-bt',
    branchName: 'Fiin Phan Xích Long',
    position: 'Trưởng ca Cửa hàng',
    phone: '0907 890 123',
    status: 'working',
    statusLabel: 'Đang làm việc',
    statusVariant: 'success',
    hourlyRate: 36000,
    startDate: '12/04/2025',
  },
  {
    id: 'emp-08',
    code: 'NV008',
    fullName: 'Trịnh Quốc Bảo',
    branchId: 'cn-bt',
    branchName: 'Fiin Phan Xích Long',
    position: 'Barista Chuyên nghiệp',
    phone: '0908 901 234',
    status: 'probation',
    statusLabel: 'Đang thử việc',
    statusVariant: 'warning',
    hourlyRate: 27000,
    startDate: '01/11/2026',
  },
];

@Component({
  selector: 'app-admin-demo',
  templateUrl: './admin_demo.html',
  styleUrl: './admin_demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucidePlus,
    LucideTrash2,
    LucideBell,
    AdminPageHeader,
    AdminStatCard,
    AdminStatusBadge,
    AdminFilterBar,
    AdminDataTable,
    AdminFormField,
    AdminDrawer,
    AdminModal,
  ],
})
export class AdminDemo {
  readonly branchService = inject(AdminBranchService);
  readonly toastService = inject(AdminToastService);

  // State data
  readonly allEmployees = signal<DemoEmployee[]>(INITIAL_DEMO_DATA);
  readonly searchQuery = signal<string>('');
  readonly statusFilter = signal<string>('all');
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(5);
  readonly sortBy = signal<string>('code');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly selectedEmployeeIds = signal<string[]>([]);

  // Drawer & Modal State
  readonly isDrawerOpen = signal<boolean>(false);
  readonly isModalOpen = signal<boolean>(false);
  readonly employeeToDelete = signal<DemoEmployee | null>(null);

  // Reactive Form
  readonly employeeForm = new FormGroup({
    fullName: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(3)] }),
    branchId: new FormControl('cn-q1', { nonNullable: true, validators: [Validators.required] }),
    position: new FormControl('Barista Chuyên nghiệp', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/^[0-9\s]{9,12}$/)] }),
    hourlyRate: new FormControl(28000, { nonNullable: true, validators: [Validators.required, Validators.min(20000)] }),
    status: new FormControl<'working' | 'probation'>('working', { nonNullable: true }),
  });

  // Table Columns
  readonly columns: TableColumn<DemoEmployee>[] = [
    { key: 'code', label: 'Mã NV', sortable: true, width: '6rem' },
    { key: 'fullName', label: 'Họ và tên', sortable: true },
    { key: 'branchName', label: 'Chi nhánh', sortable: true },
    { key: 'position', label: 'Chức vụ', sortable: true },
    { key: 'phone', label: 'Số điện thoại' },
    {
      key: 'hourlyRate',
      label: 'Đơn giá giờ',
      sortable: true,
      align: 'right',
      render: (r) => r.hourlyRate.toLocaleString('vi-VN') + 'đ/h',
    },
    { key: 'status', label: 'Trạng thái' },
    { key: 'actions', label: 'Hành động', align: 'center', width: '6rem' },
  ];

  // Filtered and Sorted items
  readonly filteredEmployees = computed(() => {
    let list = [...this.allEmployees()];

    // Branch filter from Global Service
    const selectedBranch = this.branchService.selectedBranchId();
    if (selectedBranch !== 'all') {
      list = list.filter((e) => e.branchId === selectedBranch);
    }

    // Local Status filter
    const status = this.statusFilter();
    if (status !== 'all') {
      list = list.filter((e) => e.status === status);
    }

    // Search query
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.code.toLowerCase().includes(q) ||
          e.phone.includes(q) ||
          e.position.toLowerCase().includes(q)
      );
    }

    // Sorting
    const key = this.sortBy();
    const order = this.sortOrder();
    list.sort((a, b) => {
      let valA = (a as any)[key] ?? '';
      let valB = (b as any)[key] ?? '';
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return order === 'asc' ? -1 : 1;
      if (valA > valB) return order === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  });

  // Paginated items
  readonly pagedEmployees = computed(() => {
    const list = this.filteredEmployees();
    const p = this.currentPage();
    const s = this.pageSize();
    const start = (p - 1) * s;
    return list.slice(start, start + s);
  });

  // KPI computations
  readonly totalCount = computed(() => this.allEmployees().length);
  readonly workingCount = computed(() => this.allEmployees().filter((e) => e.status === 'working').length);
  readonly probationCount = computed(() => this.allEmployees().filter((e) => e.status === 'probation').length);
  readonly averageRate = computed(() => {
    const list = this.allEmployees();
    if (!list.length) return '0đ';
    const sum = list.reduce((acc, cur) => acc + cur.hourlyRate, 0);
    return Math.round(sum / list.length).toLocaleString('vi-VN') + 'đ/h';
  });

  onSearchChange(text: string): void {
    this.searchQuery.set(text);
    this.currentPage.set(1);
  }

  onStatusFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value;
    this.statusFilter.set(val);
    this.currentPage.set(1);
  }

  onResetFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('all');
    this.currentPage.set(1);
  }

  onSortChange(evt: { key: string; order: SortDirection }): void {
    this.sortBy.set(evt.key);
    this.sortOrder.set(evt.order);
  }

  openCreateDrawer(): void {
    this.employeeForm.reset({
      fullName: '',
      branchId: this.branchService.selectedBranchId() === 'all' ? 'cn-q1' : this.branchService.selectedBranchId(),
      position: 'Barista Chuyên nghiệp',
      phone: '',
      hourlyRate: 28000,
      status: 'working',
    });
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  submitEmployee(): void {
    if (this.employeeForm.invalid) {
      this.employeeForm.markAllAsTouched();
      this.toastService.error('Vui lòng kiểm tra lại thông tin biểu mẫu!');
      return;
    }

    const val = this.employeeForm.getRawValue();
    const branch = this.branchService.branches().find((b) => b.id === val.branchId);

    const newEmp: DemoEmployee = {
      id: `emp-${Date.now()}`,
      code: `NV00${this.allEmployees().length + 1}`,
      fullName: val.fullName,
      branchId: val.branchId,
      branchName: branch ? branch.name : 'Chi nhánh chính',
      position: val.position,
      phone: val.phone,
      status: val.status,
      statusLabel: val.status === 'working' ? 'Đang làm việc' : 'Đang thử việc',
      statusVariant: val.status === 'working' ? 'success' : 'warning',
      hourlyRate: Number(val.hourlyRate),
      startDate: new Date().toLocaleDateString('vi-VN'),
    };

    this.allEmployees.update((list) => [newEmp, ...list]);
    this.closeDrawer();
    this.toastService.success(`Đã thêm nhân viên "${newEmp.fullName}" thành công!`);
  }

  confirmDeleteEmployee(emp: DemoEmployee, event?: Event): void {
    if (event) event.stopPropagation();
    this.employeeToDelete.set(emp);
    this.isModalOpen.set(true);
  }

  executeDelete(): void {
    const target = this.employeeToDelete();
    if (!target) return;

    this.allEmployees.update((list) =>
      list.map((e) =>
        e.id === target.id
          ? { ...e, status: 'resigned', statusLabel: 'Đã thôi việc', statusVariant: 'danger' }
          : e
      )
    );

    this.isModalOpen.set(false);
    this.employeeToDelete.set(null);
    this.toastService.warning(`Đã chuyển trạng thái thôi việc cho nhân viên "${target.fullName}".`);
  }

  triggerTestToast(type: 'success' | 'error' | 'warning' | 'info'): void {
    switch (type) {
      case 'success':
        this.toastService.success('Dữ liệu bảng lương tháng 11/2026 đã được lưu tự động.');
        break;
      case 'error':
        this.toastService.error('Không thể kết nối máy chủ chấm công tại CN-THUDUC.');
        break;
      case 'warning':
        this.toastService.warning('Có 2 nhân viên chưa hoàn tất xếp ca tuần này.');
        break;
      case 'info':
        this.toastService.info('Hệ thống đang đồng bộ dữ liệu toàn chuỗi...');
        break;
    }
  }
}
