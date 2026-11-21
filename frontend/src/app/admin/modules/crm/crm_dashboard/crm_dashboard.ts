import { CommonModule } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { LucideClock, LucidePieChart, LucideRotateCcw, LucideTrendingUp } from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../components/admin_combo_box/admin_combo_box';
import { AdminStatCard } from '../../../shared/admin_stat_card/admin_stat_card';
import { AdminToastService } from '../../../shared/services/admin_toast_service';

interface ApiResponseDto<T> {
  success: boolean;
  data?: T;
}

interface CrmKpiDto {
  totalCustomers: number;
  newCustomersInMonth: number;
  totalFiinPoints: number;
  averageRating: number;
  totalReviews: number;
}

interface MonthlyTrendDto {
  month: number;
  newCustomers: number;
  ordersCount: number;
}

interface TierDistDto {
  membershipTier: string;
  count: number;
}

interface ChannelDistDto {
  orderType: string;
  count: number;
}

interface CrmDashboardSummaryDto {
  kpi: CrmKpiDto;
  monthlyTrend: MonthlyTrendDto[];
  tierDistribution: TierDistDto[];
  channelDistribution: ChannelDistDto[];
}

export interface TrendPoint {
  month: number;
  label: string;
  newCustomers: number;
  ordersCount: number;
  x: number;
  y: number;
}

export interface DonutSegment {
  id: string;
  label: string;
  count: number;
  percentage: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

const TIER_META: Record<string, { label: string; color: string }> = {
  Standard: { label: 'Đồng Điệu', color: 'var(--color-nau-xam)' },
  Silver: { label: 'Hạng Bạc', color: 'var(--color-xanh-duong)' },
  Gold: { label: 'Hạng Vàng', color: 'var(--color-vang-chanh)' },
  VIP: { label: 'Thượng Khách', color: 'var(--color-xanh-dam)' },
};

const CHANNEL_LABELS: Record<string, string> = {
  InStore: 'Tại quầy (InStore)',
  TakeAway: 'Mang đi (TakeAway)',
  OnlinePickUp: 'Online tự lấy',
  OnlineDelivery: 'Online giao hàng',
};

@Component({
  selector: 'app-crm-dashboard',
  templateUrl: './crm_dashboard.html',
  styleUrl: './crm_dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideClock,
    LucidePieChart,
    LucideRotateCcw,
    LucideTrendingUp,
    AdminStatCard,
    AdminButtonComponent,
    AdminComboBoxComponent,
  ],
})
export class CrmDashboard implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(AdminToastService);
  private readonly apiUrl = 'http://localhost:5107/api/v1/crm/dashboard/summary';

  private readonly now = new Date();
  readonly selectedMonth = signal(this.now.getMonth() + 1);
  readonly selectedYear = signal(String(this.now.getFullYear()));
  readonly isLoading = signal(false);

  readonly kpi = signal<CrmKpiDto>({
    totalCustomers: 0,
    newCustomersInMonth: 0,
    totalFiinPoints: 0,
    averageRating: 0,
    totalReviews: 0,
  });
  readonly monthlyTrend = signal<MonthlyTrendDto[]>([]);
  readonly tierDistribution = signal<TierDistDto[]>([]);
  readonly channelDistribution = signal<ChannelDistDto[]>([]);

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

  readonly trendPoints = computed<TrendPoint[]>(() => {
    const raw = this.monthlyTrend();
    const map = new Map<number, MonthlyTrendDto>();
    for (const item of raw) map.set(item.month, item);

    const maxVal = Math.max(
      4,
      ...raw.map((r) => Math.max(r.newCustomers, r.ordersCount)),
    );

    const width = 560;
    const height = 170;
    const padLeft = 36;
    const padRight = 16;
    const padTop = 16;
    const padBottom = 26;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      const item = map.get(m) ?? { month: m, newCustomers: 0, ordersCount: 0 };
      const x = padLeft + (i * plotW) / 11;
      const y = padTop + plotH - (item.ordersCount / maxVal) * plotH;
      return {
        month: m,
        label: `T${m}`,
        newCustomers: item.newCustomers,
        ordersCount: item.ordersCount,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      };
    });
  });

  readonly linePath = computed(() => {
    const pts = this.trendPoints();
    if (pts.length === 0) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  });

  readonly areaPath = computed(() => {
    const pts = this.trendPoints();
    if (pts.length === 0) return '';
    const line = this.linePath();
    return `${line} L ${pts[pts.length - 1].x} 144 L ${pts[0].x} 144 Z`;
  });

  readonly donutSegments = computed<DonutSegment[]>(() => {
    const dist = this.tierDistribution();
    const total = dist.reduce((sum, d) => sum + d.count, 0);
    if (total === 0) return [];

    const circumference = 2 * Math.PI * 52;
    let offset = 0;
    return dist.map((d) => {
      const pct = (d.count / total) * 100;
      const len = (d.count / total) * circumference;
      const meta = TIER_META[d.membershipTier] ?? { label: d.membershipTier, color: '#9ca3af' };
      const seg: DonutSegment = {
        id: d.membershipTier,
        label: meta.label,
        count: d.count,
        percentage: Math.round(pct),
        color: meta.color,
        dashArray: `${len.toFixed(1)} ${(circumference - len).toFixed(1)}`,
        dashOffset: -offset,
      };
      offset += len;
      return seg;
    });
  });

  readonly channelBars = computed(() => {
    const list = this.channelDistribution();
    const maxCount = Math.max(1, ...list.map((c) => c.count));
    return list.map((c) => ({
      key: c.orderType,
      label: CHANNEL_LABELS[c.orderType] ?? c.orderType,
      count: c.count,
      widthPct: Math.round((c.count / maxCount) * 100),
    }));
  });

  ngOnInit(): void {
    void this.refreshDashboard();
  }

  onMonthChange(val: string): void {
    this.selectedMonth.set(Number(val) || 1);
    void this.refreshDashboard();
  }

  onYearChange(val: string): void {
    this.selectedYear.set(val);
    void this.refreshDashboard();
  }

  async refreshDashboard(): Promise<void> {
    this.isLoading.set(true);
    try {
      const params = new HttpParams()
        .set('year', this.selectedYear())
        .set('month', String(this.selectedMonth()));
      const res = await firstValueFrom(
        this.http.get<ApiResponseDto<CrmDashboardSummaryDto>>(this.apiUrl, {
          params,
          withCredentials: true,
        }),
      );
      if (res.data) {
        this.kpi.set(res.data.kpi ?? this.kpi());
        this.monthlyTrend.set(res.data.monthlyTrend ?? []);
        this.tierDistribution.set(res.data.tierDistribution ?? []);
        this.channelDistribution.set(res.data.channelDistribution ?? []);
      }
    } catch {
      this.toast.error('Không thể tải dữ liệu thống kê CRM.');
    } finally {
      this.isLoading.set(false);
    }
  }
}
