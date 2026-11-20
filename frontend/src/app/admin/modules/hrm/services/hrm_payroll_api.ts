import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Page } from '../../../shared/models/page';
import { PayrollFilterQuery, PayrollPeriod, PayrollSlip } from '../models/payroll';
import { getCurrentYearMonth } from '../utils/hrm_date_helpers';
import { HrmEmployeeApi } from './hrm_employee_api';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PayrollPeriodHeaderDto {
  periodId: number;
  periodMonth: string;
  branchId: number | null;
  branchName: string | null;
  status: string;
  isLocked: boolean;
  totalEmployees: number;
  totalNetPay: number;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

interface PayrollSlipDetailDto {
  slipId: number;
  periodId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchCode: string | null;
  branchName: string | null;
  contractCode: string | null;
  contractName: string | null;
  hourlyRate: number;
  standardHours: number;
  overtimeHours: number;
  basePay: number;
  overtimePay: number;
  allowance: number;
  deduction: number;
  advance: number;
  netPay: number;
  status: string;
}

interface PayrollPeriodDetailsResponse {
  period: PayrollPeriodHeaderDto | null;
  slips: PayrollSlipDetailDto[];
}

export interface PayrollSettingItem {
  settingId: number;
  code: string;
  name: string;
  category: 'allowance' | 'subsidy' | 'deduction' | 'insurance' | 'tax' | string;
  calcType: 'percent' | 'fixed_month' | 'fixed_shift' | 'fixed_count' | string;
  rawValue: number;
  impact: 'Addition' | 'Deduction' | 'Employer' | string;
  applyScope: string;
  note?: string | null;
  isActive: boolean;
}

export interface SavePayrollSettingRequest {
  settingId?: number | null;
  code: string;
  name: string;
  category: string;
  calcType: string;
  rawValue: number;
  impact: string;
  applyScope: string;
  note?: string | null;
  isActive: boolean;
}

export interface SalaryAdvanceItem {
  advanceId: number;
  advanceCode: string;
  employeeId: number;
  employeeCode: string;
  employeeName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  requestDate: string;
  period: string;
  amount: number;
  paymentMethod: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'deducted' | 'cancel_pending' | 'cancelled';
  approvedBy?: string | null;
  approvedAt?: string | null;
  decisionNote?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  otMonthlyLimit?: number;
  otApprovedHours?: number;
  otPendingHours?: number;
  otTotalRegisteredHours?: number;
  otRemainingHours?: number;
  otWarningStatus?: string;
  annualLeaveTotalDays?: number;
  annualLeaveApprovedDays?: number;
  annualLeavePendingDays?: number;
  annualLeaveRemainingDays?: number;
  isAttendanceLocked?: boolean;
}

export interface EmployeeMonthlyQuotaItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  periodMonth: string;
  otMonthlyLimit: number;
  otApprovedHours: number;
  otPendingHours: number;
  otTotalRegisteredHours: number;
  otRemainingHours: number;
  otWarningStatus: string;
  annualLeaveTotalDays: number;
  annualLeaveApprovedDays: number;
  annualLeavePendingDays: number;
  annualLeaveTotalRegisteredDays: number;
  annualLeaveRemainingDays: number;
  annualLeaveWarningStatus: string;
  isAttendanceLocked: boolean;
}

export interface CreateSalaryAdvanceRequest {
  employeeId: number;
  periodMonth: string;
  requestDate: string;
  amount: number;
  paymentMethod: string;
  reason: string;
  createdBy?: string;
}

export interface CreateSalaryAdvanceResult {
  advanceId: number;
  advanceCode: string;
}

export interface ProcessSalaryAdvanceRequest {
  action: 'approve' | 'reject' | 'request_cancel' | 'approve_cancel' | 'reject_cancel';
  approverName: string;
  note?: string;
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  approved: 'Đã duyệt (Khóa)',
  paid: 'Đã chi trả',
};

@Injectable({ providedIn: 'root' })
export class HrmPayrollApi {
  private readonly http = inject(HttpClient);
  private readonly employeeApi = inject(HrmEmployeeApi);
  private readonly baseUrl = 'http://localhost:5107/api/v1/payroll';

  private lastLoadedPeriod: PayrollPeriod | null = null;
  private lastLoadedPeriodMonth = getCurrentYearMonth();
  private lastLoadedBranchId: string | number = 'all';

  private toNumericBranchId(branchId?: string | number | null): number | null {
    if (branchId === undefined || branchId === null || branchId === 'all' || branchId === '') {
      return null;
    }
    if (typeof branchId === 'number') {
      return branchId > 0 ? branchId : null;
    }
    const normalized = this.employeeApi.normalizeBranchId(branchId);
    return normalized && normalized > 0 ? normalized : null;
  }

  private mapPeriod(dto: PayrollPeriodHeaderDto): PayrollPeriod {
    const status = (dto.status || 'draft') as PayrollPeriod['status'];
    return {
      id: String(dto.periodId),
      period: dto.periodMonth,
      branchId: dto.branchId ? String(dto.branchId) : 'all',
      branchName: dto.branchName || 'Toàn hệ thống',
      status,
      statusLabel: STATUS_LABELS[status] || status,
      totalEmployees: dto.totalEmployees,
      totalNetPay: dto.totalNetPay,
      createdAt: dto.createdAt ? new Date(dto.createdAt).toLocaleDateString('vi-VN') : '',
      approvedAt: dto.approvedAt ? new Date(dto.approvedAt).toLocaleDateString('vi-VN') : undefined,
      approvedBy: dto.approvedBy || undefined,
      isLocked: dto.isLocked,
    };
  }

  private mapSlip(dto: PayrollSlipDetailDto, periodMonth: string): PayrollSlip {
    const status = (dto.status || 'draft') as PayrollSlip['status'];
    return {
      id: String(dto.slipId),
      period: periodMonth,
      employeeId: String(dto.employeeId),
      employeeCode: dto.employeeCode,
      employeeName: dto.fullName,
      branchId: dto.branchCode || '',
      branchName: dto.branchName || 'Mặc định',
      position: dto.position || 'Nhân viên',
      hourlyRate: dto.hourlyRate,
      standardWorkHours: dto.standardHours,
      overtimeHours: dto.overtimeHours,
      basePay: dto.basePay,
      overtimePay: dto.overtimePay,
      allowance: dto.allowance,
      deduction: dto.deduction,
      advance: dto.advance,
      netPay: dto.netPay,
      status,
      statusLabel: STATUS_LABELS[status] || status,
    };
  }

  getLastLoadedPeriod(): PayrollPeriod | null {
    return this.lastLoadedPeriod;
  }

  getPayrollPeriods(period?: string, branchId?: string): Observable<PayrollPeriod[]> {
    const periodMonth = period || this.lastLoadedPeriodMonth;
    const branchIdNum = this.toNumericBranchId(branchId ?? this.lastLoadedBranchId);
    let params = new HttpParams();
    if (branchIdNum !== null) {
      params = params.set('branchId', branchIdNum.toString());
    }
    return this.http
      .get<ApiResponse<PayrollPeriodDetailsResponse>>(`${this.baseUrl}/${periodMonth}`, { params })
      .pipe(
        map((res) => {
          const p = res.data?.period ? this.mapPeriod(res.data.period) : null;
          this.lastLoadedPeriod = p;
          return p ? [p] : [];
        }),
        catchError(() => {
          return this.lastLoadedPeriod ? [ [this.lastLoadedPeriod] ] : [ [] ];
        })
      );
  }

  getPayrollSlips(query: PayrollFilterQuery): Observable<Page<PayrollSlip>> {
    const periodMonth = query.period || getCurrentYearMonth();
    this.lastLoadedPeriodMonth = periodMonth;
    this.lastLoadedBranchId = query.branchId || 'all';

    let params = new HttpParams();
    const branchIdNum = this.toNumericBranchId(query.branchId);
    if (branchIdNum !== null) {
      params = params.set('branchId', branchIdNum.toString());
    }
    if (query.q && query.q.trim()) {
      params = params.set('search', query.q.trim());
    }

    return this.http
      .get<ApiResponse<PayrollPeriodDetailsResponse>>(`${this.baseUrl}/${periodMonth}`, { params })
      .pipe(
        map((res) => {
          const periodDto = res.data?.period ?? null;
          this.lastLoadedPeriod = periodDto ? this.mapPeriod(periodDto) : null;
          const allSlips = (res.data?.slips ?? []).map((s) => this.mapSlip(s, periodMonth));

          const page = query.page || 1;
          const size = query.size || 100;
          const start = (page - 1) * size;
          const items = allSlips.slice(start, start + size);
          const total = allSlips.length;
          const totalPages = Math.max(1, Math.ceil(total / size));

          return { items, total, page, size, totalPages };
        }),
        catchError((err) => {
          const msg = err.error?.message || err.message || 'Không thể tải dữ liệu bảng lương';
          return throwError(() => new Error(msg));
        })
      );
  }

  /**
   * Tính toán lại bảng lương (Backend chặn nếu kỳ công tháng chưa khóa)
   */
  generatePayroll(period: string, branchId: string): Observable<PayrollPeriod> {
    const branchIdNum = this.toNumericBranchId(branchId);
    return this.http
      .post<ApiResponse<{ periodId: number; periodMonth: string }>>(`${this.baseUrl}/calculate`, {
        periodMonth: period,
        branchId: branchIdNum,
      })
      .pipe(
        map((res) => ({
          id: String(res.data?.periodId ?? ''),
          period,
          branchId: branchId || 'all',
          branchName: branchId === 'all' ? 'Toàn hệ thống' : 'Chi nhánh',
          status: 'draft' as const,
          statusLabel: 'Bản nháp',
          totalEmployees: 0,
          totalNetPay: 0,
          createdAt: new Date().toLocaleDateString('vi-VN'),
          isLocked: false,
        })),
        catchError((err) => {
          const msg = err.error?.message || err.message || 'Không thể tính toán bảng lương';
          return throwError(() => new Error(msg));
        })
      );
  }

  /**
   * Phê duyệt và khóa sổ kỳ lương
   */
  approvePayroll(periodId: string, approverName: string, password?: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/lock`, {
        periodId: Number(periodId),
        approverName,
        password,
      })
      .pipe(
        map((res) => res.success),
        catchError((err) => {
          const msg = err.error?.message || err.message || 'Không thể duyệt và khóa kỳ lương';
          return throwError(() => new Error(msg));
        })
      );
  }

  /**
   * Mở khóa sổ kỳ lương
   */
  unlockPayroll(periodId: string, unlockedBy: string, reason: string, password?: string): Observable<boolean> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.baseUrl}/unlock`, {
        periodId: Number(periodId),
        unlockedBy,
        reason,
        password,
      })
      .pipe(
        map((res) => res.success),
        catchError((err) => {
          const msg = err.error?.message || err.message || 'Không thể mở khóa kỳ lương';
          return throwError(() => new Error(msg));
        })
      );
  }

  getPayrollSettings(category?: string, calcType?: string, search?: string): Observable<PayrollSettingItem[]> {
    let params = new HttpParams();
    if (category && category !== 'all') params = params.set('category', category);
    if (calcType && calcType !== 'all') params = params.set('calcType', calcType);
    if (search && search.trim()) params = params.set('search', search.trim());
    return this.http
      .get<ApiResponse<PayrollSettingItem[]>>(`${this.baseUrl}/settings`, { params })
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh mục thiết lập lương')))
      );
  }

  savePayrollSetting(req: SavePayrollSettingRequest): Observable<number> {
    return this.http
      .post<ApiResponse<number>>(`${this.baseUrl}/settings`, req)
      .pipe(
        map((res) => res.data),
        catchError((err) => throwError(() => new Error(err.error?.message || err.message || 'Không thể lưu khoản mục thiết lập lương')))
      );
  }

  deletePayrollSetting(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/settings/${id}`)
      .pipe(
        map((res) => res.success),
        catchError((err) => throwError(() => new Error(err.error?.message || err.message || 'Không thể xóa khoản mục thiết lập lương')))
      );
  }

  getSalaryAdvances(
    periodMonth?: string,
    branchId?: string | number | null,
    status?: string,
    search?: string
  ): Observable<SalaryAdvanceItem[]> {
    let params = new HttpParams();
    if (periodMonth) params = params.set('periodMonth', periodMonth);
    const branchIdNum = this.toNumericBranchId(branchId);
    if (branchIdNum !== null) params = params.set('branchId', branchIdNum.toString());
    if (status && status !== 'all') params = params.set('status', status);
    if (search && search.trim()) params = params.set('search', search.trim());

    return this.http
      .get<ApiResponse<SalaryAdvanceItem[]>>(`${this.baseUrl}/advances`, { params })
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) =>
          throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh sách phiếu tạm ứng lương'))
        )
      );
  }

  createSalaryAdvance(req: CreateSalaryAdvanceRequest): Observable<CreateSalaryAdvanceResult> {
    return this.http
      .post<ApiResponse<CreateSalaryAdvanceResult>>(`${this.baseUrl}/advances`, req)
      .pipe(
        map((res) => res.data),
        catchError((err) =>
          throwError(() => new Error(err.error?.message || err.message || 'Không thể tạo phiếu tạm ứng lương'))
        )
      );
  }

  processSalaryAdvance(advanceId: number, req: ProcessSalaryAdvanceRequest): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(`${this.baseUrl}/advances/${advanceId}/process`, req)
      .pipe(
        map((res) => res.success),
        catchError((err) =>
          throwError(() => new Error(err.error?.message || err.message || 'Không thể xử lý phiếu tạm ứng lương'))
        )
      );
  }

  getEmployeeMonthlyQuotas(
    periodMonth: string,
    branchId?: string | number | null,
    employeeId?: number | null,
    search?: string
  ): Observable<EmployeeMonthlyQuotaItem[]> {
    let params = new HttpParams().set('periodMonth', periodMonth || getCurrentYearMonth());
    const branchIdNum = this.toNumericBranchId(branchId);
    if (branchIdNum !== null) params = params.set('branchId', branchIdNum.toString());
    if (employeeId && employeeId > 0) params = params.set('employeeId', employeeId.toString());
    if (search && search.trim()) params = params.set('search', search.trim());

    return this.http
      .get<ApiResponse<EmployeeMonthlyQuotaItem[]>>(`${this.baseUrl}/quotas`, { params })
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) =>
          throwError(() => new Error(err.error?.message || err.message || 'Không thể tải dữ liệu hạn mức tăng ca & phép năm'))
        )
      );
  }
}
