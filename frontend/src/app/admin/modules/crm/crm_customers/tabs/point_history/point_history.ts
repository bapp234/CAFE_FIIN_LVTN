import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideRotateCcw } from '@lucide/angular';
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
  selector: 'app-point-history',
  templateUrl: './point_history.html',
  styleUrl: './point_history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    LucideRotateCcw,
    AdminSearchBoxComponent,
    AdminComboBoxComponent,
    AdminButtonComponent,
    AdminGridTableComponent,
  ],
})
export class PointHistoryTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/customers/point-transactions';

  readonly searchQuery = signal('');
  readonly sortOrder = signal('newest');
  readonly balanceFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly balanceOptions: ComboOption[] = [
    { value: '', label: 'Tất cả biến động & số dư' },
    { value: 'earn', label: 'Cộng điểm (+)' },
    { value: 'redeem', label: 'Tiêu / Trừ điểm (-)' },
    { value: 'positive', label: 'Số dư sau GD > 0' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'pointTxId', label: 'Mã GD', type: 'code', width: '90px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '180px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '130px', mono: true },
    {
      key: 'transactionType',
      label: 'Loại giao dịch',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
        Earn: { label: 'Cộng điểm', variant: 'success' },
        Redeem: { label: 'Đổi / Tiêu điểm', variant: 'warning' },
        Adjust: { label: 'Điều chỉnh', variant: 'info' },
        Expire: { label: 'Hết hạn', variant: 'neutral' },
      },
    },
    { key: 'points', label: 'Điểm biến động', type: 'number', align: 'right', width: '130px' },
    { key: 'balanceAfter', label: 'Số dư sau GD', type: 'number', align: 'right', width: '130px' },
    { key: 'description', label: 'Diễn giải', minWidth: '220px' },
    { key: 'createdAt', label: 'Thời gian', type: 'datetime', width: '155px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams().set('sortOrder', this.sortOrder());
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.balanceFilter()) params = params.set('balanceFilter', this.balanceFilter());

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, { params, withCredentials: true }),
      );
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải lịch sử Điểm Fiin.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
