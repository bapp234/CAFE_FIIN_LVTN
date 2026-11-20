-- =========================================================================================
-- PHIÊN BẢN CSDL 24: MA TRẬN PHÂN QUYỀN HỆ THỐNG & CẤP DUYỆT PHÊ DUYỆT (HRM PERMISSION & APPROVAL MATRIX)
-- Mô tả:
-- 1. Hàm fn_HRM_GetEmployeeApprovalLevel: Lấy nhanh cấp duyệt (0..5) của nhân viên.
-- 2. Trigger trg_Approvers_ValidateLevelAndStatus: Đảm bảo cấp duyệt hợp lệ và nhân sự active.
-- 3. Trigger trg_UserRoles_ProtectSuperAdmin: Ngăn chặn xóa mất quyền Admin tối cao cuối cùng.
-- 4. Stored Procedure sp_HRM_GetEmployeePermissionSettings: Lấy dữ liệu cho bảng phân quyền.
-- 5. Stored Procedure sp_HRM_UpdateEmployeeApprovalLevel: Cập nhật cấp duyệt từ combobox trên hàng.
-- 6. Stored Procedure sp_HRM_GetEmployeeRolesForModal: Nạp danh sách quyền khi click dấu +.
-- 7. Stored Procedure sp_HRM_AssignRolesToEmployee: Lưu phân quyền từ modal.
-- =========================================================================================

USE CoffeeShopDB;
GO

-- -----------------------------------------------------------------------------------------
-- 1. FUNCTION: fn_HRM_GetEmployeeApprovalLevel
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetEmployeeApprovalLevel
(
    @EmployeeId INT,
    @BranchId INT = NULL
)
RETURNS TINYINT
AS
BEGIN
    DECLARE @Level TINYINT = 0;
    
    SELECT TOP 1 @Level = ISNULL(a.ApprovalLevel, 0)
    FROM dbo.Approvers a
    WHERE a.EmployeeId = @EmployeeId
      AND a.IsActive = 1
      AND (@BranchId IS NULL OR a.BranchId IS NULL OR a.BranchId = @BranchId)
    ORDER BY a.ApprovalLevel DESC;
    
    RETURN ISNULL(@Level, 0);
END;
GO

-- -----------------------------------------------------------------------------------------
-- 2. TRIGGER: trg_Approvers_ValidateLevelAndStatus
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER TRIGGER dbo.trg_Approvers_ValidateLevelAndStatus
ON dbo.Approvers
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- 2.1. Chặn gán cấp duyệt cho nhân sự đã nghỉ việc (Status != 'active')
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN dbo.Employees e ON i.EmployeeId = e.EmployeeId
        WHERE i.IsActive = 1
          AND LOWER(ISNULL(e.Status, '')) <> 'active'
    )
    BEGIN
        RAISERROR(N'Lỗi nghiệp vụ: Không thể gán hoặc kích hoạt Cấp duyệt cho nhân sự đã nghỉ việc hoặc không ở trạng thái đang làm việc (active).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;

    -- 2.2. Kiểm tra tính hợp lệ của Cấp duyệt (1..5)
    IF EXISTS (
        SELECT 1
        FROM inserted i
        WHERE i.IsActive = 1
          AND (i.ApprovalLevel < 1 OR i.ApprovalLevel > 5)
    )
    BEGIN
        RAISERROR(N'Lỗi nghiệp vụ: Cấp duyệt không hợp lệ. Cấp duyệt phải từ Cấp 1 đến Cấp 5 theo danh mục quy định.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

-- -----------------------------------------------------------------------------------------
-- 3. TRIGGER: trg_UserRoles_ProtectSuperAdmin
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER TRIGGER dbo.trg_UserRoles_ProtectSuperAdmin
ON dbo.UserRoles
AFTER DELETE, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Đảm bảo hệ thống luôn tồn tại ít nhất 1 tài khoản Admin (RoleId = 1) đang hoạt động
    DECLARE @AdminCount INT;
    SELECT @AdminCount = COUNT(DISTINCT ur.UserId)
    FROM dbo.UserRoles ur
    JOIN dbo.Users u ON ur.UserId = u.UserId
    WHERE ur.RoleId = 1
      AND u.IsActive = 1;

    IF (@AdminCount < 1)
    BEGIN
        RAISERROR(N'Lỗi an toàn hệ thống: Không thể gỡ bỏ vai trò Admin tối cao cuối cùng của hệ thống. Luôn phải có ít nhất 1 tài khoản Admin hoạt động.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END;
END;
GO

-- -----------------------------------------------------------------------------------------
-- 4. PROCEDURE: sp_HRM_GetEmployeePermissionSettings
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeePermissionSettings
    @BranchId INT = NULL,
    @SearchText NVARCHAR(100) = NULL,
    @ApprovalLevel TINYINT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        e.Position,
        e.BranchId,
        b.BranchName,
        e.Status AS EmployeeStatus,
        e.UserId,
        u.Username,
        ISNULL(u.IsActive, 0) AS IsUserActive,
        ISNULL(app.ApprovalLevel, 0) AS ApprovalLevel,
        ISNULL(al.LevelName, N'Không có quyền duyệt') AS ApprovalLevelName,
        (
            SELECT STRING_AGG(r.RoleName, ', ')
            FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            WHERE ur.UserId = e.UserId
        ) AS RoleNames,
        (
            SELECT STRING_AGG(CAST(r.RoleId AS VARCHAR(10)), ',')
            FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            WHERE ur.UserId = e.UserId
        ) AS RoleIds
    FROM dbo.Employees e
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Approvers app ON e.EmployeeId = app.EmployeeId AND app.IsActive = 1
    LEFT JOIN dbo.ApprovalLevels al ON app.ApprovalLevel = al.LevelNumber
    WHERE (@BranchId IS NULL OR @BranchId <= 0 OR e.BranchId = @BranchId)
      AND (
          @SearchText IS NULL 
          OR @SearchText = ''
          OR e.EmployeeCode LIKE '%' + @SearchText + '%'
          OR e.FullName LIKE '%' + @SearchText + '%'
          OR e.Position LIKE '%' + @SearchText + '%'
          OR u.Username LIKE '%' + @SearchText + '%'
      )
      AND (
          @ApprovalLevel IS NULL
          OR (@ApprovalLevel = 0 AND (app.ApprovalLevel IS NULL OR app.ApprovalLevel = 0))
          OR app.ApprovalLevel = @ApprovalLevel
      )
    ORDER BY ISNULL(app.ApprovalLevel, 0) DESC, e.EmployeeId ASC;
END;
GO

-- -----------------------------------------------------------------------------------------
-- 5. PROCEDURE: sp_HRM_UpdateEmployeeApprovalLevel
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpdateEmployeeApprovalLevel
    @EmployeeId INT,
    @BranchId INT = NULL,
    @ApprovalLevel TINYINT,
    @AssignedBy INT = NULL,
    @Note NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Kiểm tra nhân viên tồn tại
    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        RAISERROR(N'Không tìm thấy hồ sơ nhân viên trong hệ thống.', 16, 1);
        RETURN;
    END;

    -- Lấy chi nhánh nếu chưa truyền
    IF (@BranchId IS NULL OR @BranchId <= 0)
    BEGIN
        SELECT @BranchId = BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;
    END;

    BEGIN TRANSACTION;

    IF (@ApprovalLevel <= 0)
    BEGIN
        -- Hủy gán cấp duyệt
        UPDATE dbo.Approvers
        SET IsActive = 0,
            Note = ISNULL(@Note, N'Đã hủy cấp duyệt từ giao diện bảng')
        WHERE EmployeeId = @EmployeeId;
    END
    ELSE
    BEGIN
        -- Gán / Cập nhật cấp duyệt
        IF EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @EmployeeId)
        BEGIN
            UPDATE dbo.Approvers
            SET ApprovalLevel = @ApprovalLevel,
                BranchId = @BranchId,
                IsActive = 1,
                AssignedDate = CAST(GETDATE() AS DATE),
                Note = ISNULL(@Note, N'Cập nhật cấp duyệt từ màn hình phân cấp & cấp duyệt')
            WHERE EmployeeId = @EmployeeId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, IsActive, AssignedDate, Note)
            VALUES (@EmployeeId, @BranchId, @ApprovalLevel, 1, CAST(GETDATE() AS DATE), ISNULL(@Note, N'Thiết lập cấp duyệt mới'));
        END;
    END;

    COMMIT TRANSACTION;

    -- Trả về thông tin cập nhật mới nhất
    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        ISNULL(app.ApprovalLevel, 0) AS ApprovalLevel,
        ISNULL(al.LevelName, N'Không có quyền duyệt') AS ApprovalLevelName
    FROM dbo.Employees e
    LEFT JOIN dbo.Approvers app ON e.EmployeeId = app.EmployeeId AND app.IsActive = 1
    LEFT JOIN dbo.ApprovalLevels al ON app.ApprovalLevel = al.LevelNumber
    WHERE e.EmployeeId = @EmployeeId;
END;
GO

-- -----------------------------------------------------------------------------------------
-- 6. PROCEDURE: sp_HRM_GetEmployeeRolesForModal
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeRolesForModal
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    SELECT 
        r.RoleId,
        r.RoleName,
        r.Description,
        r.ParentRoleId,
        CASE 
            WHEN ur.RoleId IS NOT NULL THEN CAST(1 AS BIT) 
            ELSE CAST(0 AS BIT) 
        END AS IsAssigned
    FROM dbo.Roles r
    LEFT JOIN dbo.UserRoles ur ON r.RoleId = ur.RoleId AND ur.UserId = @UserId
    ORDER BY r.RoleId ASC;
END;
GO

-- -----------------------------------------------------------------------------------------
-- 7. PROCEDURE: sp_HRM_AssignRolesToEmployee
-- -----------------------------------------------------------------------------------------
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AssignRolesToEmployee
    @EmployeeId INT,
    @RoleIds NVARCHAR(MAX) -- Chuỗi ID cách nhau bởi dấu phẩy, ví dụ '1,3,5'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @UserId INT;
    DECLARE @FullName NVARCHAR(100);
    DECLARE @EmpCode VARCHAR(20);

    SELECT 
        @UserId = UserId,
        @FullName = FullName,
        @EmpCode = EmployeeCode
    FROM dbo.Employees 
    WHERE EmployeeId = @EmployeeId;

    IF (@EmpCode IS NULL)
    BEGIN
        RAISERROR(N'Không tìm thấy nhân sự có EmployeeId = %d.', 16, 1, @EmployeeId);
        RETURN;
    END;

    BEGIN TRANSACTION;

    -- Nếu nhân sự chưa có User trong bảng Users, tự động tạo tài khoản liên kết
    IF (@UserId IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId))
    BEGIN
        DECLARE @NewUsername VARCHAR(50) = LOWER('nv_' + @EmpCode);
        
        -- Tạo user mặc định
        INSERT INTO dbo.Users (Username, PasswordHash, PasswordSalt, FullName, IsActive, CreatedAt, MustChangePassword)
        VALUES (@NewUsername, 'INIT_HASH', 'INIT_SALT', @FullName, 1, SYSDATETIME(), 1);

        SET @UserId = SCOPE_IDENTITY();

        UPDATE dbo.Employees
        SET UserId = @UserId
        WHERE EmployeeId = @EmployeeId;
    END;

    -- Tách danh sách RoleId từ chuỗi
    CREATE TABLE #TargetRoles (RoleId INT PRIMARY KEY);

    IF (@RoleIds IS NOT NULL AND LEN(TRIM(@RoleIds)) > 0)
    BEGIN
        INSERT INTO #TargetRoles (RoleId)
        SELECT DISTINCT CAST(TRIM(value) AS INT)
        FROM STRING_SPLIT(@RoleIds, ',')
        WHERE ISNUMERIC(TRIM(value)) = 1;
    END;

    -- Xóa các vai trò không còn được chọn (trừ khi trigger bảo vệ SuperAdmin chặn)
    DELETE ur
    FROM dbo.UserRoles ur
    WHERE ur.UserId = @UserId
      AND ur.RoleId NOT IN (SELECT RoleId FROM #TargetRoles);

    -- Thêm các vai trò mới được tick chọn
    INSERT INTO dbo.UserRoles (UserId, RoleId)
    SELECT @UserId, tr.RoleId
    FROM #TargetRoles tr
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.UserRoles ur 
        WHERE ur.UserId = @UserId AND ur.RoleId = tr.RoleId
    );

    DROP TABLE #TargetRoles;

    COMMIT TRANSACTION;

    -- Trả về danh sách vai trò mới nhất của nhân sự
    SELECT 
        @EmployeeId AS EmployeeId,
        @UserId AS UserId,
        (
            SELECT STRING_AGG(r.RoleName, ', ')
            FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            WHERE ur.UserId = @UserId
        ) AS RoleNames,
        (
            SELECT STRING_AGG(CAST(r.RoleId AS VARCHAR(10)), ',')
            FROM dbo.UserRoles ur
            JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            WHERE ur.UserId = @UserId
        ) AS RoleIds;
END;
GO
