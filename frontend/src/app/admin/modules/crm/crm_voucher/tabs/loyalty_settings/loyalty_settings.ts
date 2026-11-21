import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucidePlus, LucideRotateCcw, LucideTrash2, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import {
  AdminGridTableComponent,
  GridColumn,
  GridRow,
} from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminModal } from '../../../../../shared/admin_modal/admin_modal';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

export interface EditableLoyaltyRuleRow {
  ruleId: number | null;
  ruleCode: string;
  ruleName: string;
  ruleType: string;
  earnAmountPerPoint: number;
  pointsPerStep: number;
  multiplier: number;
  minOrderAmount: number;
  redeemValuePerPoint: number;
  startDate: string;
  endDate: string;
  isDefault: boolean;
  isActive: boolean;
  _localKey: string;
  _isDirty: boolean;
  _isNew: boolean;
}

interface ApiResponseDto<T> {
  success: boolean;
  message?: string;
  data?: T;
}

@Component({
  selector: 'app-loyalty-settings',
  templateUrl: './loyalty_settings.html',
  styleUrl: './loyalty_settings.css',
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
export class LoyaltySettingsTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/loyalty-rules';

  readonly searchQuery = signal('');
  readonly rows = signal<EditableLoyaltyRuleRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly deleteTarget = signal<EditableLoyaltyRuleRow | null>(null);

  readonly columns: GridColumn[] = [
    { key: 'ruleCode', label: 'Mã quy tắc', width: '135px', editable: true },
    { key: 'ruleName', label: 'Tên quy tắc Điểm Fiin', minWidth: '220px', editable: true },
    { key: 'earnAmountPerPoint', label: 'Mức chi tiêu', align: 'right', width: '125px', editable: true },
    { key: 'pointsPerStep', label: 'Điểm Fiin', align: 'right', width: '100px', editable: true },
    { key: 'multiplier', label: 'Hệ số (x)', align: 'right', width: '95px', editable: true },
    { key: 'startDate', label: 'Từ ngày', width: '135px', editable: true },
    { key: 'endDate', label: 'Đến ngày', width: '135px', editable: true },
    { key: 'isActive', label: 'Áp dụng', align: 'center', width: '85px', editable: true },
  ];

  readonly filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = !q
      ? this.rows()
      : this.rows().filter(
          (r) =>
            r.ruleCode.toLowerCase().includes(q) ||
            r.ruleName.toLowerCase().includes(q),
        );
    return list.map((item) => ({ ...item, _raw: item }) as GridRow);
  });

  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableLoyaltyRuleRow {
    return row['_raw'] as EditableLoyaltyRuleRow;
  }

  markDirty(item: EditableLoyaltyRuleRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, { withCredentials: true }),
      );
      const list: EditableLoyaltyRuleRow[] = (res.data ?? []).map((r) => ({
        ruleId: Number(r['ruleId']),
        ruleCode: String(r['ruleCode'] ?? ''),
        ruleName: String(r['ruleName'] ?? ''),
        ruleType: String(r['ruleType'] ?? 'earn'),
        earnAmountPerPoint: Number(r['earnAmountPerPoint'] ?? 10000),
        pointsPerStep: Number(r['pointsPerStep'] ?? 1),
        multiplier: Number(r['multiplier'] ?? 1),
        minOrderAmount: Number(r['minOrderAmount'] ?? 0),
        redeemValuePerPoint: Number(r['redeemValuePerPoint'] ?? 1000),
        startDate: r['startDate'] ? String(r['startDate']).slice(0, 10) : '',
        endDate: r['endDate'] ? String(r['endDate']).slice(0, 10) : '',
        isDefault: Boolean(r['isDefault']),
        isActive: Boolean(r['isActive']),
        _localKey: `db_${r['ruleId']}`,
        _isDirty: false,
        _isNew: false,
      }));
      this.rows.set(list);
    } catch {
      this.toast.error('Không thể tải danh sách quy tắc Điểm Fiin.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    const newItem: EditableLoyaltyRuleRow = {
      ruleId: null,
      ruleCode: '',
      ruleName: '',
      ruleType: 'holiday',
      earnAmountPerPoint: 10000,
      pointsPerStep: 1,
      multiplier: 2,
      minOrderAmount: 0,
      redeemValuePerPoint: 1000,
      startDate: '',
      endDate: '',
      isDefault: false,
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
      if (!item.ruleCode.trim() || !item.ruleName.trim()) {
        this.toast.error('Vui lòng nhập đầy đủ Mã quy tắc và Tên quy tắc.');
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
                ruleId: item.ruleId,
                ruleCode: item.ruleCode.trim(),
                ruleName: item.ruleName.trim(),
                ruleType: item.ruleType,
                earnAmountPerPoint: Number(item.earnAmountPerPoint),
                pointsPerStep: Number(item.pointsPerStep),
                multiplier: Number(item.multiplier),
                minOrderAmount: Number(item.minOrderAmount),
                redeemValuePerPoint: Number(item.redeemValuePerPoint),
                startDate: item.startDate || null,
                endDate: item.endDate || null,
                isActive: item.isActive,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} quy tắc Điểm Fiin.`);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Lưu quy tắc thất bại.';
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
    if (!target || !target.ruleId) return;
    this.isSaving.set(true);
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/${target.ruleId}`, { withCredentials: true }),
      );
      this.toast.success('Đã xóa quy tắc Điểm Fiin.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Không thể xóa quy tắc.';
      this.toast.error(msg);
      this.deleteTarget.set(null);
    } finally {
      this.isSaving.set(false);
    }
  }
}
