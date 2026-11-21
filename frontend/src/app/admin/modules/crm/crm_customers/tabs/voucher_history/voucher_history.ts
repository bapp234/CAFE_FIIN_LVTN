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
  selector: 'app-voucher-history',
  templateUrl: './voucher_history.html',
  styleUrl: './voucher_history.css',
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
export class VoucherHistoryTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/customers/voucher-history';

  readonly searchQuery = signal('');
  readonly sortOrder = signal('newest');
  readonly statusFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'Available', label: 'Chưa dùng' },
    { value: 'Used', label: 'Đã sử dụng' },
    { value: 'Expired', label: 'Hết hạn' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'customerVoucherId', label: 'Mã ví', type: 'code', width: '90px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '180px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '130px', mono: true },
    { key: 'voucherCode', label: 'Mã Voucher', type: 'code', width: '130px' },
    { key: 'voucherName', label: 'Tên chương trình', minWidth: '200px' },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        Available: { label: 'Chưa dùng', variant: 'info' },
        Used: { label: 'Đã sử dụng', variant: 'success' },
        Expired: { label: 'Hết hạn', variant: 'neutral' },
      },
    },
    { key: 'redeemedAt', label: 'Ngày nhận/đổi', type: 'datetime', width: '150px', align: 'center' },
    { key: 'usedAt', label: 'Ngày sử dụng', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams().set('sortOrder', this.sortOrder());
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.statusFilter()) params = params.set('statusFilter', this.statusFilter());

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, { params, withCredentials: true }),
      );
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải lịch sử Voucher.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
