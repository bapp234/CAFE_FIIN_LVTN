export type AttendanceStatus =
  | 'on_time'       // Đúng giờ
  | 'late'          // Đi muộn
  | 'early_leave'   // Về sớm
  | 'absent'        // Vắng mặt (có lịch đăng ký nhưng không đến)
  | 'leave'         // Nghỉ phép
  | 'unscheduled';  // Làm tăng cường / Chưa xếp lịch trước

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  date: string; // YYYY-MM-DD
  // Thông tin ca đã đăng ký trước
  scheduledShiftId?: string;
  scheduledShiftName?: string;
  scheduledStartTime?: string; // e.g. '06:30'
  scheduledEndTime?: string;   // e.g. '12:00'
  // Dữ liệu chấm công thực tế
  checkIn?: string;  // e.g. '06:28'
  checkOut?: string; // e.g. '12:05'
  workHours: number; // Số giờ làm việc thực tế tính công
  overtimeHours: number; // Số giờ làm tăng ca (OT)
  lateMinutes: number;   // Số phút đi muộn (nếu > 0)
  earlyLeaveMinutes: number; // Số phút về sớm (nếu > 0)
  status: AttendanceStatus;
  statusLabel: string;
  // Audit vết điều chỉnh thủ công
  isManualAdjusted: boolean;
  adjustedNote?: string;
  adjustedBy?: string;
  adjustedAt?: string;
}

export interface AttendanceFilterQuery {
  page: number;
  size: number;
  date?: string;     // YYYY-MM-DD
  month?: string;    // YYYY-MM
  branchId?: string;
  status?: string;
  q?: string;
}
