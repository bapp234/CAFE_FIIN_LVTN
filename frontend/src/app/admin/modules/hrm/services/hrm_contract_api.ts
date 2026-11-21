import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { ContractType } from '../models/employee';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export type ContractTabMode = 'current' | 'expiring' | 'history';

export interface ContractItem {
  contractId: number;
  contractCode: string;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  branchId: number | null;
  branchName: string;
  contractTypeId: number;
  contractTypeCode: string;
  contractName: string;
  position: string;
  hourlyRate: number;
  allowance: number;
  startDate: string;
  endDate?: string | null;
  signDate?: string | null;
  status: 'pending' | 'active' | 'expired' | 'terminated' | 'rejected' | string;
  actionType?: 'new' | 'renew' | 'adjust' | 'terminate' | string | null;
  note?: string | null;
  requestedByEmployeeId?: number | null;
  requestedByName?: string | null;
  approvedByEmployeeId?: number | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approvalRequestId?: number | null;
  createdAt: string;
  daysRemaining?: number | null;
}

export interface ContractSummary {
  activeCount: number;
  expiringSoonCount: number;
  pendingApprovalCount: number;
  closedCount: number;
}

export interface SubmitContractChangePayload {
  employeeId: number;
  contractTypeId: number;
  position: string;
  hourlyRate: number;
  allowance: number;
  startDate: string;
  endDate?: string | null;
  actionType: 'new' | 'renew' | 'adjust' | 'terminate';
  targetContractId?: number | null;
  note?: string | null;
  autoApproveIfAllowed: boolean;
}

export interface SaveContractTypePayload {
  contractTypeId?: number | null;
  contractCode: string;
  contractName: string;
  standardHourlyRate: number;
  allowance: number;
  salaryPercentage: number;
  durationMonths: number | null;
  benefitsDescription?: string | null;
  isActive: boolean;
}

export interface ContractImportItem {
  rowIndex: number;
  employeeCode: string;
  employeeId: number;
  fullName?: string | null;
  contractTypeCode: string;
  contractTypeId: number;
  position: string;
  hourlyRate: number;
  allowance: number;
  startDate: string;
  endDate?: string | null;
  note?: string | null;
  isValid: boolean;
  errorMessage?: string | null;
}

export interface ContractImportPreviewResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  items: ContractImportItem[];
}

export interface ContractImportSaveResult {
  totalReceived: number;
  totalSaved: number;
  pendingCount: number;
  activatedCount: number;
}

@Injectable({ providedIn: 'root' })
export class HrmContractApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5107/api/v1/hrm/contracts';

  getContracts(params: {
    tabMode: ContractTabMode;
    branchId?: string | number | null;
    employeeId?: number | null;
    contractTypeId?: number | null;
    status?: string;
    expiringDays?: number;
    search?: string;
  }): Observable<ContractItem[]> {
    let httpParams = new HttpParams().set('tabMode', params.tabMode);
    const bId = this.normalizeBranchId(params.branchId);
    if (bId && bId > 0) httpParams = httpParams.set('branchId', bId.toString());
    if (params.employeeId && params.employeeId > 0) httpParams = httpParams.set('employeeId', params.employeeId.toString());
    if (params.contractTypeId && params.contractTypeId > 0) httpParams = httpParams.set('contractTypeId', params.contractTypeId.toString());
    if (params.status && params.status !== 'all') httpParams = httpParams.set('status', params.status);
    if (params.expiringDays && params.expiringDays > 0) httpParams = httpParams.set('expiringDays', params.expiringDays.toString());
    if (params.search?.trim()) httpParams = httpParams.set('search', params.search.trim());

    return this.http
      .get<ApiResponse<ContractItem[]>>(this.baseUrl, { params: httpParams })
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể tải danh sách hợp đồng.')))
      );
  }

  getSummary(branchId?: string | number | null, expiringDays = 30): Observable<ContractSummary> {
    let httpParams = new HttpParams().set('expiringDays', expiringDays.toString());
    const bId = this.normalizeBranchId(branchId);
    if (bId && bId > 0) httpParams = httpParams.set('branchId', bId.toString());

    return this.http
      .get<ApiResponse<ContractSummary>>(`${this.baseUrl}/summary`, { params: httpParams })
      .pipe(
        map((res) => res.data),
        catchError(() =>
          throwError(() => new Error('Không thể tải thống kê hợp đồng.'))
        )
      );
  }

  submitContractChange(payload: SubmitContractChangePayload): Observable<{ message: string; status: string }> {
    return this.http
      .post<ApiResponse<{ contractId: number; contractCode: string; status: string }>>(this.baseUrl, payload)
      .pipe(
        map((res) => ({ message: res.message, status: res.data?.status ?? 'pending' })),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể gửi thao tác hợp đồng.')))
      );
  }

  processApproval(contractId: number, decision: 'approved' | 'rejected', note?: string): Observable<string> {
    return this.http
      .post<ApiResponse<boolean>>(`${this.baseUrl}/${contractId}/approve`, { decision, note })
      .pipe(
        map((res) => res.message),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể xử lý phê duyệt hợp đồng.')))
      );
  }

  getContractTypes(): Observable<ContractType[]> {
    return this.http
      .get<ApiResponse<ContractType[]>>(`${this.baseUrl}/types`)
      .pipe(
        map((res) => res.data ?? []),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể tải danh mục loại hợp đồng.')))
      );
  }

  saveContractType(payload: SaveContractTypePayload): Observable<number> {
    return this.http
      .post<ApiResponse<number>>(`${this.baseUrl}/types`, payload)
      .pipe(
        map((res) => res.data),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể lưu loại hợp đồng.')))
      );
  }

  deleteContractType(id: number): Observable<string> {
    return this.http
      .delete<ApiResponse<boolean>>(`${this.baseUrl}/types/${id}`)
      .pipe(
        map((res) => res.message),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể xóa loại hợp đồng.')))
      );
  }

  exportExcel(params: {
    tabMode: ContractTabMode;
    branchId?: string | number | null;
    employeeId?: number | null;
    contractTypeId?: number | null;
    status?: string;
    expiringDays?: number;
    search?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams().set('tabMode', params.tabMode);
    const bId = this.normalizeBranchId(params.branchId);
    if (bId && bId > 0) httpParams = httpParams.set('branchId', bId.toString());
    if (params.employeeId && params.employeeId > 0) httpParams = httpParams.set('employeeId', params.employeeId.toString());
    if (params.contractTypeId && params.contractTypeId > 0) httpParams = httpParams.set('contractTypeId', params.contractTypeId.toString());
    if (params.status && params.status !== 'all') httpParams = httpParams.set('status', params.status);
    if (params.expiringDays && params.expiringDays > 0) httpParams = httpParams.set('expiringDays', params.expiringDays.toString());
    if (params.search?.trim()) httpParams = httpParams.set('search', params.search.trim());

    return this.http.get(`${this.baseUrl}/export-excel`, { params: httpParams, responseType: 'blob' });
  }

  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/import-template`, { responseType: 'blob' });
  }

  previewImportExcel(file: File): Observable<ContractImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return this.http
      .post<ApiResponse<ContractImportPreviewResult>>(`${this.baseUrl}/import-preview`, formData)
      .pipe(
        map((res) => res.data),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể đọc file Excel.')))
      );
  }

  saveImportContracts(items: ContractImportItem[]): Observable<{ data: ContractImportSaveResult; message: string }> {
    return this.http
      .post<ApiResponse<ContractImportSaveResult>>(`${this.baseUrl}/import-save`, { items })
      .pipe(
        map((res) => ({ data: res.data, message: res.message })),
        catchError((err) => throwError(() => new Error(err.error?.message || 'Không thể lưu danh sách hợp đồng.')))
      );
  }

  exportWord(contractId: number): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/${contractId}/export-word`, { responseType: 'blob' });
  }

  private normalizeBranchId(b?: string | number | null): number | null {
    if (b === null || b === undefined || b === 'all') return null;
    if (typeof b === 'number') return b;
    if (b === 'cn-q1') return 1;
    if (b === 'cn-q3') return 2;
    if (b === 'cn-td') return 3;
    if (b === 'cn-bt') return 4;
    const n = parseInt(b, 10);
    return isNaN(n) ? null : n;
  }
}
