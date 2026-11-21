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
  message?: string;
  data?: T;
}

interface FilterOptionsResponse {
  tiers: ComboOption[];
  segments: ComboOption[];
  joinOrders: ComboOption[];
  provinces: ComboOption[];
}

@Component({
  selector: 'app-customer-list',
  templateUrl: './customer_list.html',
  styleUrl: './customer_list.css',
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
export class CustomerListTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/customers';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly tierFilter = signal('');
  readonly joinOrderFilter = signal('newest');
  readonly segmentFilter = signal('');
  readonly provinceFilter = signal('');

  readonly tierOptions = signal<ComboOption[]>([]);
  readonly segmentOptions = signal<ComboOption[]>([]);
  readonly joinOrderOptions = signal<ComboOption[]>([]);
  readonly provinceOptions = signal<ComboOption[]>([]);

  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);
  readonly isExporting = signal(false);

  readonly columns: GridColumn[] = [
    { key: 'customerCode', label: 'Mã KH', type: 'code', width: '125px' },
    { key: 'fullName', label: 'Họ tên khách hàng', minWidth: '180px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '130px', mono: true },
    { key: 'email', label: 'Email', minWidth: '190px' },
    {
      key: 'membershipTier',
      label: 'Hạng',
      type: 'badge',
      width: '135px',
      align: 'center',
      badgeMap: {
        Standard: { label: 'Đồng Điệu', variant: 'neutral' },
        Silver: { label: 'Hạng Bạc', variant: 'info' },
        Gold: { label: 'Hạng Vàng', variant: 'warning' },
        VIP: { label: 'Thượng Khách', variant: 'success' },
      },
    },
    { key: 'loyaltyPoints', label: 'Điểm Fiin', type: 'number', align: 'right', width: '110px' },
    { key: 'totalOrders', label: 'Số đơn', type: 'number', align: 'right', width: '95px' },
    { key: 'totalSpent', label: 'Tổng chi tiêu', type: 'currency', align: 'right', width: '140px' },
    { key: 'defaultAddress', label: 'Địa chỉ mặc định', minWidth: '240px' },
    { key: 'createdAt', label: 'Ngày tham gia', type: 'date', width: '125px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.loadFilterOptions();
    void this.refreshTab();
  }

  async loadFilterOptions(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<FilterOptionsResponse>>(`${this.apiUrl}/filter-options`, {
          withCredentials: true,
        }),
      );
      const data = res.data;
      if (data) {
        this.tierOptions.set(data.tiers ?? []);
        this.segmentOptions.set(data.segments ?? []);
        this.joinOrderOptions.set(data.joinOrders ?? []);
        this.provinceOptions.set(data.provinces ?? []);
      }
    } catch {
      this.toast.error('Không thể tải danh mục bộ lọc khách hàng.');
    }
  }

  onFilterChange(): void {
    void this.refreshTab();
  }

  private buildParams(offset: number, limit: number): HttpParams {
    let params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', String(limit))
      .set('joinOrder', this.joinOrderFilter() || 'newest');

    if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
    if (this.tierFilter()) params = params.set('tier', this.tierFilter());
    if (this.segmentFilter()) params = params.set('segment', this.segmentFilter());
    if (this.provinceFilter()) params = params.set('provinceId', this.provinceFilter());
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
      this.toast.error('Không thể tải danh sách khách hàng.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async loadMore(): Promise<void> {
    if (this.loadingMore() || !this.hasMore() || this.isLoading()) return;
    this.loadingMore.set(true);
    try {
      const currentCount = this.rows().length;
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, {
          params: this.buildParams(currentCount, 10),
          withCredentials: true,
        }),
      );
      const next = res.data ?? [];
      this.rows.update((list) => [...list, ...next]);
      this.hasMore.set(next.length === 10);
    } catch {
      this.toast.error('Không thể tải thêm khách hàng.');
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
      const headers = [
        'Mã KH',
        'Họ tên khách hàng',
        'Số điện thoại',
        'Email',
        'Hạng',
        'Điểm Fiin',
        'Số đơn',
        'Tổng chi tiêu',
        'Địa chỉ mặc định',
        'Ngày tham gia',
      ];
      const tierLabelMap: Record<string, string> = {
        Standard: 'Đồng Điệu',
        Silver: 'Hạng Bạc',
        Gold: 'Hạng Vàng',
        VIP: 'Thượng Khách',
      };

      const exportRows = data.map((r) => ({
        'Mã KH': r['customerCode'] || r['customerId'],
        'Họ tên khách hàng': r['fullName'] ?? '',
        'Số điện thoại': r['phoneNumber'] ?? '',
        Email: r['email'] ?? '',
        'Hạng': tierLabelMap[String(r['membershipTier'] ?? '')] ?? r['membershipTier'] ?? '',
        'Điểm Fiin': Number(r['loyaltyPoints'] ?? 0),
        'Số đơn': Number(r['totalOrders'] ?? 0),
        'Tổng chi tiêu': Number(r['totalSpent'] ?? 0),
        'Địa chỉ mặc định': r['defaultAddress'] ?? '',
        'Ngày tham gia': r['createdAt'] ? String(r['createdAt']).slice(0, 10) : '',
      }));

      const blob = await firstValueFrom(
        this.http.post(
          this.excelUrl,
          {
            templateKey: 'CRM_Customers',
            sheetName: 'Khách hàng',
            reportTitle: 'BÁO CÁO DANH SÁCH KHÁCH HÀNG FIIN COFFEE',
            summaryLabel: 'Tổng số khách hàng:',
            fileName: `BaoCao_KhachHang_${new Date().toISOString().slice(0, 10)}.xlsx`,
            headers,
            rows: exportRows,
          },
          { responseType: 'blob', withCredentials: true },
        ),
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `BaoCao_KhachHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      this.toast.success(`Đã xuất báo cáo Excel (${data.length} khách hàng).`);
    } catch {
      this.toast.error('Xuất báo cáo Excel thất bại.');
    } finally {
      this.isExporting.set(false);
    }
  }
}
