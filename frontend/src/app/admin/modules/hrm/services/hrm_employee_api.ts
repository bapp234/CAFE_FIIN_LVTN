import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { Page } from '../../../shared/models/page';
import { AllowedWorkflowItem, ContractType, CreateEmployeeDto, Employee, EmployeeFilterQuery, EmployeeFullProfile } from '../models/employee';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
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
  private localEmployees: Employee[] = [...FALLBACK_EMPLOYEES];

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
          return this.processEmployeeFilter(this.localEmployees, query, currentUserRole);
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
      catchError((err) => {
        console.warn('Backend API /hierarchy offline hoặc chưa bật, nạp dữ liệu từ bộ nhớ nội bộ:', err.message);
        return of(this.processEmployeeFilter(this.localEmployees, query, currentUserRole));
      })
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
      catchError((err) => {
        console.warn('API /hierarchy offline, fallback sang dữ liệu phân cấp bộ nhớ:', err.message);
        const filtered = this.processEmployeeFilter(
          this.localEmployees,
          {
            page: params.pageIndex || 1,
            size: params.pageSize || 50,
            q: params.search,
            branchId: typeof params.branchId === 'string' ? params.branchId : undefined,
            status: params.status,
          },
          params.currentUsername
        );
        return of({ items: filtered.items, total: filtered.total });
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
        if (!res.data) return this.getFallbackFullProfile(validId);
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
      catchError((err) => {
        console.warn('API full-profile offline, nạp fallback profile:', err.message);
        return of(this.getFallbackFullProfile(validId));
      })
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

  getProfileForUser(user: { id?: string; email?: string; name?: string; role?: string } | null): Observable<Employee> {
    if (!user) {
      return of(this.localEmployees[0]);
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
        if (err.status === 0 || !err.status) {
          // Fallback giả lập tạo offline
          const nextId = this.localEmployees.length + 1;
          const fakeCode = `NV${String(nextId).padStart(3, '0')}`;
          const contract = FALLBACK_CONTRACT_TYPES.find((c) => c.contractTypeId === payload.contractTypeId);

          const fakeEmployee: Employee = {
            id: String(nextId),
            employeeId: nextId,
            code: fakeCode,
            employeeCode: fakeCode,
            fullName: payload.fullName,
            phone: payload.phoneNumber || '',
            phoneNumber: payload.phoneNumber || '',
            email: payload.email || '',
            citizenId: payload.citizenId,
            bankName: payload.bankName || 'Vietcombank',
            bankAccountNumber: payload.bankAccountNumber || '',
            bankAccountName: payload.bankAccountName || payload.fullName.toUpperCase(),
            branchId: payload.branchId === 1 ? 'cn-q1' : payload.branchId === 2 ? 'cn-q3' : 'cn-bt',
            numericBranchId: payload.branchId,
            branchName: payload.branchId === 1 ? 'Fiin Đinh Tiên Hoàng' : 'Fiin Hồ Con Rùa',
            position: payload.position,
            contractTypeId: payload.contractTypeId,
            contractCode: contract?.contractCode || 'HD-CHINH-THUC',
            contractName: contract?.contractName || 'Hợp đồng Lao động',
            hourlyRate: payload.hourlyRate || contract?.standardHourlyRate || 28000,
            allowance: contract?.allowance || 1000000,
            benefitsDescription: contract?.benefitsDescription || '',
            status: 'active',
            startDate: new Date().toLocaleDateString('vi-VN'),
            contractType: 'full_time',
            dateOfBirth: payload.dateOfBirth || '2001-01-01',
            gender: payload.gender || 'male',
            note: payload.note,
            updatedAt: new Date().toISOString(),
          };

          this.localEmployees.unshift(fakeEmployee);
          return of(fakeEmployee);
        }

        const errorMsg = err.error?.message || err.message || 'Lỗi kết nối máy chủ khi tạo nhân viên';
        return throwError(() => new Error(errorMsg));
      })
    );
  }

  getContractTypes(): Observable<ContractType[]> {
    return this.http.get<ApiResponse<ContractType[]>>(`${this.baseUrl}/contract-types`).pipe(
      map((res) => (res.data && res.data.length > 0 ? res.data : FALLBACK_CONTRACT_TYPES)),
      catchError(() => of(FALLBACK_CONTRACT_TYPES))
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

  private normalizeBranchId(b: string | number): number | null {
    if (typeof b === 'number') return b;
    if (b === 'cn-q1') return 1;
    if (b === 'cn-q3') return 2;
    if (b === 'cn-td') return 3;
    if (b === 'cn-bt') return 4;
    const n = parseInt(b, 10);
    return isNaN(n) ? null : n;
  }
}
