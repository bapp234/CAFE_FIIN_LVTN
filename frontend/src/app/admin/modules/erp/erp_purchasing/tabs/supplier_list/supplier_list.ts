import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideDownload, LucidePlus, LucideRotateCcw, LucideTrash2, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableSupplierRow {
  supplierId: number | null;
  supplierCode: string;
  supplierName: string;
  categoryGroup: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  currentDebt: number;
  isActive: boolean;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

@Component({
  selector: 'app-supplier-list',
  templateUrl: './supplier_list.html',
  styleUrl: './supplier_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideCheck, LucideDownload, LucidePlus, LucideRotateCcw, LucideTrash2, LucideX, AdminSearchBoxComponent, AdminButtonComponent, AdminGridTableComponent, AdminModal],
})
export class SupplierListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/suppliers';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly rows = signal<EditableSupplierRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly deleteTarget = signal<EditableSupplierRow | null>(null);

  readonly columns: GridColumn[] = [
    { key: 'supplierCode', label: 'Mã NCC', width: '110px', editable: true },
    { key: 'supplierName', label: 'Tên nhà cung cấp', minWidth: '200px', editable: true },
    { key: 'contactPerson', label: 'Người liên hệ', width: '140px', editable: true },
    { key: 'phone', label: 'Số điện thoại', width: '125px', editable: true },
    { key: 'address', label: 'Địa chỉ', minWidth: '200px', editable: true },
    { key: 'currentDebt', label: 'Công nợ', align: 'right', width: '125px', editable: true },
    { key: 'isActive', label: 'Hợp tác', align: 'center', width: '85px', editable: true },
  ];

  readonly gridRows = computed(() => this.rows().map((item) => ({ ...item, _raw: item }) as GridRow));
  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableSupplierRow {
    return row['_raw'] as EditableSupplierRow;
  }

  markDirty(item: EditableSupplierRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      const res = await firstValueFrom(this.http.get<{ data?: Record<string, unknown>[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(
        (res.data ?? []).map((r) => ({
          supplierId: Number(r['supplierId']),
          supplierCode: String(r['supplierCode'] ?? ''),
          supplierName: String(r['supplierName'] ?? ''),
          categoryGroup: String(r['categoryGroup'] ?? ''),
          contactPerson: String(r['contactPerson'] ?? ''),
          phone: String(r['phone'] ?? ''),
          email: String(r['email'] ?? ''),
          address: String(r['address'] ?? ''),
          currentDebt: Number(r['currentDebt'] ?? 0),
          isActive: Boolean(r['isActive']),
          _localKey: `db_${r['supplierId']}`,
          _isDirty: false,
          _isNew: false,
        })),
      );
    } catch {
      this.toast.error('Không thể tải danh sách nhà cung cấp.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    this.rows.update((list) => [
      {
        supplierId: null,
        supplierCode: '',
        supplierName: '',
        categoryGroup: 'Nguyên liệu',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        currentDebt: 0,
        isActive: true,
        _localKey: `new_${Date.now()}`,
        _isDirty: true,
        _isNew: true,
      },
      ...list,
    ]);
  }

  discardChanges(): void {
    void this.refreshTab();
  }

  async saveAllChanges(): Promise<void> {
    const toSave = this.dirtyRows();
    if (toSave.length === 0) return;
    this.isSaving.set(true);
    try {
      await Promise.all(
        toSave.map((item) =>
          firstValueFrom(
            this.http.post(this.apiUrl, {
              supplierId: item.supplierId,
              supplierCode: item.supplierCode.trim().toUpperCase(),
              supplierName: item.supplierName.trim(),
              categoryGroup: item.categoryGroup || null,
              contactPerson: item.contactPerson.trim() || null,
              phone: item.phone.trim() || null,
              email: item.email.trim() || null,
              address: item.address.trim() || null,
              currentDebt: Number(item.currentDebt),
              isActive: item.isActive,
            }, { withCredentials: true }),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} nhà cung cấp.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu nhà cung cấp thất bại.');
    } finally {
      this.isSaving.set(false);
    }
  }

  confirmDelete(row: GridRow): void {
    const item = this.getRaw(row);
    if (item._isNew) {
      this.rows.update((list) => list.filter((x) => x._localKey !== item._localKey));
      return;
    }
    this.deleteTarget.set(item);
  }

  async executeDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target?.supplierId) return;
    try {
      await firstValueFrom(this.http.delete(`${this.apiUrl}/${target.supplierId}`, { withCredentials: true }));
      this.toast.success('Đã xóa nhà cung cấp.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch (err: unknown) {
      this.toast.error((err as { error?: { message?: string } })?.error?.message || 'Không thể xóa nhà cung cấp.');
      this.deleteTarget.set(null);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    const headers = ['Mã NCC', 'Tên nhà cung cấp', 'Người liên hệ', 'Số điện thoại', 'Địa chỉ', 'Công nợ'];
    const exportRows = data.map((r) => ({
      'Mã NCC': r.supplierCode,
      'Tên nhà cung cấp': r.supplierName,
      'Người liên hệ': r.contactPerson,
      'Số điện thoại': r.phone,
      'Địa chỉ': r.address,
      'Công nợ': r.currentDebt,
    }));
    const blob = await firstValueFrom(
      this.http.post(this.excelUrl, { templateKey: 'ERP_Suppliers', sheetName: 'Nhà cung cấp', reportTitle: 'DANH SÁCH NHÀ CUNG CẤP FIIN COFFEE', summaryLabel: 'Tổng NCC:', fileName: 'NhaCungCap_Fiin.xlsx', headers, rows: exportRows }, { responseType: 'blob', withCredentials: true }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'NhaCungCap_Fiin.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
