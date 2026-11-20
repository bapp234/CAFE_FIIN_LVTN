import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideArrowRight,
  LucideBuilding,
  LucideDollarSign,
  LucidePackage,
  LucideRotateCcw,
  LucideShoppingCart,
  LucideTruck,
  LucideWarehouse,
} from '@lucide/angular';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import { ErpApi } from '../services/erp_api';
import {
  ErpDashboardStats,
  InventoryItem,
  MonthlyRevenueReport,
  PurchaseOrder,
} from '../models/erp_models';

@Component({
  selector: 'app-erp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAlertTriangle,
    LucideArrowRight,
    LucideBuilding,
    LucideDollarSign,
    LucidePackage,
    LucideRotateCcw,
    LucideShoppingCart,
    LucideTruck,
    LucideWarehouse,
    AdminButtonComponent,
  ],
  templateUrl: './erp_dashboard.html',
  styleUrl: './erp_dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDashboard {
  readonly branchService = inject(AdminBranchService);
  private readonly erpApi = inject(ErpApi);

  readonly isLoading = signal(false);
  readonly stats = signal<ErpDashboardStats | null>(null);
  readonly inventoryItems = signal<InventoryItem[]>([]);
  readonly purchaseOrders = signal<PurchaseOrder[]>([]);
  readonly monthlyReports = signal<MonthlyRevenueReport[]>([]);

  readonly lowStockItems = computed(() => {
    return this.inventoryItems().filter((i) => i.status === 'low_stock' || i.status === 'out_of_stock');
  });

  readonly recentPos = computed(() => {
    return this.purchaseOrders().slice(0, 4);
  });

  constructor() {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);

    this.erpApi.getDashboardStats().subscribe((s) => this.stats.set(s));
    this.erpApi.getInventoryItems().subscribe((items) => this.inventoryItems.set(items));
    this.erpApi.getPurchaseOrders().subscribe((pos) => this.purchaseOrders.set(pos));
    this.erpApi.getMonthlyReports().subscribe((reports) => {
      this.monthlyReports.set(reports);
      this.isLoading.set(false);
    });
  }

  formatCurrency(val: number | undefined): string {
    if (!val && val !== 0) return '0 ₫';
    return val.toLocaleString('vi-VN') + ' ₫';
  }
}
