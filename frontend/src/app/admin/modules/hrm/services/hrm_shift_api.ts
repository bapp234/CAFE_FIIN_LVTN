import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { ShiftAssignment, ShiftTemplate, WeekScheduleQuery } from '../models/shift';

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  errors?: string[];
}

export interface ShiftScheduleWeekStatus {
  weekId: number;
  branchId: number;
  year: number;
  weekNumber: number;
  startDate: string;
  endDate: string;
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: string;
}

export interface LockShiftScheduleRequest {
  branchId: number;
  startDate: string;
  lockedBy?: string;
  password?: string;
}

export interface UnlockShiftScheduleRequest {
  branchId: number;
  startDate: string;
  password?: string;
  unlockReason?: string;
  unlockedBy?: string;
}

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

  private mapAssignmentDto(dto: any): ShiftAssignment {
    return {
      id: String(dto.id),
      employeeId: String(dto.employeeId),
      employeeCode: dto.employeeCode || '',
      employeeName: dto.employeeName || '',
      branchId: String(dto.branchId ?? ''),
      date: dto.date,
      shiftId: String(dto.shiftId ?? ''),
      shiftCode: dto.shiftCode || '',
      shiftName: dto.shiftName || '',
      startTime: dto.startTime || '',
      endTime: dto.endTime || '',
      registeredBy: dto.registeredBy || 'manager',
      status: dto.status || 'scheduled',
      note: dto.note,
    };
  }

  getShiftTemplates(branchId?: string): Observable<ShiftTemplate[]> {
    return this.http.get<ApiResponse<any[]>>('http://localhost:5107/api/v1/shifts/templates').pipe(
      map((res) => {
        const items = res?.data || [];
        const mapped: ShiftTemplate[] = items.map((t, idx) => ({
          id: String(t.templateId ?? t.id ?? idx + 1),
          code: t.shiftCode || t.code,
          name: t.shiftName || t.name,
          startTime: String(t.startTime || '').slice(0, 5),
          endTime: String(t.endTime || '').slice(0, 5),
          breakMinutes: Number(t.breakMinutes ?? 0),
          standardHours: Number(t.standardHours ?? 5.5),
          color: (['emerald', 'amber', 'indigo', 'rose', 'sky'][idx % 5] as ShiftTemplate['color']),
          branchId: 'all',
        }));
        return mapped;
      }),
      catchError(() => of([]))
    );
  }

  private toSqlTime(t?: string): string {
    if (!t) return '08:00:00';
    return t.length === 5 ? `${t}:00` : t;
  }

  createShiftTemplate(data: Partial<ShiftTemplate>): Observable<ShiftTemplate> {
    const payload = {
      templateId: null,
      shiftCode: (data.code || `CA-${Date.now()}`).trim().toUpperCase(),
      shiftName: (data.name || 'Ca làm việc mới').trim(),
      startTime: this.toSqlTime(data.startTime || '08:00'),
      endTime: this.toSqlTime(data.endTime || '16:00'),
      breakMinutes: Number(data.breakMinutes ?? 0),
      standardHours: Number(data.standardHours ?? 8),
      colorCode: data.color || 'emerald',
      isActive: true,
    };

    return this.http
      .post<ApiResponse<{ templateId: number; shiftCode: string }>>(
        'http://localhost:5107/api/v1/shifts/templates',
        payload
      )
      .pipe(
        map((res) => ({
          id: String(res?.data?.templateId ?? Date.now()),
          code: payload.shiftCode,
          name: payload.shiftName,
          startTime: payload.startTime.slice(0, 5),
          endTime: payload.endTime.slice(0, 5),
          breakMinutes: payload.breakMinutes,
          standardHours: payload.standardHours,
          color: (payload.colorCode as ShiftTemplate['color']) || 'emerald',
          branchId: data.branchId || 'all',
        }))
      );
  }

  updateShiftTemplate(id: string, data: Partial<ShiftTemplate>): Observable<ShiftTemplate> {
    const numId = parseInt(String(id), 10);
    const payload = {
      templateId: !isNaN(numId) && numId > 0 ? numId : null,
      shiftCode: (data.code || '').trim().toUpperCase(),
      shiftName: (data.name || '').trim(),
      startTime: this.toSqlTime(data.startTime || '08:00'),
      endTime: this.toSqlTime(data.endTime || '16:00'),
      breakMinutes: Number(data.breakMinutes ?? 0),
      standardHours: Number(data.standardHours ?? 8),
      colorCode: data.color || 'emerald',
      isActive: true,
    };

    return this.http
      .post<ApiResponse<{ templateId: number; shiftCode: string }>>(
        'http://localhost:5107/api/v1/shifts/templates',
        payload
      )
      .pipe(
        map((res) => ({
          id: String(res?.data?.templateId ?? id),
          code: payload.shiftCode,
          name: payload.shiftName,
          startTime: payload.startTime.slice(0, 5),
          endTime: payload.endTime.slice(0, 5),
          breakMinutes: payload.breakMinutes,
          standardHours: payload.standardHours,
          color: (payload.colorCode as ShiftTemplate['color']) || 'emerald',
          branchId: data.branchId || 'all',
        }))
      );
  }

  deleteShiftTemplate(id: string): Observable<void> {
    const numId = parseInt(String(id), 10);
    if (isNaN(numId) || numId <= 0) {
      return of(void 0);
    }
    return this.http
      .delete<ApiResponse<boolean>>(`http://localhost:5107/api/v1/shifts/templates/${numId}`)
      .pipe(map(() => void 0));
  }

  /**
   * Lấy lịch làm việc đã đăng ký trong tuần theo chi nhánh (từ SQL Server)
   */
  getWeekSchedule(query: WeekScheduleQuery): Observable<ShiftAssignment[]> {
    let params = new HttpParams()
      .set('startDate', query.startDate)
      .set('endDate', query.endDate);

    if (query.branchId && query.branchId !== 'all' && !isNaN(Number(query.branchId))) {
      params = params.set('branchId', String(Number(query.branchId)));
    }

    return this.http
      .get<ApiResponse<any[]>>('http://localhost:5107/api/v1/shifts/assignments', { params })
      .pipe(
        map((res) => (res?.data || []).map((d) => this.mapAssignmentDto(d))),
        catchError(() => of([]))
      );
  }

  /**
   * Lưu hoặc cập nhật lịch phân ca trực tiếp vào SQL Server (dbo.ShiftAssignments)
   */
  saveShiftAssignment(asg: ShiftAssignment): Observable<ShiftAssignment> {
    const empIdNum = parseInt(String(asg.employeeId).replace(/\D/g, ''), 10);
    const branchIdNum = parseInt(String(asg.branchId || '').replace(/\D/g, ''), 10);
    const tmplIdNum = parseInt(String(asg.shiftId || ''), 10);

    const payload = {
      employeeId: isNaN(empIdNum) ? 0 : empIdNum,
      workDate: asg.date,
      shiftCode: asg.shiftCode,
      templateId: !isNaN(tmplIdNum) && tmplIdNum > 0 ? tmplIdNum : null,
      branchId: !isNaN(branchIdNum) && branchIdNum > 0 ? branchIdNum : null,
      registeredBy: asg.registeredBy || 'manager',
      status: asg.status || 'scheduled',
      note: asg.note || null,
    };

    return this.http
      .post<ApiResponse<any>>('http://localhost:5107/api/v1/shifts/assignments', payload)
      .pipe(
        map((res) => this.mapAssignmentDto(res.data)),
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Không thể lưu phân ca vào cơ sở dữ liệu.';
          return throwError(() => new Error(msg));
        })
      );
  }

  removeShiftAssignment(assignmentId: string): Observable<void> {
    const numId = parseInt(String(assignmentId), 10);
    if (isNaN(numId) || numId <= 0) {
      this.assignments = this.assignments.filter((a) => a.id !== assignmentId);
      return of(void 0);
    }

    return this.http
      .delete<ApiResponse<boolean>>(`http://localhost:5107/api/v1/shifts/assignments/${numId}`)
      .pipe(
        map(() => void 0),
        catchError((err) => {
          const msg = err?.error?.message || err?.message || 'Không thể hủy phân ca trong cơ sở dữ liệu.';
          return throwError(() => new Error(msg));
        })
      );
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

  private readonly http = inject(HttpClient);

  /**
   * Lấy trạng thái khóa lịch ca tuần từ Backend API
   */
  getShiftScheduleWeekStatus(branchId: number, startDate: string): Observable<ShiftScheduleWeekStatus | null> {
    const params = new HttpParams()
      .set('branchId', branchId.toString())
      .set('startDate', startDate);

    return this.http.get<ApiResponse<ShiftScheduleWeekStatus | null>>('http://localhost:5107/api/v1/shifts/week-status', { params }).pipe(
      map(res => res.data),
      catchError(err => {
        console.warn('Lỗi lấy trạng thái khóa ca tuần từ backend:', err);
        return of(null);
      })
    );
  }

  /**
   * Khóa lịch phân ca tuần
   */
  lockShiftSchedule(req: LockShiftScheduleRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>('http://localhost:5107/api/v1/shifts/lock-week', req).pipe(
      map(res => res.success),
      catchError(err => {
        const msg = err.error?.message || err.message || 'Không thể khóa lịch phân ca tuần';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
   * Mở khóa lịch phân ca tuần
   */
  unlockShiftSchedule(req: UnlockShiftScheduleRequest): Observable<boolean> {
    return this.http.post<ApiResponse<boolean>>('http://localhost:5107/api/v1/shifts/unlock-week', req).pipe(
      map(res => res.success),
      catchError(err => {
        const msg = err.error?.message || err.message || 'Không thể mở khóa lịch phân ca tuần';
        return throwError(() => new Error(msg));
      })
    );
  }
}
