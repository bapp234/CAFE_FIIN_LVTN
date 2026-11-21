import { Routes } from '@angular/router';
import {
  adminGuestGuard,
  adminPermissionGuard,
  staffAuthGuard,
  staffHomeGuard,
} from './core/admin_guards';
import { AdminLayout } from './layout/admin_layout/admin_layout';
import { AdminForbidden } from './pages/admin_forbidden/admin_forbidden';

/**
 * Cổng Nhân viên (/staff) — Dành cho Nhân viên vận hành & Trưởng ca (Cấp 1–2).
 * Tách biệt hoàn toàn đường dẫn và luồng đăng nhập khỏi Cổng Quản trị (/admin).
 */
export const STAFF_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/admin_login/admin_login').then((m) => m.AdminLogin),
    canActivate: [adminGuestGuard],
    data: { portal: 'staff' },
    title: 'Đăng nhập Nhân viên · Cà Phê Fiin',
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [staffAuthGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [staffHomeGuard], children: [] },
      { path: 'khong-co-quyen', component: AdminForbidden, title: 'Không có quyền truy cập' },
      {
        path: 'ho-so-nhan-vien',
        canActivate: [adminPermissionGuard],
        data: { anyPermissions: ['HRM_SELF', 'HRM_EMPLOYEE'] },
        loadComponent: () => import('./modules/hrm/hrm_profile/hrm_profile').then((m) => m.HrmProfile),
        title: 'Hồ sơ cá nhân · Cổng Nhân viên · Cà Phê Fiin',
      },
      {
        path: 'ca-lam',
        canActivate: [adminPermissionGuard],
        data: { anyPermissions: ['HRM_SCHEDULE', 'HRM_SHIFT_REGISTER'] },
        loadComponent: () => import('./modules/hrm/hrm_shifts/hrm_shifts').then((m) => m.HrmShifts),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'lich-tuan' },
          {
            path: 'lich-tuan',
            loadComponent: () =>
              import('./modules/hrm/hrm_shifts/tabs/shift_schedule/shift_schedule').then((m) => m.ShiftSchedule),
            title: 'Lịch phân ca tuần · Cổng Nhân viên · Cà Phê Fiin',
          },
          {
            path: 'mau-ca',
            loadComponent: () =>
              import('./modules/hrm/hrm_shifts/tabs/shift_templates/shift_templates').then((m) => m.ShiftTemplates),
            title: 'Danh mục mẫu ca · Cổng Nhân viên · Cà Phê Fiin',
          },
        ],
      },
      {
        path: 'cham-cong',
        canActivate: [adminPermissionGuard],
        data: { anyPermissions: ['HRM_ATTENDANCE', 'HRM_SELF'] },
        loadComponent: () => import('./modules/hrm/hrm_attendance/hrm_attendance').then((m) => m.HrmAttendance),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'cong-ca-nhan' },
          {
            path: 'cong-ca-nhan',
            loadComponent: () =>
              import('./modules/hrm/hrm_attendance/tabs/attendance_personal_monthly/attendance_personal_monthly').then(
                (m) => m.AttendancePersonalMonthly
              ),
            title: 'Công tháng cá nhân · Cổng Nhân viên · Cà Phê Fiin',
          },
          {
            path: 'tong-hop-thang',
            loadComponent: () =>
              import('./modules/hrm/hrm_attendance/tabs/attendance_monthly_summary/attendance_monthly_summary').then(
                (m) => m.AttendanceMonthlySummary
              ),
            title: 'Tổng hợp công tháng · Cổng Nhân viên · Cà Phê Fiin',
          },
          {
            path: 'phep-nam',
            loadComponent: () =>
              import('./modules/hrm/hrm_attendance/tabs/attendance_annual_leave/attendance_annual_leave').then(
                (m) => m.AttendanceAnnualLeave
              ),
            title: 'Phép năm · Cổng Nhân viên · Cà Phê Fiin',
          },
        ],
      },
      {
        path: 'don-tu',
        canActivate: [adminPermissionGuard],
        data: { anyPermissions: ['HRM_LEAVE_REQUEST', 'HRM_ATTENDANCE', 'HRM_SCHEDULE'] },
        loadComponent: () => import('./modules/hrm/hrm_requests/hrm_requests').then((m) => m.HrmRequests),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'don-tang-ca' },
          {
            path: 'don-tang-ca',
            loadComponent: () =>
              import('./modules/hrm/hrm_requests/tabs/request_overtime/request_overtime').then(
                (m) => m.RequestOvertimeTab
              ),
            title: 'Đơn xin tăng ca · Cổng Nhân viên · Cà Phê Fiin',
          },
          {
            path: 'don-bu-cong',
            loadComponent: () =>
              import('./modules/hrm/hrm_requests/tabs/request_correction/request_correction').then(
                (m) => m.RequestCorrectionTab
              ),
            title: 'Đơn bù công · Cổng Nhân viên · Cà Phê Fiin',
          },
          {
            path: 'don-nghi-phep',
            loadComponent: () =>
              import('./modules/hrm/hrm_requests/tabs/request_leave/request_leave').then(
                (m) => m.RequestLeaveTab
              ),
            title: 'Đơn nghỉ phép · Cổng Nhân viên · Cà Phê Fiin',
          },
        ],
      },
    ],
  },
];
