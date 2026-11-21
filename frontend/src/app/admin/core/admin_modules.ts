/**
 * Nguồn dữ liệu duy nhất cho 4 module của trang quản trị và phân quyền 2 lớp (Module + Menu).
 */
export type AdminModuleKey = 'cms' | 'crm' | 'hrm' | 'erp';

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
  /** Yêu cầu đúng 1 mã quyền trong dbo.Permissions (Admin luôn có toàn quyền) */
  permission?: string;
  /** Yêu cầu có ít nhất 1 trong các mã quyền */
  anyPermissions?: readonly string[];
  /** Cấp phả hệ tối thiểu (1..5) để thấy mục menu này */
  minLevel?: number;
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
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard', permission: 'CMS_MANAGE' },
      { label: 'Bài viết', path: 'bai-viet', icon: 'article', permission: 'CMS_MANAGE' },
      { label: 'Banner hero', path: 'banner-hero', icon: 'image', permission: 'CMS_MANAGE' },
    ],
  },
  {
    key: 'crm',
    label: 'CRM',
    title: 'Chăm sóc khách hàng',
    icon: 'mod-crm',
    accent: 'var(--color-xanh-duong)',
    menu: [
      { label: 'Tổng quan', path: 'tong-quan', icon: 'dashboard', anyPermissions: ['CRM_MANAGE', 'CRM_VOUCHER'] },
      { label: 'Khách hàng', path: 'khach-hang', icon: 'customers', permission: 'CRM_MANAGE' },
      { label: 'Đơn hàng', path: 'don-hang', icon: 'orders', permission: 'CRM_MANAGE' },
      { label: 'Voucher', path: 'voucher', icon: 'voucher', permission: 'CRM_VOUCHER' },
      { label: 'Đánh giá', path: 'danh-gia', icon: 'star', permission: 'CRM_MANAGE' },
    ],
  },
  {
    key: 'hrm',
    label: 'HRM',
    title: 'Quản lý nhân sự',
    icon: 'mod-hrm',
    accent: 'var(--color-xanh-dam)',
    menu: [
      {
        label: 'Tổng quan',
        path: 'tong-quan',
        icon: 'dashboard',
        anyPermissions: ['HRM_EMPLOYEE', 'HRM_SCHEDULE', 'HRM_ATTENDANCE', 'PAYROLL_MANAGE'],
        minLevel: 3,
      },
      { label: 'Danh sách nhân viên', path: 'nhan-vien', icon: 'staff', permission: 'HRM_EMPLOYEE', minLevel: 3 },
      { label: 'Hồ sơ nhân viên', path: 'ho-so-nhan-vien', icon: 'article', anyPermissions: ['HRM_SELF', 'HRM_EMPLOYEE'] },
      { label: 'Hợp đồng', path: 'hop-dong', icon: 'article', permission: 'HRM_CONTRACT' },
      { label: 'Ca làm', path: 'ca-lam', icon: 'shift', anyPermissions: ['HRM_SCHEDULE', 'HRM_SHIFT_REGISTER'] },
      { label: 'Chấm công', path: 'cham-cong', icon: 'timekeeping', anyPermissions: ['HRM_ATTENDANCE', 'HRM_SELF'] },
      { label: 'Đơn từ', path: 'don-tu', icon: 'article', anyPermissions: ['HRM_LEAVE_REQUEST', 'HRM_ATTENDANCE', 'HRM_SCHEDULE'] },
      { label: 'Lương', path: 'luong', icon: 'payroll', permission: 'PAYROLL_MANAGE' },
    ],
  },
  {
    key: 'erp',
    label: 'ERP',
    title: 'Vận hành và tài chính',
    icon: 'mod-erp',
    accent: 'var(--color-nau-dat)',
    menu: [
      {
        label: 'Tổng quan',
        path: 'tong-quan',
        icon: 'dashboard',
        anyPermissions: ['ERP_INVENTORY', 'ERP_CATALOG', 'ERP_PURCHASE', 'REPORT_VIEW'],
      },
      { label: 'Thực đơn & Món', path: 'thuc-don', icon: 'product', permission: 'ERP_CATALOG' },
      { label: 'Kho tổng', path: 'kho', icon: 'warehouse', permission: 'ERP_INVENTORY' },
      { label: 'Chi nhánh', path: 'chi-nhanh', icon: 'warehouse', permission: 'ERP_INVENTORY' },
      { label: 'Nhập hàng & NCC', path: 'nhap-hang-ncc', icon: 'purchase', permission: 'ERP_PURCHASE' },
      { label: 'Giám sát đơn & Trả món', path: 'giam-sat-don', icon: 'orders', permission: 'ERP_INVENTORY' },
      { label: 'Báo cáo doanh thu', path: 'bao-cao-doanh-thu', icon: 'report', permission: 'REPORT_VIEW' },
    ],
  },
];

export const STAFF_PORTAL_MODULE: AdminModule = {
  key: 'hrm',
  label: 'Nhân viên',
  title: 'Cổng tự phục vụ (Staff Portal)',
  icon: 'mod-hrm',
  accent: 'var(--color-xanh-dam)',
  menu: [
    { label: 'Hồ sơ cá nhân', path: 'ho-so-nhan-vien', icon: 'article', anyPermissions: ['HRM_SELF', 'HRM_EMPLOYEE'] },
    { label: 'Ca làm', path: 'ca-lam', icon: 'shift', anyPermissions: ['HRM_SCHEDULE', 'HRM_SHIFT_REGISTER'] },
    { label: 'Chấm công', path: 'cham-cong', icon: 'timekeeping', anyPermissions: ['HRM_ATTENDANCE', 'HRM_SELF'] },
    { label: 'Đơn từ', path: 'don-tu', icon: 'article', anyPermissions: ['HRM_LEAVE_REQUEST', 'HRM_ATTENDANCE', 'HRM_SCHEDULE'] },
  ],
};

export function getAdminModule(key: string | null | undefined): AdminModule | null {
  return ADMIN_MODULES.find((m) => m.key === key) ?? null;
}
