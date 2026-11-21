import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideCheck,
  LucideDownload,
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

export interface EditableProductRow {
  productId: number | null;
  imageUrl: string;
  _previewUrl?: string;
  productCode: string;
  productName: string;
  categoryId: number | null;
  categoryName: string;
  sizeName: string;
  basePrice: number;
  isActive: boolean;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

interface CategoryItemDto {
  categoryId: number;
  categoryName: string;
}

interface ApiResponseDto<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-products-list',
  templateUrl: './products_list.html',
  styleUrl: './products_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucideDownload,
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
export class ProductsListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/products';
  private readonly catUrl = 'http://localhost:5107/api/v1/erp/categories';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly categoryFilter = signal('');
  readonly statusFilter = signal('');
  readonly sortOrder = signal('newest');

  readonly categories = signal<CategoryItemDto[]>([]);
  readonly categoryOptions = computed<ComboOption[]>(() => [
    { value: '', label: 'Tất cả danh mục' },
    ...this.categories().map((c) => ({ value: String(c.categoryId), label: c.categoryName })),
  ]);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'true', label: 'Đang bán' },
    { value: 'false', label: 'Ngưng bán' },
  ];

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly rows = signal<EditableProductRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly isSaving = signal(false);
  readonly isExporting = signal(false);
  readonly deleteTarget = signal<EditableProductRow | null>(null);

  readonly columns: GridColumn[] = [
    { key: 'imageUrl', label: 'Ảnh', width: '74px', align: 'center', editable: true },
    { key: 'productCode', label: 'Mã món', width: '125px', editable: true },
    { key: 'productName', label: 'Tên món đồ uống / bánh', minWidth: '210px', editable: true },
    { key: 'categoryId', label: 'Danh mục', width: '165px', editable: true },
    { key: 'sizeName', label: 'Size', width: '80px', align: 'center' },
    { key: 'basePrice', label: 'Giá bán', align: 'right', width: '120px', editable: true },
    { key: 'isActive', label: 'Đang bán', align: 'center', width: '85px', editable: true },
  ];

  readonly gridRows = computed(() =>
    this.rows().map((item) => ({ ...item, _raw: item }) as GridRow),
  );

  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.loadCategories();
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableProductRow {
    return row['_raw'] as EditableProductRow;
  }

  markDirty(item: EditableProductRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async loadCategories(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<CategoryItemDto[]>>(this.catUrl, { withCredentials: true }),
      );
      this.categories.set(res.data ?? []);
    } catch {
      this.categories.set([]);
    }
  }

  private buildParams(offset: number, limit: number): HttpParams {
    let params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit))
      .set('sortOrder', this.sortOrder());

    if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
    if (this.categoryFilter()) params = params.set('categoryId', this.categoryFilter());
    if (this.statusFilter()) params = params.set('isActive', this.statusFilter());
    return params;
  }

  private mapRows(data: Record<string, unknown>[]): EditableProductRow[] {
    return data.map((r) => ({
      productId: Number(r['productId']),
      imageUrl: String(r['imageUrl'] ?? ''),
      productCode: String(r['productCode'] ?? ''),
      productName: String(r['productName'] ?? ''),
      categoryId: r['categoryId'] != null ? Number(r['categoryId']) : null,
      categoryName: String(r['categoryName'] ?? ''),
      sizeName: String(r['sizeName'] ?? 'M'),
      basePrice: Number(r['basePrice'] ?? 0),
      isActive: Boolean(r['isActive']),
      _localKey: `db_${r['productId']}`,
      _isDirty: false,
      _isNew: false,
    }));
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    this.hasMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, {
          params: this.buildParams(0, 50),
          withCredentials: true,
        }),
      );
      const list = this.mapRows(res.data ?? []);
      this.rows.set(list);
      this.hasMore.set(list.length === 50);
    } catch {
      this.toast.error('Không thể tải danh sách món.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore() || this.isLoading()) return;
    this.loadingMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, {
          params: this.buildParams(this.rows().length, 10),
          withCredentials: true,
        }),
      );
      const next = this.mapRows(res.data ?? []);
      this.rows.update((list) => [...list, ...next]);
      this.hasMore.set(next.length === 10);
    } catch {
      this.toast.error('Không thể tải thêm món.');
    } finally {
      this.loadingMore.set(false);
    }
  }

  addNewRow(): void {
    const firstCat = this.categories()[0];
    const newItem: EditableProductRow = {
      productId: null,
      imageUrl: '',
      productCode: '',
      productName: '',
      categoryId: firstCat?.categoryId ?? null,
      categoryName: firstCat?.categoryName ?? '',
      sizeName: 'M',
      basePrice: 35000,
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

  async onRowImageSelected(event: Event, item: EditableProductRow): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    item._previewUrl = URL.createObjectURL(file);
    this.rows.update((list) => [...list]);

    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponseDto<{ imageUrl: string }>>(`${this.apiUrl}/upload-image`, formData, {
          withCredentials: true,
        }),
      );
      if (res.data?.imageUrl) {
        item.imageUrl = res.data.imageUrl;
        this.markDirty(item);
        this.toast.success('Đã tải ảnh lên. Bấm Lưu thay đổi để lưu xuống DB.');
      }
    } catch {
      this.toast.error('Tải ảnh lên thất bại.');
    } finally {
      input.value = '';
    }
  }

  async saveAllChanges(): Promise<void> {
    const toSave = this.dirtyRows();
    if (toSave.length === 0) return;

    for (const item of toSave) {
      if (!item.productCode.trim() || !item.productName.trim()) {
        this.toast.error('Vui lòng nhập đầy đủ Mã món và Tên món.');
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
                productId: item.productId,
                productCode: item.productCode.trim().toUpperCase(),
                productName: item.productName.trim(),
                categoryId: item.categoryId,
                basePrice: Number(item.basePrice),
                imageUrl: item.imageUrl || null,
                isActive: item.isActive,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} món thành công.`);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Lưu món thất bại.';
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
    if (!target || !target.productId) return;
    this.isSaving.set(true);
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/${target.productId}`, { withCredentials: true }),
      );
      this.toast.success('Đã xóa món.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Không thể xóa món.';
      this.toast.error(msg);
      this.deleteTarget.set(null);
    } finally {
      this.isSaving.set(false);
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
      const firstCat = this.categories()[0]?.categoryId ?? null;
      const imported: EditableProductRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (!cols[0] || !cols[1]) continue;
        imported.push({
          productId: null,
          imageUrl: '',
          productCode: cols[0].toUpperCase(),
          productName: cols[1],
          categoryId: Number(cols[2]) || firstCat,
          categoryName: '',
          sizeName: 'M',
          basePrice: Number(cols[3]) || 35000,
          isActive: true,
          _localKey: `imp_${Date.now()}_${i}`,
          _isDirty: true,
          _isNew: true,
        });
      }
      if (imported.length > 0) {
        this.rows.update((list) => [...imported, ...list]);
        this.toast.success(`Đã nạp ${imported.length} món từ file CSV. Bấm Lưu thay đổi để ghi xuống DB.`);
      }
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  async downloadImportTemplate(): Promise<void> {
    try {
      const headers = ['Mã món', 'Tên món', 'Mã danh mục (CategoryId)', 'Size', 'Giá bán'];
      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'ERP_Products_Import_Template',
            sheetName: 'MauNhapMon',
            reportTitle: 'MẪU NHẬP DANH SÁCH MÓN FIIN COFFEE (KHÔNG CẦN ẢNH)',
            summaryLabel: 'Số dòng mẫu:',
            fileName: 'Mau_Nhap_ThucDon_Fiin.xlsx',
            headers,
            rows: [
              {
                'Mã món': 'CF-NEW-01',
                'Tên món': 'Cà Phê Sữa Tươi (Mẫu)',
                'Mã danh mục (CategoryId)': 1,
                Size: 'M',
                'Giá bán': 39000,
              },
            ],
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Mau_Nhap_ThucDon_Fiin.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.toast.error('Không thể tải mẫu nhập.');
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) {
      this.toast.error('Không có dữ liệu để xuất Excel.');
      return;
    }

    this.isExporting.set(true);
    try {
      const payload = data.map((r) => ({
        productCode: r.productCode,
        productName: r.productName,
        categoryName: r.categoryName,
        sizeName: r.sizeName,
        basePrice: r.basePrice,
        isActive: r.isActive,
        imageUrl: r.imageUrl,
      }));

      const blob = await firstValueFrom(
        this.http.post(`${this.apiUrl}/export-excel`, payload, {
          responseType: 'blob',
          withCredentials: true,
        }),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ThucDon_Fiin_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.success(`Đã xuất Excel kèm ảnh (${data.length} món).`);
    } catch {
      this.toast.error('Xuất Excel thất bại.');
    } finally {
      this.isExporting.set(false);
    }
  }
}
