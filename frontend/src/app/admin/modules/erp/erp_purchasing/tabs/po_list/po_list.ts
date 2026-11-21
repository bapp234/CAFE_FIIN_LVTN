import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideDownload, LucidePlus, LucideRotateCcw, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditablePoRow {
  poId: number | null;
  poCode: string;
  supplierId: number;
  supplierName: string;
  status: string;
  paymentStatus: string;
  totalAmount: number;
  paidAmount: number;
  notes: string;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

@Component({
  selector: 'app-po-list',
  templateUrl: './po_list.html',
  styleUrl: './po_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideCheck, LucideDownload, LucidePlus, LucideRotateCcw, LucideX, AdminSearchBoxComponent, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class PoListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/purchase-orders';
  private readonly supUrl = 'http://localhost:5107/api/v1/erp/suppliers';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly rows = signal<EditablePoRow[]>([]);
  readonly suppliers = signal<{ supplierId: number; supplierName: string }[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'Draft', label: 'Nháp' },
    { value: 'Ordered', label: 'Đã đặt hàng' },
    { value: 'Received', label: 'Đã nhập Kho Tổng' },
    { value: 'Cancelled', label: 'Đã hủy' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'poCode', label: 'Mã phiếu PO', width: '135px', editable: true },
    { key: 'supplierId', label: 'Nhà cung cấp', minWidth: '190px', editable: true },
    { key: 'status', label: 'Trạng thái', width: '145px', editable: true },
    { key: 'paymentStatus', label: 'Thanh toán', width: '130px', editable: true },
    { key: 'totalAmount', label: 'Tổng tiền', align: 'right', width: '130px', editable: true },
    { key: 'paidAmount', label: 'Đã trả', align: 'right', width: '125px', editable: true },
    { key: 'notes', label: 'Ghi chú', minWidth: '180px', editable: true },
  ];

  readonly gridRows = computed(() => this.rows().map((item) => ({ ...item, _raw: item }) as GridRow));
  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.loadSuppliers();
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditablePoRow {
    return row['_raw'] as EditablePoRow;
  }

  markDirty(item: EditablePoRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async loadSuppliers(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ data?: { supplierId: number; supplierName: string }[] }>(this.supUrl, { withCredentials: true }));
      this.suppliers.set(res.data ?? []);
    } catch { /* ignore */ }
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.statusFilter()) params = params.set('status', this.statusFilter());
      const res = await firstValueFrom(this.http.get<{ data?: Record<string, unknown>[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(
        (res.data ?? []).map((r) => ({
          poId: Number(r['poId']),
          poCode: String(r['poCode'] ?? ''),
          supplierId: Number(r['supplierId'] ?? 0),
          supplierName: String(r['supplierName'] ?? ''),
          status: String(r['status'] ?? 'Draft'),
          paymentStatus: String(r['paymentStatus'] ?? 'Unpaid'),
          totalAmount: Number(r['totalAmount'] ?? 0),
          paidAmount: Number(r['paidAmount'] ?? 0),
          notes: String(r['notes'] ?? ''),
          _localKey: `db_${r['poId']}`,
          _isDirty: false,
          _isNew: false,
        })),
      );
    } catch {
      this.toast.error('Không thể tải danh sách phiếu nhập hàng.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    const firstSup = this.suppliers()[0];
    if (!firstSup) {
      this.toast.error('Vui lòng thêm ít nhất 1 Nhà cung cấp trước.');
      return;
    }
    this.rows.update((list) => [
      {
        poId: null,
        poCode: `PO-${Date.now().toString().slice(-6)}`,
        supplierId: firstSup.supplierId,
        supplierName: firstSup.supplierName,
        status: 'Draft',
        paymentStatus: 'Unpaid',
        totalAmount: 0,
        paidAmount: 0,
        notes: '',
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
              poId: item.poId,
              poCode: item.poCode.trim().toUpperCase(),
              supplierId: Number(item.supplierId),
              status: item.status,
              paymentStatus: item.paymentStatus,
              totalAmount: Number(item.totalAmount),
              paidAmount: Number(item.paidAmount),
              notes: item.notes.trim() || null,
            }, { withCredentials: true }),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} phiếu nhập hàng.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu phiếu nhập thất bại.');
    } finally {
      this.isSaving.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    const headers = ['Mã phiếu PO', 'Nhà cung cấp', 'Trạng thái', 'Thanh toán', 'Tổng tiền', 'Đã trả', 'Ghi chú'];
    const exportRows = data.map((r) => ({
      'Mã phiếu PO': r.poCode,
      'Nhà cung cấp': r.supplierName,
      'Trạng thái': r.status,
      'Thanh toán': r.paymentStatus,
      'Tổng tiền': r.totalAmount,
      'Đã trả': r.paidAmount,
      'Ghi chú': r.notes,
    }));
    const blob = await firstValueFrom(
      this.http.post(this.excelUrl, { templateKey: 'ERP_PO', sheetName: 'Phiếu nhập', reportTitle: 'DANH SÁCH PHIẾU NHẬP HÀNG (PO) FIIN COFFEE', summaryLabel: 'Tổng phiếu:', fileName: 'PhieuNhapPO_Fiin.xlsx', headers, rows: exportRows }, { responseType: 'blob', withCredentials: true }),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PhieuNhapPO_Fiin.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
