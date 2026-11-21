import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideDownload, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-erp-order-history',
  templateUrl: './order_history.html',
  styleUrl: './order_history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideDownload, LucideRotateCcw, AdminSearchBoxComponent, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class OrderHistoryTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/order-history';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly statusFilter = signal('');
  readonly sortOrder = signal('newest');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả kết thúc' },
    { value: 'Completed', label: 'Giao thành công' },
    { value: 'Cancelled', label: 'Đã hủy / Trả' },
  ];

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'orderCode', label: 'Mã đơn', type: 'code', width: '130px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '170px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '125px', mono: true },
    {
      key: 'orderStatus',
      label: 'Kết quả',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
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
        Paid: { label: 'Đã thanh toán', variant: 'success' },
        Unpaid: { label: 'Chưa thanh toán', variant: 'warning' },
        Refunded: { label: 'Đã hoàn tiền', variant: 'danger' },
      },
    },
    { key: 'totalAmount', label: 'Thành tiền', type: 'currency', align: 'right', width: '130px', bold: true },
    { key: 'cancelReason', label: 'Lý do hủy (nếu có)', minWidth: '180px', tone: 'muted' },
    { key: 'createdAt', label: 'Thời gian đặt', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  private buildParams(offset: number, limit: number): HttpParams {
    let params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit))
      .set('sortOrder', this.sortOrder());
    if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
    if (this.statusFilter()) params = params.set('orderStatus', this.statusFilter());
    return params;
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    this.hasMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params: this.buildParams(0, 50), withCredentials: true }),
      );
      const list = res.data ?? [];
      this.rows.set(list);
      this.hasMore.set(list.length === 50);
    } catch {
      this.toast.error('Không thể tải lịch sử đơn hàng.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore() || this.isLoading()) return;
    this.loadingMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params: this.buildParams(this.rows().length, 10), withCredentials: true }),
      );
      const next = res.data ?? [];
      this.rows.update((l) => [...l, ...next]);
      this.hasMore.set(next.length === 10);
    } finally {
      this.loadingMore.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    const headers = ['Mã đơn', 'Khách hàng', 'SĐT', 'Kết quả', 'Thanh toán', 'Thành tiền', 'Thời gian'];
    const exportRows = data.map((r) => ({
      'Mã đơn': r['orderCode'],
      'Khách hàng': r['customerName'],
      'SĐT': r['phoneNumber'],
      'Kết quả': r['orderStatus'],
      'Thanh toán': r['paymentStatus'],
      'Thành tiền': r['totalAmount'],
      'Thời gian': r['createdAt'] ? String(r['createdAt']).replace('T', ' ').slice(0, 19) : '',
    }));
    const blob = await firstValueFrom(
      this.http.post(
        this.excelUrl,
        { templateKey: 'ERP_Order_History', sheetName: 'Lịch sử đơn', reportTitle: 'LỊCH SỬ ĐƠN HÀNG ĐỐI SOÁT DOANH THU', summaryLabel: 'Tổng đơn:', fileName: 'LichSuDonHang_Fiin.xlsx', headers, rows: exportRows },
        { responseType: 'blob', withCredentials: true },
      ),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LichSuDonHang_Fiin.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
