USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 60: ĐĂNG NHẬP, ĐĂNG KÝ, XÁC THỰC TÀI KHOẢN & QUÊN MẬT KHẨU QUA LINK GMAIL
-- Kiến trúc phân tách:
--   1. Mở rộng dbo.Users (IsEmailVerified, EmailVerifiedAt) & Tạo bảng dbo.UserAuthTokens
--   2. Function fn_Auth_IsTokenValid: Kiểm tra tính hợp lệ của token
--   3. Triggers trg_UserAuthTokens_*: Tự vô hiệu hóa link cũ & tự bật IsEmailVerified khi xác thực
--   4. Stored Procedures sp_Auth_*: Tạo token, xác thực Gmail, đặt lại mật khẩu, cập nhật sp_Auth_GetUserForLogin
-- =======================================================================================

-- 1. Mở rộng dbo.Users
IF COL_LENGTH('dbo.Users', 'IsEmailVerified') IS NULL
BEGIN
    ALTER TABLE dbo.Users ADD
        IsEmailVerified BIT NOT NULL CONSTRAINT DF_Users_IsEmailVerified DEFAULT 0,
        EmailVerifiedAt DATETIME2(0) NULL;

    -- Giữ nguyên quyền đăng nhập cho các tài khoản nội bộ/Admin đã tồn tại trước đó
    EXEC(N'UPDATE dbo.Users SET IsEmailVerified = 1, EmailVerifiedAt = SYSDATETIME() WHERE IsEmailVerified = 0;');
    PRINT N'-> Đã thêm IsEmailVerified, EmailVerifiedAt cho dbo.Users.';
END
GO

-- 2. Tạo bảng lưu Token xác thực Gmail & Quên mật khẩu (lưu SHA-256 hash của token)
IF OBJECT_ID('dbo.UserAuthTokens', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserAuthTokens (
        TokenId    INT IDENTITY(1,1) NOT NULL,
        UserId     INT NOT NULL,
        TokenType  VARCHAR(30) NOT NULL,
        TokenHash  VARCHAR(128) NOT NULL,
        ExpiresAt  DATETIME2(0) NOT NULL,
        UsedAt     DATETIME2(0) NULL,
        CreatedAt  DATETIME2(0) NOT NULL CONSTRAINT DF_UserAuthTokens_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_UserAuthTokens PRIMARY KEY CLUSTERED (TokenId),
        CONSTRAINT UQ_UserAuthTokens_TokenHash UNIQUE (TokenHash),
        CONSTRAINT CK_UserAuthTokens_Type CHECK (TokenType IN ('EmailVerify', 'PasswordReset')),
        CONSTRAINT FK_UserAuthTokens_Users FOREIGN KEY (UserId)
            REFERENCES dbo.Users(UserId) ON DELETE CASCADE
    );

    CREATE INDEX IX_UserAuthTokens_User_Type ON dbo.UserAuthTokens(UserId, TokenType, UsedAt);
    PRINT N'-> Đã tạo bảng dbo.UserAuthTokens.';
END
GO

-- 3. Function kiểm tra Token hợp lệ
CREATE OR ALTER FUNCTION dbo.fn_Auth_IsTokenValid
(
    @TokenHash VARCHAR(128),
    @TokenType VARCHAR(30)
)
RETURNS BIT
AS
BEGIN
    IF EXISTS (
        SELECT 1
        FROM dbo.UserAuthTokens
        WHERE TokenHash = @TokenHash
          AND TokenType = @TokenType
          AND UsedAt IS NULL
          AND ExpiresAt > SYSDATETIME()
    )
        RETURN CAST(1 AS BIT);

    RETURN CAST(0 AS BIT);
END;
GO

-- 4. Triggers trên dbo.UserAuthTokens
-- 4.1. Khi phát hành token mới -> tự vô hiệu hóa các token cũ chưa dùng cùng UserId & TokenType
CREATE OR ALTER TRIGGER dbo.trg_UserAuthTokens_InvalidateOldOnInsert
ON dbo.UserAuthTokens
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE t
    SET UsedAt = SYSDATETIME()
    FROM dbo.UserAuthTokens t
    INNER JOIN inserted i ON t.UserId = i.UserId AND t.TokenType = i.TokenType
    WHERE t.TokenId <> i.TokenId
      AND t.UsedAt IS NULL;
END;
GO

-- 4.2. Khi token EmailVerify được đánh dấu UsedAt -> tự bật IsEmailVerified = 1 trên dbo.Users
CREATE OR ALTER TRIGGER dbo.trg_UserAuthTokens_OnUsed
ON dbo.UserAuthTokens
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE u
    SET IsEmailVerified = 1,
        EmailVerifiedAt = ISNULL(u.EmailVerifiedAt, SYSDATETIME())
    FROM dbo.Users u
    INNER JOIN inserted i ON u.UserId = i.UserId
    INNER JOIN deleted d ON i.TokenId = d.TokenId
    WHERE i.TokenType = 'EmailVerify'
      AND d.UsedAt IS NULL
      AND i.UsedAt IS NOT NULL;
END;
GO

-- 5. Cập nhật sp_Auth_GetUserForLogin trả về thêm IsEmailVerified & CustomerId
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
        ISNULL(u.IsEmailVerified, CAST(0 AS BIT)) AS IsEmailVerified,
        ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
        u.ActiveSessionToken,
        c.CustomerId,
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
    LEFT JOIN dbo.Customers c ON c.UserId = u.UserId
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

-- 6. SP tạo Token xác thực Gmail / Quên mật khẩu (dùng cho Backend gửi link email)
CREATE OR ALTER PROCEDURE dbo.sp_Auth_CreateAuthToken
    @Email         NVARCHAR(100),
    @TokenType     VARCHAR(30),
    @TokenHash     VARCHAR(128),
    @ExpireMinutes INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    DECLARE @FullName NVARCHAR(100);
    DECLARE @IsActive BIT;

    SELECT TOP 1
        @UserId = UserId,
        @FullName = FullName,
        @IsActive = IsActive
    FROM dbo.Users
    WHERE LOWER(ISNULL(Email, '')) = LOWER(LTRIM(RTRIM(@Email)));

    IF @UserId IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy tài khoản nào gắn với email này.', 16, 1);
        RETURN;
    END

    IF @IsActive = 0
    BEGIN
        RAISERROR(N'Tài khoản đang bị khóa, không thể thực hiện thao tác này.', 16, 1);
        RETURN;
    END

    DECLARE @ExpiresAt DATETIME2(0) = DATEADD(MINUTE, @ExpireMinutes, SYSDATETIME());

    -- Trigger trg_UserAuthTokens_InvalidateOldOnInsert sẽ tự vô hiệu hóa token cũ cùng loại
    INSERT INTO dbo.UserAuthTokens (UserId, TokenType, TokenHash, ExpiresAt)
    VALUES (@UserId, @TokenType, @TokenHash, @ExpiresAt);

    SELECT
        @UserId AS UserId,
        @FullName AS FullName,
        @Email AS Email,
        @ExpiresAt AS ExpiresAt;
END;
GO

-- 7. SP xác thực tài khoản qua link Gmail
CREATE OR ALTER PROCEDURE dbo.sp_Auth_VerifyEmailToken
    @TokenHash VARCHAR(128)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.fn_Auth_IsTokenValid(@TokenHash, 'EmailVerify') = 0
    BEGIN
        RAISERROR(N'Liên kết xác thực không hợp lệ hoặc đã hết hạn.', 16, 1);
        RETURN;
    END

    DECLARE @UserId INT;
    SELECT @UserId = UserId
    FROM dbo.UserAuthTokens
    WHERE TokenHash = @TokenHash AND TokenType = 'EmailVerify';

    -- Trigger trg_UserAuthTokens_OnUsed sẽ tự cập nhật Users.IsEmailVerified = 1
    UPDATE dbo.UserAuthTokens
    SET UsedAt = SYSDATETIME()
    WHERE TokenHash = @TokenHash AND TokenType = 'EmailVerify';

    SELECT @UserId AS UserId, CAST(1 AS BIT) AS IsEmailVerified;
END;
GO

-- 8. SP đặt lại mật khẩu qua link Quên mật khẩu Gmail
CREATE OR ALTER PROCEDURE dbo.sp_Auth_ResetPasswordByToken
    @TokenHash       VARCHAR(128),
    @NewPasswordHash VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF dbo.fn_Auth_IsTokenValid(@TokenHash, 'PasswordReset') = 0
    BEGIN
        RAISERROR(N'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.', 16, 1);
        RETURN;
    END

    DECLARE @UserId INT;
    SELECT @UserId = UserId
    FROM dbo.UserAuthTokens
    WHERE TokenHash = @TokenHash AND TokenType = 'PasswordReset';

    BEGIN TRANSACTION;

    UPDATE dbo.UserAuthTokens
    SET UsedAt = SYSDATETIME()
    WHERE TokenHash = @TokenHash AND TokenType = 'PasswordReset';

    UPDATE dbo.Users
    SET PasswordHash = @NewPasswordHash,
        MustChangePassword = 0,
        ActiveSessionToken = NULL -- Ép đăng nhập lại ở mọi thiết bị
    WHERE UserId = @UserId;

    COMMIT TRANSACTION;

    SELECT @UserId AS UserId, CAST(1 AS BIT) AS ResetSuccess;
END;
GO

PRINT N'-> Hoàn tất Script 60: Auth Email Verification & Password Reset.';
GO
