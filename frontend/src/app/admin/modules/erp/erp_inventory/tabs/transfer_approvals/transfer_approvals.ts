import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideCheck, LucideRotateCcw, LucideX } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-transfer-approvals',
  templateUrl: './transfer_approvals.html',
  styleUrl: './transfer_approvals.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideCheck, LucideRotateCcw, LucideX, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class TransferApprovalsTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/transfers';

  readonly statusFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'Requested', label: 'Chờ duyệt' },
    { value: 'Approved', label: 'Đã xuất kho' },
    { value: 'Received', label: 'Đã nhận' },
    { value: 'Rejected', label: 'Từ chối' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'transferCode', label: 'Mã phiếu', type: 'code', width: '140px' },
    { key: 'toBranchName', label: 'Chi nhánh nhận', minWidth: '170px', bold: true },
    {
      key: 'transferType',
      label: 'Loại phiếu',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        Periodic: { label: 'Định kỳ', variant: 'info' },
        ExtraRequest: { label: 'Xin thêm', variant: 'warning' },
      },
    },
    { key: 'summaryItem', label: 'Chi tiết vật tư', minWidth: '210px' },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        Requested: { label: 'Chờ duyệt', variant: 'warning' },
        Approved: { label: 'Đã xuất kho', variant: 'info' },
        Received: { label: 'Đã nhận', variant: 'success' },
        Rejected: { label: 'Từ chối', variant: 'danger' },
      },
    },
    { key: 'createdAt', label: 'Ngày tạo', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.statusFilter()) params = params.set('status', this.statusFilter());
      const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải phiếu điều chuyển.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async approve(row: GridRow): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/${row['transferId']}/approve`, {}, { withCredentials: true }));
      this.toast.success('Đã duyệt xuất kho tổng.');
      await this.refreshTab();
    } catch (err: unknown) {
      this.toast.error((err as { error?: { message?: string } })?.error?.message || 'Duyệt thất bại.');
    }
  }

  async reject(row: GridRow): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/${row['transferId']}/reject`, {}, { withCredentials: true }));
      this.toast.success('Đã từ chối phiếu.');
      await this.refreshTab();
    } catch {
      this.toast.error('Từ chối thất bại.');
    }
  }
}
