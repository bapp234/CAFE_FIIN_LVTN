-- =======================================================================================
-- TỆP MÃ NGUỒN: 22_hierarchy_levels_and_permissions_schema.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   1. Xây dựng Kiến trúc Cấp bậc Phả hệ (Hierarchy Levels) độc lập: Cấp không có nghĩa là Admin.
--   2. Xây dựng Danh mục Quyền hạn phân rã (Granular Permissions) & Ma trận phân bổ quyền theo Cấp (LevelPermissions).
--   3. Xây dựng Bảng Gán phân cấp nhân sự (EmployeeHierarchy): Tách rời hoàn toàn Cấp bậc khỏi Chức danh (Position).
--   4. Xóa bỏ vĩnh viễn các trigger & logic hardcode cũ (trg_Employees_SyncUserRole, CASE Position LIKE...).
--   5. Chuẩn hóa hàm fn_Sys_GetEmployeeHierarchyLevel và fn_Sys_HasPermission đọc từ bảng thực thể.
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 22: CƠ CHẾ CẤP BẬC PHẢ HỆ ĐỘC LẬP & PHÂN BỔ QUYỀN HẠN LINH HOẠT';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 1: BẢNG DANH MỤC CẤP BẬC PHẢ HỆ HỆ THỐNG (dbo.HierarchyLevels)
-- Cấp bậc là các tầng nấc trong chuỗi phê duyệt & quản trị doanh nghiệp, KHÔNG PHẢI là Admin IT.
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'HierarchyLevels')
BEGIN
    CREATE TABLE dbo.HierarchyLevels (
        LevelId INT IDENTITY(1,1) NOT NULL,
        LevelNumber TINYINT NOT NULL,
        LevelCode VARCHAR(20) NOT NULL,
        LevelName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_HierarchyLevels_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_HierarchyLevels_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_HierarchyLevels PRIMARY KEY CLUSTERED (LevelId),
        CONSTRAINT UQ_HierarchyLevels_LevelNumber UNIQUE (LevelNumber),
        CONSTRAINT UQ_HierarchyLevels_LevelCode UNIQUE (LevelCode)
    );
    PRINT N'-> Đã tạo bảng dbo.HierarchyLevels.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.HierarchyLevels đã tồn tại.';
END;
GO

-- Nạp 5 cấp bậc quản trị chuẩn hóa có sẵn
MERGE dbo.HierarchyLevels AS target
USING (
    VALUES 
        (1, 'LEVEL_1', N'Cấp 1 - Vận hành quầy & Tác nghiệp cơ sở', N'Nhân sự trực tiếp pha chế, thu ngân, phục vụ tại cửa hàng.'),
        (2, 'LEVEL_2', N'Cấp 2 - Điều phối ca & Giám sát vận hành', N'Trưởng ca, giám sát chất lượng, điều phối vận hành ca trực tiếp.'),
        (3, 'LEVEL_3', N'Cấp 3 - Quản lý cửa hàng / Chi nhánh', N'Cửa hàng trưởng phụ trách toàn diện nhân sự và doanh thu chi nhánh.'),
        (4, 'LEVEL_4', N'Cấp 4 - Khối chuyên môn & Điều hành vùng', N'Chuyên viên HRM, Kế toán, Quản lý khu vực phụ trách nhiều chi nhánh.'),
        (5, 'LEVEL_5', N'Cấp 5 - Lãnh đạo tối cao & Ban Quản trị chuỗi', N'Tổng giám đốc (CEO), Giám đốc vận hành (COO), Ban lãnh đạo chuỗi.')
) AS source (LevelNumber, LevelCode, LevelName, Description)
ON target.LevelNumber = source.LevelNumber
WHEN MATCHED THEN
    UPDATE SET 
        target.LevelCode = source.LevelCode,
        target.LevelName = source.LevelName,
        target.Description = source.Description,
        target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (LevelNumber, LevelCode, LevelName, Description, IsActive)
    VALUES (source.LevelNumber, source.LevelCode, source.LevelName, source.Description, 1);
GO
PRINT N'-> Đã đồng bộ 5 Cấp bậc quản trị trong dbo.HierarchyLevels.';
GO

-- =======================================================================================
-- PHẦN 2: BẢNG DANH MỤC QUYỀN HẠN PHÂN RÃ HỆ THỐNG (dbo.Permissions)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Permissions')
BEGIN
    CREATE TABLE dbo.Permissions (
        PermissionId INT IDENTITY(1,1) NOT NULL,
        PermissionCode VARCHAR(60) NOT NULL,
        PermissionName NVARCHAR(150) NOT NULL,
        Module VARCHAR(30) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Permissions_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Permissions_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Permissions PRIMARY KEY CLUSTERED (PermissionId),
        CONSTRAINT UQ_Permissions_PermissionCode UNIQUE (PermissionCode)
    );
    PRINT N'-> Đã tạo bảng dbo.Permissions.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.Permissions đã tồn tại.';
END;
GO

-- Nạp danh mục các quyền hạn phân rã chi tiết
MERGE dbo.Permissions AS target
USING (
    VALUES
        -- Phân hệ Hồ sơ nhân sự (HRM)
        ('HRM.PROFILE.VIEW_SELF', N'Xem hồ sơ cá nhân', 'HRM', N'Quyền xem chi tiết lý lịch và hợp đồng của chính mình'),
        ('HRM.PROFILE.VIEW_BRANCH', N'Xem hồ sơ nhân sự chi nhánh', 'HRM', N'Quyền tra cứu hồ sơ các nhân sự thuộc chi nhánh quản lý'),
        ('HRM.PROFILE.VIEW_CHAIN', N'Xem hồ sơ nhân sự toàn chuỗi', 'HRM', N'Quyền tra cứu danh sách nhân sự trên toàn hệ thống'),
        ('HRM.EMPLOYEE.CREATE_EDIT', N'Thêm mới & Chỉnh sửa nhân sự', 'HRM', N'Quyền tạo mới hoặc cập nhật thông tin hồ sơ nhân viên'),
        ('HRM.ACCOUNT.PROVISION', N'Cấp & Phân quyền tài khoản', 'HRM', N'Quyền thiết lập tài khoản đăng nhập và mật khẩu'),

        -- Phân hệ Chấm công & Phân ca (ATTENDANCE & SHIFT)
        ('ATTENDANCE.VIEW_SELF', N'Xem chấm công cá nhân', 'ATTENDANCE', N'Xem lịch sử quẹt thẻ và đi làm của bản thân'),
        ('ATTENDANCE.VIEW_BRANCH', N'Xem chấm công chi nhánh', 'ATTENDANCE', N'Theo dõi bảng chấm công của nhân sự chi nhánh'),
        ('ATTENDANCE.VIEW_CHAIN', N'Xem chấm công toàn chuỗi', 'ATTENDANCE', N'Xem báo cáo chấm công toàn chuỗi'),
        ('ATTENDANCE.CONFIRM', N'Duyệt giải trình công', 'ATTENDANCE', N'Xác nhận lý do đi muộn, về sớm, quên check-in/out'),
        ('SHIFT.MANAGE_BRANCH', N'Điều phối ca làm việc', 'ATTENDANCE', N'Tạo và phân bổ lịch trực ca cho nhân sự cửa hàng'),

        -- Phân hệ Phê duyệt yêu cầu (APPROVAL)
        ('APPROVAL.REQUEST.CREATE', N'Tạo phiếu yêu cầu', 'APPROVAL', N'Gửi đơn xin nghỉ phép, đổi ca, tạm ứng lương'),
        ('APPROVAL.LEVEL_1.EXECUTE', N'Thực hiện duyệt Cấp 1', 'APPROVAL', N'Thẩm quyền phê duyệt bước 1 (Trưởng ca / Giám sát)'),
        ('APPROVAL.LEVEL_2.EXECUTE', N'Thực hiện duyệt Cấp 2', 'APPROVAL', N'Thẩm quyền phê duyệt bước 2 (Cửa hàng trưởng)'),
        ('APPROVAL.LEVEL_3.EXECUTE', N'Thực hiện duyệt Cấp 3', 'APPROVAL', N'Thẩm quyền phê duyệt bước cuối (Lãnh đạo / Văn phòng tổng)'),

        -- Phân hệ Tiền lương (PAYROLL)
        ('PAYROLL.VIEW_SELF', N'Xem phiếu lương cá nhân', 'PAYROLL', N'Tra cứu chi tiết lương giờ, phụ cấp, thưởng phạt của mình'),
        ('PAYROLL.CALCULATE_BRANCH', N'Xem dự toán lương chi nhánh', 'PAYROLL', N'Xem bảng tính chi phí nhân công tại cửa hàng phụ trách'),
        ('PAYROLL.VIEW_CHAIN', N'Xem tổng hợp lương toàn chuỗi', 'PAYROLL', N'Tra cứu bảng thanh toán lương tổng hợp toàn bộ chi nhánh'),
        ('PAYROLL.LOCK_AND_APPROVE', N'Chốt & Duyệt chi trả lương', 'PAYROLL', N'Thẩm quyền đóng kỳ lương và phê duyệt lệnh chi lương'),

        -- Phân hệ Bán hàng POS
        ('POS.BILL.CREATE', N'Lập hóa đơn bán hàng', 'POS', N'Thao tác order và thanh toán tiền tại quầy'),
        ('POS.BILL.CANCEL', N'Hủy hóa đơn bán hàng', 'POS', N'Hủy hóa đơn đã in khi có sự cố phát sinh'),
        ('POS.DISCOUNT.APPLY', N'Áp dụng chiết khấu đặc biệt', 'POS', N'Duyệt chiết khấu vượt hạn mức quầy'),

        -- Phân hệ Báo cáo (REPORT)
        ('REPORT.VIEW_BRANCH', N'Xem báo cáo chi nhánh', 'REPORT', N'Xem biểu đồ doanh thu và KPI tại cửa hàng'),
        ('REPORT.VIEW_CHAIN', N'Xem báo cáo toàn chuỗi', 'REPORT', N'Xem biểu đồ doanh thu và lãi lỗ (P&L) toàn hệ thống'),

        -- Phân hệ Quản trị hệ thống (SYSTEM - Dành riêng cho IT Admin)
        ('SYSTEM.SETTINGS.MANAGE', N'Cấu hình tham số hệ thống', 'SYSTEM', N'Cài đặt kỹ thuật phần mềm, tích hợp API, log hệ thống'),
        ('SYSTEM.ROLES.MANAGE', N'Quản trị vai trò & cấp bậc', 'SYSTEM', N'Phân bổ quyền hạn vào cấp bậc và quản lý nhóm người dùng')
) AS source (PermissionCode, PermissionName, Module, Description)
ON target.PermissionCode = source.PermissionCode
WHEN MATCHED THEN
    UPDATE SET 
        target.PermissionName = source.PermissionName,
        target.Module = source.Module,
        target.Description = source.Description,
        target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (PermissionCode, PermissionName, Module, Description, IsActive)
    VALUES (source.PermissionCode, source.PermissionName, source.Module, source.Description, 1);
GO
PRINT N'-> Đã đồng bộ danh mục Quyền hạn trong dbo.Permissions.';
GO

-- =======================================================================================
-- PHẦN 3: BẢNG MA TRẬN PHÂN BỔ QUYỀN HẠN THEO CẤP BẬC (dbo.LevelPermissions)
-- Nơi quản trị viên có quyền gán / bỏ quyền hạn vào từng Cấp linh hoạt.
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'LevelPermissions')
BEGIN
    CREATE TABLE dbo.LevelPermissions (
        LevelId INT NOT NULL,
        PermissionId INT NOT NULL,
        AssignedAt DATETIME2(0) NOT NULL CONSTRAINT DF_LevelPermissions_AssignedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_LevelPermissions PRIMARY KEY CLUSTERED (LevelId, PermissionId),
        CONSTRAINT FK_LevelPermissions_HierarchyLevels FOREIGN KEY (LevelId) REFERENCES dbo.HierarchyLevels(LevelId) ON DELETE CASCADE,
        CONSTRAINT FK_LevelPermissions_Permissions FOREIGN KEY (PermissionId) REFERENCES dbo.Permissions(PermissionId) ON DELETE CASCADE
    );
    PRINT N'-> Đã tạo bảng dbo.LevelPermissions.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.LevelPermissions đã tồn tại.';
END;
GO

-- Phân bổ quyền hạn mẫu vào từng Cấp
DECLARE @L1 INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 1);
DECLARE @L2 INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 2);
DECLARE @L3 INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 3);
DECLARE @L4 INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 4);
DECLARE @L5 INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 5);

MERGE dbo.LevelPermissions AS target
USING (
    -- Cấp 1: Vận hành cơ sở / quầy
    SELECT @L1 AS LevelId, PermissionId FROM dbo.Permissions WHERE PermissionCode IN (
        'HRM.PROFILE.VIEW_SELF', 'ATTENDANCE.VIEW_SELF', 'APPROVAL.REQUEST.CREATE', 'PAYROLL.VIEW_SELF', 'POS.BILL.CREATE'
    )
    UNION
    -- Cấp 2: Điều phối ca / Giám sát ca
    SELECT @L2 AS LevelId, PermissionId FROM dbo.Permissions WHERE PermissionCode IN (
        'HRM.PROFILE.VIEW_SELF', 'ATTENDANCE.VIEW_SELF', 'APPROVAL.REQUEST.CREATE', 'PAYROLL.VIEW_SELF', 'POS.BILL.CREATE',
        'ATTENDANCE.VIEW_BRANCH', 'ATTENDANCE.CONFIRM', 'SHIFT.MANAGE_BRANCH', 'APPROVAL.LEVEL_1.EXECUTE',
        'POS.BILL.CANCEL', 'POS.DISCOUNT.APPLY'
    )
    UNION
    -- Cấp 3: Quản lý cửa hàng / Cửa hàng trưởng
    SELECT @L3 AS LevelId, PermissionId FROM dbo.Permissions WHERE PermissionCode IN (
        'HRM.PROFILE.VIEW_SELF', 'HRM.PROFILE.VIEW_BRANCH', 'ATTENDANCE.VIEW_SELF', 'ATTENDANCE.VIEW_BRANCH',
        'ATTENDANCE.CONFIRM', 'SHIFT.MANAGE_BRANCH', 'APPROVAL.REQUEST.CREATE', 'APPROVAL.LEVEL_1.EXECUTE',
        'APPROVAL.LEVEL_2.EXECUTE', 'PAYROLL.VIEW_SELF', 'PAYROLL.CALCULATE_BRANCH', 'POS.BILL.CREATE',
        'POS.BILL.CANCEL', 'POS.DISCOUNT.APPLY', 'REPORT.VIEW_BRANCH'
    )
    UNION
    -- Cấp 4: Khối chuyên môn / HRM / Điều hành vùng
    SELECT @L4 AS LevelId, PermissionId FROM dbo.Permissions WHERE PermissionCode IN (
        'HRM.PROFILE.VIEW_SELF', 'HRM.PROFILE.VIEW_BRANCH', 'HRM.PROFILE.VIEW_CHAIN', 'HRM.EMPLOYEE.CREATE_EDIT',
        'HRM.ACCOUNT.PROVISION', 'ATTENDANCE.VIEW_BRANCH', 'ATTENDANCE.VIEW_CHAIN', 'ATTENDANCE.CONFIRM',
        'APPROVAL.REQUEST.CREATE', 'APPROVAL.LEVEL_2.EXECUTE', 'APPROVAL.LEVEL_3.EXECUTE', 'PAYROLL.VIEW_SELF',
        'PAYROLL.CALCULATE_BRANCH', 'PAYROLL.VIEW_CHAIN', 'REPORT.VIEW_BRANCH', 'REPORT.VIEW_CHAIN'
    )
    UNION
    -- Cấp 5: Ban Lãnh đạo tối cao / Ban Quản trị chuỗi (Lãnh đạo cao nhất nhưng KHÔNG mặc định có quyền IT Admin)
    SELECT @L5 AS LevelId, PermissionId FROM dbo.Permissions WHERE PermissionCode IN (
        'HRM.PROFILE.VIEW_SELF', 'HRM.PROFILE.VIEW_CHAIN', 'ATTENDANCE.VIEW_CHAIN', 'APPROVAL.LEVEL_3.EXECUTE',
        'PAYROLL.VIEW_CHAIN', 'PAYROLL.LOCK_AND_APPROVE', 'REPORT.VIEW_CHAIN', 'SYSTEM.ROLES.MANAGE'
    )
) AS source (LevelId, PermissionId)
ON target.LevelId = source.LevelId AND target.PermissionId = source.PermissionId
WHEN NOT MATCHED THEN
    INSERT (LevelId, PermissionId) VALUES (source.LevelId, source.PermissionId);
GO
PRINT N'-> Đã phân bổ ma trận quyền hạn cho 5 Cấp bậc trong dbo.LevelPermissions.';
GO

-- =======================================================================================
-- PHẦN 4: BẢNG GÁN BỔ NHIỆM NHÂN SỰ VÀO CẤP BẬC (dbo.EmployeeHierarchy)
-- Tách rời hoàn toàn Cấp bậc khỏi Chức danh (Position). Một chức danh có thể được bổ nhiệm vào Cấp bất kỳ.
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeHierarchy')
BEGIN
    CREATE TABLE dbo.EmployeeHierarchy (
        AssignmentId INT IDENTITY(1,1) NOT NULL,
        EmployeeId INT NOT NULL,
        LevelId INT NOT NULL,
        BranchId INT NULL, -- NULL = Thẩm quyền toàn chuỗi, hoặc chỉ định Chi nhánh cụ thể
        DirectManagerEmployeeId INT NULL, -- Cấp trên trực tiếp trong cây phả hệ
        EffectiveDate DATE NOT NULL CONSTRAINT DF_EmployeeHierarchy_EffectiveDate DEFAULT CAST(SYSDATETIME() AS DATE),
        IsActive BIT NOT NULL CONSTRAINT DF_EmployeeHierarchy_IsActive DEFAULT 1,
        Note NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeHierarchy_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_EmployeeHierarchy PRIMARY KEY CLUSTERED (AssignmentId),
        CONSTRAINT FK_EmployeeHierarchy_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT FK_EmployeeHierarchy_HierarchyLevels FOREIGN KEY (LevelId) REFERENCES dbo.HierarchyLevels(LevelId),
        CONSTRAINT FK_EmployeeHierarchy_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_EmployeeHierarchy_DirectManager FOREIGN KEY (DirectManagerEmployeeId) REFERENCES dbo.Employees(EmployeeId)
    );

    CREATE UNIQUE NONCLUSTERED INDEX UQ_EmployeeHierarchy_ActiveEmployee 
    ON dbo.EmployeeHierarchy (EmployeeId) 
    WHERE IsActive = 1;

    PRINT N'-> Đã tạo bảng dbo.EmployeeHierarchy và Index duy nhất.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.EmployeeHierarchy đã tồn tại.';
END;
GO

-- =======================================================================================
-- PHẦN 5: XÓA BỎ CÁC TRIGGER & LOGIC CŨ ĐANG ÉP CHỨC DANH SANG CẤP BẬC / ROLE
-- =======================================================================================
IF OBJECT_ID('dbo.trg_Employees_SyncUserRole', 'TR') IS NOT NULL
BEGIN
    DROP TRIGGER dbo.trg_Employees_SyncUserRole;
    PRINT N'-> ĐÃ XÓA BỎ TRIGGER CŨ: dbo.trg_Employees_SyncUserRole (Không còn ép chức danh Position sang Role).';
END;
GO

-- =======================================================================================
-- PHẦN 6: CHUẨN HÓA HÀM SCALAR: dbo.fn_Sys_GetEmployeeHierarchyLevel
-- Đọc trực tiếp từ bảng phân cấp thực thể EmployeeHierarchy, KHÔNG DÙNG CASE LIKE Position!
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_Sys_GetEmployeeHierarchyLevel
(
    @EmployeeId INT
)
RETURNS TINYINT
AS
BEGIN
    DECLARE @LevelNumber TINYINT = 1;

    -- 1. Ưu tiên tra cứu từ bảng bổ nhiệm Cấp bậc thực tế (EmployeeHierarchy)
    SELECT TOP 1 @LevelNumber = hl.LevelNumber
    FROM dbo.EmployeeHierarchy eh
    INNER JOIN dbo.HierarchyLevels hl ON eh.LevelId = hl.LevelId
    WHERE eh.EmployeeId = @EmployeeId AND eh.IsActive = 1;

    -- 2. Nếu chưa được bổ nhiệm trong bảng EmployeeHierarchy, an toàn gán Cấp 1 (Cơ sở / Quầy)
    RETURN ISNULL(@LevelNumber, 1);
END;
GO
PRINT N'-> Đã nâng cấp hàm Scalar: dbo.fn_Sys_GetEmployeeHierarchyLevel đọc từ bảng EmployeeHierarchy.';
GO

-- =======================================================================================
-- PHẦN 7: TẠO HÀM KIỂM TRA QUYỀN HẠN PHÂN HỆ: dbo.fn_Sys_HasPermission
-- Kiểm tra quyền qua Cấp bậc trong EmployeeHierarchy -> LevelPermissions -> Permissions
-- Hoặc tài khoản Quản trị viên IT (Role = 'Admin')
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_Sys_HasPermission
(
    @EmployeeId INT,
    @PermissionCode VARCHAR(60)
)
RETURNS BIT
AS
BEGIN
    -- 1. Quản trị viên kỹ thuật IT (Role = 'Admin') có toàn quyền hệ thống kỹ thuật
    IF EXISTS (
        SELECT 1 
        FROM dbo.Employees e
        INNER JOIN dbo.UserRoles ur ON e.UserId = ur.UserId
        INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
        WHERE e.EmployeeId = @EmployeeId AND r.RoleName = 'Admin'
    )
    BEGIN
        RETURN 1;
    END;

    -- 2. Kiểm tra thẩm quyền thông qua Cấp bậc phả hệ được bổ nhiệm
    IF EXISTS (
        SELECT 1
        FROM dbo.EmployeeHierarchy eh
        INNER JOIN dbo.LevelPermissions lp ON eh.LevelId = lp.LevelId
        INNER JOIN dbo.Permissions p ON lp.PermissionId = p.PermissionId
        WHERE eh.EmployeeId = @EmployeeId 
          AND eh.IsActive = 1
          AND p.PermissionCode = @PermissionCode
          AND p.IsActive = 1
    )
    BEGIN
        RETURN 1;
    END;

    RETURN 0;
END;
GO
PRINT N'-> Đã tạo hàm kiểm tra quyền hạt nhân: dbo.fn_Sys_HasPermission.';
GO

-- =======================================================================================
-- PHẦN 8: STORED PROCEDURES QUẢN TRỊ CẤP VÀ PHÂN QUYỀN
-- =======================================================================================

-- 8.1 Bổ nhiệm nhân sự vào một Cấp bậc bất kỳ (không phụ thuộc chức danh)
CREATE OR ALTER PROCEDURE dbo.sp_Sys_AssignEmployeeLevel
    @EmployeeId INT,
    @LevelNumber TINYINT,
    @BranchId INT = NULL,
    @DirectManagerEmployeeId INT = NULL,
    @Note NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @LevelId INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = @LevelNumber AND IsActive = 1);
    IF @LevelId IS NULL
    BEGIN
        THROW 50010, N'Cấp bậc phả hệ không hợp lệ hoặc đã bị vô hiệu hóa.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        THROW 50011, N'Không tìm thấy hồ sơ nhân viên chỉ định.', 1;
    END;

    -- Chống tự làm quản lý trực tiếp của chính mình
    IF @EmployeeId = @DirectManagerEmployeeId
    BEGIN
        THROW 50012, N'Một nhân sự không thể tự làm cấp trên trực tiếp của chính mình.', 1;
    END;

    BEGIN TRANSACTION;

    -- Vô hiệu hóa bản ghi bổ nhiệm cũ nếu có
    UPDATE dbo.EmployeeHierarchy
    SET IsActive = 0
    WHERE EmployeeId = @EmployeeId AND IsActive = 1;

    -- Thêm bản ghi bổ nhiệm cấp mới
    INSERT INTO dbo.EmployeeHierarchy (
        EmployeeId, LevelId, BranchId, DirectManagerEmployeeId, EffectiveDate, IsActive, Note
    )
    VALUES (
        @EmployeeId, @LevelId, @BranchId, @DirectManagerEmployeeId, CAST(SYSDATETIME() AS DATE), 1, @Note
    );

    COMMIT TRANSACTION;

    SELECT 
        eh.AssignmentId,
        eh.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        e.Position,
        hl.LevelNumber,
        hl.LevelName,
        eh.BranchId,
        eh.DirectManagerEmployeeId,
        eh.IsActive
    FROM dbo.EmployeeHierarchy eh
    INNER JOIN dbo.Employees e ON eh.EmployeeId = e.EmployeeId
    INNER JOIN dbo.HierarchyLevels hl ON eh.LevelId = hl.LevelId
    WHERE eh.EmployeeId = @EmployeeId AND eh.IsActive = 1;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_Sys_AssignEmployeeLevel.';
GO

-- 8.2 Bật/Tắt quyền hạn cho một Cấp bậc cụ thể (LevelPermissions)
CREATE OR ALTER PROCEDURE dbo.sp_Sys_SetLevelPermission
    @LevelNumber TINYINT,
    @PermissionCode VARCHAR(60),
    @Grant BIT -- 1 = Gán quyền, 0 = Thu hồi quyền
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @LevelId INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = @LevelNumber);
    DECLARE @PermissionId INT = (SELECT PermissionId FROM dbo.Permissions WHERE PermissionCode = @PermissionCode);

    IF @LevelId IS NULL OR @PermissionId IS NULL
    BEGIN
        THROW 50020, N'Cấp bậc hoặc Mã quyền hạn không tồn tại trong hệ thống.', 1;
    END;

    IF @Grant = 1
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.LevelPermissions WHERE LevelId = @LevelId AND PermissionId = @PermissionId)
        BEGIN
            INSERT INTO dbo.LevelPermissions (LevelId, PermissionId)
            VALUES (@LevelId, @PermissionId);
        END;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.LevelPermissions 
        WHERE LevelId = @LevelId AND PermissionId = @PermissionId;
    END;

    SELECT 
        hl.LevelNumber,
        hl.LevelName,
        p.PermissionCode,
        p.PermissionName,
        @Grant AS IsGranted
    FROM dbo.HierarchyLevels hl
    CROSS JOIN dbo.Permissions p
    WHERE hl.LevelId = @LevelId AND p.PermissionId = @PermissionId;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_Sys_SetLevelPermission.';
GO

-- 8.3 Lấy ma trận các Cấp kèm danh sách Quyền đã phân bổ
CREATE OR ALTER PROCEDURE dbo.sp_Sys_GetHierarchyMatrix
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        hl.LevelId,
        hl.LevelNumber,
        hl.LevelCode,
        hl.LevelName,
        hl.Description,
        p.PermissionId,
        p.PermissionCode,
        p.PermissionName,
        p.Module,
        CASE WHEN lp.LevelId IS NOT NULL THEN 1 ELSE 0 END AS HasPermission
    FROM dbo.HierarchyLevels hl
    CROSS JOIN dbo.Permissions p
    LEFT JOIN dbo.LevelPermissions lp ON hl.LevelId = lp.LevelId AND p.PermissionId = lp.PermissionId
    ORDER BY hl.LevelNumber ASC, p.Module ASC, p.PermissionCode ASC;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_Sys_GetHierarchyMatrix.';
GO

-- =======================================================================================
-- PHẦN 9: KHỞI TẠO BỔ NHIỆM BAN ĐẦU CHO 132 HỒ SƠ NHÂN SỰ VÀO BẢNG EmployeeHierarchy
-- Nạp dữ liệu vào bảng thực thể EmployeeHierarchy, không để bất kỳ hồ sơ nào bị rơi rụng.
-- =======================================================================================
PRINT N'Bắt đầu nạp khởi tạo phân cấp cho nhân sự vào dbo.EmployeeHierarchy...';

DECLARE @L1_Id INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 1);
DECLARE @L2_Id INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 2);
DECLARE @L3_Id INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 3);
DECLARE @L4_Id INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 4);
DECLARE @L5_Id INT = (SELECT LevelId FROM dbo.HierarchyLevels WHERE LevelNumber = 5);

MERGE dbo.EmployeeHierarchy AS target
USING (
    SELECT 
        e.EmployeeId,
        CASE 
            -- Ban Lãnh đạo tối cao (CEO, COO, Ban Giám đốc)
            WHEN e.Position LIKE N'%Giám đốc%' OR e.Position LIKE '%CEO%' OR e.Position LIKE '%COO%' OR e.Position LIKE '%Director%' OR e.Position LIKE '%Admin%' THEN @L5_Id
            -- Khối chuyên môn văn phòng & HRM / Kế toán / Tuyển dụng
            WHEN e.Position LIKE N'%Nhân sự%' OR e.Position LIKE '%HRM%' OR e.Position LIKE N'%Kế toán%' OR e.Position LIKE '%Accountant%' OR e.Position LIKE '%C&B%' OR e.Position LIKE N'%Tuyển dụng%' OR e.Position LIKE '%Marketing%' OR e.Position LIKE '%CRM%' THEN @L4_Id
            -- Quản lý cửa hàng (Store Manager)
            WHEN e.Position LIKE N'%Quản lý Cửa hàng%' OR e.Position LIKE N'%Cửa hàng trưởng%' OR e.Position LIKE '%Store Manager%' THEN @L3_Id
            -- Trưởng ca / Giám sát ca
            WHEN e.Position LIKE N'%Trưởng ca%' OR e.Position LIKE N'%Giám sát%' OR e.Position LIKE '%Shift Leader%' THEN @L2_Id
            -- Vận hành quầy cơ sở (Barista, Thu ngân, Phục vụ, CSKH...)
            ELSE @L1_Id
        END AS LevelId,
        e.BranchId,
        CAST(SYSDATETIME() AS DATE) AS EffectiveDate,
        1 AS IsActive,
        N'Khởi tạo phân cấp từ quy hoạch CSDL Release 22' AS Note
    FROM dbo.Employees e
) AS source (EmployeeId, LevelId, BranchId, EffectiveDate, IsActive, Note)
ON target.EmployeeId = source.EmployeeId AND target.IsActive = 1
WHEN MATCHED THEN
    UPDATE SET target.LevelId = source.LevelId, target.BranchId = source.BranchId
WHEN NOT MATCHED THEN
    INSERT (EmployeeId, LevelId, BranchId, EffectiveDate, IsActive, Note)
    VALUES (source.EmployeeId, source.LevelId, source.BranchId, source.EffectiveDate, source.IsActive, source.Note);
GO

-- =======================================================================================
-- PHẦN 10: KIỂM TRA TỔNG QUÁT KẾT QUẢ KHỞI TẠO
-- =======================================================================================
PRINT N'=======================================================================================';
PRINT N'THỐNG KÊ PHÂN BỔ NHÂN SỰ THEO CÁC CẤP BẬC MỚI:';
SELECT 
    hl.LevelNumber,
    hl.LevelCode,
    hl.LevelName,
    COUNT(eh.EmployeeId) AS TotalAssignedEmployees,
    (SELECT COUNT(*) FROM dbo.LevelPermissions lp WHERE lp.LevelId = hl.LevelId) AS TotalAssignedPermissions
FROM dbo.HierarchyLevels hl
LEFT JOIN dbo.EmployeeHierarchy eh ON hl.LevelId = eh.LevelId AND eh.IsActive = 1
GROUP BY hl.LevelNumber, hl.LevelCode, hl.LevelName, hl.LevelId
ORDER BY hl.LevelNumber ASC;

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT TRIỂN KHAI 22: CƠ CHẾ CẤP BẬC PHẢ HỆ VÀ PHÂN QUYỀN ĐỘC LẬP ĐÃ SẴN SÀNG 100%!';
PRINT N'=======================================================================================';
GO
