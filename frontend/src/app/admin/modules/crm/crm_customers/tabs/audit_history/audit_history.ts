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
  selector: 'app-audit-history',
  templateUrl: './audit_history.html',
  styleUrl: './audit_history.css',
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
export class AuditHistoryTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/customers/audit-logs';

  readonly searchQuery = signal('');
  readonly sortOrder = signal('newest');
  readonly actionFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly sortOptions: ComboOption[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'oldest', label: 'Cũ nhất' },
  ];

  readonly actionOptions: ComboOption[] = [
    { value: '', label: 'Tất cả loại thay đổi' },
    { value: 'ProfileUpdate', label: 'Sửa thông tin' },
    { value: 'AddressUpdate', label: 'Đổi địa chỉ' },
    { value: 'PasswordChange', label: 'Đổi mật khẩu' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'auditId', label: 'Mã log', type: 'code', width: '90px' },
    { key: 'customerName', label: 'Khách hàng', minWidth: '180px', bold: true },
    { key: 'phoneNumber', label: 'Số điện thoại', width: '130px', mono: true },
    {
      key: 'actionType',
      label: 'Loại thay đổi',
      type: 'badge',
      width: '140px',
      align: 'center',
      badgeMap: {
        ProfileUpdate: { label: 'Sửa thông tin', variant: 'info' },
        AddressUpdate: { label: 'Đổi địa chỉ', variant: 'warning' },
        PasswordChange: { label: 'Đổi mật khẩu', variant: 'neutral' },
      },
    },
    { key: 'fieldChanged', label: 'Trường dữ liệu', width: '140px' },
    { key: 'oldValue', label: 'Giá trị cũ', minWidth: '180px', tone: 'muted' },
    { key: 'newValue', label: 'Giá trị mới', minWidth: '180px' },
    { key: 'changedAt', label: 'Thời gian', type: 'datetime', width: '155px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams().set('sortOrder', this.sortOrder());
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      if (this.actionFilter()) params = params.set('actionFilter', this.actionFilter());

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<GridRow[]>>(this.apiUrl, { params, withCredentials: true }),
      );
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải lịch sử chỉnh sửa khách hàng.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
