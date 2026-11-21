import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideCheck, LucidePlus, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-branch-requests',
  templateUrl: './branch_requests.html',
  styleUrl: './branch_requests.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [FormsModule, LucideCheck, LucidePlus, LucideRotateCcw, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class BranchRequestsTab implements OnInit {
  readonly branchService = inject(AdminBranchService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp';

  readonly rows = signal<GridRow[]>([]);
  readonly ingredients = signal<{ ingredientId: number; ingredientName: string; unit: string }[]>([]);
  readonly isLoading = signal(false);
  readonly isFormOpen = signal(false);

  reqIngredientId = 0;
  reqQty = 10;
  reqNotes = '';

  readonly branchOptions = computed<ComboOption[]>(() =>
    this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  );

  readonly columns: GridColumn[] = [
    { key: 'transferCode', label: 'Mã phiếu', type: 'code', width: '140px' },
    { key: 'toBranchName', label: 'Chi nhánh', width: '170px', bold: true },
    {
      key: 'transferType',
      label: 'Loại',
      type: 'badge',
      width: '120px',
      align: 'center',
      badgeMap: { Periodic: { label: 'Định kỳ', variant: 'info' }, ExtraRequest: { label: 'Xin thêm', variant: 'warning' } },
    },
    { key: 'summaryItem', label: 'Vật tư yêu cầu', minWidth: '210px' },
    {
      key: 'status',
      label: 'Trạng thái',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        Requested: { label: 'Chờ duyệt', variant: 'warning' },
        Approved: { label: 'Đang giao', variant: 'info' },
        Received: { label: 'Đã nhận', variant: 'success' },
        Rejected: { label: 'Từ chối', variant: 'danger' },
      },
    },
    { key: 'createdAt', label: 'Ngày gửi', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.loadIngredients();
    void this.refreshTab();
  }

  async loadIngredients(): Promise<void> {
    try {
      const res = await firstValueFrom(this.http.get<{ data?: { ingredientId: number; ingredientName: string; unit: string }[] }>(`${this.apiUrl}/inventory/central`, { withCredentials: true }));
      const list = res.data ?? [];
      this.ingredients.set(list);
      if (list.length > 0 && !this.reqIngredientId) this.reqIngredientId = list[0].ingredientId;
    } catch { /* ignore */ }
  }

  onBranchChange(val: string): void {
    this.branchService.selectBranch(val);
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      const bId = Number(this.branchService.selectedBranchId()) || 1;
      const params = new HttpParams().set('branchId', String(bId));
      const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(`${this.apiUrl}/transfers`, { params, withCredentials: true }));
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải đơn xin nhập kho.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async submitRequest(): Promise<void> {
    const bId = Number(this.branchService.selectedBranchId()) || 1;
    if (!this.reqIngredientId || this.reqQty <= 0) {
      this.toast.error('Vui lòng chọn vật tư và số lượng > 0.');
      return;
    }
    try {
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/branch/transfer-requests`, {
          toBranchId: bId,
          ingredientId: Number(this.reqIngredientId),
          requestedQty: Number(this.reqQty),
          notes: this.reqNotes.trim() || null,
        }, { withCredentials: true }),
      );
      this.toast.success('Đã gửi đơn xin nhập kho lên Kho Tổng.');
      this.isFormOpen.set(false);
      this.reqNotes = '';
      await this.refreshTab();
    } catch {
      this.toast.error('Gửi đơn xin thất bại.');
    }
  }

  async confirmReceived(row: GridRow): Promise<void> {
    try {
      await firstValueFrom(this.http.post(`${this.apiUrl}/transfers/${row['transferId']}/receive`, {}, { withCredentials: true }));
      this.toast.success('Đã xác nhận nhận hàng vào kho chi nhánh.');
      await this.refreshTab();
    } catch {
      this.toast.error('Xác nhận nhận hàng thất bại.');
    }
  }
}
