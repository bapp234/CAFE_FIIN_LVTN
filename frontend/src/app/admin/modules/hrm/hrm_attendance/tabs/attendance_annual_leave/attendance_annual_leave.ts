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
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideDownload, LucidePlus, LucideRotateCcw } from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminFormField } from '../../../../../shared/admin_form_field/admin_form_field';
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
import { HrmEmployeeApi } from '../../../services/hrm_employee_api';

interface LeaveOverride {
  standardLeave: number;
  seniorityLeave: number;
  carriedOver: number;
  usedLeave: number;
  note: string;
}

@Component({
  selector: 'app-attendance-annual-leave',
  templateUrl: './attendance_annual_leave.html',
  styleUrl: './attendance_annual_leave.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideDownload,
    LucidePlus,
    LucideRotateCcw,
    AdminFormField,
    AdminDrawer,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class AttendanceAnnualLeave {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly toastService = inject(AdminToastService);

  // ---- Bộ lọc & Sắp xếp ----
  readonly searchQuery = signal('');
  readonly selectedYear = signal('2026');
  readonly leaveStatusFilter = signal('all');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);

  // ---- Dữ liệu & Chọn dòng ----
  readonly employees = signal<Employee[]>([]);
  readonly selectedEmployeeCodes = signal<string[]>([]);
  readonly leaveOverrides = signal<Record<string, LeaveOverride>>({});

  // ---- Drawer Cập nhật phép năm ----
  readonly isLeaveDrawerOpen = signal(false);
  readonly editingLeaveRow = signal<GridRow | null>(null);

  readonly leaveForm = new FormGroup({
    standardLeave: new FormControl(12, { nonNullable: true, validators: [Validators.required] }),
    seniorityLeave: new FormControl(0, { nonNullable: true }),
    carriedOver: new FormControl(0, { nonNullable: true }),
    usedLeave: new FormControl(0, { nonNullable: true, validators: [Validators.required] }),
    note: new FormControl('', { nonNullable: true }),
  });

  // ---- Tùy chọn Combobox ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly yearOptions: ComboOption[] = (() => {
    const list: ComboOption[] = [];
    for (let y = 2030; y >= 2020; y--) {
      list.push({ value: String(y), label: `Năm ${y}` });
    }
    return list;
  })();

  readonly leaveStatusOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả quỹ phép' },
    { value: 'available', label: 'Còn nhiều phép (>= 4 ngày)' },
    { value: 'low', label: 'Sắp hết phép (1 - 3 ngày)' },
    { value: 'exhausted', label: 'Đã hết phép (0 ngày)' },
  ];

  // =========================================================================
  // CỘT & DÒNG BẢNG DANH SÁCH PHÉP NĂM NHÂN VIÊN
  // =========================================================================
  readonly annualLeaveColumns: GridColumn[] = [
    { key: 'code', label: 'Mã NV', type: 'code', width: '6.5rem', sortable: true },
    {
      key: 'fullName',
      label: 'Họ và tên nhân sự',
      type: 'text',
      bold: true,
      minWidth: '13rem',
      sortable: true,
      subKey: 'position',
    },
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '9rem' },
    {
      key: 'standardLeave',
      label: 'Phép chuẩn năm',
      type: 'number',
      align: 'right',
      width: '7.5rem',
      suffix: ' ngày',
      summary: 'sum',
    },
    {
      key: 'seniorityLeave',
      label: 'Phép thâm niên',
      type: 'number',
      align: 'right',
      width: '7.5rem',
      suffix: ' ngày',
      summary: 'sum',
    },
    {
      key: 'carriedOver',
      label: 'Tồn năm cũ',
      type: 'number',
      align: 'right',
      width: '6.75rem',
      suffix: ' ngày',
      summary: 'sum',
    },
    {
      key: 'totalEntitlement',
      label: 'Tổng quỹ phép',
      type: 'number',
      align: 'right',
      width: '7.5rem',
      bold: true,
      tone: 'dark',
      suffix: ' ngày',
      summary: 'sum',
    },
    {
      key: 'usedLeave',
      label: 'Đã nghỉ',
      type: 'number',
      align: 'right',
      width: '6.5rem',
      tone: 'info',
      suffix: ' ngày',
      summary: 'sum',
    },
    {
      key: 'remainingLeave',
      label: 'Phép còn lại',
      type: 'number',
      align: 'right',
      width: '7.25rem',
      bold: true,
      tone: 'success',
      suffix: ' ngày',
      summary: 'sum',
    },
  ];

  readonly annualLeaveRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    const statusFilter = this.leaveStatusFilter();
    const year = this.selectedYear();
    const overrides = this.leaveOverrides();

    return this.employees()
      .filter((emp) => {
        return (
          !kw ||
          emp.fullName.toLowerCase().includes(kw) ||
          emp.code.toLowerCase().includes(kw) ||
          (emp.position && emp.position.toLowerCase().includes(kw))
        );
      })
      .map((emp, idx) => {
        const key = `${emp.code}_${year}`;
        const ov = overrides[key];

        const standardLeave = ov ? ov.standardLeave : 12;
        const seniorityLeave = ov ? ov.seniorityLeave : idx % 3 === 0 ? 1 : 0;
        const carriedOver = ov ? ov.carriedOver : idx % 4 === 0 ? 2 : 0;
        const totalEntitlement = standardLeave + seniorityLeave + carriedOver;
        const usedLeave = ov ? ov.usedLeave : Math.min(totalEntitlement, (idx * 2 + 3) % 13);
        const remainingLeave = Math.max(0, totalEntitlement - usedLeave);

        let leaveStatus = 'available';
        if (remainingLeave === 0) leaveStatus = 'exhausted';
        else if (remainingLeave <= 3) leaveStatus = 'low';

        return {
          _raw: emp,
          id: emp.id,
          code: emp.code,
          fullName: emp.fullName,
          position: emp.position || 'Nhân viên',
          branchName: emp.branchName || 'Mặc định',
          standardLeave,
          seniorityLeave,
          carriedOver,
          totalEntitlement,
          usedLeave,
          remainingLeave,
          leaveStatus,
          note: ov?.note || '',
        };
      })
      .filter((row) => statusFilter === 'all' || row['leaveStatus'] === statusFilter);
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadLeaveData();
      });
    });
  }

  loadLeaveData(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();

    this.employeeApi
      .getEmployees({ page: 1, size: 100, branchId, status: 'working' })
      .subscribe({
        next: (res) => {
          this.employees.set(res.items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
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
    const rows = this.annualLeaveRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeCodes.set(this.annualLeaveRows().map((r) => String(r['code'])));
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

  onYearChange(year: string): void {
    this.selectedYear.set(year);
  }

  onLeaveStatusFilterChange(st: string): void {
    this.leaveStatusFilter.set(st);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.leaveStatusFilter.set('all');
    this.selectedEmployeeCodes.set([]);
    this.loadLeaveData();
    this.toastService.success('Đã làm mới danh sách phép năm nhân viên!');
  }

  openLeaveDrawer(row: GridRow): void {
    this.editingLeaveRow.set(row);
    this.leaveForm.reset({
      standardLeave: Number(row['standardLeave']),
      seniorityLeave: Number(row['seniorityLeave']),
      carriedOver: Number(row['carriedOver']),
      usedLeave: Number(row['usedLeave']),
      note: String(row['note'] || ''),
    });
    this.isLeaveDrawerOpen.set(true);
  }

  saveLeaveUpdate(): void {
    if (this.leaveForm.invalid) return;
    const row = this.editingLeaveRow();
    if (!row) return;

    const val = this.leaveForm.getRawValue();
    const key = `${row['code']}_${this.selectedYear()}`;

    this.leaveOverrides.update((curr) => ({
      ...curr,
      [key]: val,
    }));

    this.isLeaveDrawerOpen.set(false);
    this.toastService.success(`Đã cập nhật quỹ phép năm của ${row['fullName']}!`);
  }

  openExportConfirm(): void {
    if (this.annualLeaveRows().length === 0) {
      this.toastService.warning('Không có dữ liệu phép năm nhân viên để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportAnnualLeaveExcel(): void {
    const selected = this.selectedEmployeeCodes();
    const allRows = this.annualLeaveRows();
    const rows =
      selected.length > 0
        ? allRows.filter((r) => selected.includes(String(r['code'])))
        : allRows;

    if (rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và tên',
      'Chức vụ',
      'Chi nhánh',
      'Phép chuẩn năm',
      'Phép thâm niên',
      'Phép tồn năm cũ',
      'Tổng quỹ phép',
      'Đã nghỉ',
      'Phép còn lại',
    ];

    const payloadRows = rows.map((r) => ({
      'Mã NV': String(r['code'] ?? ''),
      'Họ và tên': String(r['fullName'] ?? ''),
      'Chức vụ': String(r['position'] ?? ''),
      'Chi nhánh': String(r['branchName'] ?? ''),
      'Phép chuẩn năm': Number(r['standardLeave'] ?? 0),
      'Phép thâm niên': Number(r['seniorityLeave'] ?? 0),
      'Phép tồn năm cũ': Number(r['carriedOver'] ?? 0),
      'Tổng quỹ phép': Number(r['totalEntitlement'] ?? 0),
      'Đã nghỉ': Number(r['usedLeave'] ?? 0),
      'Phép còn lại': Number(r['remainingLeave'] ?? 0),
    }));

    const fileName = `Fiin_HRM_Phep_Nam_${this.selectedYear()}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Annual_Leave',
        sheetName: 'Phép năm',
        reportTitle: `DANH SÁCH QUỸ PHÉP NĂM NHÂN VIÊN ${this.selectedYear()}`,
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
          this.toastService.success(`Đã xuất danh sách phép năm ${this.selectedYear()} ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel phép năm.');
        },
      });
  }
}
