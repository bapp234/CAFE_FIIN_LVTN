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
  selector: 'app-abandoned-carts',
  templateUrl: './abandoned_carts.html',
  styleUrl: './abandoned_carts.css',
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
export class AbandonedCartsTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/orders/abandoned-carts';

  readonly searchQuery = signal('');
  readonly sortOrder = signal('newest');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'cartItemId', label: 'Mã mục', type: 'code', width: '90px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '180px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '130px', mono: true },
    { key: 'productName', label: 'Món đang chọn', minWidth: '200px' },
    { key: 'variantName', label: 'Size / Biến thể', width: '120px' },
    { key: 'quantity', label: 'Số lượng', type: 'number', align: 'center', width: '95px' },
    { key: 'notes', label: 'Ghi chú', minWidth: '180px', tone: 'muted' },
    { key: 'updatedAt', label: 'Cập nhật lúc', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams().set('sortOrder', this.sortOrder());
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, { params, withCredentials: true }),
      );
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải danh sách giỏ hàng đang chọn.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
