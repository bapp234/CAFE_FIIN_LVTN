import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';

@Component({
  selector: 'app-live-orders',
  templateUrl: './live_orders.html',
  styleUrl: './live_orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideRotateCcw, AdminSearchBoxComponent, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class LiveOrdersTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/live-orders';

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);
  readonly advancingOrderId = signal<number | null>(null);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả bước đơn' },
    { value: 'Pending', label: 'Lên món (Chờ)' },
    { value: 'Processing', label: 'Làm món (Pha chế)' },
    { value: 'Delivering', label: 'Giao món' },
    { value: 'Completed', label: 'Giao thành công' },
    { value: 'Cancelled', label: 'Đã hủy / Trả' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'orderCode', label: 'Mã đơn', type: 'code', width: '130px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '170px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '125px', mono: true },
    {
      key: 'orderStatus',
      label: 'Bước xử lý',
      type: 'badge',
      width: '140px',
      align: 'center',
      badgeMap: {
        Pending: { label: 'Lên món', variant: 'warning' },
        Confirmed: { label: 'Lên món', variant: 'warning' },
        Processing: { label: 'Làm món', variant: 'info' },
        Ready: { label: 'Giao món', variant: 'info' },
        Delivering: { label: 'Giao món', variant: 'warning' },
        Completed: { label: 'Thành công', variant: 'success' },
        Cancelled: { label: 'Đã hủy / Trả', variant: 'danger' },
      },
    },
    {
      key: 'paymentStatus',
      label: 'Thanh toán',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
        Unpaid: { label: 'Chờ thanh toán', variant: 'warning' },
        Paid: { label: 'Đã thanh toán', variant: 'success' },
        Refunded: { label: 'Đã hoàn tiền', variant: 'danger' },
      },
    },
    { key: 'totalAmount', label: 'Thành tiền', type: 'currency', align: 'right', width: '130px', bold: true },
    { key: 'updatedAt', label: 'Cập nhật lúc', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
    const timer = setInterval(() => void this.refreshTab(), 15000);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.statusFilter()) params = params.set('orderStatus', this.statusFilter());
      const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(res.data ?? []);
    } finally {
      this.isLoading.set(false);
    }
  }

  getNextPosStatus(currentStatus: unknown): { next: 'Processing' | 'Delivering' | 'Completed'; label: string } | null {
    const s = String(currentStatus ?? '');
    if (s === 'Pending' || s === 'Confirmed') return { next: 'Processing', label: 'Nhận làm món' };
    if (s === 'Processing' || s === 'Ready') return { next: 'Delivering', label: 'Giao món' };
    if (s === 'Delivering') return { next: 'Completed', label: 'Hoàn thành' };
    return null;
  }

  async advanceOrderPos(row: GridRow): Promise<void> {
    const orderId = Number(row['orderId'] ?? 0);
    const step = this.getNextPosStatus(row['orderStatus']);
    if (!orderId || !step) return;

    this.advancingOrderId.set(orderId);
    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/${orderId}/advance`,
          { nextStatus: step.next },
          { withCredentials: true }
        )
      );
      await this.refreshTab();
    } finally {
      this.advancingOrderId.set(null);
    }
  }
}
