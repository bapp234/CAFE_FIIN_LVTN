import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ShiftAssignment, ShiftTemplate, WeekScheduleQuery } from '../models/shift';

export const INITIAL_SHIFT_TEMPLATES: ShiftTemplate[] = [
  {
    id: 'shift-morning',
    code: 'CA-SANG',
    name: 'Ca Sáng (Mở quán & Pha chế)',
    startTime: '06:30',
    endTime: '12:00',
    breakMinutes: 15,
    standardHours: 5.5,
    color: 'emerald',
    branchId: 'all',
  },
  {
    id: 'shift-afternoon',
    code: 'CA-CHIEU',
    name: 'Ca Chiều (Giờ cao điểm)',
    startTime: '12:00',
    endTime: '17:30',
    breakMinutes: 15,
    standardHours: 5.5,
    color: 'amber',
    branchId: 'all',
  },
  {
    id: 'shift-evening',
    code: 'CA-TOI',
    name: 'Ca Tối (Đóng quán & Vệ sinh)',
    startTime: '17:30',
    endTime: '23:00',
    breakMinutes: 15,
    standardHours: 5.5,
    color: 'indigo',
    branchId: 'all',
  },
  {
    id: 'shift-full',
    code: 'CA-FULL',
    name: 'Ca Toàn thời gian (Quản lý)',
    startTime: '08:00',
    endTime: '17:00',
    breakMinutes: 60,
    standardHours: 8.0,
    color: 'sky',
    branchId: 'all',
  },
];

/** Sinh mẫu lịch đăng ký làm việc tuần hiện tại */
function generateMockAssignments(): ShiftAssignment[] {
  const assignments: ShiftAssignment[] = [
    // Hôm nay và các ngày trong tuần
    {
      id: 'asg-01',
      employeeId: 'emp-01',
      employeeCode: 'NV001',
      employeeName: 'Đặng Quốc Anh',
      branchId: 'cn-q1',
      date: '2026-11-15',
      shiftId: 'shift-morning',
      shiftCode: 'CA-SANG',
      shiftName: 'Ca Sáng (Mở quán & Pha chế)',
      startTime: '06:30',
      endTime: '12:00',
      registeredBy: 'manager',
      status: 'scheduled',
      note: 'Trưởng ca phụ trách kiểm tra hạt rang',
    },
    {
      id: 'asg-02',
      employeeId: 'emp-02',
      employeeCode: 'NV002',
      employeeName: 'Nguyễn Thị Hương',
      branchId: 'cn-q1',
      date: '2026-11-15',
      shiftId: 'shift-morning',
      shiftCode: 'CA-SANG',
      shiftName: 'Ca Sáng (Mở quán & Pha chế)',
      startTime: '06:30',
      endTime: '12:00',
      registeredBy: 'employee',
      status: 'scheduled',
    },
    {
      id: 'asg-03',
      employeeId: 'emp-09',
      employeeCode: 'NV009',
      employeeName: 'Ngô Thùy Trang',
      branchId: 'cn-q1',
      date: '2026-11-15',
      shiftId: 'shift-afternoon',
      shiftCode: 'CA-CHIEU',
      shiftName: 'Ca Chiều (Giờ cao điểm)',
      startTime: '12:00',
      endTime: '17:30',
      registeredBy: 'employee',
      status: 'scheduled',
    },
    {
      id: 'asg-04',
      employeeId: 'emp-03',
      employeeCode: 'NV003',
      employeeName: 'Lê Thanh Tùng',
      branchId: 'cn-q3',
      date: '2026-11-15',
      shiftId: 'shift-full',
      shiftCode: 'CA-FULL',
      shiftName: 'Ca Toàn thời gian (Quản lý)',
      startTime: '08:00',
      endTime: '17:00',
      registeredBy: 'manager',
      status: 'scheduled',
    },
    {
      id: 'asg-05',
      employeeId: 'emp-04',
      employeeCode: 'NV004',
      employeeName: 'Phạm Minh Tuấn',
      branchId: 'cn-q3',
      date: '2026-11-15',
      shiftId: 'shift-afternoon',
      shiftCode: 'CA-CHIEU',
      shiftName: 'Ca Chiều (Giờ cao điểm)',
      startTime: '12:00',
      endTime: '17:30',
      registeredBy: 'employee',
      status: 'scheduled',
    },
    {
      id: 'asg-06',
      employeeId: 'emp-05',
      employeeCode: 'NV005',
      employeeName: 'Võ Ngọc Bích',
      branchId: 'cn-td',
      date: '2026-11-15',
      shiftId: 'shift-evening',
      shiftCode: 'CA-TOI',
      shiftName: 'Ca Tối (Đóng quán & Vệ sinh)',
      startTime: '17:30',
      endTime: '23:00',
      registeredBy: 'employee',
      status: 'scheduled',
    },
    {
      id: 'asg-07',
      employeeId: 'emp-07',
      employeeCode: 'NV007',
      employeeName: 'Bùi Mỹ Linh',
      branchId: 'cn-bt',
      date: '2026-11-15',
      shiftId: 'shift-morning',
      shiftCode: 'CA-SANG',
      shiftName: 'Ca Sáng (Mở quán & Pha chế)',
      startTime: '06:30',
      endTime: '12:00',
      registeredBy: 'manager',
      status: 'scheduled',
    },
    {
      id: 'asg-08',
      employeeId: 'emp-08',
      employeeCode: 'NV008',
      employeeName: 'Trịnh Quốc Bảo',
      branchId: 'cn-bt',
      date: '2026-11-15',
      shiftId: 'shift-evening',
      shiftCode: 'CA-TOI',
      shiftName: 'Ca Tối (Đóng quán & Vệ sinh)',
      startTime: '17:30',
      endTime: '23:00',
      registeredBy: 'employee',
      status: 'scheduled',
    },
  ];

  return assignments;
}

@Injectable({ providedIn: 'root' })
export class HrmShiftApi {
  private templates: ShiftTemplate[] = [...INITIAL_SHIFT_TEMPLATES];
  private assignments: ShiftAssignment[] = generateMockAssignments();

  getShiftTemplates(branchId?: string): Observable<ShiftTemplate[]> {
    let list = this.templates;
    if (branchId && branchId !== 'all') {
      list = list.filter((t) => !t.branchId || t.branchId === 'all' || t.branchId === branchId);
    }
    return of([...list]).pipe(delay(150));
  }

  createShiftTemplate(data: Partial<ShiftTemplate>): Observable<ShiftTemplate> {
    const newTemplate: ShiftTemplate = {
      id: `shift-${Date.now()}`,
      code: data.code || `CA-${this.templates.length + 1}`,
      name: data.name || 'Ca làm việc mới',
      startTime: data.startTime || '08:00',
      endTime: data.endTime || '16:00',
      breakMinutes: data.breakMinutes || 0,
      standardHours: data.standardHours || 8,
      color: data.color || 'emerald',
      branchId: data.branchId || 'all',
    };
    this.templates.push(newTemplate);
    return of(newTemplate).pipe(delay(200));
  }

  updateShiftTemplate(id: string, data: Partial<ShiftTemplate>): Observable<ShiftTemplate> {
    const idx = this.templates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return throwError(() => new Error('Không tìm thấy ca'));
    }
    this.templates[idx] = { ...this.templates[idx], ...data };
    return of(this.templates[idx]).pipe(delay(200));
  }

  deleteShiftTemplate(id: string): Observable<void> {
    this.templates = this.templates.filter((t) => t.id !== id);
    return of(void 0).pipe(delay(200));
  }

  /**
   * Lấy lịch làm việc đã đăng ký trong tuần theo chi nhánh
   */
  getWeekSchedule(query: WeekScheduleQuery): Observable<ShiftAssignment[]> {
    let list = this.assignments.filter(
      (a) => a.date >= query.startDate && a.date <= query.endDate
    );

    if (query.branchId && query.branchId !== 'all') {
      list = list.filter((a) => a.branchId === query.branchId);
    }

    return of(list).pipe(delay(250));
  }

  /**
   * Lưu hoặc cập nhật lịch phân ca (kiểm tra không xếp trùng giờ cho 1 người trong cùng ngày)
   */
  saveShiftAssignment(asg: ShiftAssignment): Observable<ShiftAssignment> {
    // Kiểm tra trùng ca
    const conflict = this.assignments.find(
      (a) =>
        a.id !== asg.id &&
        a.employeeId === asg.employeeId &&
        a.date === asg.date &&
        a.shiftId === asg.shiftId &&
        a.status !== 'cancelled'
    );

    if (conflict) {
      return throwError(() => new Error('Nhân viên đã được xếp ca này trong cùng ngày.'));
    }

    const idx = this.assignments.findIndex((a) => a.id === asg.id);
    if (idx !== -1) {
      this.assignments[idx] = asg;
    } else {
      this.assignments.push(asg);
    }

    return of(asg).pipe(delay(200));
  }

  removeShiftAssignment(assignmentId: string): Observable<void> {
    this.assignments = this.assignments.filter((a) => a.id !== assignmentId);
    return of(void 0).pipe(delay(150));
  }

  /**
   * Lấy danh sách ca làm việc đã đăng ký hôm nay
   */
  getTodayShifts(branchId?: string): Observable<ShiftAssignment[]> {
    const today = '2026-11-15'; // Sử dụng ngày mock đồng bộ
    let list = this.assignments.filter((a) => a.date === today && a.status !== 'cancelled');

    if (branchId && branchId !== 'all') {
      list = list.filter((a) => a.branchId === branchId);
    }

    return of(list).pipe(delay(150));
  }
}
