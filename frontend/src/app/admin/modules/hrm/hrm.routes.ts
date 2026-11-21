import { Routes } from '@angular/router';
import { adminPermissionGuard } from '../../core/admin_guards';

export const HRM_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
  {
    path: 'tong-quan',
    loadComponent: () =>
      import('./hrm_dashboard/hrm_dashboard').then((m) => m.HrmDashboard),
    title: 'Tổng quan · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'nhan-vien',
    canActivate: [adminPermissionGuard],
    data: { permission: 'HRM_EMPLOYEE', minLevel: 3 },
    loadComponent: () =>
      import('./hrm_employees/hrm_employees').then((m) => m.HrmEmployees),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'danh-sach' },
      {
        path: 'danh-sach',
        loadComponent: () =>
          import('./hrm_employees/tabs/employee_list/employee_list').then((m) => m.EmployeeList),
        title: 'Danh sách Nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'chua-thiet-lap',
        loadComponent: () =>
          import('./hrm_employees/tabs/employee_unprovisioned/employee_unprovisioned').then(
            (m) => m.EmployeeUnprovisioned
          ),
        title: 'Tài khoản chưa thiết lập · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'thiet-lap',
        loadComponent: () =>
          import('./hrm_employees/tabs/employee_settings/employee_settings').then((m) => m.EmployeeSettings),
        title: 'Thiết lập Nhân sự · Quản trị Nhân sự · Cà Phê Fiin',
      },
      { path: 'phan-quyen', redirectTo: 'thiet-lap' },
    ],
  },
  {
    path: 'ho-so-nhan-vien',
    loadComponent: () =>
      import('./hrm_profile/hrm_profile').then((m) => m.HrmProfile),
    title: 'Hồ sơ Nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'hop-dong',
    canActivate: [adminPermissionGuard],
    data: { permission: 'HRM_CONTRACT' },
    loadComponent: () =>
      import('./hrm_contracts/hrm_contracts').then((m) => m.HrmContracts),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'hien-tai' },
      {
        path: 'hien-tai',
        data: { tabMode: 'current' },
        loadComponent: () =>
          import('./hrm_contracts/tabs/contract_grid/contract_grid').then((m) => m.ContractGridTab),
        title: 'Hợp đồng hiện tại · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'den-han-ky',
        data: { tabMode: 'expiring' },
        loadComponent: () =>
          import('./hrm_contracts/tabs/contract_grid/contract_grid').then((m) => m.ContractGridTab),
        title: 'Danh sách đến hạn ký hợp đồng · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'lich-su',
        data: { tabMode: 'history' },
        loadComponent: () =>
          import('./hrm_contracts/tabs/contract_grid/contract_grid').then((m) => m.ContractGridTab),
        title: 'Lịch sử ký hợp đồng · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'thiet-lap',
        canActivate: [adminPermissionGuard],
        data: { permission: 'HRM_CONTRACT', minLevel: 4 },
        loadComponent: () =>
          import('./hrm_contracts/tabs/contract_settings/contract_settings').then((m) => m.ContractSettingsTab),
        title: 'Thiết lập hợp đồng · Quản trị Nhân sự · Cà Phê Fiin',
      },
    ],
  },
  {
    path: 'ca-lam',
    loadComponent: () =>
      import('./hrm_shifts/hrm_shifts').then((m) => m.HrmShifts),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lich-tuan' },
      {
        path: 'lich-tuan',
        loadComponent: () =>
          import('./hrm_shifts/tabs/shift_schedule/shift_schedule').then((m) => m.ShiftSchedule),
        title: 'Lịch phân ca tuần · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'mau-ca',
        loadComponent: () =>
          import('./hrm_shifts/tabs/shift_templates/shift_templates').then((m) => m.ShiftTemplates),
        title: 'Danh mục mẫu ca · Quản trị Nhân sự · Cà Phê Fiin',
      },
    ],
  },
  {
    path: 'cham-cong',
    loadComponent: () =>
      import('./hrm_attendance/hrm_attendance').then((m) => m.HrmAttendance),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tong-hop-thang' },
      {
        path: 'tong-hop-thang',
        loadComponent: () =>
          import('./hrm_attendance/tabs/attendance_monthly_summary/attendance_monthly_summary').then(
            (m) => m.AttendanceMonthlySummary
          ),
        title: 'Danh sách công tổng hợp theo tháng · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'cong-ca-nhan',
        loadComponent: () =>
          import('./hrm_attendance/tabs/attendance_personal_monthly/attendance_personal_monthly').then(
            (m) => m.AttendancePersonalMonthly
          ),
        title: 'Danh sách công tháng cá nhân · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'phep-nam',
        loadComponent: () =>
          import('./hrm_attendance/tabs/attendance_annual_leave/attendance_annual_leave').then(
            (m) => m.AttendanceAnnualLeave
          ),
        title: 'Danh sách phép năm nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'thiet-lap',
        loadComponent: () =>
          import('./hrm_attendance/tabs/attendance_settings/attendance_settings').then(
            (m) => m.AttendanceSettings,
          ),
        title: 'Thiết lập tăng ca - nghỉ phép',
      },
    ],
  },
  {
    path: 'don-tu',
    loadComponent: () =>
      import('./hrm_requests/hrm_requests').then((m) => m.HrmRequests),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'don-tang-ca' },
      {
        path: 'don-tang-ca',
        loadComponent: () =>
          import('./hrm_requests/tabs/request_overtime/request_overtime').then(
            (m) => m.RequestOvertimeTab
          ),
        title: 'Đơn xin tăng ca · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'don-bu-cong',
        loadComponent: () =>
          import('./hrm_requests/tabs/request_correction/request_correction').then(
            (m) => m.RequestCorrectionTab
          ),
        title: 'Đơn bù công · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'don-nghi-phep',
        loadComponent: () =>
          import('./hrm_requests/tabs/request_leave/request_leave').then(
            (m) => m.RequestLeaveTab
          ),
        title: 'Đơn xin nghỉ phép · Quản trị Nhân sự · Cà Phê Fiin',
      },
    ],
  },
  {
    path: 'luong',
    canActivate: [adminPermissionGuard],
    data: { permission: 'PAYROLL_MANAGE' },
    loadComponent: () =>
      import('./hrm_payroll/hrm_payroll').then((m) => m.HrmPayroll),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'danh-sach-tra-luong' },
      {
        path: 'danh-sach-tra-luong',
        loadComponent: () =>
          import('./hrm_payroll/tabs/payroll_payout_list/payroll_payout_list').then(
            (m) => m.PayrollPayoutList
          ),
        title: 'Danh sách trả lương · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'luong-nhan-vien',
        loadComponent: () =>
          import('./hrm_payroll/tabs/payroll_employee_salary/payroll_employee_salary').then(
            (m) => m.PayrollEmployeeSalary
          ),
        title: 'Danh sách lương nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'tam-ung-luong',
        loadComponent: () =>
          import('./hrm_payroll/tabs/payroll_advance_list/payroll_advance_list').then(
            (m) => m.PayrollAdvanceList
          ),
        title: 'Danh sách tạm ứng lương · Quản trị Nhân sự · Cà Phê Fiin',
      },
      {
        path: 'thiet-lap-luong',
        loadComponent: () =>
          import('./hrm_payroll/tabs/payroll_settings/payroll_settings').then(
            (m) => m.PayrollSettings
          ),
        title: 'Thiết lập lương & Bảo hiểm · Quản trị Nhân sự · Cà Phê Fiin',
      },
    ],
  },
];
