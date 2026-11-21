import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideDownload, LucidePlus, LucideRotateCcw, LucideUpload, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableIngredientRow {
  ingredientId: number | null;
  ingredientCode: string;
  ingredientName: string;
  categoryGroup: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  averageCost: number;
  isActive: boolean;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

@Component({
  selector: 'app-central-stock',
  templateUrl: './central_stock.html',
  styleUrl: './central_stock.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucideDownload,
    LucidePlus,
    LucideRotateCcw,
    LucideUpload,
    LucideX,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class CentralStockTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/inventory';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly groupFilter = signal('');
  readonly rows = signal<EditableIngredientRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly isExporting = signal(false);

  readonly groupOptions: ComboOption[] = [
    { value: '', label: 'Tất cả nhóm vật tư' },
    { value: 'Nguyên liệu', label: 'Nguyên liệu pha chế' },
    { value: 'Bao bì', label: 'Ly / Nắp / Bao bì' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'ingredientCode', label: 'Mã VT', width: '115px', editable: true },
    { key: 'ingredientName', label: 'Tên nguyên liệu / vật tư', minWidth: '210px', editable: true },
    { key: 'categoryGroup', label: 'Nhóm', width: '130px', editable: true },
    { key: 'unit', label: 'ĐVT', width: '85px', editable: true },
    { key: 'currentStock', label: 'Tồn Kho Tổng', align: 'right', width: '120px', editable: true },
    { key: 'reorderLevel', label: 'Cảnh báo', align: 'right', width: '105px', editable: true },
    { key: 'averageCost', label: 'Giá vốn TB', align: 'right', width: '120px', editable: true },
    { key: 'isActive', label: 'Đang dùng', align: 'center', width: '85px', editable: true },
  ];

  readonly gridRows = computed(() => this.rows().map((item) => ({ ...item, _raw: item }) as GridRow));
  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableIngredientRow {
    return row['_raw'] as EditableIngredientRow;
  }

  markDirty(item: EditableIngredientRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.groupFilter()) params = params.set('group', this.groupFilter());

      const res = await firstValueFrom(
        this.http.get<{ data?: Record<string, unknown>[] }>(`${this.apiUrl}/central`, { params, withCredentials: true }),
      );
      this.rows.set(
        (res.data ?? []).map((r) => ({
          ingredientId: Number(r['ingredientId']),
          ingredientCode: String(r['ingredientCode'] ?? ''),
          ingredientName: String(r['ingredientName'] ?? ''),
          categoryGroup: String(r['categoryGroup'] ?? 'Nguyên liệu'),
          unit: String(r['unit'] ?? ''),
          currentStock: Number(r['currentStock'] ?? 0),
          reorderLevel: Number(r['reorderLevel'] ?? 0),
          averageCost: Number(r['averageCost'] ?? 0),
          isActive: Boolean(r['isActive']),
          _localKey: `db_${r['ingredientId']}`,
          _isDirty: false,
          _isNew: false,
        })),
      );
    } catch {
      this.toast.error('Không thể tải tồn kho tổng.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    this.rows.update((list) => [
      {
        ingredientId: null,
        ingredientCode: '',
        ingredientName: '',
        categoryGroup: 'Nguyên liệu',
        unit: 'Kg',
        currentStock: 0,
        reorderLevel: 10,
        averageCost: 0,
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
            this.http.post(
              `${this.apiUrl}/ingredients`,
              {
                ingredientId: item.ingredientId,
                ingredientCode: item.ingredientCode.trim().toUpperCase(),
                ingredientName: item.ingredientName.trim(),
                categoryGroup: item.categoryGroup,
                unit: item.unit.trim(),
                currentStock: Number(item.currentStock),
                reorderLevel: Number(item.reorderLevel),
                averageCost: Number(item.averageCost),
                isActive: item.isActive,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} vật tư Kho Tổng.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu vật tư thất bại.');
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
      const lines = String(reader.result ?? '').split(/\r?\n/).filter((l) => l.trim());
      const imported: EditableIngredientRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (!cols[0] || !cols[1]) continue;
        imported.push({
          ingredientId: null,
          ingredientCode: cols[0].toUpperCase(),
          ingredientName: cols[1],
          categoryGroup: cols[2] || 'Nguyên liệu',
          unit: cols[3] || 'Kg',
          currentStock: Number(cols[4]) || 0,
          reorderLevel: Number(cols[5]) || 10,
          averageCost: Number(cols[6]) || 0,
          isActive: true,
          _localKey: `imp_${Date.now()}_${i}`,
          _isDirty: true,
          _isNew: true,
        });
      }
      if (imported.length > 0) {
        this.rows.update((l) => [...imported, ...l]);
        this.toast.success(`Đã nạp ${imported.length} vật tư từ CSV.`);
      }
      input.value = '';
    };
    reader.readAsText(file, 'utf-8');
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    this.isExporting.set(true);
    try {
      const headers = ['Mã VT', 'Tên vật tư', 'Nhóm', 'ĐVT', 'Tồn Kho Tổng', 'Cảnh báo', 'Giá vốn TB'];
      const exportRows = data.map((r) => ({
        'Mã VT': r.ingredientCode,
        'Tên vật tư': r.ingredientName,
        'Nhóm': r.categoryGroup,
        'ĐVT': r.unit,
        'Tồn Kho Tổng': r.currentStock,
        'Cảnh báo': r.reorderLevel,
        'Giá vốn TB': r.averageCost,
      }));
      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'ERP_Central_Inventory',
            sheetName: 'Kho Tổng',
            reportTitle: 'BÁO CÁO TỒN KHO TỔNG & VẬT TƯ FIIN COFFEE',
            summaryLabel: 'Tổng mã vật tư:',
            fileName: `TonKhoTong_${new Date().toISOString().slice(0, 10)}.xlsx`,
            headers,
            rows: exportRows,
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TonKhoTong_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.isExporting.set(false);
    }
  }
}
