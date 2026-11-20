USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- TẠO DANH TÍNH NHÂN SỰ CHO TÀI KHOẢN ADMIN THEO CẤU TRÚC MÃ CHUẨN:
--   AD (Admin) + GD (Giám đốc) + 00 (Toàn hệ thống) + 5 (Cấp duyệt) + 0 (STT từ 0)
--   => Mã nhân viên: ADGD0050
-- ============================================================================
BEGIN TRY
    BEGIN TRANSACTION;

    DECLARE @AdminUserId INT = (SELECT TOP 1 UserId FROM dbo.Users WHERE Username = 'admin');
    IF @AdminUserId IS NULL
        THROW 54001, N'Không tìm thấy tài khoản admin trong dbo.Users.', 1;

    -- 1. Tạo chi nhánh Trụ sở chính mã 00 (Toàn hệ thống) nếu chưa có
    DECLARE @HqBranchId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = '00');
    IF @HqBranchId IS NULL
    BEGIN
        INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive)
        VALUES ('00', N'Trụ sở chính (Toàn hệ thống)', N'120 Đinh Tiên Hoàng, Đa Kao, Quận 1, TP.HCM', '0901234567', 1);
        SET @HqBranchId = SCOPE_IDENTITY();
    END

    -- 2. Tạo hồ sơ nhân sự cho admin với mã ADGD0050
    DECLARE @AdminEmpId INT = (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'ADGD0050' OR UserId = @AdminUserId);
    IF @AdminEmpId IS NULL
    BEGIN
        INSERT INTO dbo.Employees (
            UserId, EmployeeCode, FullName, PhoneNumber,
            Position, HireDate, HourlyRate, BranchId,
            Status, ContractType, Note, UpdatedAt
        )
        VALUES (
            @AdminUserId, 'ADGD0050', N'Quản trị viên Hệ thống', '0901234567',
            N'Giám đốc điều hành (Admin)', CAST(GETDATE() AS DATE), 0, @HqBranchId,
            'active', 'full_time', N'Danh tính Admin toàn hệ thống (Mã chuẩn ADGD0050)', SYSDATETIME()
        );
        SET @AdminEmpId = SCOPE_IDENTITY();
    END

    -- 3. Đảm bảo danh mục cấp duyệt (ApprovalLevels 1..5) và gán Cấp duyệt 5 cho Admin
    IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalLevels WHERE LevelNumber = 5)
    BEGIN
        INSERT INTO dbo.ApprovalLevels (LevelNumber, LevelCode, LevelName, Description, IsActive)
        SELECT v.LevelNumber, v.LevelCode, v.LevelName, v.Description, 1
        FROM (VALUES
            (1, 'LVL1', N'Cấp 1 - Nhân viên', N'Nhân viên cửa hàng', 1),
            (2, 'LVL2', N'Cấp 2 - Trưởng ca', N'Trưởng ca điều phối', 2),
            (3, 'LVL3', N'Cấp 3 - Cửa hàng trưởng', N'Quản lý chi nhánh', 3),
            (4, 'LVL4', N'Cấp 4 - Quản lý HRM / Kế toán', N'Khối nhân sự & tài chính', 4),
            (5, 'LVL5', N'Cấp 5 - Giám đốc / Admin', N'Cấp duyệt cao nhất toàn hệ thống', 5)
        ) AS v(LevelNumber, LevelCode, LevelName, Description, Ord)
        WHERE NOT EXISTS (SELECT 1 FROM dbo.ApprovalLevels al WHERE al.LevelNumber = v.LevelNumber);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @AdminEmpId)
    BEGIN
        INSERT INTO dbo.Approvers (EmployeeId, ApprovalLevel, BranchId, IsActive)
        VALUES (@AdminEmpId, 5, @HqBranchId, 1);
    END

    COMMIT TRANSACTION;
    PRINT N'-> Đã tạo danh tính ADGD0050 cho tài khoản admin (Cấp duyệt 5, Trụ sở chính 00).';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
GO
