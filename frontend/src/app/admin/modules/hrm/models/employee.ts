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
  roleId?: number;
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

export interface UpdateEmployeeProfileDto {
  fullName?: string;
  phoneNumber?: string;
  email?: string;
  dateOfBirth?: string | null;
  gender?: string;
  citizenId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  contractTypeId?: number;
  hourlyRate?: number;
  allowance?: number;
  note?: string;
  status?: string;
  position?: string;
  branchId?: number;
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

export interface EmployeeImportItem {
  rowIndex: number;
  employeeCode?: string | null;
  fullName: string;
  citizenId: string;
  phoneNumber?: string | null;
  branchInput?: string | null;
  position?: string | null;
  contractTypeInput?: string | null;
  hourlyRate?: number | null;
  allowance?: number | null;
  status: string;
  isValid: boolean;
  errorMessage?: string | null;
}

export interface EmployeeImportPreviewResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  items: EmployeeImportItem[];
}

export interface EmployeeImportSaveRequest {
  employees: EmployeeImportItem[];
  createAccounts: boolean;
  defaultPassword?: string;
}

export interface EmployeeImportSaveResult {
  totalReceived: number;
  totalImported: number;
  totalSkipped: number;
  accountsCreated: number;
  importedEmployees: {
    employeeId: number;
    employeeCode: string;
    fullName: string;
    citizenId: string;
    branchName: string;
    position: string;
    contractName: string;
    hourlyRate: number;
    hasAccount: boolean;
  }[];
}
