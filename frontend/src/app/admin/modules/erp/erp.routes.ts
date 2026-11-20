import { Routes } from '@angular/router';

export const ERP_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tong-quan' },
  {
    path: 'tong-quan',
    loadComponent: () =>
      import('./erp_dashboard/erp_dashboard').then((m) => m.ErpDashboard),
    title: 'Tổng quan Vận hành & Kho · ERP · Cà Phê Fiin',
  },
  {
    path: 'thuc-don',
    loadComponent: () =>
      import('./erp_products/erp_products').then((m) => m.ErpProducts),
    title: 'Thực đơn & Sản phẩm · ERP · Cà Phê Fiin',
  },
  {
    path: 'kho',
    loadComponent: () =>
      import('./erp_inventory/erp_inventory').then((m) => m.ErpInventory),
    title: 'Quản lý Kho Nguyên vật liệu · ERP · Cà Phê Fiin',
  },
  {
    path: 'nha-cung-cap',
    loadComponent: () =>
      import('./erp_suppliers/erp_suppliers').then((m) => m.ErpSuppliers),
    title: 'Quản lý Nhà cung cấp · ERP · Cà Phê Fiin',
  },
  {
    path: 'mua-hang',
    loadComponent: () =>
      import('./erp_purchasing/erp_purchasing').then((m) => m.ErpPurchasing),
    title: 'Quản lý Mua hàng (PO) · ERP · Cà Phê Fiin',
  },
  {
    path: 'bao-cao-doanh-thu',
    loadComponent: () =>
      import('./erp_reports/erp_reports').then((m) => m.ErpReports),
    title: 'Báo cáo Doanh thu & Chi phí · ERP · Cà Phê Fiin',
  },
];
