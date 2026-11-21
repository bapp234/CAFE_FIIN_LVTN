import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideDownload,
  LucideFolderPlus,
  LucidePlus,
  LucideRotateCcw,
  LucideTrash2,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
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
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableCategoryRow {
  categoryId: number | null;
  categoryName: string;
  displayOrder: number;
  productCount: number;
  isActive: boolean;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

interface ProductPoolItem {
  productId: number;
  productCode: string;
  productName: string;
  categoryId: number | null;
  categoryName: string | null;
}

interface ApiResponseDto<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-categorys-list',
  templateUrl: './categorys_list.html',
  styleUrl: './categorys_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucideDownload,
    LucideFolderPlus,
    LucidePlus,
    LucideRotateCcw,
    LucideTrash2,
    LucideUpload,
    LucideX,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
    AdminModal,
  ],
})
export class CategorysListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/categories';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly rows = signal<EditableCategoryRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isExporting = signal(false);
  readonly deleteTarget = signal<EditableCategoryRow | null>(null);

  readonly assignCategory = signal<EditableCategoryRow | null>(null);
  readonly productPool = signal<ProductPoolItem[]>([]);
  readonly poolSearch = signal('');

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'true', label: 'Đang hiển thị' },
    { value: 'false', label: 'Đang ẩn' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'categoryId', label: 'Mã DM', type: 'code', width: '90px' },
    { key: 'categoryName', label: 'Tên danh mục đồ uống / bánh', minWidth: '220px', editable: true },
    { key: 'displayOrder', label: 'Thứ tự', align: 'right', width: '100px', editable: true },
    { key: 'productCount', label: 'Số món', type: 'number', align: 'center', width: '100px' },
    { key: 'assignAction', label: 'Gắn sản phẩm', align: 'center', width: '140px', editable: true },
    { key: 'isActive', label: 'Hiển thị', align: 'center', width: '85px', editable: true },
  ];

  readonly gridRows = computed(() =>
    this.rows().map((item) => ({ ...item, _raw: item }) as GridRow),
  );

  readonly filteredPool = computed(() => {
    const q = this.poolSearch().trim().toLowerCase();
    if (!q) return this.productPool();
    return this.productPool().filter(
      (p) =>
        p.productCode.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q),
    );
  });

  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableCategoryRow {
    return row['_raw'] as EditableCategoryRow;
  }

  markDirty(item: EditableCategoryRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.statusFilter()) params = params.set('isActive', this.statusFilter());

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, {
          params,
          withCredentials: true,
        }),
      );
      const list: EditableCategoryRow[] = (res.data ?? []).map((r) => ({
        categoryId: Number(r['categoryId']),
        categoryName: String(r['categoryName'] ?? ''),
        displayOrder: Number(r['displayOrder'] ?? 0),
        productCount: Number(r['productCount'] ?? 0),
        isActive: Boolean(r['isActive']),
        _localKey: `db_${r['categoryId']}`,
        _isDirty: false,
        _isNew: false,
      }));
      this.rows.set(list);
    } catch {
      this.toast.error('Không thể tải danh sách danh mục.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    const newItem: EditableCategoryRow = {
      categoryId: null,
      categoryName: '',
      displayOrder: this.rows().length + 1,
      productCount: 0,
      isActive: true,
      _localKey: `new_${Date.now()}`,
      _isDirty: true,
      _isNew: true,
    };
    this.rows.update((list) => [newItem, ...list]);
  }

  discardChanges(): void {
    void this.refreshTab();
  }

  async saveAllChanges(): Promise<void> {
    const toSave = this.dirtyRows();
    if (toSave.length === 0) return;

    for (const item of toSave) {
      if (!item.categoryName.trim()) {
        this.toast.error('Vui lòng nhập Tên danh mục.');
        return;
      }
    }

    this.isSaving.set(true);
    try {
      await Promise.all(
        toSave.map((item) =>
          firstValueFrom(
            this.http.post(
              this.apiUrl,
              {
                categoryId: item.categoryId,
                categoryName: item.categoryName.trim(),
                displayOrder: Number(item.displayOrder),
                isActive: item.isActive,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} danh mục.`);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Lưu danh mục thất bại.';
      this.toast.error(msg);
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
    if (!target || !target.categoryId) return;
    this.isSaving.set(true);
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/${target.categoryId}`, { withCredentials: true }),
      );
      this.toast.success('Đã xóa danh mục.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Không thể xóa danh mục.';
      this.toast.error(msg);
      this.deleteTarget.set(null);
    } finally {
      this.isSaving.set(false);
    }
  }

  async openAssignPanel(item: EditableCategoryRow): Promise<void> {
    if (!item.categoryId) {
      this.toast.error('Vui lòng lưu danh mục mới trước khi gắn sản phẩm.');
      return;
    }
    this.assignCategory.set(item);
    await this.loadProductPool();
  }

  async loadProductPool(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<ProductPoolItem[]>>(`${this.apiUrl}/products-pool`, {
          withCredentials: true,
        }),
      );
      this.productPool.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải danh sách sản phẩm.');
    }
  }

  async assignProduct(productId: number): Promise<void> {
    const cat = this.assignCategory();
    if (!cat?.categoryId) return;
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/${cat.categoryId}/assign/${productId}`, {}, { withCredentials: true }),
      );
      this.toast.success('Đã thêm sản phẩm vào danh mục.');
      await this.loadProductPool();
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Không thể thêm sản phẩm.';
      this.toast.error(msg);
    }
  }

  async unassignProduct(productId: number): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/unassign/${productId}`, {}, { withCredentials: true }),
      );
      this.toast.success('Đã gỡ sản phẩm khỏi danh mục hiện tại.');
      await this.loadProductPool();
      await this.refreshTab();
    } catch {
      this.toast.error('Không thể gỡ sản phẩm.');
    }
  }

  onImportCsv(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length <= 1) {
        this.toast.error('File CSV không có dữ liệu.');
        return;
      }
      const imported: EditableCategoryRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (!cols[0]) continue;
        imported.push({
          categoryId: null,
          categoryName: cols[0],
          displayOrder: Number(cols[1]) || this.rows().length + i,
          productCount: 0,
          isActive: true,
          _localKey: `imp_${Date.now()}_${i}`,
          _isDirty: true,
          _isNew: true,
        });
      }
      if (imported.length > 0) {
        this.rows.update((list) => [...imported, ...list]);
        this.toast.success(`Đã nạp ${imported.length} danh mục từ CSV. Bấm Lưu thay đổi để ghi xuống DB.`);
      }
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) {
      this.toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    this.isExporting.set(true);
    try {
      const headers = ['Mã DM', 'Tên danh mục', 'Thứ tự', 'Số món', 'Hiển thị'];
      const exportRows = data.map((r) => ({
        'Mã DM': r.categoryId ?? '',
        'Tên danh mục': r.categoryName,
        'Thứ tự': r.displayOrder,
        'Số món': r.productCount,
        'Hiển thị': r.isActive ? 'Đang hiển thị' : 'Đang ẩn',
      }));

      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'ERP_Categories',
            sheetName: 'Danh mục',
            reportTitle: 'DANH SÁCH LOẠI ĐỒ UỐNG & BÁNH FIIN COFFEE',
            summaryLabel: 'Tổng số danh mục:',
            fileName: `DanhMuc_Fiin_${new Date().toISOString().slice(0, 10)}.xlsx`,
            headers,
            rows: exportRows,
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `DanhMuc_Fiin_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.success(`Đã xuất Excel (${data.length} danh mục).`);
    } catch {
      this.toast.error('Xuất Excel thất bại.');
    } finally {
      this.isExporting.set(false);
    }
  }
}
