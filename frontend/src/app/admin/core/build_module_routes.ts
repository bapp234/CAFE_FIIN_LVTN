import { Routes } from '@angular/router';
import { AdminModuleKey, getAdminModule } from './admin_modules';

/**
 * Tạo route cho một module từ danh sách menu trong admin_modules.ts.
 * Mỗi mục menu hiện dùng trang tạm (AdminPage). Khi làm xong một màn hình thật,
 * viết routes riêng cho module đó và trỏ path tương ứng sang component thật
 * (ví dụ HRM: xem modules/hrm/hrm.routes.ts).
 */
export function buildModuleRoutes(key: AdminModuleKey): Routes {
  const mod = getAdminModule(key);
  if (!mod) return [];

  return [
    { path: '', pathMatch: 'full', redirectTo: mod.menu[0].path },
    ...mod.menu.map((item) => ({
      path: item.path,
      title: `${item.label} · ${mod.label}`,
      data: { module: key, menuPath: item.path },
      loadComponent: () =>
        import('../pages/admin_page/admin_page').then((m) => m.AdminPage),
    })),
  ];
}
