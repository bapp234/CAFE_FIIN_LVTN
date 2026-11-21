import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { LucideDownload, LucideRotateCcw } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { AdminComboBoxComponent, ComboOption } from '../../../components/admin_combo_box/admin_combo_box';
import { AdminGridTableComponent, GridColumn, GridRow } from '../../../components/admin_grid_table/admin_grid_table';
import { AdminToastService } from '../../../shared/services/admin_toast_service';

type ReportTab = 'revenue' | 'profit' | 'products';

@Component({
  selector: 'app-erp-reports',
  standalone: true,
  imports: [CommonModule, LucideDownload, LucideRotateCcw, AdminComboBoxComponent, AdminButtonComponent, AdminGridTableComponent],
  templateUrl: './erp_reports.html',
  styleUrl: './erp_reports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpReports implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/reports';
  private readonly excelUrl = 'http://localhost:5107/api/v1/hrm/excel/export-standard';

  private readonly now = new Date();
  readonly activeTab = signal<ReportTab>('revenue');
  readonly selectedYear = signal(String(this.now.getFullYear()));
  readonly isLoading = signal(false);

  readonly revenueRows = signal<GridRow[]>([]);
  readonly productRows = signal<GridRow[]>([]);

  readonly yearOptions: ComboOption[] = [
    { value: String(this.now.getFullYear() - 1), label: `Năm ${this.now.getFullYear() - 1}` },
    { value: String(this.now.getFullYear()), label: `Năm ${this.now.getFullYear()}` },
    { value: String(this.now.getFullYear() + 1), label: `Năm ${this.now.getFullYear() + 1}` },
  ];

  readonly revenueColumns: GridColumn[] = [
    { key: 'month', label: 'Tháng', type: 'code', width: '90px' },
    { key: 'orderCount', label: 'Số đơn hàng', type: 'number', align: 'right', width: '130px' },
    { key: 'grossRevenue', label: 'Doanh thu gộp', type: 'currency', align: 'right', width: '160px' },
    { key: 'discountTotal', label: 'Giảm giá / Voucher', type: 'currency', align: 'right', width: '160px' },
    { key: 'netRevenue', label: 'Doanh thu thuần', type: 'currency', align: 'right', width: '160px', bold: true },
  ];

  readonly productColumns: GridColumn[] = [
    { key: 'productCode', label: 'Mã món', type: 'code', width: '125px' },
    { key: 'productName', label: 'Tên món đồ uống / bánh', minWidth: '220px', bold: true },
    { key: 'categoryName', label: 'Danh mục', width: '170px' },
    { key: 'totalQty', label: 'Số lượng bán', type: 'number', align: 'right', width: '130px' },
    { key: 'totalRevenue', label: 'Doanh thu món', type: 'currency', align: 'right', width: '160px', bold: true },
  ];

  ngOnInit(): void {
    void this.loadData();
  }

  setTab(tab: ReportTab): void {
    this.activeTab.set(tab);
    void this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      const params = new HttpParams().set('year', this.selectedYear());
      if (this.activeTab() === 'products') {
        const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(`${this.apiUrl}/products`, { params, withCredentials: true }));
        this.productRows.set(res.data ?? []);
      } else {
        const res = await firstValueFrom(this.http.get<{ data?: GridRow[] }>(`${this.apiUrl}/revenue`, { params, withCredentials: true }));
        this.revenueRows.set(res.data ?? []);
      }
    } catch {
      this.toast.error('Không thể tải báo cáo doanh thu.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async exportExcel(): Promise<void> {
    const isProducts = this.activeTab() === 'products';
    const data = isProducts ? this.productRows() : this.revenueRows();
    if (data.length === 0) return;

    const headers = isProducts
      ? ['Mã món', 'Tên món', 'Danh mục', 'Số lượng bán', 'Doanh thu món']
      : ['Tháng', 'Số đơn hàng', 'Doanh thu gộp', 'Giảm giá', 'Doanh thu thuần'];

    const exportRows = isProducts
      ? data.map((r) => ({
          'Mã món': r['productCode'],
          'Tên món': r['productName'],
          'Danh mục': r['categoryName'],
          'Số lượng bán': r['totalQty'],
          'Doanh thu món': r['totalRevenue'],
        }))
      : data.map((r) => ({
          'Tháng': r['month'],
          'Số đơn hàng': r['orderCount'],
          'Doanh thu gộp': r['grossRevenue'],
          'Giảm giá': r['discountTotal'],
          'Doanh thu thuần': r['netRevenue'],
        }));

    const blob = await firstValueFrom(
      this.http.post(
        this.excelUrl,
        {
          templateKey: isProducts ? 'ERP_Product_Revenue' : 'ERP_Revenue',
          sheetName: 'Báo cáo',
          reportTitle: isProducts ? 'BÁO CÁO DOANH THU THEO MÓN' : 'BÁO CÁO DOANH THU BÁN HÀNG',
          summaryLabel: 'Tổng dòng:',
          fileName: `BaoCao_ERP_${this.selectedYear()}.xlsx`,
          headers,
          rows: exportRows,
        },
        { responseType: 'blob', withCredentials: true },
      ),
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BaoCao_ERP_${this.selectedYear()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
