export interface ContractType {
  contractTypeId: number;
  contractCode: string;
  contractName: string;
  standardHourlyRate: number;
  allowance: number;
  salaryPercentage: number;
  durationMonths: number | null;
  benefitsDescription: string;
  isActive: boolean;
}

export interface Employee {
  id: string;
  code: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other' | string;
  position: string;
  branchId: string;
  branchName: string;
  status: 'working' | 'probation' | 'resigned' | 'active' | string;
  startDate: string;
  contractType: 'full_time' | 'part_time' | string;
  hourlyRate: number;
  avatarUrl?: string;
  note?: string;

  // Thuộc tính mở rộng từ CSDL
  employeeId?: number;
  employeeCode?: string;
  userId?: number;
  username?: string;
  phoneNumber?: string;
  citizenId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  numericBranchId?: number;
  branchCode?: string;
  contractTypeId?: number;
  contractCode?: string;
  contractName?: string;
  allowance?: number;
  benefitsDescription?: string;
  hireDate?: string;
  updatedAt?: string;

  // Phân quyền cây phả hệ
  hierarchyLevel?: number;
  roleName?: string;
  roleDescription?: string;
  avatarInitial?: string;
}

export interface AllowedWorkflowItem {
  WorkflowCode: string;
  WorkflowName: string;
  Description?: string;
  MinApprovalLevel?: number;
}

export interface EmployeeFullProfile {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: string;
  citizenId?: string;
  status: string;
  hireDate: string;
  note?: string;

  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;

  branchId?: number;
  branchCode?: string;
  branchName?: string;
  position?: string;

  contractTypeId?: number;
  contractCode?: string;
  contractName?: string;
  hourlyRate?: number;
  allowance?: number;
  benefitsDescription?: string;

  userId?: number;
  username?: string;
  roleId?: number;
  roleName?: string;
  hierarchyLevel: number;
  approvalLevel?: number;
  directManagerName?: string;
  directManagerCode?: string;
  allowedWorkflowsJson?: string;
  allowedWorkflows?: AllowedWorkflowItem[];
}

export interface CreateEmployeeDto {
  username: string;
  password: string;
  fullName: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string | null;
  gender?: string;
  citizenId: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  branchId: number;
  position: string;
  contractTypeId: number;
  hourlyRate?: number | null;
  note?: string;
  roleId?: number | null;
}

export interface EmployeeFilterQuery {
  page: number;
  size: number;
  q?: string;
  branchId?: string;
  position?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}
