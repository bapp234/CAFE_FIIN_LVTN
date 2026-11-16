import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { Page } from '../../../shared/models/page';
import { AttendanceFilterQuery, AttendanceRecord } from '../models/attendance';

export const INITIAL_ATTENDANCE_RECORDS: AttendanceRecord[] = [
  {
    id: 'att-01',
    employeeId: 'emp-01',
    employeeCode: 'NV001',
    employeeName: 'Đặng Quốc Anh',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    date: '2026-11-15',
    scheduledShiftId: 'shift-morning',
    scheduledShiftName: 'Ca Sáng (Mở quán & Pha chế)',
    scheduledStartTime: '06:30',
    scheduledEndTime: '12:00',
    checkIn: '06:25',
    checkOut: '12:05',
    workHours: 5.5,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'on_time',
    statusLabel: 'Đúng giờ',
    isManualAdjusted: false,
  },
  {
    id: 'att-02',
    employeeId: 'emp-02',
    employeeCode: 'NV002',
    employeeName: 'Nguyễn Thị Hương',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    date: '2026-11-15',
    scheduledShiftId: 'shift-morning',
    scheduledShiftName: 'Ca Sáng (Mở quán & Pha chế)',
    scheduledStartTime: '06:30',
    scheduledEndTime: '12:00',
    checkIn: '06:45',
    checkOut: '12:00',
    workHours: 5.25,
    overtimeHours: 0,
    lateMinutes: 15,
    earlyLeaveMinutes: 0,
    status: 'late',
    statusLabel: 'Đi muộn 15p',
    isManualAdjusted: false,
  },
  {
    id: 'att-03',
    employeeId: 'emp-09',
    employeeCode: 'NV009',
    employeeName: 'Ngô Thùy Trang',
    branchId: 'cn-q1',
    branchName: 'Fiin Đinh Tiên Hoàng',
    date: '2026-11-15',
    scheduledShiftId: 'shift-afternoon',
    scheduledShiftName: 'Ca Chiều (Giờ cao điểm)',
    scheduledStartTime: '12:00',
    scheduledEndTime: '17:30',
    checkIn: '11:55',
    checkOut: '18:30',
    workHours: 5.5,
    overtimeHours: 1.0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'on_time',
    statusLabel: 'Tăng ca +1h',
    isManualAdjusted: false,
  },
  {
    id: 'att-04',
    employeeId: 'emp-03',
    employeeCode: 'NV003',
    employeeName: 'Lê Thanh Tùng',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    date: '2026-11-15',
    scheduledShiftId: 'shift-full',
    scheduledShiftName: 'Ca Toàn thời gian (Quản lý)',
    scheduledStartTime: '08:00',
    scheduledEndTime: '17:00',
    checkIn: '07:58',
    checkOut: '17:15',
    workHours: 8.0,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'on_time',
    statusLabel: 'Đúng giờ',
    isManualAdjusted: false,
  },
  {
    id: 'att-05',
    employeeId: 'emp-04',
    employeeCode: 'NV004',
    employeeName: 'Phạm Minh Tuấn',
    branchId: 'cn-q3',
    branchName: 'Fiin Hồ Con Rùa',
    date: '2026-11-15',
    scheduledShiftId: 'shift-afternoon',
    scheduledShiftName: 'Ca Chiều (Giờ cao điểm)',
    scheduledStartTime: '12:00',
    scheduledEndTime: '17:30',
    // Chưa đến và không có checkIn -> Vắng mặt
    checkIn: undefined,
    checkOut: undefined,
    workHours: 0,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'absent',
    statusLabel: 'Vắng có lịch',
    isManualAdjusted: false,
  },
  {
    id: 'att-06',
    employeeId: 'emp-05',
    employeeCode: 'NV005',
    employeeName: 'Võ Ngọc Bích',
    branchId: 'cn-td',
    branchName: 'Fiin Làng Đại Học',
    date: '2026-11-15',
    scheduledShiftId: 'shift-evening',
    scheduledShiftName: 'Ca Tối (Đóng quán & Vệ sinh)',
    scheduledStartTime: '17:30',
    scheduledEndTime: '23:00',
    checkIn: '17:25',
    checkOut: '23:05',
    workHours: 5.5,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'on_time',
    statusLabel: 'Đúng giờ',
    isManualAdjusted: false,
  },
  {
    id: 'att-07',
    employeeId: 'emp-07',
    employeeCode: 'NV007',
    employeeName: 'Bùi Mỹ Linh',
    branchId: 'cn-bt',
    branchName: 'Fiin Phan Xích Long',
    date: '2026-11-15',
    scheduledShiftId: 'shift-morning',
    scheduledShiftName: 'Ca Sáng (Mở quán & Pha chế)',
    scheduledStartTime: '06:30',
    scheduledEndTime: '12:00',
    checkIn: '06:30',
    checkOut: '12:10',
    workHours: 5.5,
    overtimeHours: 0,
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    status: 'on_time',
    statusLabel: 'Đúng giờ',
    isManualAdjusted: false,
  },
  {
    id: 'att-08',
    employeeId: 'emp-08',
    employeeCode: 'NV008',
    employeeName: 'Trịnh Quốc Bảo',
    branchId: 'cn-bt',
    branchName: 'Fiin Phan Xích Long',
    date: '2026-11-15',
    scheduledShiftId: 'shift-evening',
    scheduledShiftName: 'Ca Tối (Đóng quán & Vệ sinh)',
    scheduledStartTime: '17:30',
    scheduledEndTime: '23:00',
    checkIn: '17:50',
    checkOut: '23:00',
    workHours: 5.0,
    overtimeHours: 0,
    lateMinutes: 20,
    earlyLeaveMinutes: 0,
    status: 'late',
    statusLabel: 'Đi muộn 20p',
    isManualAdjusted: false,
  },
];

@Injectable({ providedIn: 'root' })
export class HrmAttendanceApi {
  private records: AttendanceRecord[] = [...INITIAL_ATTENDANCE_RECORDS];

  getAttendanceList(query: AttendanceFilterQuery): Observable<Page<AttendanceRecord>> {
    let list = [...this.records];

    if (query.branchId && query.branchId !== 'all') {
      list = list.filter((r) => r.branchId === query.branchId);
    }

    if (query.date) {
      list = list.filter((r) => r.date === query.date);
    }

    if (query.status && query.status !== 'all') {
      list = list.filter((r) => r.status === query.status);
    }

    if (query.q) {
      const kw = query.q.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.employeeName.toLowerCase().includes(kw) ||
          r.employeeCode.toLowerCase().includes(kw) ||
          (r.scheduledShiftName && r.scheduledShiftName.toLowerCase().includes(kw))
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
   * Điều chỉnh thủ công giờ vào/ra do sự cố máy chấm công (kèm ghi chú và vết audit)
   */
  adjustAttendance(
    id: string,
    checkIn: string,
    checkOut: string,
    reason: string,
    adjusterName: string
  ): Observable<AttendanceRecord> {
    const idx = this.records.findIndex((r) => r.id === id);
    if (idx === -1) {
      return throwError(() => new Error('Không tìm thấy bản ghi chấm công.'));
    }

    const rec = this.records[idx];
    // Tính lại giờ làm
    let workHours = 5.5;
    if (rec.scheduledShiftId === 'shift-full') workHours = 8.0;

    const updated: AttendanceRecord = {
      ...rec,
      checkIn,
      checkOut,
      workHours,
      lateMinutes: 0,
      status: 'on_time',
      statusLabel: 'Đúng giờ (Đã chỉnh)',
      isManualAdjusted: true,
      adjustedNote: reason,
      adjustedBy: adjusterName,
      adjustedAt: new Date().toLocaleTimeString('vi-VN') + ' ' + new Date().toLocaleDateString('vi-VN'),
    };

    this.records[idx] = updated;
    return of(updated).pipe(delay(250));
  }

  getTodayAttendanceSummary(branchId?: string): Observable<{ scheduled: number; onTime: number; late: number; absent: number }> {
    const today = '2026-11-15';
    let list = this.records.filter((r) => r.date === today);

    if (branchId && branchId !== 'all') {
      list = list.filter((r) => r.branchId === branchId);
    }

    const scheduled = list.length;
    const onTime = list.filter((r) => r.status === 'on_time').length;
    const late = list.filter((r) => r.status === 'late').length;
    const absent = list.filter((r) => r.status === 'absent').length;

    return of({ scheduled, onTime, late, absent }).pipe(delay(150));
  }

  exportCsv(query: AttendanceFilterQuery): Observable<string> {
    let list = [...this.records];
    if (query.branchId && query.branchId !== 'all') {
      list = list.filter((r) => r.branchId === query.branchId);
    }
    if (query.date) {
      list = list.filter((r) => r.date === query.date);
    }

    const headers = 'Mã NV,Họ và tên,Chi nhánh,Ngày,Ca làm,Giờ vào,Giờ ra,Số giờ công,Giờ OT,Đi muộn (phút),Trạng thái,Ghi chú chỉnh sửa\n';
    const rows = list.map(
      (r) =>
        `"${r.employeeCode}","${r.employeeName}","${r.branchName}","${r.date}","${r.scheduledShiftName || ''}","${r.checkIn || ''}","${r.checkOut || ''}",${r.workHours},${r.overtimeHours},${r.lateMinutes},"${r.statusLabel}","${r.adjustedNote || ''}"`
    ).join('\n');

    return of(headers + rows).pipe(delay(200));
  }
}
