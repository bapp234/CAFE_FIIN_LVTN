import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideDollarSign } from '@lucide/angular';
import { DashboardMonthlyStat } from '../../services/hrm_employee_api';

export interface SalaryBarPoint {
  month: number;
  label: string;
  fullLabel: string;
  amountMillion: number;
  formattedAmount: string;
  hours: number;
  avgRate: string;
  isCurrent: boolean;
  x: number;
  y: number;
  height: number;
}

export interface ChartAxisTick {
  val: number;
  label: string;
  y: number;
}

function computeNiceScale(
  maxVal: number,
  tickCount = 5
): { max: number; ticks: number[] } {
  const safeMax = Math.max(maxVal, 5);
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
  selector: 'app-hrm-salary-trend-chart',
  templateUrl: './hrm_salary_trend_chart.html',
  styleUrl: './hrm_salary_trend_chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, LucideDollarSign],
})
export class HrmSalaryTrendChart {
  readonly branchId = input<string>('all');
  readonly selectedMonth = input<number>(11);
  readonly selectedYear = input<string>('2026');
  readonly monthlyStats = input<DashboardMonthlyStat[]>([]);

  readonly hoveredPoint = signal<SalaryBarPoint | null>(null);

  private readonly normalizedMonthlyData = computed(() => {
    const mapByMonth = new Map<number, DashboardMonthlyStat>();
    for (const item of this.monthlyStats()) {
      mapByMonth.set(item.month, item);
    }
    return Array.from({ length: 12 }, (_, idx) => {
      const m = idx + 1;
      const stat = mapByMonth.get(m);
      const totalVnd = Number(stat?.salaryCostVnd ?? 0);
      const hours = Number(stat?.workHours ?? 0);
      return {
        month: m,
        totalVnd,
        baseMillion: totalVnd / 1_000_000,
        hours,
      };
    });
  });

  readonly chartScale = computed(() => {
    const rawMax = Math.max(...this.normalizedMonthlyData().map((d) => d.baseMillion), 10);
    return computeNiceScale(rawMax, 5);
  });

  readonly yTicks = computed<ChartAxisTick[]>(() => {
    const scale = this.chartScale();
    const chartHeight = 250;
    const bottomY = 300;
    return scale.ticks.map((v) => ({
      val: v,
      label: `${v}tr`,
      y: Math.round(bottomY - (v / scale.max) * chartHeight),
    }));
  });

  readonly barPoints = computed<SalaryBarPoint[]>(() => {
    const scale = this.chartScale();
    const curMonth = this.selectedMonth();
    const curYear = this.selectedYear();
    const chartHeight = 250;
    const bottomY = 300;
    const startX = 85;
    const stepX = 74;

    return this.normalizedMonthlyData().map((d, idx) => {
      const amount = Number(d.baseMillion.toFixed(2));
      const hours = Math.round(d.hours);
      const ratio = scale.max > 0 ? amount / scale.max : 0;
      const height = Math.round(ratio * chartHeight);
      const x = startX + idx * stepX;
      const y = bottomY - height;
      const totalVnd = d.totalVnd;
      const hourlyRate = hours > 0 ? Math.round(totalVnd / hours) : 0;

      return {
        month: d.month,
        label: `T${d.month}`,
        fullLabel: `Tháng ${d.month}/${curYear}`,
        amountMillion: amount,
        formattedAmount: `${Math.round(totalVnd).toLocaleString('vi-VN')} ₫`,
        hours,
        avgRate: `~${hourlyRate.toLocaleString('vi-VN')} ₫/h`,
        isCurrent: d.month === curMonth,
        x,
        y,
        height,
      };
    });
  });

  // Tóm tắt nhanh kỳ đang chọn (selectedMonth)
  readonly currentMonthSummary = computed(() => {
    const m = this.selectedMonth();
    const pm = this.barPoints().find((p) => p.month === m) ?? this.barPoints()[0];
    return {
      month: m,
      amount: pm?.formattedAmount ?? '0 ₫',
      hours: `${pm?.hours ?? 0} h`,
      rate: pm?.avgRate ?? '0 ₫/h',
    };
  });

  setHovered(pt: SalaryBarPoint | null): void {
    this.hoveredPoint.set(pt);
  }
}
