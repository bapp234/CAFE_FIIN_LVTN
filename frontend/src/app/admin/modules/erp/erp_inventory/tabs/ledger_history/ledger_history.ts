import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideDownload, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-ledger-history',
  templateUrl: './ledger_history.html',
  styleUrl: './ledger_history.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideDownload, LucideRotateCcw, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class LedgerHistoryTab implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/inventory/transactions';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly txTypeFilter = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly txOptions: ComboOption[] = [
    { value: '', label: 'Tất cả loại giao dịch' },
    { value: 'StockIn', label: 'Nhập kho (StockIn)' },
    { value: 'OrderDeduct', label: 'Trừ theo đơn (OrderDeduct)' },
    { value: 'WasteLoss', label: 'Hao hụt / Hủy (WasteLoss)' },
    { value: 'Adjustment', label: 'Kiểm kê (Adjustment)' },
  ];

  readonly columns: GridColumn[] = [
    { key: 'transactionId', label: 'Mã GD', type: 'code', width: '90px' },
    { key: 'branchName', label: 'Kho / Chi nhánh', width: '160px', bold: true },
    { key: 'ingredientName', label: 'Nguyên vật liệu', minWidth: '180px' },
    {
      key: 'transactionType',
      label: 'Loại GD',
      type: 'badge',
      width: '130px',
      align: 'center',
      badgeMap: {
        StockIn: { label: 'Nhập kho', variant: 'success' },
        OrderDeduct: { label: 'Trừ đơn', variant: 'info' },
        WasteLoss: { label: 'Hao hụt', variant: 'danger' },
        Adjustment: { label: 'Kiểm kê', variant: 'warning' },
      },
    },
    { key: 'quantity', label: 'Số lượng', type: 'number', align: 'right', width: '110px' },
    { key: 'balanceAfter', label: 'Tồn sau GD', type: 'number', align: 'right', width: '110px' },
    { key: 'notes', label: 'Ghi chú', minWidth: '180px' },
    { key: 'createdAt', label: 'Thời gian', type: 'datetime', width: '150px', align: 'center' },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams();
      if (this.txTypeFilter()) params = params.set('txType', this.txTypeFilter());
      const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải sổ cái kho.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    const headers = ['Mã GD', 'Kho / Chi nhánh', 'Nguyên vật liệu', 'Loại GD', 'Số lượng', 'Tồn sau GD', 'Thời gian'];
    const exportRows = data.map((r) => ({
      'Mã GD': r['transactionId'],
      'Kho / Chi nhánh': r['branchName'],
      'Nguyên vật liệu': r['ingredientName'],
      'Loại GD': r['transactionType'],
      'Số lượng': r['quantity'],
      'Tồn sau GD': r['balanceAfter'],
      'Thời gian': r['createdAt'] ? String(r['createdAt']).replace('T', ' ').slice(0, 19) : '',
    }));
    const blob = await firstValueFrom(
      this.http.post(
        this.excelUrl,
        { templateKey: 'ERP_Ledger', sheetName: 'Sổ cái kho', reportTitle: 'SỔ CÁI NHẬP XUẤT TỒN KHO FIIN COFFEE', summaryLabel: 'Tổng giao dịch:', fileName: 'SoCaiKho_Fiin.xlsx', headers, rows: exportRows },
        { responseType: 'blob', withCredentials: true },
      ),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SoCaiKho_Fiin.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
