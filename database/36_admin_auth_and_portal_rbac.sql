USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- RELEASE 36: XÁC THỰC ĐĂNG NHẬP THẬT (ADMIN PORTAL & STAFF PORTAL) + RBAC 2 LỚP
-- Mật khẩu mẫu BCrypt (workFactor=11) cho 6 tài khoản quản trị/nhân viên: Fiin@123
-- ============================================================================

-- 1. Bổ sung hoặc chuẩn hóa Role Marketing (Chỉ vào CMS + CRM)
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Marketing')
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description, ParentRoleId)
    VALUES (N'Marketing', N'Quản lý Nội dung Website & Chăm sóc Khách hàng (CMS + CRM)', 1);
    PRINT N'-> Đã bổ sung Role Marketing vào dbo.Roles.';
END
ELSE
BEGIN
    UPDATE dbo.Roles
    SET Description = N'Quản lý Nội dung Website & Chăm sóc Khách hàng (CMS + CRM)'
    WHERE RoleName = N'Marketing';
END
GO

-- 2. Bổ sung 2 Permission chi tiết (Voucher CRM & Mua hàng/NCC ERP) để minh họa ẩn menu bên trong cục
MERGE dbo.Permissions AS target
USING (VALUES
    ('CRM_VOUCHER',  'CRM', N'Khách hàng & Web', N'Quản lý Voucher & Chiến dịch ưu đãi', N'Tạo, chỉnh sửa và khóa mã giảm giá, chương trình khuyến mãi', 16),
    ('ERP_PURCHASE', 'ERP', N'Kho & Sản phẩm',   N'Quản lý Nhà cung cấp & Đơn mua hàng', N'Quản lý danh sách nhà cung cấp và lập đơn đặt mua nguyên liệu', 17)
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

-- 3. Cập nhật ma trận RolePermissions chuẩn 2 lớp (Module + Menu)
--    - Admin: Toàn bộ quyền (4 cục, full menu)
--    - HRManager: Chỉ cục HRM (full menu HRM + Lương + RBAC)
--    - Marketing: Chỉ 2 cục CMS + CRM (full menu CMS + CRM)
--    - StoreManager: Cả 4 cục (CMS, CRM, HRM, ERP) NHƯNG ẨN Lương (PAYROLL_MANAGE), Voucher (CRM_VOUCHER), NCC/Mua hàng (ERP_PURCHASE), Báo cáo doanh thu (REPORT_VIEW), RBAC (SYSTEM_RBAC)
--    - ShiftLeader: Cổng Nhân viên (Cấp 2, duyệt Cấp 1)
--    - Barista / Cashier / ServiceStaff: Cổng Nhân viên (Cấp 1, tự phục vụ)
DELETE FROM dbo.RolePermissions
WHERE RoleId IN (
    SELECT RoleId FROM dbo.Roles
    WHERE RoleName IN (N'Admin', N'HRManager', N'Marketing', N'StoreManager', N'ShiftLeader', N'Barista', N'Cashier', N'ServiceStaff', N'Accountant')
);

;WITH RolePermSeed AS (
    -- Admin: Toàn bộ quyền
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Admin'

    UNION ALL
    -- HRManager: Chỉ HRM (Full menu HRM)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'HRManager'
      AND p.PermissionCode IN ('HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE','HRM_EMPLOYEE','PAYROLL_MANAGE','SYSTEM_RBAC')

    UNION ALL
    -- Marketing: Chỉ CMS + CRM
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Marketing'
      AND p.PermissionCode IN ('CMS_MANAGE','CRM_MANAGE','CRM_VOUCHER')

    UNION ALL
    -- StoreManager: Vào cả 4 cục CMS, CRM, HRM, ERP nhưng ẩn các menu cấp tổng (Lương, Voucher, NCC/Mua hàng, Báo cáo doanh thu, RBAC)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'StoreManager'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','CMS_MANAGE','CRM_MANAGE','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE','HRM_EMPLOYEE','ERP_INVENTORY','ERP_CATALOG')

    UNION ALL
    -- Accountant: Kế toán (ERP + Lương + Báo cáo)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Accountant'
      AND p.PermissionCode IN ('HRM_SELF','HRM_LEAVE_REQUEST','PAYROLL_MANAGE','ERP_INVENTORY','ERP_CATALOG','ERP_PURCHASE','REPORT_VIEW')

    UNION ALL
    -- ShiftLeader: Trưởng ca (Cấp 2 - Cổng Nhân viên)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'ShiftLeader'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST','HRM_SCHEDULE','HRM_ATTENDANCE')

    UNION ALL
    -- Cashier: Thu ngân (Cấp 1 - Cổng Nhân viên)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Cashier'
      AND p.PermissionCode IN ('POS_SELL','POS_CA_SHIFT','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST')

    UNION ALL
    -- Barista: Pha chế (Cấp 1 - Cổng Nhân viên)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'Barista'
      AND p.PermissionCode IN ('POS_SELL','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST')

    UNION ALL
    -- ServiceStaff: Phục vụ (Cấp 1 - Cổng Nhân viên)
    SELECT r.RoleId, p.PermissionId
    FROM dbo.Roles r CROSS JOIN dbo.Permissions p
    WHERE r.RoleName = N'ServiceStaff'
      AND p.PermissionCode IN ('POS_SELL','HRM_SELF','HRM_SHIFT_REGISTER','HRM_LEAVE_REQUEST')
)
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT DISTINCT RoleId, PermissionId FROM RolePermSeed;
GO

-- 4. Cập nhật Scalar Function dbo.fn_Sys_GetEmployeeHierarchyLevel (hỗ trợ Marketing = Cấp 3)
CREATE OR ALTER FUNCTION dbo.fn_Sys_GetEmployeeHierarchyLevel
(
    @EmployeeId INT
)
RETURNS TINYINT
AS
BEGIN
    DECLARE @Level TINYINT = 1;

    SELECT @Level = MAX(
        CASE 
            WHEN r.RoleName = 'Admin' OR r.RoleId = 1 THEN 5
            WHEN r.RoleName IN ('HRManager', 'Accountant') OR r.RoleId IN (2, 7) THEN 4
            WHEN r.RoleName IN ('StoreManager', 'Marketing') OR r.RoleId = 3 THEN 3
            WHEN r.RoleName = 'ShiftLeader' OR r.RoleId = 6 THEN 2
            ELSE 1
        END
    )
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
    INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
    WHERE e.EmployeeId = @EmployeeId;

    IF @Level IS NULL OR @Level = 1
    BEGIN
        SELECT @Level = CASE 
            WHEN e.Position LIKE N'%Giám đốc%' OR e.Position LIKE N'%Admin%' THEN 5
            WHEN e.Position LIKE N'%Nhân sự%' OR e.Position LIKE N'%HRM%' OR e.Position LIKE N'%Kế toán%' THEN 4
            WHEN e.Position LIKE N'%Quản lý Cửa hàng%' OR e.Position LIKE N'%Cửa hàng trưởng%' OR e.Position LIKE N'%Marketing%' THEN 3
            WHEN e.Position LIKE N'%Trưởng ca%' THEN 2
            ELSE 1
        END
        FROM dbo.Employees e
        WHERE e.EmployeeId = @EmployeeId;
    END

    RETURN ISNULL(@Level, 1);
END;
GO

-- 5. Seed / Upsert 6 tài khoản đăng nhập thật (Mật khẩu BCrypt: Fiin@123)
DECLARE @BcryptHash VARCHAR(255) = '$2a$11$xEqkc7iqxJsFvWFeXhgtEuRWodCADMAJrYlEbK/puuami4Iv8BfN.';
DECLARE @BranchQ1 INT = ISNULL((SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = 'CN-Q1'), 1);
DECLARE @BranchHQ INT = ISNULL((SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = 'CN-HQ'), 5);

DECLARE @RoleAdmin INT        = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'Admin');
DECLARE @RoleHR INT           = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'HRManager');
DECLARE @RoleMarketing INT    = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'Marketing');
DECLARE @RoleStoreMgr INT     = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'StoreManager');
DECLARE @RoleShiftLeader INT  = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'ShiftLeader');
DECLARE @RoleBarista INT      = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'Barista');

-- Helper bảng tạm chứa 6 tài khoản chuẩn
DECLARE @Accounts TABLE (
    Username       VARCHAR(50),
    Email          VARCHAR(100),
    FullName       NVARCHAR(100),
    PhoneNumber    VARCHAR(20),
    EmployeeCode   VARCHAR(20),
    Position       NVARCHAR(100),
    BranchId       INT,
    HourlyRate     DECIMAL(18,2),
    RoleId         INT,
    ApprovalLevel  TINYINT,
    ApproverBranch INT NULL
);

INSERT INTO @Accounts VALUES
('admin',         'admin@fiin.vn',      N'Nguyễn Văn An',  '0901000001', 'ADM001', N'Quản trị viên Hệ thống / Giám đốc', @BranchHQ, 65000, @RoleAdmin,       3, NULL),
('hr_manager',    'hr@fiin.vn',         N'Trần Thị Mai',   '0901000002', 'HRM001', N'Trưởng phòng Nhân sự (HRM)',        @BranchHQ, 52000, @RoleHR,          3, NULL),
('marketing',     'marketing@fiin.vn',  N'Lê Hoàng Nam',   '0901000003', 'MKT001', N'Quản lý Marketing & CRM',           @BranchHQ, 45000, @RoleMarketing,   0, NULL),
('store_manager', 'manager.q1@fiin.vn', N'Võ Minh Quân',   '0901000004', 'MGR001', N'Quản lý Cửa hàng Q1',               @BranchQ1, 42000, @RoleStoreMgr,    2, @BranchQ1),
('shift_leader',  'shift.q1@fiin.vn',   N'Đặng Quốc Anh',  '0901000005', 'SHF001', N'Trưởng ca Pha chế Q1',              @BranchQ1, 35000, @RoleShiftLeader, 1, @BranchQ1),
('barista01',     'barista01@fiin.vn',  N'Nguyễn Thị Hương','0901000006','BAR001', N'Barista Chuyên nghiệp Q1',          @BranchQ1, 28000, @RoleBarista,     0, NULL);

DECLARE @u VARCHAR(50), @e VARCHAR(100), @fn NVARCHAR(100), @ph VARCHAR(20),
        @ec VARCHAR(20), @pos NVARCHAR(100), @bid INT, @rate DECIMAL(18,2),
        @rid INT, @apLvl TINYINT, @apBranch INT;

DECLARE acc_cursor CURSOR LOCAL FAST_FORWARD FOR
SELECT Username, Email, FullName, PhoneNumber, EmployeeCode, Position, BranchId, HourlyRate, RoleId, ApprovalLevel, ApproverBranch
FROM @Accounts;

OPEN acc_cursor;
FETCH NEXT FROM acc_cursor INTO @u, @e, @fn, @ph, @ec, @pos, @bid, @rate, @rid, @apLvl, @apBranch;

WHILE @@FETCH_STATUS = 0
BEGIN
    DECLARE @uid INT = NULL;
    DECLARE @empId INT = NULL;

    SELECT TOP 1 @uid = UserId FROM dbo.Users WHERE Username = @u OR Email = @e;

    IF @uid IS NULL
    BEGIN
        INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
        VALUES (@u, @BcryptHash, @fn, @ph, @e, 1);
        SET @uid = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.Users
        SET Username = @u,
            Email = @e,
            FullName = @fn,
            PhoneNumber = @ph,
            PasswordHash = @BcryptHash,
            IsActive = 1
        WHERE UserId = @uid;
    END

    -- Gán Role chuẩn duy nhất cho tài khoản mẫu
    IF @rid IS NOT NULL
    BEGIN
        DELETE FROM dbo.UserRoles WHERE UserId = @uid;
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@uid, @rid);
    END

    -- Đảm bảo có bản ghi Employees gắn với UserId (đồng bộ cả FullName & PhoneNumber sang Employees)
    SELECT TOP 1 @empId = EmployeeId FROM dbo.Employees WHERE UserId = @uid OR EmployeeCode = @ec;
    IF @empId IS NULL
    BEGIN
        INSERT INTO dbo.Employees (UserId, EmployeeCode, FullName, PhoneNumber, Position, HireDate, HourlyRate, BranchId, Status)
        VALUES (@uid, @ec, @fn, @ph, @pos, '2025-01-10', @rate, @bid, 'active');
        SET @empId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.Employees
        SET UserId = @uid,
            FullName = @fn,
            PhoneNumber = @ph,
            Position = @pos,
            BranchId = @bid,
            Status = 'active'
        WHERE EmployeeId = @empId;
    END

    -- Cập nhật bảng Approvers nếu có cấp duyệt
    IF @apLvl > 0
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @empId)
        BEGIN
            INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, IsActive, Note)
            VALUES (@empId, @apBranch, @apLvl, 1, N'Khởi tạo chuẩn 6 tài khoản phân cấp');
        END
        ELSE
        BEGIN
            UPDATE dbo.Approvers
            SET BranchId = @apBranch, ApprovalLevel = @apLvl, IsActive = 1, Note = N'Khởi tạo chuẩn 6 tài khoản phân cấp'
            WHERE EmployeeId = @empId;
        END
    END

    FETCH NEXT FROM acc_cursor INTO @u, @e, @fn, @ph, @ec, @pos, @bid, @rate, @rid, @apLvl, @apBranch;
END

CLOSE acc_cursor;
DEALLOCATE acc_cursor;
GO

-- 6. Stored Procedure: dbo.sp_Auth_GetUserForLogin (Đăng nhập bằng Username / Email / Mã NV)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_GetUserForLogin
    @Identifier NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Key NVARCHAR(100) = LTRIM(RTRIM(@Identifier));
    DECLARE @UserId INT = NULL;

    SELECT TOP 1 @UserId = u.UserId
    FROM dbo.Users u
    LEFT JOIN dbo.Employees e ON e.UserId = u.UserId
    WHERE LOWER(u.Username) = LOWER(@Key)
       OR LOWER(ISNULL(u.Email, '')) = LOWER(@Key)
       OR LOWER(ISNULL(e.EmployeeCode, '')) = LOWER(@Key);

    IF @UserId IS NULL
        RETURN;

    -- Result Set 1: Thông tin người dùng, nhân sự, chi nhánh, cấp phả hệ & cấp duyệt
    SELECT TOP 1
        u.UserId,
        u.Username,
        u.PasswordHash,
        u.FullName,
        u.Email,
        u.PhoneNumber,
        u.IsActive,
        ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
        e.EmployeeId,
        e.EmployeeCode,
        e.Position,
        e.Status AS EmployeeStatus,
        e.BranchId,
        b.BranchCode,
        b.BranchName,
        CASE
            WHEN e.EmployeeId IS NOT NULL THEN dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId)
            ELSE ISNULL((
                SELECT MAX(
                    CASE
                        WHEN r.RoleName = 'Admin' OR r.RoleId = 1 THEN 5
                        WHEN r.RoleName IN ('HRManager', 'Accountant') OR r.RoleId IN (2, 7) THEN 4
                        WHEN r.RoleName IN ('StoreManager', 'Marketing') OR r.RoleId = 3 THEN 3
                        WHEN r.RoleName = 'ShiftLeader' OR r.RoleId = 6 THEN 2
                        ELSE 1
                    END
                )
                FROM dbo.UserRoles ur
                INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
                WHERE ur.UserId = u.UserId
            ), 1)
        END AS HierarchyLevel,
        ISNULL((
            SELECT MAX(ap.ApprovalLevel)
            FROM dbo.Approvers ap
            WHERE ap.EmployeeId = e.EmployeeId AND ap.IsActive = 1
        ), 0) AS ApprovalLevel
    FROM dbo.Users u
    LEFT JOIN dbo.Employees e ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON b.BranchId = e.BranchId
    WHERE u.UserId = @UserId;

    -- Result Set 2: Danh sách Roles
    SELECT r.RoleName, r.Description
    FROM dbo.UserRoles ur
    INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
    WHERE ur.UserId = @UserId
    ORDER BY r.RoleId;

    -- Result Set 3: Danh sách Permissions (RBAC)
    SELECT DISTINCT p.PermissionCode
    FROM dbo.UserRoles ur
    INNER JOIN dbo.RolePermissions rp ON ur.RoleId = rp.RoleId
    INNER JOIN dbo.Permissions p ON rp.PermissionId = p.PermissionId
    WHERE ur.UserId = @UserId
    ORDER BY p.PermissionCode;
END;
GO

-- 7. Stored Procedure: dbo.sp_Auth_GetUserById (Phục vụ GET /api/v1/auth/me)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_GetUserById
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Username VARCHAR(50) = (SELECT Username FROM dbo.Users WHERE UserId = @UserId);
    IF @Username IS NULL
        RETURN;

    EXEC dbo.sp_Auth_GetUserForLogin @Identifier = @Username;
END;
GO

-- 8. Stored Procedure: dbo.sp_Auth_ChangePassword
CREATE OR ALTER PROCEDURE dbo.sp_Auth_ChangePassword
    @UserId          INT,
    @NewPasswordHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET PasswordHash = @NewPasswordHash,
        MustChangePassword = 0
    WHERE UserId = @UserId;

    SELECT @@ROWCOUNT AS AffectedRows;
END;
GO

PRINT N'-> Đã triển khai hoàn tất Release 36 (Admin Auth, Staff Portal & RBAC 2 lớp).';
GO
