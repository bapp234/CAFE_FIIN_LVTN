import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideCheck, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-disposal-reviews',
  templateUrl: './disposal_reviews.html',
  styleUrl: './disposal_reviews.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideCheck, LucideRotateCcw, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class DisposalReviewsTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/disposal-reviews';

  readonly statusFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly statusOptions: ComboOption[] = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'PendingManagerReview', label: 'Chờ duyệt' },
    { value: 'Reviewed', label: 'Đã duyệt' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'orderCode', label: 'Mã đơn', type: 'code', width: '130px' },
    { key: 'totalAmount', label: 'Giá trị đơn', type: 'currency', align: 'right', width: '125px' },
    { key: 'cancelReason', label: 'Lý do hủy / trả', minWidth: '180px' },
    {
      key: 'reviewStatus',
      label: 'Trạng thái',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        PendingManagerReview: { label: 'Chờ duyệt', variant: 'warning' },
        Reviewed: { label: 'Đã duyệt', variant: 'success' },
      },
    },
    { key: 'situationType', label: 'Hướng xử lý', width: '140px' },
    { key: 'managerDecisionNotes', label: 'Ghi chú quản lý', minWidth: '190px' },
    { key: 'reviewedAt', label: 'Ngày duyệt', type: 'datetime', width: '150px', align: 'center' },
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
    } finally {
      this.isLoading.set(false);
    }
  }

  async approve(row: GridRow): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/approve`, {
          reviewId: row['reviewId'],
          situationType: 'WasteLoss',
          managerDecisionNotes: 'Quản lý đã xác nhận ghi nhận hao hụt sau pha chế.',
        }, { withCredentials: true }),
      );
      this.toast.success('Đã duyệt xử lý đơn trả/hủy.');
      await this.refreshTab();
    } catch {
      this.toast.error('Duyệt thất bại.');
    }
  }
}
