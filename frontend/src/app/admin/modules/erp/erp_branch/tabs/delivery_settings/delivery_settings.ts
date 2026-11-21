import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucideRotateCcw, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableDeliveryRow {
  branchId: number;
  branchName: string;
  isDeliveryEnabled: boolean;
  maxRadiusKm: number;
  baseShippingFee: number;
  feePerKm: number;
  freeShipMinOrder: number;
  supportedAreas: string;
  _isDirty: boolean;
}

@Component({
  selector: 'app-delivery-settings',
  templateUrl: './delivery_settings.html',
  styleUrl: './delivery_settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideCheck, LucideRotateCcw, LucideX, AdminButtonComponent, AdminGridTableComponent],
})
export class DeliverySettingsTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/branch/delivery-settings';

  readonly rows = signal<EditableDeliveryRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  readonly columns: GridColumn[] = [
    { key: 'branchId', label: 'Mã CN', type: 'code', width: '80px' },
    { key: 'branchName', label: 'Tên chi nhánh', minWidth: '180px', bold: true },
    { key: 'isDeliveryEnabled', label: 'Bật giao hàng', align: 'center', width: '105px', editable: true },
    { key: 'maxRadiusKm', label: 'Bán kính (Km)', align: 'right', width: '115px', editable: true },
    { key: 'baseShippingFee', label: 'Phí ship cơ bản', align: 'right', width: '130px', editable: true },
    { key: 'feePerKm', label: 'Phụ thu / Km', align: 'right', width: '120px', editable: true },
    { key: 'freeShipMinOrder', label: 'Freeship từ đơn', align: 'right', width: '135px', editable: true },
    { key: 'supportedAreas', label: 'Khu vực / Phường hỗ trợ', minWidth: '220px', editable: true },
  ];

  readonly gridRows = computed(() => this.rows().map((item) => ({ ...item, _raw: item }) as GridRow));
  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableDeliveryRow {
    return row['_raw'] as EditableDeliveryRow;
  }

  markDirty(item: EditableDeliveryRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(this.http.get<{ data?: Record<string, unknown>[] }>(this.apiUrl, { withCredentials: true }));
      this.rows.set(
        (res.data ?? []).map((r) => ({
          branchId: Number(r['branchId']),
          branchName: String(r['branchName'] ?? ''),
          isDeliveryEnabled: Boolean(r['isDeliveryEnabled']),
          maxRadiusKm: Number(r['maxRadiusKm'] ?? 5),
          baseShippingFee: Number(r['baseShippingFee'] ?? 15000),
          feePerKm: Number(r['feePerKm'] ?? 5000),
          freeShipMinOrder: Number(r['freeShipMinOrder'] ?? 150000),
          supportedAreas: String(r['supportedAreas'] ?? ''),
          _isDirty: false,
        })),
      );
    } catch {
      this.toast.error('Không thể tải cấu hình giao hàng.');
    } finally {
      this.isLoading.set(false);
    }
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
              this.apiUrl,
              {
                branchId: item.branchId,
                isDeliveryEnabled: item.isDeliveryEnabled,
                maxRadiusKm: Number(item.maxRadiusKm),
                baseShippingFee: Number(item.baseShippingFee),
                feePerKm: Number(item.feePerKm),
                freeShipMinOrder: Number(item.freeShipMinOrder),
                supportedAreas: item.supportedAreas.trim() || null,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu cấu hình giao hàng cho ${toSave.length} chi nhánh.`);
      await this.refreshTab();
    } catch {
      this.toast.error('Lưu cấu hình giao hàng thất bại.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
