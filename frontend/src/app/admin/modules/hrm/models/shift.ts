export interface ShiftTemplate {
  id: string;
  code: string;
  name: string;
  startTime: string; // HH:mm (ví dụ: '06:30')
  endTime: string;   // HH:mm (ví dụ: '12:00')
  breakMinutes: number;
  standardHours: number; // số giờ làm việc chuẩn (ví dụ: 5.5)
  color: string;     // mã màu hoặc theme badge
  branchId?: string; // 'all' hoặc chi nhánh cụ thể
}

/** Lịch phân ca / Lịch làm việc đăng ký trước của nhân viên */
export interface ShiftAssignment {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  branchId: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  registeredBy: 'manager' | 'employee' | 'excel-import';
  status: 'scheduled' | 'swapped' | 'cancelled';
  note?: string;
}

export interface WeekScheduleQuery {
  branchId: string;
  startDate: string; // YYYY-MM-DD (Thứ hai)
  endDate: string;   // YYYY-MM-DD (Chủ nhật)
}
