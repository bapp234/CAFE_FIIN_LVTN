import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideDownload, LucideRotateCcw } from '@lucide/angular';
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
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

interface ApiResponseDto<T> {
  success: boolean;
  data?: T;
}

@Component({
  selector: 'app-order-list',
  templateUrl: './order_list.html',
  styleUrl: './order_list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LucideDownload,
    LucideRotateCcw,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class OrderListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/orders';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly orderTypeFilter = signal('');
  readonly orderStatusFilter = signal('');
  readonly paymentStatusFilter = signal('');
  readonly sortOrder = signal('newest');

  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly isExporting = signal(false);

  readonly orderTypeOptions: ComboOption[] = [
    { value: '', label: 'Tất cả kênh đặt' },
    { value: 'InStore', label: 'Tại quầy (InStore)' },
    { value: 'TakeAway', label: 'Mang đi (TakeAway)' },
    { value: 'OnlinePickUp', label: 'Online tự đến lấy' },
    { value: 'OnlineDelivery', label: 'Online giao tận nơi' },
  ];

  readonly orderStatusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'Pending', label: 'Chờ xác nhận' },
    { value: 'Confirmed', label: 'Đã xác nhận' },
    { value: 'Processing', label: 'Đang pha chế' },
    { value: 'Ready', label: 'Sẵn sàng' },
    { value: 'Delivering', label: 'Đang giao' },
    { value: 'Completed', label: 'Hoàn tất' },
    { value: 'Cancelled', label: 'Đã hủy' },
  ];

  readonly paymentStatusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả thanh toán' },
    { value: 'Unpaid', label: 'Chưa thanh toán' },
    { value: 'Paid', label: 'Đã thanh toán' },
    { value: 'Refunded', label: 'Đã hoàn tiền' },
  ];

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'orderCode', label: 'Mã đơn', type: 'code', width: '130px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '175px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '125px', mono: true },
    {
      key: 'orderType',
      label: 'Kênh đặt',
      type: 'badge',
      width: '140px',
      align: 'center',
      badgeMap: {
        InStore: { label: 'Tại quầy', variant: 'neutral' },
        TakeAway: { label: 'Mang đi', variant: 'info' },
        OnlinePickUp: { label: 'Online lấy tại quán', variant: 'warning' },
        OnlineDelivery: { label: 'Online giao hàng', variant: 'success' },
      },
    },
    {
      key: 'orderStatus',
      label: 'Trạng thái đơn',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
        Pending: { label: 'Chờ xác nhận', variant: 'warning' },
        Confirmed: { label: 'Đã xác nhận', variant: 'info' },
        Processing: { label: 'Đang pha chế', variant: 'info' },
        Ready: { label: 'Sẵn sàng', variant: 'info' },
        Delivering: { label: 'Đang giao', variant: 'warning' },
        Completed: { label: 'Hoàn tất', variant: 'success' },
        Cancelled: { label: 'Đã hủy', variant: 'danger' },
      },
    },
    {
      key: 'paymentStatus',
      label: 'Thanh toán',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
        Unpaid: { label: 'Chưa thanh toán', variant: 'warning' },
        Paid: { label: 'Đã thanh toán', variant: 'success' },
        PartiallyRefunded: { label: 'Hoàn một phần', variant: 'neutral' },
        Refunded: { label: 'Đã hoàn tiền', variant: 'danger' },
      },
    },
    { key: 'subTotal', label: 'Tạm tính', type: 'currency', align: 'right', width: '120px' },
    { key: 'discountAmount', label: 'Giảm giá', type: 'currency', align: 'right', width: '115px' },
    { key: 'totalAmount', label: 'Thành tiền', type: 'currency', align: 'right', width: '130px', bold: true },
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
    if (this.orderTypeFilter()) params = params.set('orderType', this.orderTypeFilter());
    if (this.orderStatusFilter()) params = params.set('orderStatus', this.orderStatusFilter());
    if (this.paymentStatusFilter()) params = params.set('paymentStatus', this.paymentStatusFilter());
    return params;
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    this.hasMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, {
          params: this.buildParams(0, 50),
          withCredentials: true,
        }),
      );
      const list = res.data ?? [];
      this.rows.set(list);
      this.hasMore.set(list.length === 50);
    } catch {
      this.toast.error('Không thể tải danh sách đơn hàng.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore() || this.isLoading()) return;
    this.loadingMore.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, {
          params: this.buildParams(this.rows().length, 10),
          withCredentials: true,
        }),
      );
      const next = res.data ?? [];
      this.rows.update((list) => [...list, ...next]);
      this.hasMore.set(next.length === 10);
    } catch {
      this.toast.error('Không thể tải thêm đơn hàng.');
    } finally {
      this.loadingMore.set(false);
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
      const headers = ['Mã đơn', 'Khách hàng', 'Số điện thoại', 'Kênh đặt', 'Trạng thái', 'Thanh toán', 'Thành tiền', 'Thời gian đặt'];
      const exportRows = data.map((r) => ({
        'Mã đơn': r['orderCode'] ?? '',
        'Khách hàng': r['customerName'] ?? 'Khách lẻ',
        'Số điện thoại': r['phoneNumber'] ?? '',
        'Kênh đặt': r['orderType'] ?? '',
        'Trạng thái': r['orderStatus'] ?? '',
        'Thanh toán': r['paymentStatus'] ?? '',
        'Thành tiền': Number(r['totalAmount'] ?? 0),
        'Thời gian đặt': r['createdAt'] ? String(r['createdAt']).replace('T', ' ').slice(0, 19) : '',
      }));

      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'CRM_Orders',
            sheetName: 'Đơn hàng',
            reportTitle: 'BÁO CÁO LỊCH SỬ ĐƠN HÀNG KHÁCH HÀNG',
            summaryLabel: 'Tổng số đơn hàng:',
            fileName: `BaoCao_DonHang_${new Date().toISOString().slice(0, 10)}.xlsx`,
            headers,
            rows: exportRows,
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BaoCao_DonHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.success(`Đã xuất báo cáo Excel (${data.length} đơn hàng).`);
    } catch {
      this.toast.error('Xuất báo cáo Excel thất bại.');
    } finally {
      this.isExporting.set(false);
    }
  }
}
