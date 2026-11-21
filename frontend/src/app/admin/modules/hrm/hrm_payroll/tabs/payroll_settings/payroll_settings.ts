import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  LucideCheck,
  LucidePlus,
  LucideRotateCcw,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
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
} from '../../../../../components/admin_grid_table/admin_grid_table';
import {
  HrmPayrollApi,
  PayrollSettingItem,
} from '../../../services/hrm_payroll_api';

export interface EditablePayrollSettingRow extends PayrollSettingItem {
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

@Component({
  selector: 'app-payroll-settings',
  templateUrl: './payroll_settings.html',
  styleUrl: './payroll_settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideTrash2,
    LucideX,
    AdminModal,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminGridTableComponent,
  ],
})
export class PayrollSettings implements OnInit {
  private readonly payrollApi = inject(HrmPayrollApi);
  private readonly toastService = inject(AdminToastService);
  private localSeq = 0;

  readonly searchQuery = signal('');
  readonly categoryFilter = signal('all');
  readonly calcTypeFilter = signal('all');
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  readonly rows = signal<EditablePayrollSettingRow[]>([]);
  readonly deleteTarget = signal<EditablePayrollSettingRow | null>(null);

  readonly categoryFilterOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả nhóm khoản mục' },
    { value: 'allowance', label: 'Phụ cấp' },
    { value: 'subsidy', label: 'Trợ cấp / Thưởng' },
    { value: 'deduction', label: 'Khấu trừ / Phạt' },
    { value: 'insurance', label: 'Bảo hiểm (BHXH/YT/TN)' },
    { value: 'tax', label: 'Thuế TNCN' },
    { value: 'general', label: 'Tham số chung' },
  ];

  readonly calcTypeOptions: ComboOption[] = [
    { value: 'all', label: 'Tất cả cách tính' },
    { value: 'fixed_month', label: 'Cố định / tháng' },
    { value: 'fixed_shift', label: 'Theo ngày làm việc' },
    { value: 'fixed_count', label: 'Theo số lần' },
    { value: 'percent', label: 'Theo phần trăm (%)' },
  ];

  readonly settingColumns: GridColumn[] = [
    { key: 'code', label: 'Mã khoản', width: '11.5rem', editable: true },
    { key: 'name', label: 'Tên khoản mục', minWidth: '16rem', editable: true },
    { key: 'category', label: 'Nhóm', width: '10.5rem', editable: true },
    { key: 'calcType', label: 'Cách tính', width: '11rem', editable: true },
    { key: 'rawValue', label: 'Định mức / %', align: 'right', width: '8.5rem', editable: true },
    { key: 'impact', label: 'Tác động', width: '10.5rem', editable: true },
    { key: 'applyScope', label: 'Phạm vi áp dụng', width: '12rem', editable: true },
    { key: 'note', label: 'Ghi chú', minWidth: '15rem', editable: true },
    { key: 'isActive', label: 'Áp dụng', align: 'center', width: '5rem', editable: true },
  ];

  readonly gridRows = computed<GridRow[]>(() => {
    const kw = this.searchQuery().trim().toLowerCase();
    const cat = this.categoryFilter();
    const calc = this.calcTypeFilter();

    return this.rows()
      .filter((item) => {
        if (item._isNew) return true;
        const matchCat = cat === 'all' || item.category === cat;
        const matchCalc = calc === 'all' || item.calcType === calc;
        const matchKw =
          !kw ||
          item.code.toLowerCase().includes(kw) ||
          item.name.toLowerCase().includes(kw) ||
          item.applyScope.toLowerCase().includes(kw);
        return matchCat && matchCalc && matchKw;
      })
      .map((item) => ({
        _raw: item,
        _localKey: item._localKey,
        code: item.code,
        name: item.name,
        category: item.category,
        calcType: item.calcType,
        rawValue: item.rawValue,
        impact: item.impact,
        applyScope: item.applyScope,
        note: item.note ?? '',
        isActive: item.isActive,
      }));
  });

  readonly dirtyCount = computed(() => this.rows().filter((r) => r._isDirty).length);

  ngOnInit(): void {
    this.loadSettings();
  }

  getRaw(row: GridRow): EditablePayrollSettingRow {
    return row['_raw'] as EditablePayrollSettingRow;
  }

  loadSettings(): void {
    this.isLoading.set(true);
    this.payrollApi.getPayrollSettings().subscribe({
      next: (items) => {
        this.rows.set(
          items.map((item) => ({
            ...item,
            _localKey: `ps-${item.settingId}`,
            _isDirty: false,
            _isNew: false,
          }))
        );
        this.isLoading.set(false);
      },
      error: (err: Error) => {
        this.isLoading.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  refreshTab(): void {
    this.searchQuery.set('');
    this.categoryFilter.set('all');
    this.calcTypeFilter.set('all');
    this.loadSettings();
    this.toastService.success('Đã tải lại bảng thiết lập lương từ cơ sở dữ liệu.');
  }

  addNewRow(): void {
    this.localSeq += 1;
    const newRow: EditablePayrollSettingRow = {
      settingId: 0,
      code: '',
      name: '',
      category: this.categoryFilter() === 'all' ? 'allowance' : this.categoryFilter(),
      calcType: this.calcTypeFilter() === 'all' ? 'fixed_month' : this.calcTypeFilter(),
      rawValue: 0,
      impact: 'Addition',
      applyScope: 'all',
      note: '',
      isActive: true,
      _localKey: `ps-new-${this.localSeq}`,
      _isDirty: true,
      _isNew: true,
    };
    this.rows.update((list) => [newRow, ...list]);
  }

  markDirty(row: EditablePayrollSettingRow): void {
    row._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  saveAllChanges(): void {
    if (this.isSaving() || this.dirtyCount() === 0) return;

    const dirtyRows = this.rows().filter((r) => r._isDirty);
    for (const r of dirtyRows) {
      if (!r.code.trim() || !r.name.trim()) {
        this.toastService.warning('Vui lòng nhập đầy đủ Mã khoản mục và Tên khoản mục cho các dòng đang sửa.');
        return;
      }
    }

    this.isSaving.set(true);
    const calls = dirtyRows.map((r) =>
      this.payrollApi.savePayrollSetting({
        settingId: r._isNew ? null : r.settingId,
        code: r.code.trim().toUpperCase(),
        name: r.name.trim(),
        category: r.category,
        calcType: r.calcType,
        rawValue: Number(r.rawValue) || 0,
        impact: r.impact,
        applyScope: r.applyScope.trim() || 'Toàn hệ thống',
        note: r.note?.trim() || null,
        isActive: r.isActive,
      })
    );

    forkJoin(calls).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.toastService.success(`Đã lưu thành công ${calls.length} khoản mục thiết lập lương!`);
        this.loadSettings();
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.toastService.error(err.message);
      },
    });
  }

  discardChanges(): void {
    this.loadSettings();
    this.toastService.info('Đã hủy các thay đổi chưa lưu.');
  }

  confirmDelete(row: GridRow): void {
    const raw = this.getRaw(row);
    if (raw._isNew) {
      this.rows.update((list) => list.filter((r) => r._localKey !== raw._localKey));
      return;
    }
    this.deleteTarget.set(raw);
  }

  executeDelete(): void {
    const target = this.deleteTarget();
    if (!target || this.isSaving()) return;

    this.isSaving.set(true);
    this.payrollApi.deletePayrollSetting(target.settingId).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.deleteTarget.set(null);
        this.toastService.success(`Đã xóa khoản mục ${target.code}.`);
        this.loadSettings();
      },
      error: (err: Error) => {
        this.isSaving.set(false);
        this.toastService.error(err.message);
      },
    });
  }
}
