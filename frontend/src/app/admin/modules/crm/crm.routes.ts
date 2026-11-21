import { Routes } from '@angular/router';
import { buildModuleRoutes } from '../../core/build_module_routes';

const baseRoutes = buildModuleRoutes('crm').filter(
  (r) =>
    r.path !== 'tong-quan' &&
    r.path !== 'voucher' &&
    r.path !== 'khach-hang' &&
    r.path !== 'don-hang' &&
    r.path !== 'danh-gia',
);

export const CRM_ROUTES: Routes = [
  ...baseRoutes,
  {
    path: 'tong-quan',
    title: 'Tổng quan · CRM',
    data: { module: 'crm', menuPath: 'tong-quan' },
    loadComponent: () =>
      import('./crm_dashboard/crm_dashboard').then((m) => m.CrmDashboard),
  },
  {
    path: 'danh-gia',
    title: 'Đánh giá · CRM',
    data: { module: 'crm', menuPath: 'danh-gia' },
    loadComponent: () =>
      import('./crm_reviews/crm_reviews').then((m) => m.CrmReviews),
  },
  {
    path: 'don-hang',
    title: 'Đơn hàng · CRM',
    data: { module: 'crm', menuPath: 'don-hang' },
    loadComponent: () =>
      import('./crm_orders/crm_orders').then((m) => m.CrmOrders),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'danh-sach-don-hang' },
      {
        path: 'danh-sach-don-hang',
        title: 'Danh sách đơn hàng · CRM',
        loadComponent: () =>
          import('./crm_orders/tabs/order_list/order_list').then(
            (m) => m.OrderListTab,
          ),
      },
      {
        path: 'gio-hang-dang-chon',
        title: 'Giỏ hàng đang chọn · CRM',
        loadComponent: () =>
          import('./crm_orders/tabs/abandoned_carts/abandoned_carts').then(
            (m) => m.AbandonedCartsTab,
          ),
      },
    ],
  },
  {
    path: 'khach-hang',
    title: 'Khách hàng · CRM',
    data: { module: 'crm', menuPath: 'khach-hang' },
    loadComponent: () =>
      import('./crm_customers/crm_customers').then((m) => m.CrmCustomers),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'danh-sach-khach-hang' },
      {
        path: 'danh-sach-khach-hang',
        title: 'Danh sách khách hàng · CRM',
        loadComponent: () =>
          import('./crm_customers/tabs/customer_list/customer_list').then(
            (m) => m.CustomerListTab,
          ),
      },
      {
        path: 'lich-su-diem-fiin',
        title: 'Lịch sử Điểm Fiin · CRM',
        loadComponent: () =>
          import('./crm_customers/tabs/point_history/point_history').then(
            (m) => m.PointHistoryTab,
          ),
      },
      {
        path: 'lich-su-voucher',
        title: 'Lịch sử Voucher · CRM',
        loadComponent: () =>
          import('./crm_customers/tabs/voucher_history/voucher_history').then(
            (m) => m.VoucherHistoryTab,
          ),
      },
      {
        path: 'lich-su-chinh-sua',
        title: 'Lịch sử chỉnh sửa · CRM',
        loadComponent: () =>
          import('./crm_customers/tabs/audit_history/audit_history').then(
            (m) => m.AuditHistoryTab,
          ),
      },
    ],
  },
  {
    path: 'voucher',
    title: 'Voucher & Điểm Fiin · CRM',
    data: { module: 'crm', menuPath: 'voucher' },
    loadComponent: () =>
      import('./crm_voucher/crm_voucher').then((m) => m.CrmVoucher),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'quy-tac-diem-fiin' },
      {
        path: 'quy-tac-diem-fiin',
        title: 'Quy tắc Điểm Fiin · CRM',
        loadComponent: () =>
          import('./crm_voucher/tabs/loyalty_settings/loyalty_settings').then(
            (m) => m.LoyaltySettingsTab,
          ),
      },
      {
        path: 'danh-sach-voucher',
        title: 'Danh sách Voucher · CRM',
        loadComponent: () =>
          import('./crm_voucher/tabs/voucher_list/voucher_list').then(
            (m) => m.VoucherListTab,
          ),
      },
    ],
  },
];
