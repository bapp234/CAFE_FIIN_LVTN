export type PayrollStatus = 'draft' | 'approved' | 'paid';

export interface PayrollPeriod {
  id: string;
  period: string; // YYYY-MM
  branchId: string;
  branchName: string;
  status: PayrollStatus;
  statusLabel: string;
  totalEmployees: number;
  totalNetPay: number;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  isLocked: boolean; // Bản đã duyệt sẽ bị khóa
}

export interface PayrollSlip {
  id: string;
  period: string; // YYYY-MM
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  position: string;
  hourlyRate: number;         // Đơn giá lương giờ chuẩn
  standardWorkHours: number;  // Số giờ làm việc chuẩn
  overtimeHours: number;      // Số giờ tăng ca (OT)
  basePay: number;            // standardWorkHours * hourlyRate
  overtimePay: number;        // overtimeHours * hourlyRate * 1.5
  allowance: number;          // Phụ cấp (trách nhiệm, chuyên cần, tiền ăn)
  deduction: number;          // Khấu trừ (phạt đi muộn theo quy chế)
  advance: number;            // Tạm ứng lương trong kỳ
  netPay: number;             // Thực lĩnh = basePay + overtimePay + allowance - deduction - advance
  status: PayrollStatus;
  statusLabel: string;
}

export interface PayrollFilterQuery {
  page: number;
  size: number;
  period: string;
  branchId?: string;
  q?: string;
}
