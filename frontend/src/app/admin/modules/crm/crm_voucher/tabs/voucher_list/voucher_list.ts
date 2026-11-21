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

export interface EditableVoucherRow {
  voucherId: number | null;
  voucherCode: string;
  voucherName: string;
  discountType: 'FixedAmount' | 'Percent';
  discountValue: number;
  maxDiscountAmount: number | null;
  minOrderAmount: number;
  pointsCost: number;
  usageLimit: number | null;
  startAt: string;
  endAt: string;
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
  selector: 'app-voucher-list',
  templateUrl: './voucher_list.html',
  styleUrl: './voucher_list.css',
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
export class VoucherListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/vouchers';

  readonly searchQuery = signal('');
  readonly rows = signal<EditableVoucherRow[]>([]);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);
  readonly deleteTarget = signal<EditableVoucherRow | null>(null);

  readonly columns: GridColumn[] = [
    { key: 'voucherCode', label: 'Mã Voucher', width: '130px', editable: true },
    { key: 'voucherName', label: 'Tên chương trình ưu đãi', minWidth: '200px', editable: true },
    { key: 'discountType', label: 'Loại giảm', width: '115px', editable: true },
    { key: 'discountValue', label: 'Mức giảm', align: 'right', width: '110px', editable: true },
    { key: 'minOrderAmount', label: 'Đơn tối thiểu', align: 'right', width: '120px', editable: true },
    { key: 'pointsCost', label: 'Điểm Fiin đổi', align: 'right', width: '105px', editable: true },
    { key: 'startAt', label: 'Từ ngày', width: '130px', editable: true },
    { key: 'endAt', label: 'Đến ngày', width: '130px', editable: true },
    { key: 'isActive', label: 'Áp dụng', align: 'center', width: '85px', editable: true },
  ];

  readonly filteredRows = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = !q
      ? this.rows()
      : this.rows().filter(
          (r) =>
            r.voucherCode.toLowerCase().includes(q) ||
            r.voucherName.toLowerCase().includes(q),
        );
    return list.map((item) => ({ ...item, _raw: item }) as GridRow);
  });

  readonly dirtyRows = computed(() => this.rows().filter((r) => r._isDirty));
  readonly dirtyCount = computed(() => this.dirtyRows().length);

  ngOnInit(): void {
    void this.refreshTab();
  }

  getRaw(row: GridRow): EditableVoucherRow {
    return row['_raw'] as EditableVoucherRow;
  }

  markDirty(item: EditableVoucherRow): void {
    item._isDirty = true;
    this.rows.update((list) => [...list]);
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<Record<string, unknown>[]>>(this.apiUrl, { withCredentials: true }),
      );
      const list: EditableVoucherRow[] = (res.data ?? []).map((r) => ({
        voucherId: Number(r['voucherId']),
        voucherCode: String(r['voucherCode'] ?? ''),
        voucherName: String(r['voucherName'] ?? ''),
        discountType: (r['discountType'] === 'Percent' ? 'Percent' : 'FixedAmount'),
        discountValue: Number(r['discountValue'] ?? 10000),
        maxDiscountAmount: r['maxDiscountAmount'] != null ? Number(r['maxDiscountAmount']) : null,
        minOrderAmount: Number(r['minOrderAmount'] ?? 0),
        pointsCost: Number(r['pointsCost'] ?? 0),
        usageLimit: r['usageLimit'] != null ? Number(r['usageLimit']) : null,
        startAt: r['startAt'] ? String(r['startAt']).slice(0, 10) : '',
        endAt: r['endAt'] ? String(r['endAt']).slice(0, 10) : '',
        isActive: Boolean(r['isActive']),
        _localKey: `db_${r['voucherId']}`,
        _isDirty: false,
        _isNew: false,
      }));
      this.rows.set(list);
    } catch {
      this.toast.error('Không thể tải danh sách Voucher.');
    } finally {
      this.isLoading.set(false);
    }
  }

  addNewRow(): void {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const newItem: EditableVoucherRow = {
      voucherId: null,
      voucherCode: '',
      voucherName: '',
      discountType: 'FixedAmount',
      discountValue: 10000,
      maxDiscountAmount: null,
      minOrderAmount: 0,
      pointsCost: 10,
      usageLimit: null,
      startAt: today,
      endAt: nextMonth,
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
      if (!item.voucherCode.trim() || !item.voucherName.trim() || !item.startAt || !item.endAt) {
        this.toast.error('Vui lòng nhập đầy đủ Mã, Tên Voucher và Từ ngày / Đến ngày.');
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
                voucherId: item.voucherId,
                voucherCode: item.voucherCode.trim().toUpperCase(),
                voucherName: item.voucherName.trim(),
                discountType: item.discountType,
                discountValue: Number(item.discountValue),
                maxDiscountAmount: item.maxDiscountAmount,
                minOrderAmount: Number(item.minOrderAmount),
                pointsCost: Number(item.pointsCost),
                usageLimit: item.usageLimit,
                startAt: item.startAt,
                endAt: item.endAt,
                isActive: item.isActive,
              },
              { withCredentials: true },
            ),
          ),
        ),
      );
      this.toast.success(`Đã lưu ${toSave.length} Voucher.`);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Lưu Voucher thất bại.';
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
    if (!target || !target.voucherId) return;
    this.isSaving.set(true);
    try {
      await firstValueFrom(
        this.http.delete(`${this.apiUrl}/${target.voucherId}`, { withCredentials: true }),
      );
      this.toast.success('Đã xóa Voucher.');
      this.deleteTarget.set(null);
      await this.refreshTab();
    } catch (err: unknown) {
      const msg = (err as { error?: { message?: string } })?.error?.message || 'Không thể xóa Voucher.';
      this.toast.error(msg);
      this.deleteTarget.set(null);
    } finally {
      this.isSaving.set(false);
    }
  }
}
