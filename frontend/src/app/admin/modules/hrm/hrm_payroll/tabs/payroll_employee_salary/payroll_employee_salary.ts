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
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { LucideDownload, LucideFileText, LucideRotateCcw } from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
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
import { ContractType, Employee } from '../../../models/employee';
import { HrmEmployeeApi } from '../../../services/hrm_employee_api';
import { ContractItem, HrmContractApi } from '../../../services/hrm_contract_api';
import { HrmPayrollApi, PayrollSettingItem } from '../../../services/hrm_payroll_api';

const OFFICIAL_CONTRACT_CODES = new Set(['HD-CO-THOI-HAN', 'HD-VO-THOI-HAN', 'HD-LAO-DONG']);

@Component({
  selector: 'app-payroll-employee-salary',
  templateUrl: './payroll_employee_salary.html',
  styleUrl: './payroll_employee_salary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideDownload,
    LucideFileText,
    LucideRotateCcw,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class PayrollEmployeeSalary {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly contractApi = inject(HrmContractApi);
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly toastService = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ---- Bộ lọc & Sắp xếp ----
  readonly searchQuery = signal('');
  readonly positionFilter = signal('all');
  readonly contractFilter = signal('all');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);
  readonly isExportConfirmOpen = signal(false);
  readonly isExporting = signal(false);

  // ---- Dữ liệu đồng bộ từ Hợp đồng & Thiết lập lương ----
  readonly employees = signal<Employee[]>([]);
  readonly activeContracts = signal<ContractItem[]>([]);
  readonly contractTypes = signal<ContractType[]>([]);
  readonly payrollSettings = signal<PayrollSettingItem[]>([]);
  readonly selectedEmployeeCodes = signal<string[]>([]);

  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly positionOptions = computed<ComboOption[]>(() => {
    const positions = Array.from(
      new Set(this.employees().map((e) => e.position).filter((p): p is string => !!p))
    );
    return [
      { value: 'all', label: 'Tất cả chức vụ' },
      ...positions.map((p) => ({ value: p, label: p })),
    ];
  });

  readonly contractOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả hình thức' },
    { value: 'fulltime', label: 'Chính thức (Tháng)' },
    { value: 'parttime', label: 'Bán thời gian (Giờ)' },
  ];

  // =========================================================================
  // CỘT & DÒNG BẢNG DANH SÁCH LƯƠNG NHÂN VIÊN
  // =========================================================================
  readonly employeeSalaryColumns: GridColumn[] = [
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
    { key: 'branchName', label: 'Chi nhánh', type: 'pill', minWidth: '9.5rem', sortable: true },
    {
      key: 'salaryMode',
      label: 'Hình thức lương',
      type: 'badge',
      align: 'center',
      width: '8.75rem',
      sortable: true,
      badgeMap: {
        fulltime: { label: 'Lương cứng + Ca', variant: 'success' },
        parttime: { label: 'Lương theo giờ', variant: 'info' },
      },
    },
    {
      key: 'baseSalary',
      label: 'Lương cơ bản tháng',
      type: 'currency',
      align: 'right',
      width: '9.5rem',
      bold: true,
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'hourlyRate',
      label: 'Đơn giá / giờ',
      type: 'currency',
      align: 'right',
      width: '8rem',
      suffix: ' ₫/h',
      sortable: true,
      summary: 'avg',
    },
    {
      key: 'insuranceSalary',
      label: 'Khấu trừ BH (NLĐ)',
      type: 'currency',
      align: 'right',
      width: '9.25rem',
      tone: 'info',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'fixedAllowance',
      label: 'Phụ cấp hợp đồng',
      type: 'currency',
      align: 'right',
      width: '9rem',
      tone: 'success',
      sortable: true,
      summary: 'sum',
    },
    {
      key: 'bankAccount',
      label: 'Tài khoản nhận lương',
      type: 'text',
      mono: true,
      minWidth: '13.5rem',
      tone: 'muted',
    },
  ];

  readonly employeeSalaryRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    const pos = this.positionFilter();
    const cf = this.contractFilter();
    const settings = this.payrollSettings();

    const stdDaysSetting = settings.find((s) => s.code === 'STANDARD_WORK_DAYS' && s.isActive);
    const standardWorkDays = stdDaysSetting && stdDaysSetting.rawValue > 0 ? stdDaysSetting.rawValue : 26;

    const insurancePctFullTime = settings
      .filter(
        (s) =>
          s.isActive &&
          s.category === 'insurance' &&
          s.calcType === 'percent' &&
          s.impact === 'Deduction' &&
          ['all', 'full_time', 'hợp đồng chính thức', 'toàn hệ thống'].includes(
            (s.applyScope || '').trim().toLowerCase()
          )
      )
      .reduce((sum, s) => sum + Number(s.rawValue || 0), 0);

    const insurancePctPartTime = settings
      .filter(
        (s) =>
          s.isActive &&
          s.category === 'insurance' &&
          s.calcType === 'percent' &&
          s.impact === 'Deduction' &&
          ['all', 'part_time', 'toàn hệ thống'].includes((s.applyScope || '').trim().toLowerCase())
      )
      .reduce((sum, s) => sum + Number(s.rawValue || 0), 0);

    const contractByEmpId = new Map<number, ContractItem>();
    const contractByEmpCode = new Map<string, ContractItem>();
    for (const c of this.activeContracts()) {
      if (c.status?.toLowerCase() !== 'active') continue;
      if (!contractByEmpId.has(c.employeeId)) contractByEmpId.set(c.employeeId, c);
      if (c.employeeCode && !contractByEmpCode.has(c.employeeCode)) {
        contractByEmpCode.set(c.employeeCode, c);
      }
    }

    const typeByCode = new Map<string, ContractType>();
    for (const t of this.contractTypes()) {
      if (t.contractCode) typeByCode.set(t.contractCode, t);
    }

    return this.employees()
      .filter((emp) => {
        const matchPos = pos === 'all' || emp.position === pos;
        const matchKw =
          !kw ||
          emp.fullName.toLowerCase().includes(kw) ||
          emp.code.toLowerCase().includes(kw) ||
          (emp.position && emp.position.toLowerCase().includes(kw));
        return matchPos && matchKw;
      })
      .map((emp) => {
        const numericId = Number(emp.employeeId ?? emp.id ?? 0);
        const contract = contractByEmpId.get(numericId) ?? contractByEmpCode.get(emp.code);
        const contractType = contract?.contractTypeCode
          ? typeByCode.get(contract.contractTypeCode)
          : undefined;

        const isOfficialFullTime = contract?.contractTypeCode
          ? OFFICIAL_CONTRACT_CODES.has(contract.contractTypeCode)
          : (emp.contractType || '').toLowerCase() === 'full_time';

        const salaryMode = isOfficialFullTime ? 'fulltime' : 'parttime';
        const hourlyRate = Number(contract?.hourlyRate ?? emp.hourlyRate ?? 0);
        const salaryFactor = Number(contractType?.salaryPercentage ?? 100) / 100;
        const baseSalary = Math.round(hourlyRate * 8 * standardWorkDays * salaryFactor);
        const insurancePct = isOfficialFullTime ? insurancePctFullTime : insurancePctPartTime;
        const insuranceSalary = Math.round((baseSalary * insurancePct) / 100);
        const fixedAllowance = Number(contract?.allowance ?? 0);
        const bankAccount = this.formatBankAccount(emp);

        return {
          _raw: emp,
          id: emp.id,
          employeeId: numericId,
          code: emp.code,
          fullName: emp.fullName,
          position: emp.position || 'Nhân viên',
          branchName: emp.branchName || 'Mặc định',
          salaryMode,
          baseSalary,
          hourlyRate,
          insuranceSalary,
          fixedAllowance,
          bankAccount,
        };
      })
      .filter((row) => cf === 'all' || row.salaryMode === cf);
  });

  constructor() {
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.loadEmployees();
      });
    });
  }

  private formatBankAccount(emp: Employee): string {
    const bank = (emp.bankName || '').trim();
    const acc = (emp.bankAccountNumber || '').trim();
    if (bank && acc) return `${bank} - ${acc}`;
    if (acc) return acc;
    if (bank) return bank;
    return 'Chưa cập nhật';
  }

  loadEmployees(): void {
    this.isLoading.set(true);
    const branchId = this.branchService.selectedBranchId();

    forkJoin({
      employees: this.employeeApi.getEmployees({ page: 1, size: 100, branchId, status: 'working' }),
      contracts: this.contractApi
        .getContracts({ tabMode: 'current', branchId })
        .pipe(catchError(() => of([] as ContractItem[]))),
      contractTypes: this.contractApi
        .getContractTypes()
        .pipe(catchError(() => of([] as ContractType[]))),
      settings: this.payrollApi
        .getPayrollSettings()
        .pipe(catchError(() => of([] as PayrollSettingItem[]))),
    }).subscribe({
      next: ({ employees, contracts, contractTypes, settings }) => {
        this.employees.set(employees.items);
        this.activeContracts.set(contracts);
        this.contractTypes.set(contractTypes);
        this.payrollSettings.set(settings);
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
    const rows = this.employeeSalaryRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.clearSelection();
    } else {
      this.selectedEmployeeCodes.set(this.employeeSalaryRows().map((r) => String(r['code'])));
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

  onPositionFilterChange(pos: string): void {
    this.positionFilter.set(pos);
  }

  onContractFilterChange(c: string): void {
    this.contractFilter.set(c);
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.positionFilter.set('all');
    this.contractFilter.set('all');
    this.selectedEmployeeCodes.set([]);
    this.loadEmployees();
    this.toastService.success('Đã làm mới danh sách lương nhân viên!');
  }

  viewEmployeeContract(row: GridRow, event: Event): void {
    event.stopPropagation();
    const empId = Number(row['employeeId'] ?? 0);
    const code = String(row['code'] || '');

    this.router.navigate(['../../hop-dong/hien-tai'], {
      relativeTo: this.route,
      queryParams: empId > 0 ? { employeeId: String(empId) } : { search: code },
    });
  }

  openExportConfirm(): void {
    if (this.employeeSalaryRows().length === 0) {
      this.toastService.warning('Không có dữ liệu lương nhân viên để xuất Excel.');
      return;
    }
    this.isExportConfirmOpen.set(true);
  }

  confirmExportSalaryListExcel(): void {
    const rows = this.employeeSalaryRows();
    if (rows.length === 0) {
      this.isExportConfirmOpen.set(false);
      return;
    }

    const headers = [
      'Mã NV',
      'Họ và tên',
      'Chức vụ',
      'Chi nhánh',
      'Hình thức',
      'Lương cơ bản tháng',
      'Đơn giá giờ',
      'Mức đóng BHXH',
      'Phụ cấp cố định',
      'Tài khoản nhận lương',
    ];

    const payloadRows = rows.map((r) => ({
      'Mã NV': String(r['code'] ?? ''),
      'Họ và tên': String(r['fullName'] ?? ''),
      'Chức vụ': String(r['position'] ?? ''),
      'Chi nhánh': String(r['branchName'] ?? ''),
      'Hình thức': String(r['salaryMode'] ?? ''),
      'Lương cơ bản tháng': Number(r['baseSalary'] ?? 0),
      'Đơn giá giờ': Number(r['hourlyRate'] ?? 0),
      'Mức đóng BHXH': Number(r['insuranceSalary'] ?? 0),
      'Phụ cấp cố định': Number(r['fixedAllowance'] ?? 0),
      'Tài khoản nhận lương': String(r['bankAccount'] ?? ''),
    }));

    const fileName = `Fiin_HRM_Luong_Nhan_Vien_${new Date().toISOString().slice(0, 10)}.xlsx`;
    this.isExporting.set(true);
    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Employee_Salary',
        sheetName: 'Lương nhân viên',
        reportTitle: 'DANH SÁCH ĐỊNH MỨC LƯƠNG NHÂN VIÊN',
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
          this.toastService.success(`Đã xuất ${rows.length} định mức lương nhân viên ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Không thể xuất tệp Excel lương nhân viên. Vui lòng thử lại.');
        },
      });
  }
}
