import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideDownload, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../../../components/admin_grid_table/admin_grid_table';
import { AdminSearchBoxComponent } from '../../../../../components/admin_search_box/admin_search_box';
import { AdminBranchService } from '../../../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../../../shared/services/admin_toast_service';

@Component({
  selector: 'app-branch-stock',
  templateUrl: './branch_stock.html',
  styleUrl: './branch_stock.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [LucideDownload, LucideRotateCcw, AdminSearchBoxComponent, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
})
export class BranchStockTab implements OnInit {
  readonly branchService = inject(AdminBranchService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/branch/inventory';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  readonly searchQuery = signal('');
  readonly rows = signal<GridRow[]>([]);
  readonly isLoading = signal(false);

  readonly branchOptions = computed<ComboOption[]>(() =>
    this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  );

  readonly columns: GridColumn[] = [
    { key: 'ingredientCode', label: 'Mã VT', type: 'code', width: '115px' },
    { key: 'ingredientName', label: 'Tên nguyên liệu / vật tư', minWidth: '210px', bold: true },
    { key: 'categoryGroup', label: 'Nhóm', width: '125px' },
    { key: 'unit', label: 'ĐVT', width: '85px', align: 'center' },
    { key: 'currentStock', label: 'Tồn Chi nhánh', type: 'number', align: 'right', width: '130px', bold: true },
    { key: 'reorderLevel', label: 'Định mức tối thiểu', type: 'number', align: 'right', width: '140px' },
    {
      key: 'status',
      label: 'Tình trạng',
      type: 'badge',
      width: '125px',
      align: 'center',
      badgeMap: {
        in_stock: { label: 'Đủ hàng', variant: 'success' },
        low_stock: { label: 'Sắp hết', variant: 'warning' },
        out_of_stock: { label: 'Hết hàng', variant: 'danger' },
      },
    },
  ];

  ngOnInit(): void {
    void this.refreshTab();
  }

  onBranchChange(val: string): void {
    this.branchService.selectBranch(val);
    void this.refreshTab();
  }

  async refreshTab(): Promise<void> {
    this.isLoading.set(true);
    try {
      const bId = Number(this.branchService.selectedBranchId()) || 1;
      let params = new HttpParams().set('branchId', String(bId));
      if (this.searchQuery().trim()) params = params.set('search', this.searchQuery().trim());
      const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(this.apiUrl, { params, withCredentials: true }));
      this.rows.set(res.data ?? []);
    } catch {
      this.toast.error('Không thể tải tồn kho chi nhánh.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const data = this.rows();
    if (data.length === 0) return;
    const headers = ['Mã VT', 'Tên vật tư', 'Nhóm', 'ĐVT', 'Tồn Chi nhánh', 'Định mức', 'Tình trạng'];
    const exportRows = data.map((r) => ({
      'Mã VT': r['ingredientCode'],
      'Tên vật tư': r['ingredientName'],
      'Nhóm': r['categoryGroup'],
      'ĐVT': r['unit'],
      'Tồn Chi nhánh': r['currentStock'],
      'Định mức': r['reorderLevel'],
      'Tình trạng': r['status'],
    }));
    const blob = await firstValueFrom(
      this.http.post(
        this.excelUrl,
        { templateKey: 'ERP_Branch_Stock', sheetName: 'Tồn chi nhánh', reportTitle: 'BÁO CÁO TỒN KHO CHI NHÁNH FIIN COFFEE', summaryLabel: 'Tổng vật tư:', fileName: 'TonKhoChiNhanh_Fiin.xlsx', headers, rows: exportRows },
        { responseType: 'blob', withCredentials: true },
      ),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TonKhoChiNhanh_Fiin.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  }
}
