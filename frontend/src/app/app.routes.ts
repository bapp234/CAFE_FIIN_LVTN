import { Routes } from '@angular/router';
import { PageLanding } from './pages/page_landing/landing';
import { PageHome } from './pages/page_home/home';
import { PagePolicy } from './pages/page_policy/policy';
import { PageMembership } from './pages/page_membership/membership';
import { PageProducts } from './pages/page_products/products';
import { PageProductDetail } from './pages/page_product_detail/productDetail';
import { PageSearch } from './pages/page_search/search';
import { PageNews } from './pages/page_news/news';
import { PageAuth } from './pages/page_auth/auth';

export const routes: Routes = [
  {
    path: '',
    component: PageLanding,
    title: 'Cà Phê Sài Gòn - Hương Vị Truyền Thống'
  },
  {
    path: 'home',
    component: PageHome,
    title: 'Trang chủ - Cà Phê Sài Gòn'
  },
  {
    path: 'auth',
    component: PageAuth,
    title: 'Tài Khoản & Đăng Nhập - Cà Phê Fiin'
  },
  {
    path: 'login',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'dang-nhap',
    redirectTo: 'auth',
    pathMatch: 'full'
  },
  {
    path: 'register',
    redirectTo: 'auth?mode=register',
    pathMatch: 'full'
  },
  {
    path: 'dang-ky',
    redirectTo: 'auth?mode=register',
    pathMatch: 'full'
  },
  {
    path: 'forgot-password',
    redirectTo: 'auth?mode=forgot-password',
    pathMatch: 'full'
  },
  {
    path: 'quen-mat-khau',
    redirectTo: 'auth?mode=forgot-password',
    pathMatch: 'full'
  },
  {
    path: 'san-pham',
    component: PageProducts,
    title: 'Thực Đơn Sản Phẩm - Cà Phê Fiin'
  },
  {
    path: 'san-pham/:id',
    component: PageProductDetail,
    title: 'Chi Tiết Sản Phẩm - Cà Phê Fiin'
  },
  {
    path: 'product/:id',
    redirectTo: 'san-pham/:id',
    pathMatch: 'full'
  },
  {
    path: 'menu',
    redirectTo: 'san-pham',
    pathMatch: 'full'
  },
  {
    path: 'products',
    redirectTo: 'san-pham',
    pathMatch: 'full'
  },
  {
    path: 'tim-kiem',
    component: PageSearch,
    title: 'Tìm Kiếm Món Ngon - Cà Phê Fiin'
  },
  {
    path: 'search',
    redirectTo: 'tim-kiem',
    pathMatch: 'full'
  },
  {
    path: 'tin-tuc',
    component: PageNews,
    title: 'Chuyện Phiếm Cùng Fiin - Bản Tin Ký Sự'
  },
  {
    path: 'news',
    redirectTo: 'tin-tuc',
    pathMatch: 'full'
  },
  {
    path: 'journal',
    redirectTo: 'tin-tuc',
    pathMatch: 'full'
  },
  {
    path: 'chinh-sach-doi-tra',
    component: PagePolicy,
    title: 'Chính sách Đặt hàng & Đổi trả - Cà Phê Fiin'
  },
  {
    path: 'chinh-sach',
    redirectTo: 'chinh-sach-doi-tra',
    pathMatch: 'full'
  },
  {
    path: 'uu-dai',
    component: PageMembership,
    title: 'Ưu Đãi Thành Viên - Cà Phê Fiin'
  },
  {
    path: 'membership',
    redirectTo: 'uu-dai',
    pathMatch: 'full'
  },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: '**',
    redirectTo: ''
  }
];
