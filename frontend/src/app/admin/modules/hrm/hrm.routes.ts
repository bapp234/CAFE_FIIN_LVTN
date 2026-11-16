import { Routes } from '@angular/router';

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
    loadComponent: () =>
      import('./hrm_employees/hrm_employees').then((m) => m.HrmEmployees),
    title: 'Danh sách Nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'ho-so-nhan-vien',
    loadComponent: () =>
      import('./hrm_profile/hrm_profile').then((m) => m.HrmProfile),
    title: 'Hồ sơ Nhân viên · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'ca-lam',
    loadComponent: () =>
      import('./hrm_shifts/hrm_shifts').then((m) => m.HrmShifts),
    title: 'Ca làm & Lịch tuần · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'cham-cong',
    loadComponent: () =>
      import('./hrm_attendance/hrm_attendance').then((m) => m.HrmAttendance),
    title: 'Dữ liệu Chấm công · Quản trị Nhân sự · Cà Phê Fiin',
  },
  {
    path: 'luong',
    loadComponent: () =>
      import('./hrm_payroll/hrm_payroll').then((m) => m.HrmPayroll),
    title: 'Tính toán Lương · Quản trị Nhân sự · Cà Phê Fiin',
  },
];
