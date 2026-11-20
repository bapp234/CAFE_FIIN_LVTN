USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- RELEASE 37: SINGLE ACTIVE SESSION (CHẶN ĐĂNG NHẬP TRÙNG TÀI KHOẢN NHIỀU CỬA SỔ)
-- ============================================================================

-- 1. Thêm cột ActiveSessionToken vào dbo.Users (lưu token phiên duy nhất đang hoạt động)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Users') AND name = 'ActiveSessionToken'
)
BEGIN
    ALTER TABLE dbo.Users
    ADD ActiveSessionToken VARCHAR(64) NULL;
    PRINT N'-> Đã thêm cột ActiveSessionToken vào dbo.Users.';
END
GO

-- 2. Cập nhật sp_Auth_GetUserForLogin trả về thêm ActiveSessionToken
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

    SELECT TOP 1
        u.UserId,
        u.Username,
        u.PasswordHash,
        u.FullName,
        u.Email,
        u.PhoneNumber,
        u.IsActive,
        ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
        u.ActiveSessionToken,
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

    SELECT r.RoleName, r.Description
    FROM dbo.UserRoles ur
    INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
    WHERE ur.UserId = @UserId
    ORDER BY r.RoleId;

    SELECT DISTINCT p.PermissionCode
    FROM dbo.UserRoles ur
    INNER JOIN dbo.RolePermissions rp ON ur.RoleId = rp.RoleId
    INNER JOIN dbo.Permissions p ON rp.PermissionId = p.PermissionId
    WHERE ur.UserId = @UserId
    ORDER BY p.PermissionCode;
END;
GO

-- 3. Stored Procedure: Cập nhật hoặc xóa ActiveSessionToken
CREATE OR ALTER PROCEDURE dbo.sp_Auth_UpdateActiveSessionToken
    @UserId       INT,
    @SessionToken VARCHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE dbo.Users
    SET ActiveSessionToken = @SessionToken
    WHERE UserId = @UserId;
END;
GO

PRINT N'-> Đã triển khai hoàn tất Release 37 (Single Active Session).';
GO
