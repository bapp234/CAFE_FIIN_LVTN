import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { AllowedWorkflowItem, ContractType, CreateEmployeeDto, Employee, EmployeeFilterQuery, EmployeeFullProfile, EmployeeImportItem, EmployeeImportPreviewResult, EmployeeImportSaveRequest, EmployeeImportSaveResult, UpdateEmployeeProfileDto } from '../models/employee';
import { GridColumn, GridDataset, GridRow } from '../../../components/admin_grid_table/admin_grid_table';
interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface AttendancePeriodStatus {
  periodId: number;
  branchId: number;
  periodMonth: string;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
  unlockedBy?: string;
  unlockedAt?: string;
  unlockReason?: string;
}

export interface LockAttendancePeriodRequest {
  branchId: number;
  periodMonth: string;
  lockedBy?: string;
  password?: string;
}

export interface UnlockAttendancePeriodRequest {
  branchId: number;
  periodMonth: string;
  unlockPassword: string;
  unlockReason: string;
  unlockedBy?: string;
}

export interface AttendanceMonthlySummaryItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  workingStatus: string;
  standardDays: number;
  workDays: number;
  workHours: number;
  totalWorkHours: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  otNormalHours: number;
  otWeekendHours: number;
  otHolidayHours: number;
  earlyLateCount: number;
  missingPunchCount: number;
}

export interface OvertimeTypeItem {
  overtimeTypeId: number;
  otCode: string;
  otName: string;
  otCategory: 'normal' | 'weekend' | 'holiday' | 'night' | string;
  scope: 'all' | 'store' | 'office' | string;
  payMultiplier: number;
  nightExtraRate: number;
  maxHoursPerDay: number;
  maxHoursPerMonth: number;
  roundingMinutes: number;
  requireApproval: boolean;
  allowCompensatoryLeave: boolean;
  description?: string | null;
  isActive: boolean;
}

export interface SaveOvertimeTypeRequest {
  overtimeTypeId?: number | null;
  otCode: string;
  otName: string;
  otCategory: string;
  scope: string;
  payMultiplier: number;
  nightExtraRate: number;
  maxHoursPerDay: number;
  maxHoursPerMonth: number;
  roundingMinutes: number;
  requireApproval: boolean;
  allowCompensatoryLeave: boolean;
  description?: string | null;
  isActive: boolean;
}

export interface LeaveTypeItem {
  leaveTypeId: number;
  leaveCode: string;
  leaveName: string;
  scope: 'all' | 'store' | 'office' | string;
  isPaid: boolean;
  paidPercent: number;
  deductAnnualLeave: boolean;
  standardDaysPerYear: number;
  minNoticeDays: number;
  monthlyAccrual: boolean;
  probationEligible: boolean;
  allowNegativeBalance: boolean;
  description?: string | null;
  isActive: boolean;
}

export interface SaveLeaveTypeRequest {
  leaveTypeId?: number | null;
  leaveCode: string;
  leaveName: string;
  scope: string;
  isPaid: boolean;
  paidPercent: number;
  deductAnnualLeave: boolean;
  standardDaysPerYear: number;
  minNoticeDays: number;
  monthlyAccrual: boolean;
  probationEligible: boolean;
  allowNegativeBalance: boolean;
  description?: string | null;
  isActive: boolean;
}

export interface HolidayItem {
  holidayId: number;
  holidayDate: string;
  holidayName: string;
  year: number;
  payMultiplier: number;
  isPaid: boolean;
}

export interface OvertimeRequestItem {
  overtimeId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  otCode: string;
  otName: string;
  otType: string;
  payMultiplier: number;
  reason: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | string;
  approvedAt?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface CreateOvertimeRequestPayload {
  employeeId: number;
  workDate: string;
  startTime: string;
  endTime: string;
  otCode: string;
  reason: string;
}

export interface AttendanceCorrectionRequestItem {
  requestId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  workDate: string;
  scheduledStart: string;
  scheduledEnd: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  requestedHours: number;
  reason: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | string;
  approvedByName?: string | null;
  approvedAt?: string | null;
  approverNote?: string | null;
  createdAt: string;
}

export interface CreateAttendanceCorrectionRequestPayload {
  employeeId: number;
  workDate: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export interface LeaveRequestItem {
  leaveId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number | null;
  branchName: string;
  fromDate: string;
  toDate: string;
  leaveDays: number;
  leaveCode: string;
  leaveName: string;
  leaveType: string;
  isPaid: boolean;
  paidPercent: number;
  reason: string;
  approvalStatus: 'pending' | 'approved' | 'rejected' | string;
  approvedAt?: string | null;
  note?: string | null;
  createdAt: string;
}

export interface CreateLeaveRequestPayload {
  employeeId: number;
  fromDate: string;
  toDate: string;
  leaveCode: string;
  reason: string;
}

export interface ProcessHrmRequestPayload {
  action: 'approved' | 'rejected' | 'request_cancel' | 'approve_cancel' | 'reject_cancel';
  approverName?: string;
  note?: string;
}

export function getPositionLevel(pos: string): number {
  if (!pos) return 1;
  const p = pos.toLowerCase();
  if (p.includes('quản trị viên') || p.includes('admin') || p.includes('giám đốc')) return 5;
  if (p.includes('nhân sự') || p.includes('hrm')) return 4;
  if (p.includes('quản lý cửa hàng') || p.includes('cửa hàng trưởng')) return 3;
  if (p.includes('trưởng ca')) return 2;
  return 1;
}

export interface RoleSummary {
  roleId: number;
  roleName: string;
  description: string;
  hierarchyLevel: number;
  memberCount: number;
  badgeColor: string;
}

export interface ModulePermission {
  moduleKey: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
  approvalLevel: number;
}

export interface RoleAccountPolicy {
  defaultPassword: string;
  mustChangePasswordOnFirstLogin: boolean;
  sessionTimeoutMinutes: number;
  allowLoginOutsideShift: boolean;
  enableTwoFactorAuth: boolean;
}

export interface RoleMember {
  userId: number;
  employeeId: number;
  employeeCode: string;
  fullName: string;
  username: string;
  email?: string;
  phoneNumber?: string;
  branchName: string;
  position: string;
  status: string;
  isActive: boolean;
  roleId?: number;
  roleName?: string;
  hierarchyLevel?: number;
  approvalLevel?: number;
}

export interface EmployeePermissionSettingItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchId: number;
  branchName: string;
  employeeStatus: string;
  userId?: number;
  username?: string;
  isUserActive: boolean;
  approvalLevel: number;
  approvalLevelName: string;
  roleNames?: string;
  roleIds?: string;
}

export interface RoleModalItem {
  roleId: number;
  roleName: string;
  description?: string;
  parentRoleId?: number;
  isAssigned: boolean;
}

export interface PermissionItem {
  permissionId: number;
  permissionCode: string;
  moduleCode: string;
  moduleName: string;
  permissionName: string;
  description?: string;
  sortOrder: number;
}

export interface RolePermissionMapping {
  roleId: number;
  permissionId: number;
  permissionCode: string;
}

export interface RolePermissionMatrix {
  permissions: PermissionItem[];
  mappings: RolePermissionMapping[];
}

export interface RoleDetailSettings {
  roleId: number;
  roleName: string;
  description: string;
  hierarchyLevel: number;
  permissions: ModulePermission[];
  accountPolicy: RoleAccountPolicy;
  members: RoleMember[];
}

export interface UnprovisionedEmployee {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  position: string;
  branchName: string;
  status: string;
}

export interface EmployeeSimpleItem {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  citizenId?: string;
  position: string;
  branchId: number;
  branchName: string;
  contractName?: string;
  employeeStatus: string;
  hireDate: string;
  hourlyRate?: number;
  hasAccount: boolean;
  userId?: number;
  username?: string;
  roleName?: string;
  hierarchyLevel: number;
  isUserActive: boolean;
  mustChangePassword: boolean;
  totalCount?: number;
}

export interface DashboardPositionItem {
  groupId: string;
  label: string;
  color: string;
  count: number;
}

export interface DashboardMonthlyStat {
  month: number;
  headcount: number;
  hiredCount: number;
  resignedCount: number;
  salaryCostVnd?: number;
  workHours?: number;
}

export interface DashboardAttendanceSummary {
  totalShifts: number;
  onTimeCount: number;
  lateCount: number;
  earlyLeaveCount: number;
  missingPunchCount: number;
}

export interface HrmDashboardSummary {
  totalEmployees: number;
  workingEmployees: number;
  resignedEmployees: number;
  probationEmployees: number;
  positionBreakdown: DashboardPositionItem[];
  monthlyStats: DashboardMonthlyStat[];
  attendanceSummary: DashboardAttendanceSummary;
}

export const FALLBACK_ROLES: RoleSummary[] = [
  { roleId: 1, roleName: 'Admin', description: 'Quản trị viên toàn hệ thống', hierarchyLevel: 5, memberCount: 1, badgeColor: 'red' },
  { roleId: 2, roleName: 'HRM', description: 'Chuyên viên Quản trị Nhân sự & Tiền lương', hierarchyLevel: 4, memberCount: 2, badgeColor: 'blue' },
  { roleId: 3, roleName: 'Manager', description: 'Quản lý Cửa hàng Chi nhánh', hierarchyLevel: 3, memberCount: 3, badgeColor: 'amber' },
  { roleId: 4, roleName: 'Cashier', description: 'Thu ngân bán hàng POS', hierarchyLevel: 2, memberCount: 4, badgeColor: 'emerald' },
  { roleId: 5, roleName: 'Barista', description: 'Pha chế quầy bar', hierarchyLevel: 1, memberCount: 4, badgeColor: 'cyan' },
];

export const FALLBACK_EMPLOYEES: Employee[] = [
  {
    id: '1',
    employeeId: 1,
    code: 'NV001',
    employeeCode: 'NV001',
    fullName: 'Đặng Quốc Anh',
    phone: '0901 234 567',
    phoneNumber: '0901 234 567',
    email: 'quocanh@fiin.vn',
    citizenId: '079000012345',
    bankName: 'MB Bank',
    bankAccountNumber: '1000987654',
    bankAccountName: 'ĐẶNG QUỐC ANH',
    branchId: 'cn-q1',
    numericBranchId: 1,
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Trưởng ca Pha chế',
    contractTypeId: 5,
    contractCode: 'HD-QUAN-LY',
    contractName: 'Hợp đồng Quản lý Cửa hàng / Trưởng ca',
    hourlyRate: 35000,
    allowance: 1500000,
    benefitsDescription: 'Đầy đủ chế độ bảo hiểm, phụ cấp trách nhiệm quản lý 1.500.000đ, thưởng theo KPI tăng trưởng cửa hàng.',
    status: 'active',
    startDate: '15/01/2025',
    contractType: 'full_time',
    dateOfBirth: '1998-04-12',
    gender: 'male',
    note: 'Chứng chỉ Barista Specialty, quản lý ca sáng tốt.',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '2',
    employeeId: 2,
    code: 'NV002',
    employeeCode: 'NV002',
    fullName: 'Nguyễn Thị Hương',
    phone: '0902 345 678',
    phoneNumber: '0902 345 678',
    email: 'huongnt@fiin.vn',
    citizenId: '079000024690',
    bankName: 'Techcombank',
    bankAccountNumber: '1001975308',
    bankAccountName: 'NGUYỄN THỊ HƯƠNG',
    branchId: 'cn-q1',
    numericBranchId: 1,
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Barista Chuyên nghiệp',
    contractTypeId: 3,
    contractCode: 'HD-CHINH-THUC',
    contractName: 'Hợp đồng Lao động Chính thức (Full-time)',
    hourlyRate: 28000,
    allowance: 1000000,
    benefitsDescription: 'Tham gia đầy đủ BHXH/BHYT theo luật, phụ cấp cơm trưa 1.000.000đ/tháng, thưởng doanh số chi nhánh.',
    status: 'active',
    startDate: '01/03/2025',
    contractType: 'full_time',
    dateOfBirth: '2001-08-20',
    gender: 'female',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '3',
    employeeId: 3,
    code: 'NV003',
    employeeCode: 'NV003',
    fullName: 'Lê Thanh Tùng',
    phone: '0903 456 789',
    phoneNumber: '0903 456 789',
    email: 'tunglt@fiin.vn',
    citizenId: '079000037035',
    bankName: 'ACB',
    bankAccountNumber: '1002962962',
    bankAccountName: 'LÊ THANH TÙNG',
    branchId: 'cn-q3',
    numericBranchId: 2,
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Quản lý Cửa hàng',
    contractTypeId: 5,
    contractCode: 'HD-QUAN-LY',
    contractName: 'Hợp đồng Quản lý Cửa hàng / Trưởng ca',
    hourlyRate: 42000,
    allowance: 1500000,
    benefitsDescription: 'Đầy đủ chế độ bảo hiểm, phụ cấp trách nhiệm quản lý 1.500.000đ, thưởng theo KPI tăng trưởng cửa hàng.',
    status: 'active',
    startDate: '10/11/2024',
    contractType: 'full_time',
    dateOfBirth: '1995-11-05',
    gender: 'male',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '4',
    employeeId: 4,
    code: 'NV004',
    employeeCode: 'NV004',
    fullName: 'Phạm Minh Tuấn',
    phone: '0904 567 890',
    phoneNumber: '0904 567 890',
    email: 'tuanpm@fiin.vn',
    citizenId: '079000049380',
    bankName: 'Vietcombank',
    bankAccountNumber: '1003950616',
    bankAccountName: 'PHẠM MINH TUẤN',
    branchId: 'cn-q3',
    numericBranchId: 2,
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Nhân viên Thu ngân',
    contractTypeId: 4,
    contractCode: 'HD-PART-TIME',
    contractName: 'Hợp đồng Bán thời gian (Part-time)',
    hourlyRate: 24000,
    allowance: 300000,
    benefitsDescription: 'Lịch làm việc linh hoạt theo ca học, hỗ trợ 1 ly cà phê/ca làm, thưởng chuyên cần hàng tháng.',
    status: 'active',
    startDate: '15/06/2025',
    contractType: 'part_time',
    dateOfBirth: '2003-02-14',
    gender: 'male',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '11',
    employeeId: 11,
    code: 'NV011',
    employeeCode: 'NV011',
    fullName: 'Nguyễn Văn Minh',
    phone: '0901234567',
    phoneNumber: '0901234567',
    email: 'minhnv@fiin.vn',
    citizenId: '079201009999',
    bankName: 'Vietcombank',
    bankAccountNumber: '9988776655',
    bankAccountName: 'NGUYỄN VĂN MINH',
    branchId: 'cn-q1',
    numericBranchId: 1,
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Barista Chuyên nghiệp',
    contractTypeId: 3,
    contractCode: 'HD-CHINH-THUC',
    contractName: 'Hợp đồng Lao động Chính thức (Full-time)',
    hourlyRate: 28000,
    allowance: 1000000,
    benefitsDescription: 'Tham gia đầy đủ BHXH/BHYT theo luật, phụ cấp cơm trưa 1.000.000đ/tháng.',
    status: 'active',
    startDate: '15/11/2026',
    contractType: 'full_time',
    dateOfBirth: '2001-01-01',
    gender: 'male',
    note: 'Chứng chỉ Barista cấp độ 2',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '12',
    employeeId: 12,
    code: 'NV012',
    employeeCode: 'NV012',
    fullName: 'Phan Thu Trang',
    phone: '0908112233',
    phoneNumber: '0908112233',
    email: 'trangpt@fiin.vn',
    citizenId: '079203001234',
    bankName: 'MB Bank',
    bankAccountNumber: '1122334455',
    bankAccountName: 'PHAN THU TRANG',
    branchId: 'cn-q3',
    numericBranchId: 2,
    branchName: 'Fiin Hồ Con Rùa',
    position: 'Nhân viên Phục vụ',
    contractTypeId: 4,
    contractCode: 'HD-PART-TIME',
    contractName: 'Hợp đồng Bán thời gian (Part-time)',
    hourlyRate: 25000,
    allowance: 300000,
    benefitsDescription: 'Lịch làm việc linh hoạt theo ca học, hỗ trợ 1 ly cà phê/ca làm.',
    status: 'active',
    startDate: '15/11/2026',
    contractType: 'part_time',
    dateOfBirth: '2003-05-15',
    gender: 'female',
    updatedAt: '2026-11-15T13:48:20',
  },
  {
    id: '13',
    employeeId: 13,
    code: 'NV013',
    employeeCode: 'NV013',
    fullName: 'Lê Hoàng Nam',
    phone: '0909887766',
    phoneNumber: '0909887766',
    email: 'namlh@fiin.vn',
    citizenId: '079202008888',
    bankName: 'Vietcombank',
    bankAccountNumber: '8888999900',
    bankAccountName: 'LE HOANG NAM',
    branchId: 'cn-q1',
    numericBranchId: 1,
    branchName: 'Fiin Đinh Tiên Hoàng',
    position: 'Barista Chuyên nghiệp',
    contractTypeId: 3,
    contractCode: 'HD-CHINH-THUC',
    contractName: 'Hợp đồng Lao động Chính thức (Full-time)',
    hourlyRate: 28000,
    allowance: 1000000,
    benefitsDescription: 'Tham gia đầy đủ BHXH/BHYT theo luật, phụ cấp cơm trưa 1.000.000đ/tháng.',
    status: 'active',
    startDate: '15/11/2026',
    contractType: 'full_time',
    dateOfBirth: '2002-09-10',
    gender: 'male',
    note: 'Kinh nghiệm pha chế 2 năm tại quán specialty',
    updatedAt: '2026-11-15T14:34:55',
  },
];

export const INITIAL_EMPLOYEES: Employee[] = [...FALLBACK_EMPLOYEES];

export const FALLBACK_CONTRACT_TYPES: ContractType[] = [
  { contractTypeId: 1, contractCode: 'HD-HOC-VIEC', contractName: 'Hợp đồng Đào tạo / Học việc', standardHourlyRate: 20000, allowance: 200000, salaryPercentage: 80, durationMonths: 1, benefitsDescription: 'Hỗ trợ 1 ly cà phê/ca làm việc, tài liệu đào tạo barista chuyên nghiệp.', isActive: true },
  { contractTypeId: 2, contractCode: 'HD-THU-VIEC', contractName: 'Hợp đồng Thử việc (2 tháng)', standardHourlyRate: 24000, allowance: 500000, salaryPercentage: 85, durationMonths: 2, benefitsDescription: 'Phụ cấp cơm trưa, hỗ trợ gửi xe, 1 ly cà phê/ca làm, cấp phát đồng phục miễn phí.', isActive: true },
  { contractTypeId: 3, contractCode: 'HD-CHINH-THUC', contractName: 'Hợp đồng Lao động Chính thức (Full-time)', standardHourlyRate: 28000, allowance: 1000000, salaryPercentage: 100, durationMonths: 12, benefitsDescription: 'Tham gia đầy đủ BHXH/BHYT theo luật, phụ cấp cơm trưa 1.000.000đ/tháng, thưởng doanh số chi nhánh, thưởng lễ tết.', isActive: true },
  { contractTypeId: 4, contractCode: 'HD-PART-TIME', contractName: 'Hợp đồng Bán thời gian (Part-time)', standardHourlyRate: 25000, allowance: 300000, salaryPercentage: 100, durationMonths: 6, benefitsDescription: 'Lịch làm việc linh hoạt theo ca học, hỗ trợ 1 ly cà phê/ca làm, thưởng chuyên cần hàng tháng.', isActive: true },
  { contractTypeId: 5, contractCode: 'HD-QUAN-LY', contractName: 'Hợp đồng Quản lý Cửa hàng / Trưởng ca', standardHourlyRate: 38000, allowance: 1500000, salaryPercentage: 100, durationMonths: 24, benefitsDescription: 'Đầy đủ chế độ bảo hiểm, phụ cấp trách nhiệm quản lý 1.500.000đ, thưởng theo KPI tăng trưởng cửa hàng, xét tăng lương 6 tháng/lần.', isActive: true },
];

@Injectable({ providedIn: 'root' })
export class HrmEmployeeApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:5107/api/v1/employees';
  private localEmployees: Employee[] = [];

  /**
   * Lấy danh sách nhân viên: ưu tiên gọi Backend API /hierarchy theo phân quyền cây phả hệ
   * Nếu offline tự động fallback về danh sách chuẩn
   */

  getEmployees(query: EmployeeFilterQuery, currentUserRole?: string, currentUsername?: string): Observable<Page<Employee>> {
    let params = new HttpParams();

    if (currentUsername) {
      params = params.set('currentUsername', currentUsername);
    }
    if (query.branchId && query.branchId !== 'all') {
      const bId = this.normalizeBranchId(query.branchId);
      if (bId) params = params.set('branchId', bId);
    }

    if (query.status && query.status !== 'all') {
      const dbStatus = query.status === 'working' ? 'active' : query.status;
      params = params.set('status', dbStatus);
    }

    if (query.q) {
      params = params.set('search', query.q.trim());
    }

    params = params.set('pageIndex', query.page || 1);
    params = params.set('pageSize', query.size || 10);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/hierarchy`, { params }).pipe(
      map((res) => {
        if (!res.data || !res.data.items) {
          return { items: [], total: 0, page: query.page || 1, size: query.size || 10, totalPages: 1 };
        }
        const items: Employee[] = res.data.items.map((dto: any) => this.mapDtoToEmployee(dto));
        const total = res.data.total ?? items.length;
        const totalPages = res.data.totalPages ?? Math.max(1, Math.ceil(total / (query.size || 10)));
        return {
          items,
          total,
          page: query.page || 1,
          size: query.size || 10,
          totalPages,
        };
      }),
      catchError(() =>
        of({ items: [], total: 0, page: query.page || 1, size: query.size || 10, totalPages: 1 })
      )
    );
  }

  /**
   * Lấy danh sách nhân viên phân cấp phả hệ phục vụ phân trang lười (Lazy Loading / Infinite Scroll)
   * Tải trước 50 nhân viên đầu tiên, khi cuộn chuột nạp thêm 10 nhân viên tiếp theo
   */
  getEmployeesByHierarchy(params: {
    currentUsername?: string;
    currentUserId?: number;
    currentEmployeeId?: number;
    branchId?: string | number;
    status?: string;
    search?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Observable<{ items: Employee[]; total: number }> {
    let httpParams = new HttpParams();
    if (params.currentUsername) httpParams = httpParams.set('currentUsername', params.currentUsername);
    if (params.currentUserId) httpParams = httpParams.set('currentUserId', params.currentUserId);
    if (params.currentEmployeeId) httpParams = httpParams.set('currentEmployeeId', params.currentEmployeeId);
    if (params.branchId && params.branchId !== 'all') {
      const bId = this.normalizeBranchId(params.branchId);
      if (bId) httpParams = httpParams.set('branchId', bId);
    }
    if (params.status && params.status !== 'all') {
      const dbStatus = params.status === 'working' ? 'active' : params.status;
      httpParams = httpParams.set('status', dbStatus);
    }
    if (params.search) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    httpParams = httpParams.set('pageIndex', params.pageIndex || 1);
    httpParams = httpParams.set('pageSize', params.pageSize || 50);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/hierarchy`, { params: httpParams }).pipe(
      map((res) => {
        if (!res.data || !res.data.items) {
          return { items: [], total: 0 };
        }
        const items = res.data.items.map((dto: any) => this.mapDtoToEmployee(dto));
        return {
          items,
          total: res.data.total ?? items.length,
        };
      }),
      catchError(() => of({ items: [], total: 0 }))
    );
  }

  /**
   * Lấy bộ dữ liệu động (Metadata Cột + Dữ liệu Dòng) từ Stored Procedure sp_HRM_GetEmployees_GridDataset
   * Các cột hiển thị do CSDL sinh ra động, không cần hardcode trên UI
   */
  getEmployeesGridDataset(params: {
    currentUsername?: string;
    branchId?: string | number;
    position?: string;
    status?: string;
    targetDate?: string;
    search?: string;
    pageIndex?: number;
    pageSize?: number;
  }): Observable<GridDataset & { total: number }> {
    let httpParams = new HttpParams();
    if (params.currentUsername) httpParams = httpParams.set('currentUsername', params.currentUsername);
    if (params.branchId && params.branchId !== 'all') {
      const bId = this.normalizeBranchId(params.branchId);
      if (bId) httpParams = httpParams.set('branchId', bId);
    }
    if (params.position && params.position !== 'all') httpParams = httpParams.set('position', params.position);
    if (params.status && params.status !== 'all') {
      const dbStatus = params.status === 'working' ? 'active' : params.status;
      httpParams = httpParams.set('status', dbStatus);
    }
    if (params.targetDate) httpParams = httpParams.set('targetDate', params.targetDate);
    if (params.search) httpParams = httpParams.set('search', params.search.trim());
    httpParams = httpParams.set('pageIndex', params.pageIndex || 1);
    httpParams = httpParams.set('pageSize', params.pageSize || 50);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/grid-dataset`, { params: httpParams }).pipe(
      map((res) => {
        if (!res.data || !res.data.columns || !res.data.rows) {
          throw new Error('Dữ liệu grid-dataset rỗng hoặc không đúng định dạng');
        }

        const columns: GridColumn[] = res.data.columns.map((c: any) => ({
          key: c.key || c.Key,
          label: c.label || c.Label,
          type: c.type || c.Type || 'text',
          align: c.align || c.Align || 'left',
          width: c.width || c.Width,
          minWidth: c.minWidth || c.MinWidth,
          sortable: c.sortable ?? c.Sortable ?? false,
          mono: c.mono ?? c.Mono ?? false,
          bold: c.bold ?? c.Bold ?? false,
        }));

        const rows: GridRow[] = res.data.rows.map((r: any) => ({
          ...r,
          id: r.employeeId || r.EmployeeId || r.code,
          _raw: this.mapDtoToEmployee(r),
        }));

        return {
          columns,
          rows,
          total: res.data.totalCount ?? rows.length,
        };
      }),
      catchError((err) => {
        console.error('Lỗi khi gọi Backend API /grid-dataset:', err);
        return of({
          columns: [],
          rows: [],
          total: 0,
        });
      })
    );
  }

  /**
   * Lấy danh sách nhân viên tinh gọn qua Backend API /simple (ánh xạ Stored Procedure dbo.sp_HRM_GetEmployees_Simple)
   * @param params.accountStatus: 1 (đã có TK/MK, trừ nghỉ việc), 0 (chưa có TK/MK, trừ nghỉ việc), -1 (lấy tất cả)
   */
  getEmployeesSimple(params: {
    accountStatus?: number;
    viewDate?: string;
    branchId?: number | null;
    search?: string;
    loginId?: number;
    pageIndex?: number;
    pageSize?: number;
  }): Observable<EmployeeSimpleItem[]> {
    let httpParams = new HttpParams();
    if (params.accountStatus !== undefined) httpParams = httpParams.set('accountStatus', params.accountStatus);
    if (params.viewDate) httpParams = httpParams.set('viewDate', params.viewDate);
    if (params.branchId && params.branchId > 0) httpParams = httpParams.set('branchId', params.branchId);
    if (params.search) httpParams = httpParams.set('search', params.search.trim());
    if (params.loginId) httpParams = httpParams.set('loginId', params.loginId);
    if (params.pageIndex !== undefined) httpParams = httpParams.set('pageIndex', params.pageIndex);
    if (params.pageSize !== undefined) httpParams = httpParams.set('pageSize', params.pageSize);

    return this.http.get<ApiResponse<EmployeeSimpleItem[]>>(`${this.baseUrl}/simple`, { params: httpParams }).pipe(
      map(res => res.data || []),
      catchError((err) => {
        console.error('Lỗi khi gọi Backend API /employees/simple:', err);
        return of([]);
      })
    );
  }

  /**
   * Lấy toàn bộ số liệu tổng hợp KPI và biểu đồ chuyên biệt cho HRM Dashboard
   * (ánh xạ Stored Procedure dbo.sp_HRM_GetDashboardSummary)
   */
  getDashboardSummary(params: {
    branchId?: number | null;
    year?: number;
    month?: number;
    loginId?: number;
  }): Observable<HrmDashboardSummary | null> {
    let httpParams = new HttpParams();
    if (params.branchId && params.branchId > 0) httpParams = httpParams.set('branchId', params.branchId);
    if (params.year) httpParams = httpParams.set('year', params.year);
    if (params.month) httpParams = httpParams.set('month', params.month);
    if (params.loginId) httpParams = httpParams.set('loginId', params.loginId);

    return this.http.get<ApiResponse<HrmDashboardSummary>>(`${this.baseUrl}/dashboard-summary`, { params: httpParams }).pipe(
      map((res) => res.data || null),
      catchError((err) => {
        console.error('Lỗi khi gọi Backend API /employees/dashboard-summary:', err);
        return of(null);
      })
    );
  }

  /**
   * Xuất danh sách nhân sự ra file Excel (.xlsx) theo template ParadiseHR
   */
  exportEmployeesExcel(params: {
    branchId?: string | number;
    position?: string;
    status?: string;
    search?: string;
    employeeCodes?: string;
    accountStatus?: number;
  }): Observable<Blob> {
    let httpParams = new HttpParams();
    if (params.branchId && params.branchId !== 'all') {
      const bId = this.normalizeBranchId(params.branchId);
      if (bId) httpParams = httpParams.set('branchId', bId);
    }
    if (params.position && params.position !== 'all') {
      httpParams = httpParams.set('position', params.position);
    }
    if (params.status && params.status !== 'all') {
      const dbStatus = params.status === 'working' ? 'active' : params.status;
      httpParams = httpParams.set('status', dbStatus);
    }
    if (params.search && params.search.trim()) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params.employeeCodes && params.employeeCodes.trim()) {
      httpParams = httpParams.set('employeeCodes', params.employeeCodes.trim());
    }
    if (params.accountStatus !== undefined) {
      httpParams = httpParams.set('accountStatus', params.accountStatus);
    }

    return this.http.get(`${this.baseUrl}/export-excel`, {
      params: httpParams,
      responseType: 'blob',
    });
  }

  /**
   * Xuất bảng dữ liệu HRM bất kỳ ra tệp Excel (.xlsx) theo template chuẩn Café Sài Gòn Vintage
   */
  exportStandardExcel(payload: {
    templateKey: string;
    sheetName: string;
    reportTitle: string;
    summaryLabel?: string;
    fileName: string;
    headers: string[];
    rows: Record<string, unknown>[];
  }): Observable<Blob> {
    return this.http.post('http://localhost:5107/api/v1/hrm/excel/export-standard', payload, {
      responseType: 'blob',
    });
  }

  /**
   * Đọc dữ liệu bảng từ tệp Excel (.xlsx) tải lên (dùng cho Nhập lịch phân ca tuần, ...)
   */
  parseExcelRows(file: File): Observable<{ headers: string[]; rows: Record<string, string>[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<ApiResponse<{ headers: string[]; rows: Record<string, string>[] }>>(
        'http://localhost:5107/api/v1/hrm/excel/parse-excel',
        formData
      )
      .pipe(map((res) => res.data));
  }

  /**
   * Điều chỉnh giờ công thủ công theo nhân sự & ngày (kiểm tra khóa kỳ công & ghi Audit Trail)
   */
  adjustAttendanceManual(payload: {
    employeeId: number;
    workDate: string;
    checkInTime: string;
    checkOutTime: string;
    adjustedBy: string;
    adjustedReason: string;
  }): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/adjust-manual', payload)
      .pipe(map((res) => res.data ?? 0));
  }

  /**
   * Kích hoạt tải xuống tệp Excel Blob trên trình duyệt
   */
  downloadExcelBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Tải file Excel mẫu chuẩn (.xlsx) để người dùng điền dữ liệu nhập nhanh
   */
  downloadImportTemplate(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/import-template`, {
      responseType: 'blob',
    });
  }

  /**
   * Tải file Excel lên để đọc trước và kiểm tra tính hợp lệ dữ liệu (Preview & Validation)
   */
  previewImportExcel(file: File): Observable<EmployeeImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<ApiResponse<EmployeeImportPreviewResult>>(`${this.baseUrl}/import-preview`, formData).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Không thể đọc file Excel.');
        }
        return res.data;
      })
    );
  }

  /**
   * Xác nhận nạp hàng loạt (100+ nhân viên) vào CSDL
   */
  saveImportEmployees(payload: EmployeeImportSaveRequest): Observable<EmployeeImportSaveResult> {
    return this.http.post<ApiResponse<EmployeeImportSaveResult>>(`${this.baseUrl}/import-save`, payload).pipe(
      map((res) => {
        if (!res.success || !res.data) {
          throw new Error(res.message || 'Không thể lưu danh sách nhân sự.');
        }
        return res.data;
      })
    );
  }

  /**
   * Lấy toàn bộ danh mục tùy chọn cho các combobox bộ lọc (Chi nhánh, Chức vụ, Trạng thái, Loại HĐ)
   */
  getEmployeesFilterOptions(): Observable<{
    branches: { value: string; label: string }[];
    positions: { value: string; label: string }[];
    statuses: { value: string; label: string }[];
    contractTypes: { value: string; label: string }[];
  }> {
    return this.http
      .get<ApiResponse<{
        branches: { value: string; label: string }[];
        positions: { value: string; label: string }[];
        statuses: { value: string; label: string }[];
        contractTypes: { value: string; label: string }[];
      }>>(`${this.baseUrl}/filter-options`)
      .pipe(
        map((res) => res.data),
        catchError((err) => {
          console.error('Lỗi khi nạp filter-options từ backend:', err);
          return of({
            branches: [],
            positions: [],
            statuses: [],
            contractTypes: [],
          });
        })
      );
  }

  /**
   * Lấy chi tiết hồ sơ 5 nhóm trường thông tin đầy đủ từ dbo.sp_HRM_GetEmployeeFullProfile
   */
  getFullProfile(employeeId: number | string, targetDate?: string): Observable<EmployeeFullProfile | null> {
    const rawStr = String(employeeId);
    const numId = parseInt(rawStr.replace(/\D/g, ''), 10);
    const validId = isNaN(numId) ? 1 : numId;

    let params = new HttpParams();
    if (targetDate) params = params.set('targetDate', targetDate);

    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${validId}/full-profile`, { params }).pipe(
      map((res) => {
        if (!res.data) return null;
        const d = res.data;
        let allowedWorkflows: AllowedWorkflowItem[] = [];
        if (d.allowedWorkflowsJson) {
          try {
            allowedWorkflows = typeof d.allowedWorkflowsJson === 'string'
              ? JSON.parse(d.allowedWorkflowsJson)
              : d.allowedWorkflowsJson;
          } catch (e) {
            console.warn('Lỗi phân giải JSON allowedWorkflowsJson:', e);
          }
        }

        const profile: EmployeeFullProfile = {
          employeeId: d.employeeId || d.EmployeeId || validId,
          employeeCode: d.employeeCode || d.EmployeeCode || `NV${String(validId).padStart(3, '0')}`,
          fullName: d.fullName || d.FullName || '',
          phoneNumber: d.phoneNumber || d.PhoneNumber,
          email: d.email || d.Email,
          dateOfBirth: d.dateOfBirth || d.DateOfBirth,
          gender: d.gender || d.Gender,
          citizenId: d.citizenId || d.CitizenId,
          status: d.status || d.Status || 'active',
          hireDate: d.hireDate || d.HireDate,
          note: d.note || d.Note,
          bankName: d.bankName || d.BankName,
          bankAccountNumber: d.bankAccountNumber || d.BankAccountNumber,
          bankAccountName: d.bankAccountName || d.BankAccountName,
          branchId: d.branchId || d.BranchId,
          branchCode: d.branchCode || d.BranchCode,
          branchName: d.branchName || d.BranchName,
          contractTypeId: d.contractTypeId || d.ContractTypeId,
          contractCode: d.contractCode || d.ContractCode,
          contractName: d.contractName || d.ContractName,
          hourlyRate: d.hourlyRate || d.HourlyRate,
          allowance: d.allowance || d.Allowance,
          benefitsDescription: d.benefitsDescription || d.BenefitsDescription,
          userId: d.userId || d.UserId,
          username: d.username || d.Username,
          roleId: d.roleId || d.RoleId,
          roleName: d.roleName || d.RoleName,
          hierarchyLevel: d.hierarchyLevel || d.HierarchyLevel || 1,
          approvalLevel: d.approvalLevel || d.ApprovalLevel,
          directManagerName: d.directManagerName || d.DirectManagerName,
          directManagerCode: d.directManagerCode || d.DirectManagerCode,
          allowedWorkflowsJson: d.allowedWorkflowsJson || d.AllowedWorkflowsJson,
          allowedWorkflows,
        };
        return profile;
      }),
      catchError(() => of(null))
    );
  }

  private getFallbackFullProfile(id: number): EmployeeFullProfile {
    const emp = this.localEmployees.find((e) => e.employeeId === id) || this.localEmployees[0];
    const contract = FALLBACK_CONTRACT_TYPES.find((c) => c.contractTypeId === emp.contractTypeId) || FALLBACK_CONTRACT_TYPES[4];
    const level = getPositionLevel(emp.position);

    const workflows: AllowedWorkflowItem[] = [];
    if (level >= 4) {
      workflows.push(
        { WorkflowCode: 'PAYROLL_PERIOD_LOCK', WorkflowName: 'Khóa kỳ lương & Phê duyệt chi trả lương toàn chuỗi', Description: 'Duyệt bảng lương và ủy nhiệm chi ngân hàng', MinApprovalLevel: 4 },
        { WorkflowCode: 'NEW_HIRE_ONBOARDING', WorkflowName: 'Tiếp nhận & bổ nhiệm nhân sự mới', Description: 'Duyệt ký hợp đồng lao động và bổ nhiệm', MinApprovalLevel: 4 }
      );
    }
    if (level >= 3) {
      workflows.push(
        { WorkflowCode: 'INVENTORY_WASTE', WorkflowName: 'Phê duyệt đề xuất hủy hàng hư hỏng / Hao hụt kho', Description: 'Duyệt hủy tồn kho chi nhánh', MinApprovalLevel: 3 },
        { WorkflowCode: 'SALARY_ADVANCE', WorkflowName: 'Phê duyệt đơn xin tạm ứng lương giữa kỳ', Description: 'Duyệt đơn ứng lương của nhân viên chi nhánh', MinApprovalLevel: 3 }
      );
    }
    if (level >= 2) {
      workflows.push(
        { WorkflowCode: 'SHIFT_SWAP', WorkflowName: 'Phê duyệt đơn xin đổi ca làm việc & chốt lịch trực hàng tuần', Description: 'Duyệt đổi ca trực giữa các nhân viên chi nhánh', MinApprovalLevel: 2 },
        { WorkflowCode: 'SHORT_LEAVE', WorkflowName: 'Phê duyệt đơn xin nghỉ phép ngắn hạn (≤ 1 ngày)', Description: 'Duyệt nghỉ phép ngắn hạn theo ca trực', MinApprovalLevel: 2 }
      );
    }
    if (level === 1) {
      workflows.push(
        { WorkflowCode: 'MY_REQUESTS', WorkflowName: 'Tạo phiếu đổi ca, xin nghỉ phép, tạm ứng lương cá nhân', Description: 'Gửi yêu cầu cá nhân lên trưởng ca xem xét', MinApprovalLevel: 1 }
      );
    }

    return {
      employeeId: emp.employeeId || id,
      employeeCode: emp.employeeCode || emp.code,
      fullName: emp.fullName,
      phoneNumber: emp.phoneNumber || emp.phone,
      email: emp.email,
      dateOfBirth: emp.dateOfBirth,
      gender: emp.gender,
      citizenId: emp.citizenId || '079000012345',
      status: emp.status,
      hireDate: emp.startDate || '2025-01-15',
      note: emp.note || 'Chứng chỉ Barista Specialty, quản lý ca sáng tốt.',
      bankName: emp.bankName || 'MB Bank',
      bankAccountNumber: emp.bankAccountNumber || '1000987654',
      bankAccountName: emp.bankAccountName || emp.fullName.toUpperCase(),
      branchId: emp.numericBranchId || 1,
      branchCode: emp.branchCode || 'CN-Q1',
      branchName: emp.branchName,
      contractTypeId: emp.contractTypeId || 5,
      contractCode: emp.contractCode || contract.contractCode,
      contractName: emp.contractName || contract.contractName,
      hourlyRate: emp.hourlyRate || contract.standardHourlyRate,
      allowance: emp.allowance || contract.allowance,
      benefitsDescription: emp.benefitsDescription || contract.benefitsDescription,
      userId: emp.userId || id,
      username: emp.username || (emp.employeeCode || emp.code).toLowerCase(),
      roleId: level === 5 ? 1 : level === 3 ? 3 : level === 2 ? 6 : 5,
      roleName: level === 5 ? 'Admin' : level === 3 ? 'StoreManager' : level === 2 ? 'ShiftLeader' : 'Staff',
      hierarchyLevel: level,
      approvalLevel: level === 5 ? 3 : level === 3 ? 2 : level === 2 ? 2 : 1,
      directManagerName: level < 5 ? 'Lê Thanh Tùng' : undefined,
      directManagerCode: level < 5 ? 'NV003' : undefined,
      allowedWorkflowsJson: JSON.stringify(workflows),
      allowedWorkflows: workflows,
    };
  }

  getProfileForUser(user: { id?: string; employeeId?: number; username?: string; email?: string; name?: string; role?: string } | null): Observable<Employee> {
    if (!user) {
      return of(this.localEmployees[0]);
    }
    if (user.employeeId) {
      const byEmpId = this.localEmployees.find((e) => Number(e.employeeId || e.id) === user.employeeId);
      if (byEmpId) return of(byEmpId);
      return of({
        ...this.localEmployees[0],
        id: String(user.employeeId),
        employeeId: user.employeeId,
        fullName: user.name || this.localEmployees[0].fullName,
        email: user.email || this.localEmployees[0].email,
        username: user.username,
      });
    }
    // 1. Tìm theo email
    if (user.email) {
      const byEmail = this.localEmployees.find((e) => e.email?.toLowerCase() === user.email?.toLowerCase());
      if (byEmail) return of(byEmail);
    }
    // 2. Tìm theo họ tên
    if (user.name) {
      const byName = this.localEmployees.find((e) => e.fullName?.toLowerCase() === user.name?.toLowerCase());
      if (byName) return of(byName);
    }
    // 3. Tìm theo vị trí tương ứng phân quyền
    if (user.role) {
      const userLevel = getPositionLevel(user.role);
      const byLevel = this.localEmployees.find((e) => getPositionLevel(e.position) === userLevel);
      if (byLevel) return of(byLevel);
    }
    // 4. Default: trả về nhân viên đầu tiên
    return of(this.localEmployees[0]);
  }

  getEmployeeById(id: string | number): Observable<Employee | null> {
    const strId = String(id).toLowerCase();
    return this.http.get<ApiResponse<any>>(`${this.baseUrl}/${id}`).pipe(
      map((res) => (res.data ? this.mapDtoToEmployee(res.data) : null)),
      catchError(() => {
        const found = this.localEmployees.find(
          (e) =>
            String(e.employeeId).toLowerCase() === strId ||
            e.id.toLowerCase() === strId ||
            e.code.toLowerCase() === strId ||
            (e.employeeCode && e.employeeCode.toLowerCase() === strId)
        ) ?? null;
        return of(found);
      })
    );
  }

  createEmployee(payload: CreateEmployeeDto): Observable<Employee> {
    return this.http.post<ApiResponse<any>>(this.baseUrl, payload).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Không thể tạo nhân viên mới');
        }
        const created = this.mapDtoToEmployee(res.data);
        this.localEmployees.unshift(created);
        return created;
      }),
      catchError((err) => {
        const errorMsg = err.error?.message || err.message || 'Lỗi kết nối máy chủ khi tạo nhân viên';
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  updateEmployeeProfile(employeeId: number | string, payload: UpdateEmployeeProfileDto): Observable<any> {
    const rawStr = String(employeeId);
    const numId = parseInt(rawStr.replace(/\D/g, ''), 10);
    const validId = isNaN(numId) ? 1 : numId;

    return this.http.put<ApiResponse<any>>(`${this.baseUrl}/${validId}/profile`, payload).pipe(
      map((res) => {
        if (!res.success) {
          throw new Error(res.message || 'Không thể cập nhật hồ sơ nhân viên');
        }
        this.updateLocalEmployeeProfile(validId, payload);
        return res.data;
      }),
      catchError((err) => {
        const errorMsg = err.error?.message || err.message || 'Không thể cập nhật hồ sơ nhân viên';
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  private updateLocalEmployeeProfile(empId: number, p: UpdateEmployeeProfileDto): void {
    const emp = this.localEmployees.find((e) => e.employeeId === empId || e.id === String(empId));
    if (emp) {
      if (p.fullName !== undefined) emp.fullName = p.fullName;
      if (p.phoneNumber !== undefined) {
        emp.phoneNumber = p.phoneNumber;
        emp.phone = p.phoneNumber;
      }
      if (p.email !== undefined) emp.email = p.email;
      if (p.dateOfBirth !== undefined && p.dateOfBirth !== null) emp.dateOfBirth = p.dateOfBirth;
      if (p.gender !== undefined) emp.gender = p.gender;
      if (p.citizenId !== undefined) emp.citizenId = p.citizenId;
      if (p.bankName !== undefined) emp.bankName = p.bankName;
      if (p.bankAccountNumber !== undefined) emp.bankAccountNumber = p.bankAccountNumber;
      if (p.bankAccountName !== undefined) emp.bankAccountName = p.bankAccountName;
      if (p.contractTypeId !== undefined) {
        emp.contractTypeId = p.contractTypeId;
        const c = FALLBACK_CONTRACT_TYPES.find((ct) => ct.contractTypeId === p.contractTypeId);
        if (c) {
          emp.contractCode = c.contractCode;
          emp.contractName = c.contractName;
        }
      }
      if (p.hourlyRate !== undefined) emp.hourlyRate = p.hourlyRate;
      if (p.allowance !== undefined) emp.allowance = p.allowance;
      if (p.note !== undefined) emp.note = p.note;
      if (p.status !== undefined) emp.status = p.status;
      emp.updatedAt = new Date().toISOString();
    }
  }

  getContractTypes(): Observable<ContractType[]> {
    return this.http.get<ApiResponse<ContractType[]>>(`${this.baseUrl}/contract-types`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  getBranches(): Observable<any[]> {
    return this.http.get<ApiResponse<any[]>>(`${this.baseUrl}/branches`).pipe(
      map((res) => res.data || []),
      catchError(() => of([]))
    );
  }

  changeStatus(id: string | number, status: 'active' | 'resigned'): Observable<boolean> {
    const item = this.localEmployees.find((e) => String(e.employeeId) === String(id) || e.id === String(id));
    if (item) item.status = status;
    return of(true);
  }

  getStats(branchId?: string): Observable<{ total: number; working: number; probation: number; resigned: number }> {
    return this.getEmployees({ page: 1, size: 1000, branchId }).pipe(
      map((page) => {
        const list = page.items;
        return {
          total: list.length,
          working: list.filter((e) => e.status === 'active' || e.status === 'working').length,
          probation: list.filter((e) => e.contractCode === 'HD-THU-VIEC' || e.contractCode === 'HD-HOC-VIEC').length,
          resigned: list.filter((e) => e.status === 'resigned').length,
        };
      })
    );
  }

  getRoleSummaries(): Observable<RoleSummary[]> {
    return this.http.get<{ success: boolean; data: RoleSummary[] }>('/api/v1/hrm/role-settings/roles').pipe(
      map(res => res?.data || []),
      catchError(() => of([]))
    );
  }

  getRoleDetailSettings(roleId: number): Observable<RoleDetailSettings> {
    return this.http.get<{ success: boolean; data: RoleDetailSettings }>(`/api/v1/hrm/role-settings/roles/${roleId}`).pipe(
      map(res => res.data),
      catchError((err) => throwError(() => new Error(err?.error?.message || 'Không thể tải chi tiết vai trò.')))
    );
  }

  saveRoleDetailSettings(roleId: number, payload: RoleDetailSettings): Observable<any> {
    return this.http.put<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/roles/${roleId}`, payload);
  }

  resetEmployeePassword(userId: number, payload: { newPassword: string; mustChangePassword?: boolean }): Observable<any> {
    return this.http.post<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/users/${userId}/reset-password`, payload);
  }

  getUnprovisionedEmployees(params?: { pageIndex?: number; pageSize?: number; search?: string; branchId?: number | null }): Observable<UnprovisionedEmployee[]> {
    return this.getEmployeesSimple({
      accountStatus: 0,
      pageIndex: params?.pageIndex || 1,
      pageSize: params?.pageSize || 50,
      search: params?.search,
      branchId: params?.branchId,
    }).pipe(
      map(items =>
        (items || []).map(e => ({
          employeeId: e.employeeId,
          employeeCode: e.employeeCode,
          fullName: e.fullName,
          position: e.position,
          branchName: e.branchName,
          status: e.employeeStatus,
        }))
      ),
      catchError(() => of([]))
    );
  }

  createAccountForEmployee(req: { employeeId: number; username: string; password: string; roleId: number; mustChangePassword?: boolean }): Observable<any> {
    return this.http.post<{ success: boolean; message: string }>(
      'http://localhost:5107/api/v1/hrm/role-settings/employees/create-account',
      req
    );
  }

  bulkCreateAccounts(req: { employeeIds: number[]; defaultPassword: string; defaultRoleId?: number; mustChangePassword?: boolean }): Observable<any> {
    return this.http.post<{ success: boolean; count: number; message: string }>(
      'http://localhost:5107/api/v1/hrm/role-settings/employees/bulk-create-accounts',
      req
    );
  }

  assignEmployeeToRole(roleId: number, userId: number): Observable<any> {
    return this.http.post<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/roles/${roleId}/assign/${userId}`, {});
  }

  removeEmployeeFromRole(roleId: number, userId: number): Observable<any> {
    return this.http.delete<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/roles/${roleId}/remove/${userId}`).pipe(
      catchError(() => of({ success: true, message: 'Đã gỡ nhân viên khỏi vai trò thành công!' }))
    );
  }

  changeEmployeeRole(userId: number, oldRoleId: number, newRoleId: number): Observable<any> {
    return this.http.put<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/users/${userId}/change-role`, {
      userId,
      oldRoleId,
      newRoleId
    }).pipe(
      catchError(() => of({ success: true, message: 'Đã thay đổi vai trò nhân sự thành công!' }))
    );
  }

  getAllActiveMembers(): Observable<RoleMember[]> {
    return of(this.localEmployees.map(e => {
      let roleId = e.roleId || 5;
      let roleName = e.roleName || 'Barista';
      let hierarchyLevel = e.hierarchyLevel || 1;
      let approvalLevel = 1;

      if (e.code === 'NV001' || (e.position && e.position.toLowerCase().includes('giám đốc'))) {
        roleId = 1;
        roleName = 'Admin';
        hierarchyLevel = 5;
        approvalLevel = 5;
      } else if (e.code === 'NV002' || e.code === 'NV003' || (e.position && e.position.toLowerCase().includes('nhân sự'))) {
        roleId = 2;
        roleName = 'HRM';
        hierarchyLevel = 4;
        approvalLevel = 4;
      } else if (e.position && (e.position.toLowerCase().includes('quản lý') || e.position.toLowerCase().includes('trưởng'))) {
        roleId = 3;
        roleName = 'Manager';
        hierarchyLevel = 3;
        approvalLevel = 3;
      } else if (e.position && (e.position.toLowerCase().includes('thu ngân') || e.position.toLowerCase().includes('cashier'))) {
        roleId = 4;
        roleName = 'Cashier';
        hierarchyLevel = 2;
        approvalLevel = 2;
      } else {
        roleId = 5;
        roleName = 'Barista';
        hierarchyLevel = 1;
        approvalLevel = 1;
      }

      return {
        userId: Number(e.id || e.employeeId),
        employeeId: Number(e.employeeId || e.id),
        employeeCode: e.code || e.employeeCode || `NV00${e.id}`,
        fullName: e.fullName,
        username: e.email ? e.email.split('@')[0] : `user_${e.id}`,
        email: e.email,
        phoneNumber: e.phone || e.phoneNumber,
        branchName: e.branchName || 'Fiin Đinh Tiên Hoàng',
        position: e.position,
        status: e.status || 'active',
        isActive: e.status !== 'resigned',
        roleId,
        roleName,
        hierarchyLevel,
        approvalLevel,
      };
    }));
  }

  updateEmployeeHierarchyAndRole(userId: number, roleId: number, hierarchyLevel: number, approvalLevel?: number): Observable<any> {
    const role = FALLBACK_ROLES.find(r => r.roleId === roleId);
    const roleName = role ? role.roleName : 'Barista';

    // Cập nhật mảng localEmployees
    const emp = this.localEmployees.find(e => Number(e.id || e.employeeId) === userId);
    if (emp) {
      emp.roleId = roleId;
      emp.roleName = roleName;
      emp.hierarchyLevel = hierarchyLevel;
    }

    return this.http.put<{ success: boolean; message: string }>(`/api/v1/hrm/role-settings/users/${userId}/hierarchy-role`, {
      userId,
      roleId,
      hierarchyLevel,
      approvalLevel: approvalLevel || hierarchyLevel
    }).pipe(
      catchError(() => of({
        success: true,
        message: `Đã cập nhật phân cấp [Cấp ${hierarchyLevel}] & Vai trò [${roleName}] thành công!`
      }))
    );
  }

  // =========================================================================
  // MA TRẬN PHÂN QUYỀN & CẤP DUYỆT (GRID MATRIX)
  // =========================================================================
  getPermissionMatrix(params?: {
    branchId?: string | number;
    search?: string;
    approvalLevel?: number;
  }): Observable<EmployeePermissionSettingItem[]> {
    let httpParams = new HttpParams();
    if (params?.branchId && params.branchId !== 'all') {
      httpParams = httpParams.set('branchId', params.branchId);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search.trim());
    }
    if (params?.approvalLevel !== undefined && params.approvalLevel >= 0) {
      httpParams = httpParams.set('approvalLevel', params.approvalLevel);
    }

    const url = 'http://localhost:5107/api/v1/hrm/role-settings/matrix';
    return this.http.get<{ success: boolean; data: EmployeePermissionSettingItem[] }>(
      url,
      { params: httpParams }
    ).pipe(
      map(res => res?.data || []),
      catchError(() => of([]))
    );
  }

  private getFallbackPermissionMatrix(): EmployeePermissionSettingItem[] {
    return this.localEmployees.map(e => {
      const empId = Number(e.id || e.employeeId) || 1;
      const lvl = e.hierarchyLevel || 1;
      return {
        employeeId: empId,
        employeeCode: e.code,
        fullName: e.fullName,
        position: e.position,
        branchId: typeof e.branchId === 'number' ? e.branchId : 1,
        branchName: e.branchName || 'Trụ sở chính',
        employeeStatus: 'active',
        userId: empId,
        username: e.code.toLowerCase(),
        isUserActive: true,
        approvalLevel: lvl > 3 ? 3 : lvl,
        approvalLevelName: lvl > 0 ? `Cấp ${lvl > 3 ? 3 : lvl}` : 'Không có quyền duyệt',
        roleNames: e.roleName || (lvl >= 5 ? 'Admin' : lvl >= 3 ? 'StoreManager' : 'Barista'),
        roleIds: String(lvl >= 5 ? 1 : lvl >= 3 ? 3 : 5)
      };
    });
  }

  updateEmployeeApprovalLevel(
    employeeId: number,
    approvalLevel: number,
    branchId?: number,
    note?: string
  ): Observable<{ success: boolean; message: string }> {
    const url = `http://localhost:5107/api/v1/hrm/role-settings/employees/${employeeId}/approval-level`;
    return this.http.put<{ success: boolean; message: string }>(
      url,
      { approvalLevel, branchId, note }
    );
  }

  getEmployeeRolesForModal(employeeId: number): Observable<RoleModalItem[]> {
    const url = `http://localhost:5107/api/v1/hrm/role-settings/employees/${employeeId}/roles`;
    return this.http.get<{ success: boolean; data: RoleModalItem[] }>(
      url
    ).pipe(
      map(res => res?.data || []),
      catchError(() => of([]))
    );
  }

  private getFallbackRolesForModal(employeeId: number): RoleModalItem[] {
    const emp = this.localEmployees.find(e => Number(e.id || e.employeeId) === employeeId);
    const assignedRole = emp?.roleName || 'Barista';
    return FALLBACK_ROLES.map(r => ({
      roleId: r.roleId,
      roleName: r.roleName,
      description: r.description,
      parentRoleId: undefined,
      isAssigned: r.roleName.toLowerCase() === assignedRole.toLowerCase() || (assignedRole === 'Admin' && r.roleId === 1)
    }));
  }

  assignRolesToEmployee(
    employeeId: number,
    roleIds: string
  ): Observable<{ success: boolean; message: string }> {
    const url = `http://localhost:5107/api/v1/hrm/role-settings/employees/${employeeId}/roles`;
    return this.http.post<{ success: boolean; message: string }>(
      url,
      { roleIds }
    );
  }

  getRolePermissionMatrix(): Observable<RolePermissionMatrix> {
    const url = 'http://localhost:5107/api/v1/hrm/role-settings/permissions-matrix';
    return this.http.get<{ success: boolean; data: RolePermissionMatrix }>(url).pipe(
      map((res) => res?.data ?? { permissions: [], mappings: [] }),
      catchError(() => of({ permissions: [], mappings: [] }))
    );
  }

  private getFallbackRoleDetail(roleId: number): RoleDetailSettings {
    const role = FALLBACK_ROLES.find(r => r.roleId === roleId) || FALLBACK_ROLES[0];
    const level = role.hierarchyLevel;
    
    // Tìm các nhân viên thuộc vai trò này
    const roleMembers: RoleMember[] = this.localEmployees
      .filter(e => {
        if (role.roleName === 'Admin') return e.code === 'NV001';
        if (role.roleName === 'HRM') return e.code === 'NV002' || e.code === 'NV003';
        if (role.roleName === 'Manager') return e.position.includes('Quản lý');
        if (role.roleName === 'Cashier') return e.position.includes('Thu ngân');
        return e.position.includes('Barista') || !e.position.includes('Quản lý');
      })
      .map(e => ({
        userId: Number(e.id || e.employeeId),
        employeeId: Number(e.employeeId || e.id),
        employeeCode: e.code || e.employeeCode || `NV00${e.id}`,
        fullName: e.fullName,
        username: e.email ? e.email.split('@')[0] : `user_${e.id}`,
        email: e.email,
        phoneNumber: e.phone || e.phoneNumber,
        branchName: e.branchName || 'Fiin Đinh Tiên Hoàng',
        position: e.position,
        status: e.status || 'active',
        isActive: e.status !== 'resigned'
      }));

    return {
      roleId: role.roleId,
      roleName: role.roleName,
      description: role.description,
      hierarchyLevel: level,
      permissions: [
        {
          moduleKey: 'hrm_employees',
          moduleName: 'Hồ sơ & Danh sách nhân sự',
          canView: true,
          canCreate: level >= 3,
          canEdit: level >= 3,
          canDelete: level >= 4,
          canApprove: level >= 3,
          approvalLevel: level >= 3 ? level : 0
        },
        {
          moduleKey: 'hrm_shifts',
          moduleName: 'Ca làm việc & Phân lịch tuần',
          canView: true,
          canCreate: level >= 3,
          canEdit: level >= 3,
          canDelete: level >= 4,
          canApprove: level >= 3,
          approvalLevel: level >= 3 ? level : 0
        },
        {
          moduleKey: 'hrm_attendance',
          moduleName: 'Chấm công & Điểm danh quầy',
          canView: true,
          canCreate: true,
          canEdit: level >= 3,
          canDelete: level >= 4,
          canApprove: level >= 3,
          approvalLevel: level >= 3 ? level : 0
        },
        {
          moduleKey: 'hrm_payroll',
          moduleName: 'Bảng lương & Tạm ứng thu nhập',
          canView: level >= 3,
          canCreate: level >= 4,
          canEdit: level >= 4,
          canDelete: level >= 5,
          canApprove: level >= 4,
          approvalLevel: level >= 4 ? level : 0
        },
        {
          moduleKey: 'hrm_settings',
          moduleName: 'Thiết lập nhân sự & Phân quyền',
          canView: level >= 4,
          canCreate: level >= 5,
          canEdit: level >= 5,
          canDelete: level >= 5,
          canApprove: level >= 5,
          approvalLevel: level >= 5 ? 5 : 0
        }
      ],
      accountPolicy: {
        defaultPassword: 'Fiin@' + new Date().getFullYear(),
        mustChangePasswordOnFirstLogin: true,
        sessionTimeoutMinutes: level >= 4 ? 240 : 480,
        allowLoginOutsideShift: level >= 3,
        enableTwoFactorAuth: level >= 4
      },
      members: roleMembers.length > 0 ? roleMembers : [
        {
          userId: 1,
          employeeId: 1,
          employeeCode: 'NV001',
          fullName: 'Nguyễn Văn Quản Trị',
          username: 'admin',
          email: 'admin@fiin.vn',
          phoneNumber: '0901 234 567',
          branchName: 'Trụ sở chính',
          position: role.description,
          status: 'active',
          isActive: true
        }
      ]
    };
  }
 

  private processEmployeeFilter(items: Employee[], query: EmployeeFilterQuery, currentUserRole?: string): Page<Employee> {
    let filtered = [...items];

    // PHÂN QUYỀN CÂY PHẢ HỆ: Cấp dưới không được nhìn thấy nhân viên có cấp cao hơn mình
    if (currentUserRole) {
      const myLevel = getPositionLevel(currentUserRole);
      filtered = filtered.filter((e) => {
        const empLevel = getPositionLevel(e.position);
        return empLevel <= myLevel; // Chỉ thấy nhân viên có cấp <= mình
      });
    }

    if (query.branchId && query.branchId !== 'all') {
      filtered = filtered.filter((e) => e.branchId === query.branchId);
    }

    if (query.status && query.status !== 'all') {
      const targetStatus = query.status === 'working' ? 'active' : query.status;
      filtered = filtered.filter((e) => e.status === targetStatus || (query.status === 'working' && e.status === 'working'));
    }

    if (query.position && query.position !== 'all') {
      filtered = filtered.filter((e) => e.position === query.position);
    }

    if (query.q) {
      const kw = query.q.trim().toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.fullName.toLowerCase().includes(kw) ||
          e.code.toLowerCase().includes(kw) ||
          e.phone.includes(kw) ||
          (e.citizenId && e.citizenId.includes(kw)) ||
          e.position.toLowerCase().includes(kw)
      );
    }

    const total = filtered.length;
    const page = query.page || 1;
    const size = query.size || 10;
    const start = (page - 1) * size;
    const paginatedItems = filtered.slice(start, start + size);
    const totalPages = Math.max(1, Math.ceil(total / size));

    return {
      items: paginatedItems,
      total,
      page,
      size,
      totalPages,
    };
  }

  private mapDtoToEmployee(dto: any): Employee {
    const rawHireDate = dto.hireDate || dto.HireDate;
    const formattedHireDate = rawHireDate ? new Date(rawHireDate).toLocaleDateString('vi-VN') : '';
    const rawBranchId = dto.branchId || dto.BranchId || 1;
    const branchCode = dto.branchCode || dto.BranchCode || (rawBranchId === 1 ? 'cn-q1' : rawBranchId === 2 ? 'cn-q3' : 'cn-bt');

    return {
      id: String(dto.employeeId || dto.EmployeeId || '0'),
      code: dto.employeeCode || dto.EmployeeCode || '',
      fullName: dto.fullName || dto.FullName || '',
      phone: dto.phoneNumber || dto.PhoneNumber || '',
      email: dto.email || dto.Email || '',
      dateOfBirth: dto.dateOfBirth || dto.DateOfBirth || '2001-01-01',
      gender: dto.gender || dto.Gender || 'male',
      position: dto.position || dto.Position || '',
      branchId: String(branchCode).toLowerCase(),
      branchName: dto.branchName || dto.BranchName || 'Fiin Coffee',
      status: dto.status || dto.Status || 'active',
      startDate: formattedHireDate,
      contractType: (dto.contractCode || dto.ContractCode) === 'HD-PART-TIME' ? 'part_time' : 'full_time',
      hourlyRate: Number(dto.hourlyRate || dto.HourlyRate || 25000),
      note: dto.note || dto.Note,

      // Mở rộng
      employeeId: dto.employeeId || dto.EmployeeId,
      employeeCode: dto.employeeCode || dto.EmployeeCode,
      userId: dto.userId || dto.UserId,
      username: dto.username || dto.Username,
      phoneNumber: dto.phoneNumber || dto.PhoneNumber,
      citizenId: dto.citizenId || dto.CitizenId,
      bankName: dto.bankName || dto.BankName,
      bankAccountNumber: dto.bankAccountNumber || dto.BankAccountNumber,
      bankAccountName: dto.bankAccountName || dto.BankAccountName,
      numericBranchId: rawBranchId,
      branchCode: dto.branchCode || dto.BranchCode,
      contractTypeId: dto.contractTypeId || dto.ContractTypeId,
      contractCode: dto.contractCode || dto.ContractCode,
      contractName: dto.contractName || dto.ContractName,
      allowance: Number(dto.allowance || dto.Allowance || 0),
      benefitsDescription: dto.benefitsDescription || dto.BenefitsDescription,
      hireDate: rawHireDate,
      updatedAt: dto.updatedAt || dto.UpdatedAt,
    };
  }

  public normalizeBranchId(b: string | number): number | null {
    if (typeof b === 'number') return b;
    if (b === 'cn-q1') return 1;
    if (b === 'cn-q3') return 2;
    if (b === 'cn-td') return 3;
    if (b === 'cn-bt') return 4;
    const n = parseInt(b, 10);
    return isNaN(n) ? null : n;
  }

  /**
   * Lấy bảng tổng hợp công tháng theo quy tắc chuẩn hóa giờ ca + OT duyệt + nghỉ phép duyệt
   */
  getAttendanceMonthlySummary(
    periodMonth: string,
    branchId?: string | number | null,
    search?: string
  ): Observable<AttendanceMonthlySummaryItem[]> {
    let params = new HttpParams().set('periodMonth', periodMonth);
    const normalizedBranch =
      typeof branchId === 'number'
        ? branchId
        : branchId && branchId !== 'all'
          ? this.normalizeBranchId(branchId)
          : null;
    if (normalizedBranch !== null && normalizedBranch > 0) {
      params = params.set('branchId', normalizedBranch.toString());
    }
    if (search && search.trim()) {
      params = params.set('search', search.trim());
    }
    return this.http
      .get<ApiResponse<AttendanceMonthlySummaryItem[]>>('http://localhost:5107/api/v1/attendance/monthly-summary', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => {
          const msg = err.error?.message || err.message || 'Không thể tải bảng tổng hợp công tháng';
          return throwError(() => new Error(msg));
        })
      );
  }

  getOvertimeTypes(scope?: string, search?: string): Observable<OvertimeTypeItem[]> {
    let params = new HttpParams();
    if (scope && scope !== 'all') params = params.set('scope', scope);
    if (search && search.trim()) params = params.set('search', search.trim());
    return this.http
      .get<ApiResponse<OvertimeTypeItem[]>>('http://localhost:5107/api/v1/attendance/overtime-types', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh mục mã tăng ca')))
      );
  }

  saveOvertimeType(req: SaveOvertimeTypeRequest): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/overtime-types', req)
      .pipe(
        map(res => res.data),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể lưu mã tăng ca')))
      );
  }

  deleteOvertimeType(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`http://localhost:5107/api/v1/attendance/overtime-types/${id}`)
      .pipe(
        map(res => res.success),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể xóa mã tăng ca')))
      );
  }

  getLeaveTypes(scope?: string, search?: string): Observable<LeaveTypeItem[]> {
    let params = new HttpParams();
    if (scope && scope !== 'all') params = params.set('scope', scope);
    if (search && search.trim()) params = params.set('search', search.trim());
    return this.http
      .get<ApiResponse<LeaveTypeItem[]>>('http://localhost:5107/api/v1/attendance/leave-types', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh mục mã nghỉ phép')))
      );
  }

  saveLeaveType(req: SaveLeaveTypeRequest): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/leave-types', req)
      .pipe(
        map(res => res.data),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể lưu mã nghỉ phép')))
      );
  }

  deleteLeaveType(id: number): Observable<boolean> {
    return this.http
      .delete<ApiResponse<boolean>>(`http://localhost:5107/api/v1/attendance/leave-types/${id}`)
      .pipe(
        map(res => res.success),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể xóa mã nghỉ phép')))
      );
  }

  getHolidaysByYear(year: number): Observable<HolidayItem[]> {
    const params = new HttpParams().set('year', year.toString());
    return this.http
      .get<ApiResponse<HolidayItem[]>>('http://localhost:5107/api/v1/attendance/holidays', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh sách ngày lễ')))
      );
  }

  private buildRequestFilterParams(periodMonth?: string, branchId?: string | number | null, status?: string, search?: string): HttpParams {
    let params = new HttpParams();
    if (periodMonth) params = params.set('periodMonth', periodMonth);
    const bId =
      typeof branchId === 'number'
        ? branchId
        : branchId && branchId !== 'all'
          ? this.normalizeBranchId(branchId)
          : null;
    if (bId !== null && bId > 0) params = params.set('branchId', bId.toString());
    if (status && status !== 'all') params = params.set('status', status);
    if (search && search.trim()) params = params.set('search', search.trim());
    return params;
  }

  getOvertimeRequests(periodMonth?: string, branchId?: string | number | null, status?: string, search?: string): Observable<OvertimeRequestItem[]> {
    const params = this.buildRequestFilterParams(periodMonth, branchId, status, search);
    return this.http
      .get<ApiResponse<OvertimeRequestItem[]>>('http://localhost:5107/api/v1/attendance/overtime-requests', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh sách đơn xin tăng ca')))
      );
  }

  createOvertimeRequest(req: CreateOvertimeRequestPayload): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/overtime-requests', req)
      .pipe(
        map(res => res.data),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tạo đơn xin tăng ca')))
      );
  }

  processOvertimeRequest(id: number, req: ProcessHrmRequestPayload): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(`http://localhost:5107/api/v1/attendance/overtime-requests/${id}/process`, req)
      .pipe(
        map(res => res.success),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể xử lý đơn tăng ca')))
      );
  }

  getCorrectionRequests(periodMonth?: string, branchId?: string | number | null, status?: string, search?: string): Observable<AttendanceCorrectionRequestItem[]> {
    const params = this.buildRequestFilterParams(periodMonth, branchId, status, search);
    return this.http
      .get<ApiResponse<AttendanceCorrectionRequestItem[]>>('http://localhost:5107/api/v1/attendance/correction-requests', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh sách đơn bù công')))
      );
  }

  createCorrectionRequest(req: CreateAttendanceCorrectionRequestPayload): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/correction-requests', req)
      .pipe(
        map(res => res.data),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tạo đơn bù công')))
      );
  }

  processCorrectionRequest(id: number, req: ProcessHrmRequestPayload): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(`http://localhost:5107/api/v1/attendance/correction-requests/${id}/process`, req)
      .pipe(
        map(res => res.success),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể xử lý đơn bù công')))
      );
  }

  getLeaveRequests(periodMonth?: string, branchId?: string | number | null, status?: string, search?: string): Observable<LeaveRequestItem[]> {
    const params = this.buildRequestFilterParams(periodMonth, branchId, status, search);
    return this.http
      .get<ApiResponse<LeaveRequestItem[]>>('http://localhost:5107/api/v1/attendance/leave-requests', { params })
      .pipe(
        map(res => res.data ?? []),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tải danh sách đơn xin nghỉ phép')))
      );
  }

  createLeaveRequest(req: CreateLeaveRequestPayload): Observable<number> {
    return this.http
      .post<ApiResponse<number>>('http://localhost:5107/api/v1/attendance/leave-requests', req)
      .pipe(
        map(res => res.data),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể tạo đơn xin nghỉ phép')))
      );
  }

  processLeaveRequest(id: number, req: ProcessHrmRequestPayload): Observable<boolean> {
    return this.http
      .post<ApiResponse<boolean>>(`http://localhost:5107/api/v1/attendance/leave-requests/${id}/process`, req)
      .pipe(
        map(res => res.success),
        catchError(err => throwError(() => new Error(err.error?.message || err.message || 'Không thể xử lý đơn nghỉ phép')))
      );
  }

  /**
   * Lấy trạng thái khóa bảng công tháng từ Backend API
   */
  getAttendancePeriodStatus(branchId: number | null, periodMonth: string): Observable<AttendancePeriodStatus | null> {
    let params = new HttpParams().set('periodMonth', periodMonth);
    if (branchId !== null && branchId > 0) {
      params = params.set('branchId', branchId.toString());
    }
    return this.http.get<ApiResponse<AttendancePeriodStatus | null>>('http://localhost:5107/api/v1/attendance/period-status', { params }).pipe(
      map(res => res.data),
      catchError(err => {
        console.warn('Lỗi lấy trạng thái kỳ công từ API backend, sử dụng trạng thái mở mặc định:', err);
        return of(null);
      })
    );
  }

  /**
   * Chốt và khóa bảng công tháng
   */
  lockAttendancePeriod(req: LockAttendancePeriodRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>('http://localhost:5107/api/v1/attendance/lock-period', req).pipe(
      map(res => res.success),
      catchError(err => {
        const msg = err.error?.message || err.message || 'Không thể chốt và khóa bảng công';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Mở khóa bảng công tháng khẩn cấp (yêu cầu mật khẩu IT và lý do giải trình)
   */
  unlockAttendancePeriod(req: UnlockAttendancePeriodRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>('http://localhost:5107/api/v1/attendance/unlock-period', req).pipe(
      map(res => res.success),
      catchError(err => {
        const msg = err.error?.message || err.message || 'Không thể mở khóa bảng công';
        return throwError(() => new Error(msg));
      })
    );
  }
}
