import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideClock,
  LucidePieChart,
  LucideRotateCcw,
  LucideTrendingUp,
  LucideUserPlus,
} from '@lucide/angular';
import { AdminBranchService } from '../../../shared/services/admin_branch_service';
import { AdminStatCard } from '../../../shared/admin_stat_card/admin_stat_card';
import { AdminButtonComponent } from '../../../components/admin_button/admin_button';
import {
  AdminComboBoxComponent,
  ComboOption,
} from '../../../components/admin_combo_box/admin_combo_box';
import { HrmSalaryTrendChart } from '../components/hrm_salary_trend_chart/hrm_salary_trend_chart';
import {
  HrmEmployeeApi,
  HrmDashboardSummary,
  DashboardPositionItem,
  DashboardMonthlyStat,
  DashboardAttendanceSummary,
} from '../services/hrm_employee_api';

export interface MonthTrendPoint {
  month: number;
  label: string;
  count: number;
  growth: string;
  x: number;
  y: number;
}

export interface ChartAxisTick {
  val: number;
  label: string;
  y: number;
}

export interface TurnoverPoint {
  month: number;
  label: string;
  hired: number;
  resigned: number;
  net: number;
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

function computeNiceScale(
  maxVal: number,
  tickCount = 4
): { max: number; ticks: number[] } {
  const safeMax = Math.max(maxVal, 4);
  const rawStep = safeMax / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const normalized = rawStep / magnitude;

  let niceStep: number;
  if (normalized <= 1.2) niceStep = 1 * magnitude;
  else if (normalized <= 2.5) niceStep = 2 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const niceMax = niceStep * tickCount;
  const ticks: number[] = [];
  for (let i = tickCount; i >= 0; i--) {
    ticks.push(Number((i * niceStep).toFixed(1)));
  }
  return { max: Math.max(niceMax, safeMax), ticks };
}

@Component({
  selector: 'app-hrm-dashboard',
  templateUrl: './hrm_dashboard.html',
  styleUrl: './hrm_dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    LucideUserPlus,
    LucideTrendingUp,
    LucidePieChart,
    LucideRotateCcw,
    LucideClock,
    AdminStatCard,
    AdminButtonComponent,
    AdminComboBoxComponent,
    HrmSalaryTrendChart,
  ],
})
export class HrmDashboard {
  readonly branchService = inject(AdminBranchService);
  private readonly employeeApi = inject(HrmEmployeeApi);

  readonly isLoading = signal(true);
  readonly summary = signal<HrmDashboardSummary | null>(null);

  // ---- 1. Bộ lọc Chi nhánh & Tùy chọn năm ----
  readonly branchOptions = computed<ComboOption[]>(() => [
    { value: 'all', label: 'Tất cả chi nhánh' },
    ...this.branchService.branches().map((b) => ({ value: String(b.id), label: b.name })),
  ]);

  readonly selectedMonth = signal<number>(11);
  readonly selectedYear = signal<string>('2026');
  readonly selectedMonthString = computed(() => String(this.selectedMonth()));

  readonly monthOptions: ComboOption[] = [
    { value: '1', label: 'Tháng 1' },
    { value: '2', label: 'Tháng 2' },
    { value: '3', label: 'Tháng 3' },
    { value: '4', label: 'Tháng 4' },
    { value: '5', label: 'Tháng 5' },
    { value: '6', label: 'Tháng 6' },
    { value: '7', label: 'Tháng 7' },
    { value: '8', label: 'Tháng 8' },
    { value: '9', label: 'Tháng 9' },
    { value: '10', label: 'Tháng 10' },
    { value: '11', label: 'Tháng 11' },
    { value: '12', label: 'Tháng 12' },
  ];

  readonly yearOptions: ComboOption[] = [
    { value: '2026', label: 'Năm 2026' },
    { value: '2025', label: 'Năm 2025' },
    { value: '2024', label: 'Năm 2024' },
  ];

  readonly attendanceTotalShifts = computed<number>(() => {
    const segs = this.attendanceDonutSegments();
    return segs.reduce((sum, s) => sum + s.count, 0);
  });

  readonly punctualComplianceRate = computed<string>(() => {
    const segs = this.attendanceDonutSegments();
    const onTime = segs.find((s) => s.id === 'on_time')?.count ?? 0;
    const total = this.attendanceTotalShifts();
    if (total === 0) return '0.0';
    return ((onTime / total) * 100).toFixed(1);
  });

  // ---- 2. 4 Chỉ số KPI Chuẩn hóa ----
  readonly totalEmployees = signal(0);
  readonly workingEmployees = signal(0);
  readonly resignedEmployees = signal(0);
  readonly probationEmployees = signal(0);

  // ---- 3. Biểu đồ đường biến động nhân sự 12 tháng ----
  readonly monthlyTrends = signal<MonthTrendPoint[]>([]);
  readonly trendTicks = signal<ChartAxisTick[]>([]);
  readonly hoveredPoint = signal<MonthTrendPoint | null>(null);

  // ---- 4. Biểu đồ cột kép Tuyển mới vs Nghỉ việc ----
  readonly turnoverStats = signal<TurnoverPoint[]>([]);
  readonly turnoverTicks = signal<ChartAxisTick[]>([]);
  readonly hoveredTurnover = signal<TurnoverPoint | null>(null);

  // ---- 5. Cặp biểu đồ đôi: Cơ cấu Chức vụ & Tỷ lệ Chấm công ----
  readonly positionDonutSegments = signal<DonutSegment[]>([]);
  readonly attendanceDonutSegments = signal<DonutSegment[]>([]);
  readonly hoveredDonutSegment = signal<DonutSegment | null>(null);

  // =========================================================================
  // TOÁN TỬ VẼ ĐƯỜNG CONG SPLINE BÉZIER (THOÁNG, MƯỢT MÀ, KHÔNG GÃY KHÚC)
  // =========================================================================
  readonly svgSplinePath = computed(() => {
    const pts = this.monthlyTrends();
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(i - 1, 0)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(i + 2, pts.length - 1)];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x} ${p2.y}`;
    }
    return d;
  });

  readonly svgAreaPath = computed(() => {
    const pts = this.monthlyTrends();
    if (pts.length < 2) return '';
    const spline = this.svgSplinePath();
    const firstX = pts[0].x;
    const lastX = pts[pts.length - 1].x;
    const baseBottom = 310;
    return `${spline} L ${lastX} ${baseBottom} L ${firstX} ${baseBottom} Z`;
  });

  constructor() {
    effect(() => {
      const branchId = this.branchService.selectedBranchId();
      const month = this.selectedMonth();
      const year = this.selectedYear();
      this.loadDashboardData(branchId, month, year);
    });
  }

  loadDashboardData(branchId?: string, month?: number, year?: string): void {
    this.isLoading.set(true);

    const bId = branchId && branchId !== 'all' ? Number(branchId) : null;
    const m = month ?? this.selectedMonth();
    const y = parseInt(year ?? this.selectedYear(), 10);

    this.employeeApi
      .getDashboardSummary({
        branchId: bId,
        year: y,
        month: m,
      })
      .subscribe({
        next: (summaryData) => {
          this.summary.set(summaryData);
          if (summaryData) {
            this.applyDashboardSummary(summaryData);
          }
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  onBranchFilterChange(branchId: string): void {
    this.branchService.selectBranch(branchId);
  }

  onMonthFilterChange(monthStr: string): void {
    const m = parseInt(monthStr, 10);
    if (!isNaN(m) && m >= 1 && m <= 12) {
      this.selectedMonth.set(m);
    }
  }

  onYearFilterChange(year: string): void {
    this.selectedYear.set(year);
  }

  refreshDashboard(): void {
    this.loadDashboardData(
      this.branchService.selectedBranchId(),
      this.selectedMonth(),
      this.selectedYear()
    );
  }

  setHoveredPoint(pt: MonthTrendPoint | null): void {
    this.hoveredPoint.set(pt);
  }

  setHoveredTurnover(tp: TurnoverPoint | null): void {
    this.hoveredTurnover.set(tp);
  }

  setHoveredDonut(seg: DonutSegment | null): void {
    this.hoveredDonutSegment.set(seg);
  }

  // =========================================================================
  // ÁP DỤNG TOÀN BỘ SỐ LIỆU TỔNG HỢP TỪ SP dbo.sp_HRM_GetDashboardSummary
  // =========================================================================
  private applyDashboardSummary(data: HrmDashboardSummary): void {
    this.totalEmployees.set(data.totalEmployees ?? 0);
    this.workingEmployees.set(data.workingEmployees ?? 0);
    this.resignedEmployees.set(data.resignedEmployees ?? 0);
    this.probationEmployees.set(data.probationEmployees ?? 0);

    const monthly = data.monthlyStats ?? [];
    this.buildMonthlyTrends(monthly);
    this.buildTurnoverStats(monthly);
    this.buildPositionDonut(data.positionBreakdown ?? []);
    this.buildAttendanceDonut(data.attendanceSummary);
  }

  // =========================================================================
  // BIỂU ĐỒ ĐƯỜNG BIẾN ĐỘNG QUY MÔ NHÂN SỰ 12 THÁNG (DỮ LIỆU THẬT TỪ DB)
  // =========================================================================
  private buildMonthlyTrends(monthlyStats: DashboardMonthlyStat[]): void {
    const normalized: DashboardMonthlyStat[] =
      monthlyStats.length === 12
        ? monthlyStats
        : Array.from({ length: 12 }, (_, idx) => {
            const m = idx + 1;
            return (
              monthlyStats.find((s) => s.month === m) ?? {
                month: m,
                headcount: 0,
                hiredCount: 0,
                resignedCount: 0,
              }
            );
          });

    const rawMax = Math.max(...normalized.map((d) => d.headcount), 4);
    const scale = computeNiceScale(rawMax, 4);

    const chartHeight = 260;
    const bottomY = 310;

    const ticks: ChartAxisTick[] = scale.ticks.map((v) => {
      const ratio = v / scale.max;
      const y = Math.round(bottomY - ratio * chartHeight);
      return { val: v, label: String(v), y };
    });
    this.trendTicks.set(ticks);

    const points: MonthTrendPoint[] = normalized.map((d, idx) => {
      const x = 65 + idx * 73.5;
      const normalizedRatio = d.headcount / scale.max;
      const y = Math.round(bottomY - normalizedRatio * chartHeight);
      const prevCount = idx > 0 ? normalized[idx - 1].headcount : d.headcount;
      const delta = d.headcount - prevCount;
      const growth =
        idx === 0
          ? `Đầu năm (${d.hiredCount > 0 ? `+${d.hiredCount} mới` : 'ổn định'})`
          : delta > 0
            ? `+${delta} nhân sự so với tháng trước`
            : delta < 0
              ? `${delta} nhân sự so với tháng trước`
              : 'Duy trì biên chế ổn định';

      return {
        month: d.month,
        label: `Tháng ${d.month}`,
        count: d.headcount,
        growth,
        x,
        y,
      };
    });

    this.monthlyTrends.set(points);
  }

  // =========================================================================
  // BIỂU ĐỒ CỘT KÉP TUYỂN MỚI VS NGHỈ VIỆC 12 THÁNG (DỮ LIỆU THẬT TỪ DB)
  // =========================================================================
  private buildTurnoverStats(monthlyStats: DashboardMonthlyStat[]): void {
    const normalized: DashboardMonthlyStat[] =
      monthlyStats.length === 12
        ? monthlyStats
        : Array.from({ length: 12 }, (_, idx) => {
            const m = idx + 1;
            return (
              monthlyStats.find((s) => s.month === m) ?? {
                month: m,
                headcount: 0,
                hiredCount: 0,
                resignedCount: 0,
              }
            );
          });

    const data: TurnoverPoint[] = normalized.map((s) => ({
      month: s.month,
      label: `Tháng ${s.month}`,
      hired: s.hiredCount,
      resigned: s.resignedCount,
      net: s.hiredCount - s.resignedCount,
    }));

    const maxVal = Math.max(
      ...data.map((d) => Math.max(d.hired, d.resigned)),
      4
    );
    const scale = computeNiceScale(maxVal, 4);
    const chartHeight = 250;
    const bottomY = 310;

    const ticks: ChartAxisTick[] = scale.ticks.map((v) => {
      const ratio = v / scale.max;
      const y = Math.round(bottomY - ratio * chartHeight);
      return { val: v, label: String(v), y };
    });
    this.turnoverTicks.set(ticks);

    this.turnoverStats.set(data);
  }

  // =========================================================================
  // DONUT CƠ CẤU CHỨC VỤ (DỮ LIỆU THẬT TỪ DB)
  // =========================================================================
  private buildPositionDonut(items: DashboardPositionItem[]): void {
    const total = items.reduce((acc, it) => acc + it.count, 0);
    const safeTotal = total || 1;
    const circumference = 2 * Math.PI * 72; // r = 72 -> C ~ 452.389
    let accumulated = 0;

    const segments: DonutSegment[] = items.map((it) => {
      const ratio = total > 0 ? it.count / safeTotal : 0;
      const percentage = Math.round(ratio * 100);
      const dashLen = ratio * circumference;
      const dashArray = `${dashLen.toFixed(1)} ${circumference.toFixed(1)}`;
      const dashOffset = -accumulated;
      accumulated += dashLen;

      return {
        id: it.groupId,
        label: it.label,
        count: it.count,
        percentage,
        color: it.color,
        dashArray,
        dashOffset: Number(dashOffset.toFixed(1)),
      };
    });

    this.positionDonutSegments.set(segments);
  }

  // =========================================================================
  // DONUT KỶ LUẬT CHẤM CÔNG THÁNG (DỮ LIỆU THẬT TỪ dbo.Attendances)
  // =========================================================================
  private buildAttendanceDonut(att?: DashboardAttendanceSummary): void {
    const items = [
      { id: 'on_time', label: 'Đúng giờ (Chuẩn ca)', count: att?.onTimeCount ?? 0, color: '#15803d' },
      { id: 'late', label: 'Đi muộn', count: att?.lateCount ?? 0, color: '#d97706' },
      { id: 'early_leave', label: 'Về sớm', count: att?.earlyLeaveCount ?? 0, color: '#0284c7' },
      { id: 'missing_punch', label: 'Quên chấm công', count: att?.missingPunchCount ?? 0, color: '#a8a29e' },
    ];

    const total = items.reduce((acc, it) => acc + it.count, 0);
    const safeTotal = total || 1;
    const circumference = 2 * Math.PI * 72;
    let accumulated = 0;

    const segments: DonutSegment[] = items.map((it) => {
      const ratio = total > 0 ? it.count / safeTotal : 0;
      const percentage = Math.round(ratio * 100);
      const dashLen = ratio * circumference;
      const dashArray = `${dashLen.toFixed(1)} ${circumference.toFixed(1)}`;
      const dashOffset = -accumulated;
      accumulated += dashLen;

      return {
        id: it.id,
        label: it.label,
        count: it.count,
        percentage,
        color: it.color,
        dashArray,
        dashOffset: Number(dashOffset.toFixed(1)),
      };
    });

    this.attendanceDonutSegments.set(segments);
  }
}
