import { Routes } from '@angular/router';
import {
  adminAuthGuard,
  adminGuestGuard,
  adminHomeGuard,
  adminModuleGuard,
} from './core/admin_guards';
import { AdminLayout } from './layout/admin_layout/admin_layout';
import { AdminForbidden } from './pages/admin_forbidden/admin_forbidden';

/**
 * Cổng Quản trị (/admin) — Dành cho Quản lý & Quản trị viên (Cấp 3–5).
 */
export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/admin_login/admin_login').then((m) => m.AdminLogin),
    canActivate: [adminGuestGuard],
    data: { portal: 'admin' },
    title: 'Đăng nhập Quản trị · Cà Phê Fiin',
  },
  {
    path: '',
    component: AdminLayout,
    canActivate: [adminAuthGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [adminHomeGuard], children: [] },
      {
        path: '_demo',
        loadComponent: () => import('./shared/admin_demo/admin_demo').then((m) => m.AdminDemo),
        title: 'Demo Thành phần Dùng chung · Cà Phê Fiin',
      },
      { path: 'khong-co-quyen', component: AdminForbidden, title: 'Không có quyền truy cập' },
      {
        path: 'cms',
        canMatch: [adminModuleGuard],
        data: { module: 'cms' },
        loadChildren: () => import('./modules/cms/cms.routes').then((m) => m.CMS_ROUTES),
      },
      {
        path: 'crm',
        canMatch: [adminModuleGuard],
        data: { module: 'crm' },
        loadChildren: () => import('./modules/crm/crm.routes').then((m) => m.CRM_ROUTES),
      },
      {
        path: 'hrm',
        canMatch: [adminModuleGuard],
        data: { module: 'hrm' },
        loadChildren: () => import('./modules/hrm/hrm.routes').then((m) => m.HRM_ROUTES),
      },
      {
        path: 'erp',
        canMatch: [adminModuleGuard],
        data: { module: 'erp' },
        loadChildren: () => import('./modules/erp/erp.routes').then((m) => m.ERP_ROUTES),
      },
    ],
  },
];
