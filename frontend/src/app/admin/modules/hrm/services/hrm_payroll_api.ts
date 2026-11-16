import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Page } from '../../../shared/models/page';
import { PayrollFilterQuery, PayrollPeriod, PayrollSlip } from '../models/payroll';
import { INITIAL_EMPLOYEES } from './hrm_employee_api';

export const INITIAL_PAYROLL_PERIODS: PayrollPeriod[] = [
  {
    id: 'pay-2026-10-all',
    period: '2026-10',
    branchId: 'all',
    branchName: 'Toàn hệ thống',
    status: 'paid',
    statusLabel: 'Đã chi trả',
    totalEmployees: 9,
    totalNetPay: 78450000,
    createdAt: '31/10/2026',
    approvedAt: '03/11/2026',
    approvedBy: 'Trần Thị Mai',
    isLocked: true,
  },
  {
    id: 'pay-2026-11-all',
    period: '2026-11',
    branchId: 'all',
    branchName: 'Toàn hệ thống',
    status: 'draft',
    statusLabel: 'Bản nháp (Đang tính)',
    totalEmployees: 10,
    totalNetPay: 83200000,
    createdAt: '15/11/2026',
    isLocked: false,
  },
];

export const INITIAL_PAYROLL_SLIPS: PayrollSlip[] = [
  {
    id: 'slip-01',
    period: '2026-11',
    employeeId: 'emp-01',
    employeeCode: 'NV001',
    employeeName: 'Đặng Quốc Anh',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Trưởng ca Pha chế',
    hourlyRate: 35000,
    standardWorkHours: 132,
    overtimeHours: 10,
    basePay: 4620000,
    overtimePay: 525000, // 10 * 35000 * 1.5
    allowance: 1200000,  // Phụ cấp trách nhiệm + ăn ca
    deduction: 0,
    advance: 1000000,
    netPay: 5345000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
  {
    id: 'slip-02',
    period: '2026-11',
    employeeId: 'emp-02',
    employeeCode: 'NV002',
    employeeName: 'Nguyễn Thị Hương',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Barista Chuyên nghiệp',
    hourlyRate: 28000,
    standardWorkHours: 120,
    overtimeHours: 6,
    basePay: 3360000,
    overtimePay: 252000, // 6 * 28000 * 1.5
    allowance: 800000,
    deduction: 50000,    // Phạt đi muộn 1 lần
    advance: 500000,
    netPay: 3862000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
  {
    id: 'slip-03',
    period: '2026-11',
    employeeId: 'emp-03',
    employeeCode: 'NV003',
    employeeName: 'Lê Thanh Tùng',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Quản lý Cửa hàng',
    hourlyRate: 42000,
    standardWorkHours: 160,
    overtimeHours: 12,
    basePay: 6720000,
    overtimePay: 756000, // 12 * 42000 * 1.5
    allowance: 2000000,  // Phụ cấp quản lý + doanh số
    deduction: 0,
    advance: 0,
    netPay: 9476000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
  {
    id: 'slip-04',
    period: '2026-11',
    employeeId: 'emp-04',
    employeeCode: 'NV004',
    employeeName: 'Phạm Minh Tuấn',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Nhân viên Thu ngân',
    hourlyRate: 25000,
    standardWorkHours: 85,
    overtimeHours: 2,
    basePay: 2125000,
    overtimePay: 75000,
    allowance: 400000,
    deduction: 100000, // Đi muộn 2 lần
    advance: 0,
    netPay: 2500000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
  {
    id: 'slip-05',
    period: '2026-11',
    employeeId: 'emp-05',
    employeeCode: 'NV005',
    employeeName: 'Võ Ngọc Bích',
    branchId: 'cn-td',
    branchName: 'Fiin Làng Đại Học',
    position: 'Barista Part-time',
    hourlyRate: 26000,
    standardWorkHours: 70,
    overtimeHours: 0,
    basePay: 1820000,
    overtimePay: 0,
    allowance: 300000,
    deduction: 0,
    advance: 0,
    netPay: 2120000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
  {
    id: 'slip-07',
    period: '2026-11',
    employeeId: 'emp-07',
    employeeCode: 'NV007',
    employeeName: 'Bùi Mỹ Linh',
    branchId: 'cn-bt',
    branchName: 'Fiin Phan Xích Long',
    position: 'Trưởng ca Cửa hàng',
    hourlyRate: 36000,
    standardWorkHours: 140,
    overtimeHours: 8,
    basePay: 5040000,
    overtimePay: 432000,
    allowance: 1500000,
    deduction: 0,
    advance: 1000000,
    netPay: 5972000,
    status: 'draft',
    statusLabel: 'Bản nháp',
  },
];

@Injectable({ providedIn: 'root' })
export class HrmPayrollApi {
  private periods: PayrollPeriod[] = [...INITIAL_PAYROLL_PERIODS];
  private slips: PayrollSlip[] = [...INITIAL_PAYROLL_SLIPS];

  getPayrollPeriods(): Observable<PayrollPeriod[]> {
    return of([...this.periods]).pipe(delay(150));
  }

  getPayrollSlips(query: PayrollFilterQuery): Observable<Page<PayrollSlip>> {
    let list = this.slips.filter((s) => s.period === query.period);

    if (query.branchId && query.branchId !== 'all') {
      list = list.filter((s) => s.branchId === query.branchId);
    }

    if (query.q) {
      const kw = query.q.trim().toLowerCase();
      list = list.filter(
        (s) => s.employeeName.toLowerCase().includes(kw) || s.employeeCode.toLowerCase().includes(kw)
      );
    }

    const total = list.length;
    const page = query.page || 1;
    const size = query.size || 10;
    const start = (page - 1) * size;
    const items = list.slice(start, start + size);
    const totalPages = Math.max(1, Math.ceil(total / size));

    return of({ items, total, page, size, totalPages }).pipe(delay(200));
  }

  /**
   * Tính toán lại bảng lương cho kỳ và chi nhánh
   */
  generatePayroll(period: string, branchId: string): Observable<PayrollPeriod> {
    const existing = this.periods.find((p) => p.period === period && p.branchId === branchId);
    if (existing && existing.isLocked) {
      return throwError(() => new Error('Kỳ lương này đã được phê duyệt và khóa, không thể tính lại.'));
    }

    // Quét nhân viên đang làm việc
    let activeEmployees = INITIAL_EMPLOYEES.filter((e) => e.status !== 'resigned');
    if (branchId !== 'all') {
      activeEmployees = activeEmployees.filter((e) => e.branchId === branchId);
    }

    const newSlips: PayrollSlip[] = activeEmployees.map((e) => {
      const stdHours = e.contractType === 'full_time' ? 120 + Math.floor(Math.random() * 30) : 60 + Math.floor(Math.random() * 25);
      const otHours = Math.floor(Math.random() * 8);
      const basePay = stdHours * e.hourlyRate;
      const otPay = otHours * (e.hourlyRate * 1.5);
      const allowance = e.contractType === 'full_time' ? 1000000 : 300000;
      const deduction = Math.random() > 0.7 ? 50000 : 0;
      const advance = Math.random() > 0.6 ? 500000 : 0;
      const netPay = basePay + otPay + allowance - deduction - advance;

      return {
        id: `slip-${period}-${e.id}`,
        period,
        employeeId: e.id,
        employeeCode: e.code,
        employeeName: e.fullName,
        branchId: e.branchId,
        branchName: e.branchName,
        position: e.position,
        hourlyRate: e.hourlyRate,
        standardWorkHours: stdHours,
        overtimeHours: otHours,
        basePay,
        overtimePay: otPay,
        allowance,
        deduction,
        advance,
        netPay,
        status: 'draft',
        statusLabel: 'Bản nháp',
      };
    });

    // Thay thế slips của period
    this.slips = this.slips.filter((s) => s.period !== period || (branchId !== 'all' && s.branchId !== branchId));
    this.slips.push(...newSlips);

    const totalNetPay = newSlips.reduce((sum, s) => sum + s.netPay, 0);

    let periodRec = this.periods.find((p) => p.period === period && p.branchId === branchId);
    if (!periodRec) {
      periodRec = {
        id: `pay-${period}-${branchId}`,
        period,
        branchId,
        branchName: branchId === 'all' ? 'Toàn hệ thống' : newSlips[0]?.branchName || 'Chi nhánh',
        status: 'draft',
        statusLabel: 'Bản nháp (Đang tính)',
        totalEmployees: newSlips.length,
        totalNetPay,
        createdAt: new Date().toLocaleDateString('vi-VN'),
        isLocked: false,
      };
      this.periods.unshift(periodRec);
    } else {
      periodRec.totalEmployees = newSlips.length;
      periodRec.totalNetPay = totalNetPay;
      periodRec.status = 'draft';
      periodRec.statusLabel = 'Bản nháp (Đã tính lại)';
    }

    return of(periodRec).pipe(delay(350));
  }

  /**
   * Phê duyệt và KHÓA kỳ lương
   */
  approvePayroll(periodId: string, approverName: string): Observable<PayrollPeriod> {
    const idx = this.periods.findIndex((p) => p.id === periodId);
    if (idx === -1) {
      return throwError(() => new Error('Không tìm thấy kỳ lương.'));
    }

    this.periods[idx] = {
      ...this.periods[idx],
      status: 'approved',
      statusLabel: 'Đã duyệt (Đã khóa)',
      approvedAt: new Date().toLocaleDateString('vi-VN'),
      approvedBy: approverName,
      isLocked: true,
    };

    // Cập nhật trạng thái phiếu lương con
    const p = this.periods[idx];
    this.slips = this.slips.map((s) =>
      s.period === p.period && (p.branchId === 'all' || s.branchId === p.branchId)
        ? { ...s, status: 'approved', statusLabel: 'Đã duyệt' }
        : s
    );

    return of(this.periods[idx]).pipe(delay(250));
  }

  getPayrollSlipById(id: string): Observable<PayrollSlip | null> {
    const slip = this.slips.find((s) => s.id === id) ?? null;
    return of(slip).pipe(delay(150));
  }
}
