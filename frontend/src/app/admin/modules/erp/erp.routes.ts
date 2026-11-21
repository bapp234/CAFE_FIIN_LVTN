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
    title: 'Thực đơn & Sản phẩm · ERP · Cà Phê Fiin',
    loadComponent: () =>
      import('./erp_products/erp_products').then((m) => m.ErpProducts),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'Thuc-don-fiin' },
      {
        path: 'Thuc-don-fiin',
        title: 'Thực đơn đồ uống Fiin · ERP',
        loadComponent: () =>
          import('./erp_products/tabs/products_list/products_list').then(
            (m) => m.ProductsListTab,
          ),
      },
      {
        path: 'danh-sach-loai-mon',
        title: 'Danh sách loại món · ERP',
        loadComponent: () =>
          import('./erp_products/tabs/categorys_list/categorys_list').then(
            (m) => m.CategorysListTab,
          ),
      },
    ],
  },
  {
    path: 'kho',
    title: 'Kho tổng · ERP · Cà Phê Fiin',
    loadComponent: () =>
      import('./erp_inventory/erp_inventory').then((m) => m.ErpInventory),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ton-kho-tong' },
      {
        path: 'ton-kho-tong',
        title: 'Tồn kho tổng & Vật tư · ERP',
        loadComponent: () =>
          import('./erp_inventory/tabs/central_stock/central_stock').then(
            (m) => m.CentralStockTab,
          ),
      },
      {
        path: 'duyet-cap-hang',
        title: 'Duyệt cấp hàng & Định kỳ · ERP',
        loadComponent: () =>
          import('./erp_inventory/tabs/transfer_approvals/transfer_approvals').then(
            (m) => m.TransferApprovalsTab,
          ),
      },
      {
        path: 'so-cai-kho',
        title: 'Sổ cái nhập – xuất tổng · ERP',
        loadComponent: () =>
          import('./erp_inventory/tabs/ledger_history/ledger_history').then(
            (m) => m.LedgerHistoryTab,
          ),
      },
    ],
  },
  {
    path: 'chi-nhanh',
    title: 'Chi nhánh · ERP · Cà Phê Fiin',
    loadComponent: () =>
      import('./erp_branch/erp_branch').then((m) => m.ErpBranch),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'ton-kho-chi-nhanh' },
      {
        path: 'ton-kho-chi-nhanh',
        title: 'Tồn kho chi nhánh · ERP',
        loadComponent: () =>
          import('./erp_branch/tabs/branch_stock/branch_stock').then(
            (m) => m.BranchStockTab,
          ),
      },
      {
        path: 'don-xin-nhap-kho',
        title: 'Đơn xin nhập kho · ERP',
        loadComponent: () =>
          import('./erp_branch/tabs/branch_requests/branch_requests').then(
            (m) => m.BranchRequestsTab,
          ),
      },
      {
        path: 'cong-thuc-mon',
        title: 'Công thức món (BOM) · ERP',
        loadComponent: () =>
          import('./erp_branch/tabs/product_recipes/product_recipes').then(
            (m) => m.ProductRecipesTab,
          ),
      },
      {
        path: 'giao-hang-phi-ship',
        title: 'Giao hàng & Phí ship · ERP',
        loadComponent: () =>
          import('./erp_branch/tabs/delivery_settings/delivery_settings').then(
            (m) => m.DeliverySettingsTab,
          ),
      },
    ],
  },
  {
    path: 'nhap-hang-ncc',
    title: 'Nhập hàng & NCC · ERP · Cà Phê Fiin',
    loadComponent: () =>
      import('./erp_purchasing/erp_purchasing').then((m) => m.ErpPurchasing),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'phieu-nhap-hang' },
      {
        path: 'phieu-nhap-hang',
        title: 'Phiếu nhập hàng (PO) · ERP',
        loadComponent: () =>
          import('./erp_purchasing/tabs/po_list/po_list').then(
            (m) => m.PoListTab,
          ),
      },
      {
        path: 'nha-cung-cap',
        title: 'Nhà cung cấp · ERP',
        loadComponent: () =>
          import('./erp_purchasing/tabs/supplier_list/supplier_list').then(
            (m) => m.SupplierListTab,
          ),
      },
    ],
  },
  {
    path: 'giam-sat-don',
    title: 'Giám sát đơn & Trả món · ERP · Cà Phê Fiin',
    loadComponent: () =>
      import('./erp_live_orders/erp_live_orders').then((m) => m.ErpLiveOrders),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'phien-don-hang' },
      {
        path: 'phien-don-hang',
        title: 'Phiên đơn hàng (Real-time) · ERP',
        loadComponent: () =>
          import('./erp_live_orders/tabs/live_orders/live_orders').then(
            (m) => m.LiveOrdersTab,
          ),
      },
      {
        path: 'duyet-tra-mon',
        title: 'Duyệt trả món & Hao hụt · ERP',
        loadComponent: () =>
          import('./erp_live_orders/tabs/disposal_reviews/disposal_reviews').then(
            (m) => m.DisposalReviewsTab,
          ),
      },
      {
        path: 'lich-su-don-hang',
        title: 'Lịch sử đơn hàng · ERP',
        loadComponent: () =>
          import('./erp_live_orders/tabs/order_history/order_history').then(
            (m) => m.OrderHistoryTab,
          ),
      },
    ],
  },
  {
    path: 'bao-cao-doanh-thu',
    loadComponent: () =>
      import('./erp_reports/erp_reports').then((m) => m.ErpReports),
    title: 'Báo cáo Doanh thu & Lợi nhuận · ERP · Cà Phê Fiin',
  },
];
