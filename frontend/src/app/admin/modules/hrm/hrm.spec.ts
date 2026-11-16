import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { HrmEmployeeApi } from './services/hrm_employee_api';
import { HrmShiftApi } from './services/hrm_shift_api';
import { HrmAttendanceApi } from './services/hrm_attendance_api';
import { HrmPayrollApi } from './services/hrm_payroll_api';
import { CreateEmployeeDto, Employee } from './models/employee';
import { ShiftAssignment, ShiftTemplate } from './models/shift';

describe('HRM Module Core Business Logic & Services (Giai đoạn 4)', () => {
  let employeeApi: HrmEmployeeApi;
  let shiftApi: HrmShiftApi;
  let attendanceApi: HrmAttendanceApi;
  let payrollApi: HrmPayrollApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), HrmEmployeeApi, HrmShiftApi, HrmAttendanceApi, HrmPayrollApi],
    });

    employeeApi = TestBed.inject(HrmEmployeeApi);
    shiftApi = TestBed.inject(HrmShiftApi);
    attendanceApi = TestBed.inject(HrmAttendanceApi);
    payrollApi = TestBed.inject(HrmPayrollApi);
  });

  describe('4.1 Employee Management API', () => {
    it('should list employees across all branches when branchId is all', async () => {
      const page = await firstValueFrom(
        employeeApi.getEmployees({ page: 1, size: 20, branchId: 'all' })
      );
      expect(page.items.length).toBeGreaterThanOrEqual(5);
      expect(page.total).toBeGreaterThanOrEqual(5);
    });

    it('should filter employees by specific branch (cn-q1)', async () => {
      const page = await firstValueFrom(
        employeeApi.getEmployees({ page: 1, size: 20, branchId: 'cn-q1' })
      );
      expect(page.items.every((e: Employee) => e.branchId === 'cn-q1')).toBe(true);
    });

    it('should filter employees by position', async () => {
      const page = await firstValueFrom(
        employeeApi.getEmployees({ page: 1, size: 20, position: 'Barista Chuyên nghiệp' })
      );
      expect(page.items.every((e: Employee) => e.position === 'Barista Chuyên nghiệp')).toBe(true);
    });

    it('should create a new employee with generated code', async () => {
      const newEmpData: CreateEmployeeDto = {
        username: 'nam.le',
        password: 'Password@123',
        fullName: 'Lê Hoàng Nam',
        phoneNumber: '0909112233',
        email: 'nam.le@fiin.vn',
        citizenId: '079000099881',
        branchId: 1,
        position: 'Thu ngân & Phục vụ',
        contractTypeId: 4,
        hourlyRate: 28000,
        roleId: 4,
      };
      const created = await firstValueFrom(employeeApi.createEmployee(newEmpData));
      expect(created.id).toBeDefined();
      expect(created.code).toMatch(/^NV\d+$/);
      expect(created.fullName).toBe('Lê Hoàng Nam');
      expect(created.status).toBe('active');
    });

    it('should handle employee resignation correctly', async () => {
      const isResigned = await firstValueFrom(
        employeeApi.changeStatus('1', 'resigned')
      );
      expect(isResigned).toBe(true);
    });

    it('should return KPI stats for employees', async () => {
      const stats = await firstValueFrom(employeeApi.getStats('all'));
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.working).toBeGreaterThan(0);
    });
  });

  describe('4.2 Shift Schedule & Template API', () => {
    it('should list default shift templates', async () => {
      const templates = await firstValueFrom(shiftApi.getShiftTemplates());
      expect(templates.length).toBeGreaterThanOrEqual(4);
      expect(templates.some((t: ShiftTemplate) => t.code === 'CA-SANG')).toBe(true);
      expect(templates.some((t: ShiftTemplate) => t.code === 'CA-CHIEU')).toBe(true);
    });

    it('should create a new shift template', async () => {
      const dto: Partial<ShiftTemplate> = {
        code: 'CA-DEM',
        name: 'Ca Đêm (Trực đêm)',
        startTime: '22:00',
        endTime: '06:00',
        standardHours: 8,
        color: 'indigo',
      };
      const created = await firstValueFrom(shiftApi.createShiftTemplate(dto));
      expect(created.code).toBe('CA-DEM');
      expect(created.standardHours).toBe(8);
    });

    it('should get weekly schedule assignments for a branch', async () => {
      const assignments = await firstValueFrom(
        shiftApi.getWeekSchedule({
          branchId: 'cn-q1',
          startDate: '2026-11-09',
          endDate: '2026-11-15',
        })
      );
      expect(Array.isArray(assignments)).toBe(true);
      expect(assignments.every((a: ShiftAssignment) => a.branchId === 'cn-q1')).toBe(true);
    });

    it('should assign and prevent duplicate shift assignment on the same day', async () => {
      const asg: ShiftAssignment = {
        id: 'asg-test-dup',
        employeeId: 'emp-02',
        employeeCode: 'NV002',
        employeeName: 'Nguyễn Thị Hương',
        branchId: 'cn-q1',
        shiftId: 'shift-morning',
        shiftCode: 'CA-SANG',
        shiftName: 'Ca Sáng',
        date: '2026-11-20',
        startTime: '06:30',
        endTime: '12:00',
        registeredBy: 'manager',
        status: 'scheduled',
      };
      const assignment = await firstValueFrom(shiftApi.saveShiftAssignment(asg));
      expect(assignment.id).toBe('asg-test-dup');

      // Duplicate attempt should reject with error
      const dupAsg: ShiftAssignment = {
        id: 'asg-test-dup-2',
        employeeId: 'emp-02',
        employeeCode: 'NV002',
        employeeName: 'Nguyễn Thị Hương',
        branchId: 'cn-q1',
        shiftId: 'shift-morning',
        shiftCode: 'CA-SANG',
        shiftName: 'Ca Sáng',
        date: '2026-11-20',
        startTime: '06:30',
        endTime: '12:00',
        registeredBy: 'manager',
        status: 'scheduled',
      };
      await expect(
        firstValueFrom(shiftApi.saveShiftAssignment(dupAsg))
      ).rejects.toThrow('Nhân viên đã được xếp ca này trong cùng ngày.');
    });

    it('should remove a shift assignment', async () => {
      await expect(
        firstValueFrom(shiftApi.removeShiftAssignment('asg-test-dup'))
      ).resolves.toBeUndefined();
    });
  });

  describe('4.3 Attendance Cross-Checking & Manual Adjustment API', () => {
    it('should get attendance list for a specific date', async () => {
      const page = await firstValueFrom(
        attendanceApi.getAttendanceList({
          page: 1,
          size: 20,
          date: '2026-11-15',
          branchId: 'all',
        })
      );
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((r) => r.date === '2026-11-15')).toBe(true);
    });

    it('should cross-check check-in/out against scheduled shift', async () => {
      const page = await firstValueFrom(
        attendanceApi.getAttendanceList({
          page: 1,
          size: 20,
          date: '2026-11-15',
          branchId: 'all',
        })
      );
      const lateRecord = page.items.find((r) => r.status === 'late');
      if (lateRecord) {
        expect(lateRecord.lateMinutes).toBeGreaterThan(0);
        expect(lateRecord.scheduledStartTime).toBeDefined();
      }
    });

    it('should support manual adjustment with required reason and auditor tracking', async () => {
      const adjusted = await firstValueFrom(
        attendanceApi.adjustAttendance(
          'att-02',
          '06:30',
          '12:00',
          'Máy chấm công vân tay bị lỗi cảm biến, quản lý xác nhận',
          'Nguyễn Quản Lý (Admin)'
        )
      );
      expect(adjusted.isManualAdjusted).toBe(true);
      expect(adjusted.adjustedNote).toContain('vân tay bị lỗi');
      expect(adjusted.adjustedBy).toBe('Nguyễn Quản Lý (Admin)');
      expect(adjusted.lateMinutes).toBe(0);
      expect(adjusted.status).toBe('on_time');
    });

    it('should export attendance CSV string', async () => {
      const csv = await firstValueFrom(
        attendanceApi.exportCsv({ page: 1, size: 50, branchId: 'all', date: '2026-11-15' })
      );
      expect(csv).toContain('Mã NV,Họ và tên,Chi nhánh');
      expect(csv).toContain('Đặng Quốc Anh');
    });
  });

  describe('4.4 Payroll Calculation & Period Locking API', () => {
    it('should calculate payroll with standard hours and overtime OT x1.5', async () => {
      const period = await firstValueFrom(
        payrollApi.generatePayroll('2026-11', 'all')
      );
      expect(period.period).toBe('2026-11');
      expect(period.totalEmployees).toBeGreaterThan(0);

      const slipsPage = await firstValueFrom(
        payrollApi.getPayrollSlips({ period: '2026-11', page: 1, size: 20 })
      );
      expect(slipsPage.items.length).toBeGreaterThan(0);

      for (const slip of slipsPage.items) {
        const expectedBasePay = slip.standardWorkHours * slip.hourlyRate;
        const expectedOtPay = slip.overtimeHours * (slip.hourlyRate * 1.5);
        const expectedNet = expectedBasePay + expectedOtPay + slip.allowance - slip.deduction - slip.advance;

        expect(slip.basePay).toBe(expectedBasePay);
        expect(slip.overtimePay).toBe(expectedOtPay);
        expect(slip.netPay).toBe(expectedNet);
      }
    });

    it('should lock a payroll period and prevent re-calculation', async () => {
      const periods = await firstValueFrom(payrollApi.getPayrollPeriods());
      const p = periods.find((x) => x.period === '2026-10') || periods[0];

      const locked = await firstValueFrom(
        payrollApi.approvePayroll(p.id, 'Lê Kế Toán Trưởng')
      );
      expect(locked.isLocked).toBe(true);
      expect(locked.status).toBe('approved');

      // Attempting to recalculate a locked period must throw
      await expect(
        firstValueFrom(payrollApi.generatePayroll(locked.period, locked.branchId))
      ).rejects.toThrow('Kỳ lương này đã được phê duyệt và khóa');
    });
  });
});
