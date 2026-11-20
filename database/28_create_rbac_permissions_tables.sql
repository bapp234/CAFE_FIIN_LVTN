USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- TẠO MỚI HỆ THỐNG RBAC CHI TIẾT: dbo.Permissions & dbo.RolePermissions
-- MỤC ĐÍCH: Chuẩn hóa 15 Quyền (Permissions) theo 6 phân hệ và ánh xạ vào
--           8 Vai trò (Roles) trong dbo.Roles (bao gồm ServiceStaff).
-- ============================================================================

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'ServiceStaff')
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description, ParentRoleId)
    VALUES (N'ServiceStaff', N'Nhân viên phục vụ bàn (Order tại bàn, tự đăng ký ca & gửi đơn từ chờ duyệt)', 6);
    PRINT N'-> Đã bổ sung Role ServiceStaff vào dbo.Roles.';
END
GO

IF OBJECT_ID('dbo.Permissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Permissions (
        PermissionId   INT IDENTITY(1,1) PRIMARY KEY,
        PermissionCode VARCHAR(50)   NOT NULL UNIQUE,
        ModuleCode     VARCHAR(30)   NOT NULL,
        ModuleName     NVARCHAR(80)  NOT NULL,
        PermissionName NVARCHAR(120) NOT NULL,
        Description    NVARCHAR(255) NULL,
        SortOrder      INT           NOT NULL DEFAULT 0
    );
    PRINT N'-> Đã tạo bảng dbo.Permissions.';
END
GO

IF OBJECT_ID('dbo.RolePermissions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.RolePermissions (
        RoleId       INT NOT NULL,
        PermissionId INT NOT NULL,
        CONSTRAINT PK_RolePermissions PRIMARY KEY (RoleId, PermissionId),
        CONSTRAINT FK_RolePermissions_Roles FOREIGN KEY (RoleId) REFERENCES dbo.Roles(RoleId) ON DELETE CASCADE,
        CONSTRAINT FK_RolePermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId) ON DELETE CASCADE
    );
    PRINT N'-> Đã tạo bảng dbo.RolePermissions.';
END
GO

-- ============================================================================
-- SEED 15 PERMISSIONS CHUẨN THEO 6 PHÂN HỆ
-- ============================================================================
MERGE dbo.Permissions AS target
USING (VALUES
    ('POS_SELL',           'POS',     N'Bán hàng POS',      N'Tạo đơn & Order tại bàn/quầy',           N'Lập hóa đơn bán hàng tại quầy, order tại bàn và nhận đơn online', 1),
    ('POS_CA_SHIFT',       'POS',     N'Bán hàng POS',      N'Mở/đóng ca két & Hủy/hoàn đơn',          N'Kiểm soát két tiền đầu/cuối ca và hủy/hoàn đơn', 2),
    ('HRM_SELF',           'HRM',     N'Nhân sự & Công',    N'Xem ca, công & phiếu lương cá nhân',     N'Xem lịch phân ca, lịch sử chấm công và lương của bản thân', 3),
    ('HRM_SHIFT_REGISTER', 'HRM',     N'Nhân sự & Công',    N'Tự đăng ký ca làm việc cá nhân',         N'Đăng ký nguyện vọng ca làm việc theo tuần chờ quản lý duyệt', 4),
    ('HRM_LEAVE_REQUEST',  'HRM',     N'Nhân sự & Công',    N'Gửi đơn từ chờ duyệt',                   N'Tạo đơn xin nghỉ phép, đổi ca, đi muộn/về sớm hoặc tạm ứng chờ duyệt', 5),
    ('HRM_SCHEDULE',       'HRM',     N'Nhân sự & Công',    N'Xếp lịch & Khóa ca tuần',                N'Phân ca làm việc tuần và chốt khóa lịch ca chi nhánh', 6),
    ('HRM_ATTENDANCE',     'HRM',     N'Nhân sự & Công',    N'Theo dõi, sửa & Khóa bảng công',         N'Kiểm tra chấm công ngày, điều chỉnh công và chốt kỳ công', 7),
    ('HRM_EMPLOYEE',       'HRM',     N'Nhân sự & Công',    N'Quản lý hồ sơ & Cấp tài khoản',          N'Thêm/sửa hồ sơ nhân sự, hợp đồng và cấp tài khoản', 8),
    ('PAYROLL_MANAGE',     'PAYROLL', N'Bảng lương',        N'Tính lương, tạm ứng & Khóa sổ lương',    N'Tính bảng lương tháng, duyệt tạm ứng và khóa sổ trả lương', 9),
    ('ERP_INVENTORY',      'ERP',     N'Kho & Sản phẩm',    N'Nhập/xuất kho & Kiểm kê nguyên liệu',    N'Quản lý tồn kho, phiếu nhập/xuất và kiểm kê định kỳ', 10),
    ('ERP_CATALOG',        'ERP',     N'Kho & Sản phẩm',    N'Quản lý sản phẩm, công thức & NCC',      N'Cấu hình thực đơn, định lượng công thức và nhà cung cấp', 11),
    ('CRM_MANAGE',         'CRM',     N'Khách hàng & Web',  N'Quản lý khách hàng & Tích điểm',         N'Tra cứu hồ sơ khách hàng, phân hạng và điểm thưởng', 12),
    ('CMS_MANAGE',         'CMS',     N'Khách hàng & Web',  N'Quản lý banner, bài viết & Khuyến mãi',  N'Cập nhật nội dung website bán hàng và chương trình ưu đãi', 13),
    ('REPORT_VIEW',        'REPORT',  N'Báo cáo & Hệ thống',N'Xem Dashboard & Báo cáo doanh thu',      N'Truy cập thống kê doanh thu, chi phí và hiệu suất vận hành', 14),
    ('SYSTEM_RBAC',        'SYSTEM',  N'Báo cáo & Hệ thống',N'Phân quyền Vai trò & Cấp duyệt',         N'Thiết lập vai trò hệ thống và thẩm quyền phê duyệt (Level 0-5)', 15)
) AS src (PermissionCode, ModuleCode, ModuleName, PermissionName, Description, SortOrder)
ON target.PermissionCode = src.PermissionCode
WHEN MATCHED THEN
    UPDATE SET
        ModuleCode     = src.ModuleCode,
        ModuleName     = src.ModuleName,
        PermissionName = src.PermissionName,
        Description    = src.Description,
        SortOrder      = src.SortOrder
WHEN NOT MATCHED THEN
    INSERT (PermissionCode, ModuleCode, ModuleName, PermissionName, Description, SortOrder)
    VALUES (src.PermissionCode, src.ModuleCode, src.ModuleName, src.PermissionName, src.Description, src.SortOrder);
GO

-- ============================================================================
-- ÁNH XẠ QUYỀN MẶC ĐỊNH CHO 8 ROLES
-- ============================================================================
DELETE FROM dbo.RolePermissions;

;WITH RolePermSeed AS (
    -- 1. Admin: Toàn bộ 15 quyền
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Admin'

    UNION ALL
    -- 2. HRManager: Toàn bộ HRM + Lương + Báo cáo + RBAC
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'HRManager'
      AND p.PermissionCode IN ('HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE','HRM_EMPLOYEE','PAYROLL_MANAGE','REPORT_VIEW','SYSTEM_RBAC')

    UNION ALL
    -- 3. StoreManager: Vận hành chi nhánh
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'StoreManager'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE','HRM_EMPLOYEE','ERP_INVENTORY','ERP_CATALOG','CRM_MANAGE','REPORT_VIEW')

    UNION ALL
    -- 4. Cashier: Thu ngân POS + CRM + Cá nhân & Đơn từ
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Cashier'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','CRM_MANAGE')

    UNION ALL
    -- 5. Barista: Quầy bar + Cá nhân & Đơn từ
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Barista'
      AND p.PermissionCode IN ('POS_SELL','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST')

    UNION ALL
    -- 6. ShiftLeader: Trưởng ca (POS + Phân ca + Chấm công + Kho + Đơn từ)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'ShiftLeader'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE','ERP_INVENTORY')

    UNION ALL
    -- 7. Accountant: Kế toán & Kiểm soát kho + Lương + Báo cáo
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Accountant'
      AND p.PermissionCode IN ('HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','PAYROLL_MANAGE','ERP_INVENTORY','ERP_CATALOG','REPORT_VIEW')

    UNION ALL
    -- 8. ServiceStaff: Nhân viên phục vụ (Order tại bàn + Cá nhân + Đăng ký ca + Đơn từ chờ duyệt)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r
    CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'ServiceStaff'
      AND p.PermissionCode IN ('POS_SELL','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST')
)
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT DISTINCT rp.RoleId, rp.PermissionId
FROM RolePermSeed rp;
GO

-- ============================================================================
-- STORED PROCEDURE: dbo.sp_HRM_GetRolePermissionMatrix
-- TRẢ VỀ 2 RESULT SETS:
--   1. Danh sách 15 Permissions theo thứ tự phân hệ
--   2. Bảng ánh xạ RoleId <-> PermissionCode
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetRolePermissionMatrix
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        PermissionId,
        PermissionCode,
        ModuleCode,
        ModuleName,
        PermissionName,
        Description,
        SortOrder
    FROM dbo.Permissions
    ORDER BY SortOrder ASC, PermissionId ASC;

    SELECT
        rp.RoleId,
        rp.PermissionId,
        p.PermissionCode
    FROM dbo.RolePermissions rp
    INNER JOIN dbo.Permissions p ON rp.PermissionId = p.PermissionId
    ORDER BY rp.RoleId ASC, p.SortOrder ASC;
END;
GO

PRINT N'-> Đã triển khai hoàn tất 8 Roles, 15 Permissions và dbo.sp_HRM_GetRolePermissionMatrix.';
GO
