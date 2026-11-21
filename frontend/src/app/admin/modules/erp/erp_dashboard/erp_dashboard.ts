import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  LucideAlertTriangle,
  LucideClock,
  LucidePieChart,
  LucideRotateCcw,
  LucideTrendingUp,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../components/admin_combo_box/admin_combo_box';
import { AdminStatCard } from '../../../shared/admin_stat_card/admin_stat_card';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminToastService } from '../../../shared/services/admin_toast_service';
import { ErpDashboardStats, InventoryItem, MonthlyRevenueReport } from '../models/erp_models';

interface ApiResponseDto<T> {
  success: boolean;
  data?: T;
}

interface ErpDashboardSummaryDto {
  stats: ErpDashboardStats;
  lowStockItems: InventoryItem[];
  monthlyReports: MonthlyRevenueReport[];
}

export interface ErpTrendPoint {
  month: number;
  label: string;
  revenue: number;
  orderCount: number;
  x: number;
  y: number;
}

export interface ErpDonutSegment {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

@Component({
  selector: 'app-erp-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    LucideAlertTriangle,
    LucideClock,
    LucidePieChart,
    LucideRotateCcw,
    LucideTrendingUp,
    AdminButtonComponent,
    AdminComboBoxComponent,
    AdminStatCard,
  ],
  templateUrl: './erp_dashboard.html',
  styleUrl: './erp_dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ErpDashboard implements OnInit {
  readonly branchService = inject(AdminBranchService);
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/erp/dashboard/summary';

  private readonly now = new Date();
  readonly selectedMonth = signal(this.now.getMonth() + 1);
  readonly selectedYear = signal(String(this.now.getFullYear()));
  readonly isLoading = signal(false);

  readonly stats = signal<ErpDashboardStats>({
    totalInventoryValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalSkuCount: 0,
    monthlyPurchaseTotal: 0,
    pendingPoCount: 0,
    totalSupplierDebt: 0,
    monthlyGrossRevenue: 0,
  });
  readonly lowStockItems = signal<InventoryItem[]>([]);
  readonly monthlyReports = signal<MonthlyRevenueReport[]>([]);

  readonly branchOptions = computed<ComboOption[]>(() =>
    this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  );

  readonly monthOptions: ComboOption[] = Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Tháng ${i + 1}`,
  }));

  readonly yearOptions: ComboOption[] = [
    { value: String(this.now.getFullYear() - 1), label: `Năm ${this.now.getFullYear() - 1}` },
    { value: String(this.now.getFullYear()), label: `Năm ${this.now.getFullYear()}` },
    { value: String(this.now.getFullYear() + 1), label: `Năm ${this.now.getFullYear() + 1}` },
  ];

  readonly selectedMonthString = computed(() => String(this.selectedMonth()));

  readonly trendPoints = computed<ErpTrendPoint[]>(() => {
    const raw = this.monthlyReports();
    const map = new Map<number, MonthlyRevenueReport>();
    for (const item of raw) {
      const m = Number(String(item.month).replace(/^T/i, '').split('/')[0]);
      if (m >= 1 && m <= 12) map.set(m, item);
    }

    const maxRev = Math.max(100000, ...raw.map((r) => r.revenue ?? 0));
    const width = 560;
    const padLeft = 36;
    const padRight = 16;
    const padTop = 16;
    const plotW = width - padLeft - padRight;
    const plotH = 128;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const item = map.get(m);
      const revenue = item?.revenue ?? 0;
      const x = padLeft + (i * plotW) / 11;
      const y = padTop + plotH - (revenue / maxRev) * plotH;
      return {
        month: m,
        label: `T${m}`,
        revenue,
        orderCount: item?.orderCount ?? 0,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    });
  });

  readonly linePath = computed(() => {
    const pts = this.trendPoints();
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  });

  readonly areaPath = computed(() => {
    const pts = this.trendPoints();
    if (pts.length === 0) return '';
    return `${this.linePath()} L ${pts[pts.length - 1].x} 144 L ${pts[0].x} 144 Z`;
  });

  readonly stockSegments = computed<ErpDonutSegment[]>(() => {
    const s = this.stats();
    const inStock = Math.max(0, s.totalSkuCount - s.lowStockCount - s.outOfStockCount);
    const items = [
      { id: 'in_stock', label: 'Đủ hàng', count: inStock, color: 'var(--color-xanh-dam)' },
      { id: 'low_stock', label: 'Sắp hết', count: s.lowStockCount, color: 'var(--color-vang-chanh)' },
      { id: 'out_of_stock', label: 'Hết hàng', count: s.outOfStockCount, color: 'var(--color-do)' },
    ].filter((i) => i.count > 0);

    const total = items.reduce((sum, i) => sum + i.count, 0);
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 52;
    let offset = 0;
    return items.map((d) => {
      const len = (d.count / total) * circumference;
      const seg: ErpDonutSegment = {
        ...d,
        percentage: Math.round((d.count / total) * 100),
        dashArray: `${len.toFixed(1)} ${(circumference - len).toFixed(1)}`,
        dashOffset: -offset,
      };
      offset += len;
      return seg;
    });
  });

  ngOnInit(): void {
    void this.loadData();
  }

  onBranchChange(val: string): void {
    this.branchService.selectBranch(val);
    void this.loadData();
  }

  onMonthChange(val: string): void {
    this.selectedMonth.set(Number(val) || 1);
    void this.loadData();
  }

  onYearChange(val: string): void {
    this.selectedYear.set(val);
    void this.loadData();
  }

  async loadData(): Promise<void> {
    this.isLoading.set(true);
    try {
      let params = new HttpParams()
        .set('year', this.selectedYear())
        .set('month', String(this.selectedMonth()));
      const bId = Number(this.branchService.selectedBranchId());
      if (bId > 0) params = params.set('branchId', String(bId));

      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<ErpDashboardSummaryDto>>(this.apiUrl, {
          params,
          withCredentials: true,
        }),
      );
      if (res.data) {
        this.stats.set(res.data.stats ?? this.stats());
        this.lowStockItems.set(res.data.lowStockItems ?? []);
        this.monthlyReports.set(res.data.monthlyReports ?? []);
      }
    } catch {
      this.toast.error('Không thể tải dữ liệu tổng quan ERP.');
    } finally {
      this.isLoading.set(false);
    }
  }

  formatCurrency(val: number | undefined): string {
    return (val ?? 0).toLocaleString('vi-VN') + ' ₫';
  }
}
