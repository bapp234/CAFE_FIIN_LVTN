import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucidePlus, LucideRotateCcw, LucideTrash2, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableRecipeRow {
  recipeId: number | null;
  variantId: number;
  productCode: string;
  productName: string;
  sizeName: string;
  ingredientId: number;
  ingredientName: string;
  unit: string;
  quantity: number;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

interface VariantOption {
  variantId: number;
  productCode: string;
  productName: string;
  sizeName: string;
}

interface IngredientOption {
  ingredientId: number;
  ingredientName: string;
  unit: string;
}

@Component({
  selector: 'app-product-recipes',
  templateUrl: './product_recipes.html',
  styleUrl: './product_recipes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    FormsModule,
    LucideCheck,
    LucidePlus,
    LucideRotateCcw,
    LucideTrash2,
    LucideX,
    AdminSearchBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
    AdminModal,
  ],
})
export class ProductRecipesTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp';

  readonly searchQuery = signal('');
  readonly rows = signal<EditableRecipeRow[]>([]);
  readonly variants = signal<VariantOption[]>([]);
  readonly ingredients = signal<IngredientOption[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly deleteTarget = signal<EditableRecipeRow | null>(null);

  readonly columns: GridColumn[] = [
    { key: 'variantId', label: 'Món & Size', minWidth: '240px', editable: true },
    { key: 'ingredientId', label: 'Nguyên liệu / Vật tư', minWidth: '220px', editable: true },
    { key: 'quantity', label: 'Định lượng', align: 'right', width: '125px', editable: true },
    { key: 'unit', label: 'ĐVT', width: '85px', align: 'center' },
  ];

  readonly gridRows = computed(() => this.rows().map((item) => ({ ...item, _raw: item }) as GridRow));
  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.loadLookups();
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableRecipeRow {
    return row['_raw'] as EditableRecipeRow;
  }

  markDirty(item: EditableRecipeRow): void {
    item._isDirty = true;
    const ing = this.ingredients().find((i) => i.ingredientId === Number(item.ingredientId));
    if (ing) item.unit = ing.unit;
    this.rows.update((list) => [...list]);
  }

  async loadLookups(): Promise<void> {
    try {
      const [vRes, iRes] = await Promise.all([
        firstValueFrom(this.http.get<{ data?: VariantOption[] }>(`${this.apiUrl}/variants`, { withCredentials: true })),
        firstValueFrom(this.http.get<{ data?: IngredientOption[] }>(`${this.apiUrl}/inventory/central`, { withCredentials: true })),
      ]);
      this.variants.set(vRes.data ?? []);
      this.ingredients.set(iRes.data ?? []);
    } catch { /* ignore */ }
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      const res = await firstValueFrom(
        this.http.get<{ data?: Record<string, unknown>[] }>(`${this.apiUrl}/recipes`, { params, withCredentials: true }),
      );
      this.rows.set(
        (res.data ?? []).map((r) => ({
          recipeId: Number(r['recipeId']),
          variantId: Number(r['variantId']),
          productCode: String(r['productCode'] ?? ''),
          productName: String(r['productName'] ?? ''),
          sizeName: String(r['sizeName'] ?? ''),
          ingredientId: Number(r['ingredientId']),
          ingredientName: String(r['ingredientName'] ?? ''),
          unit: String(r['unit'] ?? ''),
          quantity: Number(r['quantity'] ?? 0),
          _localKey: `db_${r['recipeId']}`,
          _isDirty: false,
          _isNew: false,
        })),
      );
    } catch {
      this.toast.error('Không thể tải công thức món (BOM).');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    const firstVar = this.variants()[0];
    const firstIng = this.ingredients()[0];
    if (!firstVar || !firstIng) {
      this.toast.error('Cần có ít nhất 1 món và 1 nguyên liệu để tạo công thức.');
      return;
    }
    this.rows.update((list) => [
      {
        recipeId: null,
        variantId: firstVar.variantId,
        productCode: firstVar.productCode,
        productName: firstVar.productName,
        sizeName: firstVar.sizeName,
        ingredientId: firstIng.ingredientId,
        ingredientName: firstIng.ingredientName,
        unit: firstIng.unit,
        quantity: 0.025,
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
              `${this.apiUrl}/recipes`,
              {
                recipeId: item.recipeId,
                variantId: Number(item.variantId),
                ingredientId: Number(item.ingredientId),
                quantity: Number(item.quantity),
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} công thức định lượng.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu công thức thất bại.');
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
    if (!target?.recipeId) return;
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/recipes/${target.recipeId}`, { withCredentials: true }),
      );
      this.toast.success('Đã xóa định lượng công thức.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch {
      this.toast.error('Không thể xóa công thức.');
      this.deleteTarget.set(null);
    }
  }
}
