/**
 * Nguồn dữ liệu duy nhất cho 4 module của trang quản trị.
 * Thêm module mới: thêm khóa vào AdminModuleKey, một mục trong ADMIN_MODULES,
 * một file routes trong modules/ và một dòng trong admin.routes.ts.
 */
export type AdminModuleKey = 'cms' | 'crm' | 'hrm' | 'erp';

/** Khóa icon, xem AdminIconComponent. Icon mới: import trong admin_icon.ts rồi thêm 1 @case */
export type AdminIconKey =
  | 'mod-cms'
  | 'mod-crm'
  | 'mod-hrm'
  | 'mod-erp'
  | 'dashboard'
  | 'article'
  | 'image'
  | 'folder-tree'
  | 'product'
  | 'customers'
  | 'orders'
  | 'voucher'
  | 'star'
  | 'staff'
  | 'shift'
  | 'timekeeping'
  | 'payroll'
  | 'warehouse'
  | 'supplier'
  | 'purchase'
  | 'report';

export interface AdminMenuItem {
  label: string;
  /** Đường dẫn tương đối trong module, ví dụ 'bai-viet' -> /admin/cms/bai-viet */
  path: string;
  icon: AdminIconKey;
}

export interface AdminModule {
  key: AdminModuleKey;
  label: string;
  title: string;
  icon: AdminIconKey;
  /** Màu nhấn của module (dùng cho tab, sidebar, chấm active) */
  accent: string;
  menu: readonly AdminMenuItem[];
}

export const ADMIN_MODULES: readonly AdminModule[] = [
  {
    key: 'cms',
    label: 'CMS',
    title: 'Quản lý nội dung',
    icon: 'mod-cms',
    accent: 'var(--color-do)',
    menu: [
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard' },
      { label: 'Bài viết', path: 'bai-viet', icon: 'article' },
      { label: 'Banner hero', path: 'banner-hero', icon: 'image' },
      { label: 'Danh mục', path: 'danh-muc', icon: 'folder-tree' },
      { label: 'Sản phẩm', path: 'san-pham', icon: 'product' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    title: 'Chăm sóc khách hàng',
    icon: 'mod-crm',
    accent: 'var(--color-xanh-duong)',
    menu: [
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard' },
      { label: 'Khách hàng', path: 'khach-hang', icon: 'customers' },
      { label: 'Đơn hàng', path: 'don-hang', icon: 'orders' },
      { label: 'Voucher', path: 'voucher', icon: 'voucher' },
      { label: 'Đánh giá', path: 'danh-gia', icon: 'star' },
    ],
  },
  {
    key: 'hrm',
    label: 'HRM',
    title: 'Quản lý nhân sự',
    icon: 'mod-hrm',
    accent: 'var(--color-xanh-dam)',
    menu: [
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard' },
      { label: 'Danh sách nhân viên', path: 'nhan-vien', icon: 'staff' },
      { label: 'Hồ sơ nhân viên', path: 'ho-so-nhan-vien', icon: 'article' },
      { label: 'Ca làm', path: 'ca-lam', icon: 'shift' },
      { label: 'Chấm công', path: 'cham-cong', icon: 'timekeeping' },
      { label: 'Lương', path: 'luong', icon: 'payroll' },
    ],
  },
  {
    key: 'erp',
    label: 'ERP',
    title: 'Vận hành và tài chính',
    icon: 'mod-erp',
    accent: 'var(--color-nau-dat)',
    menu: [
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard' },
      { label: 'Kho', path: 'kho', icon: 'warehouse' },
      { label: 'Nhà cung cấp', path: 'nha-cung-cap', icon: 'supplier' },
      { label: 'Mua hàng', path: 'mua-hang', icon: 'purchase' },
      { label: 'Báo cáo doanh thu', path: 'bao-cao-doanh-thu', icon: 'report' },
    ],
  },
];

export function getAdminModule(key: string | null | undefined): AdminModule | null {
  return ADMIN_MODULES.find((m) => m.key === key) ?? null;
}
