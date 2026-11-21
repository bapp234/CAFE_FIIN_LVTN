# Hệ thống Quản trị Nội bộ Cà Phê Fiin (CMS · CRM · HRM · ERP)

Tài liệu kỹ thuật dành cho nhóm phát triển và người kiểm thử hệ thống quản trị.

---

## 1. Cơ chế Xác thực & Phân quyền (Authentication & Authorization)

> **Nguyên tắc quan trọng:** Chặn ở giao diện người dùng (Angular Guards, `canMatch`, `canActivate`) chỉ nhằm mục đích tối ưu trải nghiệm (ẩn menu, chặn nạp mã module trái phép). **Backend bắt buộc phải kiểm tra quyền hạn module và quyền hạn dữ liệu chi tiết ở từng API endpoint.**

### Mô hình HttpOnly Cookie + Mock Service
- Ứng dụng triển khai kiến trúc bảo mật với **HttpOnly Cookie** để ngăn chặn tấn công đánh cắp phiên qua XSS.
- Khi có backend thật:
  - `POST /api/admin/auth/login` (kèm credentials) -> Backend xác thực và gắn cookie `Set-Cookie: fiin_admin_session=...; HttpOnly; SameSite=Strict; Path=/`.
  - `GET /api/admin/auth/me` (`withCredentials: true`) -> Backend đọc cookie và trả về thông tin profile `{ id, name, email, role, modules: [...] }`.
  - `POST /api/admin/auth/logout` -> Backend xóa cookie.
- Khi chưa có backend (Mock Service):
  - `AdminAuthService` (`core/admin_auth_service.ts`) mô phỏng hoàn toàn vòng đời này qua `sessionStorage` (đóng tab tự thoát) và độ trễ mạng thực tế (300ms).

---

## 2. Tài khoản Kiểm thử & Báo cáo Demo

Tại trang đăng nhập riêng `/admin/login`, có sẵn bảng **Demo 1-Click** cho các vai trò:

| Tài khoản | Mật khẩu | Vai trò | Phân hệ được phép | Mục đích thử nghiệm |
|---|---|---|---|---|
| `admin@fiin.vn` | `admin` | Quản trị viên toàn hệ thống | `['cms', 'crm', 'hrm', 'erp']` | Xem toàn bộ 4 tab và toàn bộ chức năng |
| `hr@fiin.vn` | `admin` | Trưởng phòng Nhân sự | `['hrm']` | Chỉ hiện tab HRM; thử vào `/admin/cms` sẽ bị chặn `canMatch` đẩy về `/admin/khong-co-quyen` |
| `kinhdoanh@fiin.vn` | `admin` | Quản lý Bán hàng & Marketing | `['cms', 'crm']` | Hiện tab CMS và CRM |
| `kho@fiin.vn` | `admin` | Quản lý Chuỗi & Kho | `['erp']` | Chỉ hiện tab ERP |
| `guest@fiin.vn` | `admin` | Nhân viên tập sự | `[]` | Vào thẳng trang `/admin/khong-co-quyen` có nút "Đăng xuất" |

---

## 3. Cấu trúc Điều hướng & Định tuyến

- `/admin/login`: Trang đăng nhập chuyên biệt dành cho Admin (`adminGuestGuard` chuyển vào `/admin` nếu đã có phiên).
- `/admin`: `adminHomeGuard` tự động điều hướng sang module đầu tiên mà tài khoản có quyền (ví dụ `/admin/cms` hoặc `/admin/hrm`).
- `/admin/khong-co-quyen`: Trang hiển thị khi tài khoản cố truy cập module không được phân quyền hoặc chưa có quyền nào.
- Lazy chunk isolation: Mỗi module (`cms`, `crm`, `hrm`, `erp`) được tách chunk riêng biệt và bảo vệ bằng `adminModuleGuard` (`canMatch`). Nếu không có quyền, mã nguồn module không bao giờ được tải về trình duyệt.
