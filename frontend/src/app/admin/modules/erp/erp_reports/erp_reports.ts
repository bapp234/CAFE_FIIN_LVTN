import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideArrowUpRight,
  LucideBarChart3,
  LucideCalendar,
  LucideDollarSign,
  LucidePercent,
  LucidePieChart,
  LucideRotateCcw,
  LucideTrendingUp,
} from '@lucide/angular';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { ErpApi } from '../services/erp_api';
import { MonthlyRevenueReport, ProductCategoryRevenue } from '../models/erp_models';

@Component({
  selector: 'app-erp-reports',
  standalone: true,
  imports: [
    CommonModule,
    LucideArrowUpRight,
    LucideBarChart3,
    LucideCalendar,
    LucideDollarSign,
    LucidePercent,
    LucidePieChart,
    LucideRotateCcw,
    LucideTrendingUp,
    AdminButtonComponent,
  ],
  templateUrl: './erp_reports.html',
  styleUrl: './erp_reports.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpReports {
  readonly branchService = inject(AdminBranchService);
  private readonly erpApi = inject(ErpApi);

  readonly isLoading = signal(false);
  readonly monthlyReports = signal<MonthlyRevenueReport[]>([]);
  readonly categoryRevenues = signal<ProductCategoryRevenue[]>([]);

  readonly currentMonth = computed(() => {
    const list = this.monthlyReports();
    return list.length > 0 ? list[list.length - 1] : null;
  });

  readonly grossMarginPercent = computed(() => {
    const cm = this.currentMonth();
    if (!cm || cm.revenue === 0) return 0;
    return Math.round((cm.grossProfit / cm.revenue) * 100);
  });

  readonly totalYearRevenue = computed(() => {
    return this.monthlyReports().reduce((sum, r) => sum + r.revenue, 0);
  });

  readonly totalYearProfit = computed(() => {
    return this.monthlyReports().reduce((sum, r) => sum + r.grossProfit, 0);
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.erpApi.getMonthlyReports().subscribe((reports) => this.monthlyReports.set(reports));
    this.erpApi.getCategoryRevenues().subscribe((cats) => {
      this.categoryRevenues.set(cats);
      this.isLoading.set(false);
    });
  }

  formatCurrency(val: number | undefined): string {
    if (!val && val !== 0) return '0 ₫';
    return val.toLocaleString('vi-VN') + ' ₫';
  }
}
