import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import {
  LucideDownload,
  LucideFileText,
  LucidePencil,
  LucideRotateCcw,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { SortDirection } from '../../../../../shared/models/page';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';
import { AdminSession } from '../../../../../core/admin_session';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { Employee, EmployeeImportItem, EmployeeImportPreviewResult } from '../../../models/employee';
import { HrmEmployeeApi, EmployeeSimpleItem } from '../../../services/hrm_employee_api';
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

@Component({
  selector: 'app-employee-list',
  templateUrl: './employee_list.html',
  styleUrl: './employee_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    DecimalPipe,
    LucideDownload,
    LucideFileText,
    LucidePencil,
    LucideRotateCcw,
    LucideTrash2,
    LucideUpload,
    LucideX,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class EmployeeList {
  readonly branchService = inject(AdminBranchService);
  readonly toastService = inject(AdminToastService);
  readonly adminSession = inject(AdminSession);
  readonly employeeApi = inject(HrmEmployeeApi);
  readonly router = inject(Router);

  // ---- Phân trang cuộn lười (Infinite Scroll - 50 nhân sự / lần) ----
  readonly page = signal(1);
  readonly size = signal(50);
  readonly hasMore = signal(true);
  readonly isLoadingMore = signal(false);
  readonly rawEmployees = signal<EmployeeSimpleItem[]>([]);
  readonly searchQuery = signal('');
  readonly positionFilter = signal('all');
  readonly sortBy = signal('');
  readonly sortOrder = signal<SortDirection>('asc');
  readonly isLoading = signal(false);

  // ---- Dữ liệu bảng lưới (lấy động từ Database qua SP) ----
  readonly defaultColumns: GridColumn[] = [
    { key: 'code', label: 'MÃ NHÂN VIÊN', type: 'code', align: 'center', width: '7.5rem', sortable: true, mono: true },
    { key: 'fullName', label: 'TÊN NHÂN VIÊN', type: 'text', align: 'left', width: '13.5rem', sortable: true, bold: true },
    { key: 'citizenId', label: 'SỐ CCCD', type: 'code', align: 'center', width: '9.5rem', mono: true },
    { key: 'phone', label: 'SỐ ĐIỆN THOẠI', type: 'text', align: 'center', width: '9rem' },
    { key: 'position', label: 'CHỨC DANH / VỊ TRÍ', type: 'text', align: 'left', width: '12.5rem' },
    { key: 'branchName', label: 'CHI NHÁNH', type: 'pill', align: 'left', width: '11.5rem' },
    { key: 'contractName', label: 'HỢP ĐỒNG LAO ĐỘNG', type: 'pill', align: 'left', width: '13.5rem' },
    { key: 'hireDate', label: 'NGÀY VÀO LÀM', type: 'date', align: 'center', width: '8.5rem' },
    { key: 'hourlyRate', label: 'LƯƠNG GIỜ', type: 'currency', align: 'right', width: '8rem' },
  ];
  readonly employeeColumns = signal<GridColumn[]>(this.defaultColumns);
  readonly employeeRows = signal<GridRow[]>([]);

  // ---- Chọn nhân sự trên lưới ----
  readonly selectedEmployeeCodes = signal<string[]>([]);
  readonly selectedEmployeeId = signal<string | null>(null);

  readonly isAllSelected = computed<boolean>(() => {
    const rows = this.employeeRows();
    if (rows.length === 0) return false;
    const selected = new Set(this.selectedEmployeeCodes());
    return rows.every((r) => selected.has(String(r['code'])));
  });

  readonly isIndeterminate = computed<boolean>(() => {
    const count = this.selectedEmployeeCodes().length;
    return count > 0 && !this.isAllSelected();
  });

  // ---- Hộp thoại xóa nhân sự ----
  readonly isDeleteConfirmOpen = signal(false);

  // ---- Tùy chọn Combobox ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly positionOptions = signal<ComboOption[]>([
    { value: 'all', label: 'Tất cả chức vụ' },
  ]);

  // ---- Xuất Excel (.xlsx) ----
  readonly isExporting = signal(false);
  readonly isExportConfirmOpen = signal(false);

  // ---- Nhập nhanh Excel (.xlsx) ----
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);
  readonly selectedFileName = signal('');
  readonly isImportModalOpen = signal(false);
  readonly isImporting = signal(false);
  readonly previewResult = signal<EmployeeImportPreviewResult | null>(null);
  readonly previewTab = signal<'all' | 'valid' | 'error'>('all');

  readonly filteredPreviewItems = computed<EmployeeImportItem[]>(() => {
    const preview = this.previewResult();
    if (!preview) return [];
    const tab = this.previewTab();
    if (tab === 'valid') return preview.items.filter((i) => i.isValid);
    if (tab === 'error') return preview.items.filter((i) => !i.isValid);
    return preview.items;
  });

  constructor() {
    // Tải tùy chọn bộ lọc từ CSDL
    this.employeeApi.getEmployeesFilterOptions().subscribe((opts) => {
      if (opts.positions?.length) {
        this.positionOptions.set([
          { value: 'all', label: 'Tất cả chức vụ' },
          ...opts.positions,
        ]);
      }
    });

    // Tự động tải lại danh sách khi chi nhánh trên topbar thay đổi
    effect(() => {
      this.branchService.selectedBranchId();
      untracked(() => {
        this.page.set(1);
        this.loadEmployees();
      });
    });
  }

  loadEmployees(reset: boolean = true): void {
    if (reset) {
      this.page.set(1);
      this.hasMore.set(true);
      this.isLoading.set(true);
      this.rawEmployees.set([]);
    }

    const bId = this.branchService.selectedBranchId();
    const branchIdNum = bId && bId !== 'all' ? Number(bId) : null;

    this.employeeApi
      .getEmployeesSimple({
        accountStatus: 1, // Công tắc 1: Chỉ lấy nhân viên ĐÃ CÓ TÀI KHOẢN VÀ MẬT KHẨU
        branchId: branchIdNum,
        search: this.searchQuery(),
        pageIndex: 1,
        pageSize: this.size(),
      })
      .subscribe({
        next: (items) => {
          this.rawEmployees.set(items);
          this.hasMore.set(items.length >= this.size());
          this.mapRows(items);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onScrollToBottom(): void {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;

    this.isLoadingMore.set(true);
    const nextPage = this.page() + 1;

    const bId = this.branchService.selectedBranchId();
    const branchIdNum = bId && bId !== 'all' ? Number(bId) : null;

    this.employeeApi
      .getEmployeesSimple({
        accountStatus: 1,
        branchId: branchIdNum,
        search: this.searchQuery(),
        pageIndex: nextPage,
        pageSize: this.size(),
      })
      .subscribe({
        next: (newItems) => {
          this.page.set(nextPage);
          if (!newItems || newItems.length < this.size()) {
            this.hasMore.set(false);
          }
          const combined = [...this.rawEmployees(), ...(newItems || [])];
          this.rawEmployees.set(combined);
          this.mapRows(combined);
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.isLoadingMore.set(false);
        },
      });
  }

  private mapRows(items: EmployeeSimpleItem[]): void {
    this.employeeColumns.set(this.defaultColumns);
    const pos = this.positionFilter();

    let filtered = items;
    if (pos && pos !== 'all') {
      filtered = filtered.filter((e) => e.position === pos);
    }

    const rows: GridRow[] = filtered.map((emp) => ({
      id: emp.employeeCode,
      code: emp.employeeCode,
      fullName: emp.fullName,
      citizenId: emp.citizenId || '—',
      phone: emp.phoneNumber || '—',
      position: emp.position,
      branchName: emp.branchName,
      contractName: emp.contractName || 'Chưa ký HĐ',
      hireDate: emp.hireDate,
      hourlyRate: emp.hourlyRate || 0,
      _raw: emp,
    }));
    this.employeeRows.set(rows);
  }

  // =========================================================================
  // XUẤT EXCEL CÓ XÁC NHẬN
  // =========================================================================
  openExportConfirm(): void {
    if (this.isExporting()) return;
    this.isExportConfirmOpen.set(true);
  }

  executeExportExcel(): void {
    this.isExportConfirmOpen.set(false);
    if (this.isExporting()) return;

    const selected = this.selectedEmployeeCodes();
    const isSelective = selected.length > 0;
    const allRows = this.employeeRows();
    const exportRows = isSelective
      ? allRows.filter((r) => selected.includes(String(r['code'])))
      : allRows;

    if (exportRows.length === 0) {
      this.toastService.warning('Không có dữ liệu nhân sự trên màn hình để xuất Excel.');
      return;
    }

    const cols = this.employeeColumns();
    const headers = cols.map((c) => c.label || c.key);
    const payloadRows = exportRows.map((r) => {
      const record: Record<string, unknown> = {};
      for (const c of cols) {
        const headerName = c.label || c.key;
        let val = r[c.key];
        if (c.key === 'hireDate' && val) {
          const d = new Date(String(val));
          val = isNaN(d.getTime())
            ? String(val)
            : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } else if (c.key === 'hourlyRate') {
          val = Number(val ?? 0);
        } else {
          val = val ?? '—';
        }
        record[headerName] = val;
      }
      return record;
    });

    const fileName = `Fiin_HRM_Danh_Sach_Nhan_Su_${new Date().toISOString().slice(0, 10)}.xlsx`;
    this.isExporting.set(true);
    this.toastService.info(
      isSelective
        ? `Đang kết xuất tệp Excel cho ${exportRows.length} nhân sự đã chọn...`
        : 'Đang kết xuất tệp Excel danh sách nhân sự...'
    );

    this.employeeApi
      .exportStandardExcel({
        templateKey: 'Fiin_HRM_Employees',
        sheetName: 'Danh sách nhân sự',
        reportTitle: 'DANH SÁCH NHÂN SỰ ĐANG LÀM VIỆC',
        summaryLabel: 'Tổng số nhân sự:',
        fileName,
        headers,
        rows: payloadRows,
      })
      .subscribe({
        next: (blob) => {
          this.isExporting.set(false);
          this.employeeApi.downloadExcelBlob(blob, fileName);
          this.toastService.success(`Đã xuất ${exportRows.length} nhân sự ra tệp Excel!`);
        },
        error: () => {
          this.isExporting.set(false);
          this.toastService.error('Có lỗi xảy ra khi tạo tệp Excel.');
        },
      });
  }

  // =========================================================================
  // NHẬP EXCEL TRỰC TIẾP TỪ FILE EXPLORER CÓ PROGRESS BAR & PREVIEW
  // =========================================================================
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      this.toastService.warning('Vui lòng chọn file định dạng Excel (.xlsx).');
      input.value = '';
      return;
    }

    this.selectedFileName.set(file.name);
    this.isUploading.set(true);
    this.uploadProgress.set(20);

    // Mô phỏng thanh tiến trình mượt mà khi xử lý file lớn
    const timer = setInterval(() => {
      this.uploadProgress.update((p) => (p < 85 ? p + 15 : p));
    }, 150);

    this.employeeApi.previewImportExcel(file).subscribe({
      next: (res) => {
        clearInterval(timer);
        this.uploadProgress.set(100);
        setTimeout(() => {
          this.isUploading.set(false);
          this.previewResult.set(res);
          this.previewTab.set('all');
          this.isImportModalOpen.set(true);
        }, 250);
        input.value = '';
      },
      error: (err: unknown) => {
        clearInterval(timer);
        this.isUploading.set(false);
        this.uploadProgress.set(0);
        input.value = '';
        const msg = err instanceof Error ? err.message : 'Lỗi khi đọc file Excel.';
        this.toastService.error(`Đọc file thất bại: ${msg}`);
      },
    });
  }

  closeImportModal(): void {
    if (this.isImporting()) return;
    this.isImportModalOpen.set(false);
    this.previewResult.set(null);
  }

  executeImport(): void {
    const preview = this.previewResult();
    if (!preview || preview.validRows === 0) {
      this.toastService.warning('Không có dòng nhân sự hợp lệ nào để nhập.');
      return;
    }

    const validItems = preview.items.filter((i) => i.isValid);
    this.isImporting.set(true);

    // Tự động tạo tài khoản đăng nhập để nhân sự mới có UserId IS NOT NULL và hiện ngay trên danh sách
    this.employeeApi
      .saveImportEmployees({
        employees: validItems,
        createAccounts: true,
        defaultPassword: 'Fiin@123',
      })
      .subscribe({
        next: (res) => {
          this.isImporting.set(false);
          this.isImportModalOpen.set(false);
          this.previewResult.set(null);
          this.toastService.success(
            `Nạp thành công ${res.totalImported} hồ sơ nhân sự vào hệ thống!`
          );
          this.loadEmployees();
        },
        error: (err: unknown) => {
          this.isImporting.set(false);
          const msg = err instanceof Error ? err.message : 'Lỗi khi lưu dữ liệu.';
          this.toastService.error(`Lỗi nạp nhân sự: ${msg}`);
        },
      });
  }

  // =========================================================================
  // BỘ LỌC, TÌM KIẾM & THAO TÁC BẢNG LƯỚI
  // =========================================================================
  onRowClick(row: GridRow): void {
    const code = String(row['code'] || row['EmployeeCode'] || row['id']);
    const currentCodes = this.selectedEmployeeCodes();
    if (currentCodes.includes(code)) {
      this.selectedEmployeeCodes.set(currentCodes.filter((c) => c !== code));
    } else {
      this.selectedEmployeeCodes.set([...currentCodes, code]);
    }
    this.selectedEmployeeId.set(String(row['id']));
  }

  clearSelection(): void {
    this.selectedEmployeeCodes.set([]);
    this.selectedEmployeeId.set(null);
  }

  toggleSelectAll(): void {
    if (this.isAllSelected()) {
      this.selectedEmployeeCodes.set([]);
      this.selectedEmployeeId.set(null);
    } else {
      this.selectedEmployeeCodes.set(this.employeeRows().map((r) => String(r['code'])));
    }
  }

  // =========================================================================
  // NÚT THAO TÁC SỬA / XÓA NHÂN SỰ KHI ĐƯỢC CHỌN
  // =========================================================================
  openEditEmployee(): void {
    const selected = this.selectedEmployeeCodes();
    if (selected.length !== 1) return;
    const row = this.employeeRows().find((r) => r['code'] === selected[0]);
    const empRaw = row?.['_raw'] as any;
    const empId = empRaw?.employeeId || empRaw?.id;
    if (empId) {
      void this.router.navigate(['/admin/hrm/ho-so-nhan-vien'], { queryParams: { id: empId } });
    } else {
      void this.router.navigate(['/admin/hrm/ho-so-nhan-vien'], { queryParams: { code: selected[0] } });
    }
  }

  openDeleteConfirm(): void {
    if (this.selectedEmployeeCodes().length === 0) return;
    this.isDeleteConfirmOpen.set(true);
  }

  executeDeleteEmployees(): void {
    const codes = this.selectedEmployeeCodes();
    this.isDeleteConfirmOpen.set(false);
    if (codes.length === 0) return;

    const count = codes.length;
    this.employeeRows.update((rows) => rows.filter((r) => !codes.includes(String(r['code']))));
    this.selectedEmployeeCodes.set([]);
    this.selectedEmployeeId.set(null);
    this.toastService.success(
      count === 1
        ? `Đã xóa nhân sự [${codes[0]}] khỏi danh sách thành công.`
        : `Đã xóa thành công ${count} nhân sự đã chọn khỏi danh sách.`
    );
  }

  onSortChange(sort: GridSort): void {
    this.sortBy.set(sort.key);
    this.sortOrder.set(sort.order);
  }

  onSearchChange(kw: string): void {
    this.searchQuery.set(kw);
    this.page.set(1);
    this.loadEmployees();
  }

  onPositionFilterChange(value: string): void {
    this.positionFilter.set(value);
    this.page.set(1);
    this.loadEmployees();
  }

  onBranchFilterChange(value: string): void {
    this.branchService.selectBranch(value);
  }

  refreshTab(): void {
    const branchWasAll = this.branchService.selectedBranchId() === 'all';
    this.searchQuery.set('');
    this.positionFilter.set('all');
    this.selectedEmployeeCodes.set([]);
    this.selectedEmployeeId.set(null);
    this.page.set(1);

    if (!branchWasAll) {
      this.branchService.selectBranch('all');
    } else {
      this.loadEmployees();
    }
    this.toastService.success('Đã làm mới danh sách nhân sự!');
  }

  viewProfile(emp: Employee, event?: Event): void {
    event?.stopPropagation();
    const id = emp.employeeId || emp.code;
    void this.router.navigate(['/admin/hrm/ho-so-nhan-vien'], { queryParams: { id } });
  }
}
