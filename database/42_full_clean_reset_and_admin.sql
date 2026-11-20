USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- RESET TOÀN BỘ DỮ LIỆU CSDL (CHỈ GIỮ LẠI: Roles, Permissions, RolePermissions)
-- VÀ TẠO LẠI 1 TÀI KHOẢN ADMIN DUY NHẤT (CẤP 5 - FULL PERMISSION)
-- =======================================================================================
BEGIN TRY
    BEGIN TRANSACTION;

    -- Lưu lại PasswordHash hiện tại của tài khoản admin để giữ nguyên mật khẩu đăng nhập
    DECLARE @AdminPasswordHash NVARCHAR(255);
    SELECT TOP 1 @AdminPasswordHash = PasswordHash
    FROM dbo.Users
    WHERE Username = 'admin';

    IF @AdminPasswordHash IS NULL
    BEGIN
        SELECT TOP 1 @AdminPasswordHash = u.PasswordHash
        FROM dbo.Users u
        INNER JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
        WHERE ur.RoleId = 1;
    END

    IF @AdminPasswordHash IS NULL
        THROW 53001, N'Không tìm thấy PasswordHash mẫu của tài khoản Admin để khôi phục.', 1;

    -- Vô hiệu hóa toàn bộ trigger & FK check trong phiên transaction dọn dẹp
    EXEC sp_MSforeachtable 'ALTER TABLE ? DISABLE TRIGGER ALL';

    -- Xóa toàn bộ dữ liệu nghiệp vụ & danh mục (CHỈ CHỪA Roles, Permissions, RolePermissions)
    IF OBJECT_ID('dbo.ApprovalSteps', 'U') IS NOT NULL DELETE FROM dbo.ApprovalSteps;
    IF OBJECT_ID('dbo.ApprovalRequests', 'U') IS NOT NULL DELETE FROM dbo.ApprovalRequests;
    IF OBJECT_ID('dbo.Approvers', 'U') IS NOT NULL DELETE FROM dbo.Approvers;
    IF OBJECT_ID('dbo.ApprovalDefinitions', 'U') IS NOT NULL DELETE FROM dbo.ApprovalDefinitions;
    IF OBJECT_ID('dbo.ApprovalLevels', 'U') IS NOT NULL DELETE FROM dbo.ApprovalLevels;

    IF OBJECT_ID('dbo.AttendanceUnlockLogs', 'U') IS NOT NULL DELETE FROM dbo.AttendanceUnlockLogs;
    IF OBJECT_ID('dbo.AttendanceCorrectionRequests', 'U') IS NOT NULL DELETE FROM dbo.AttendanceCorrectionRequests;
    IF OBJECT_ID('dbo.EmployeeOvertimes', 'U') IS NOT NULL DELETE FROM dbo.EmployeeOvertimes;
    IF OBJECT_ID('dbo.EmployeeLeaves', 'U') IS NOT NULL DELETE FROM dbo.EmployeeLeaves;
    IF OBJECT_ID('dbo.EmployeeAnnualLeaves', 'U') IS NOT NULL DELETE FROM dbo.EmployeeAnnualLeaves;
    IF OBJECT_ID('dbo.AttendancePeriods', 'U') IS NOT NULL DELETE FROM dbo.AttendancePeriods;
    IF OBJECT_ID('dbo.Attendances', 'U') IS NOT NULL DELETE FROM dbo.Attendances;
    IF OBJECT_ID('dbo.PayrollSlips', 'U') IS NOT NULL DELETE FROM dbo.PayrollSlips;
    IF OBJECT_ID('dbo.PayrollPeriods', 'U') IS NOT NULL DELETE FROM dbo.PayrollPeriods;
    IF OBJECT_ID('dbo.PayrollSettings', 'U') IS NOT NULL DELETE FROM dbo.PayrollSettings;

    IF OBJECT_ID('dbo.ShiftAssignments', 'U') IS NOT NULL DELETE FROM dbo.ShiftAssignments;
    IF OBJECT_ID('dbo.ShiftScheduleWeeks', 'U') IS NOT NULL DELETE FROM dbo.ShiftScheduleWeeks;
    IF OBJECT_ID('dbo.ShiftTemplates', 'U') IS NOT NULL DELETE FROM dbo.ShiftTemplates;
    IF OBJECT_ID('dbo.Shifts', 'U') IS NOT NULL DELETE FROM dbo.Shifts;

    IF OBJECT_ID('dbo.EmployeeContracts', 'U') IS NOT NULL DELETE FROM dbo.EmployeeContracts;
    IF OBJECT_ID('dbo.Employees', 'U') IS NOT NULL DELETE FROM dbo.Employees;
    IF OBJECT_ID('dbo.UserRoles', 'U') IS NOT NULL DELETE FROM dbo.UserRoles;
    IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DELETE FROM dbo.Users;

    IF OBJECT_ID('dbo.ContractTypes', 'U') IS NOT NULL DELETE FROM dbo.ContractTypes;
    IF OBJECT_ID('dbo.OvertimeTypes', 'U') IS NOT NULL DELETE FROM dbo.OvertimeTypes;
    IF OBJECT_ID('dbo.LeaveTypes', 'U') IS NOT NULL DELETE FROM dbo.LeaveTypes;
    IF OBJECT_ID('dbo.Holidays', 'U') IS NOT NULL DELETE FROM dbo.Holidays;
    IF OBJECT_ID('dbo.HrmSettings', 'U') IS NOT NULL DELETE FROM dbo.HrmSettings;

    IF OBJECT_ID('dbo.OrderItemToppings', 'U') IS NOT NULL DELETE FROM dbo.OrderItemToppings;
    IF OBJECT_ID('dbo.OrderItems', 'U') IS NOT NULL DELETE FROM dbo.OrderItems;
    IF OBJECT_ID('dbo.OrderDeliveries', 'U') IS NOT NULL DELETE FROM dbo.OrderDeliveries;
    IF OBJECT_ID('dbo.PaymentTransactions', 'U') IS NOT NULL DELETE FROM dbo.PaymentTransactions;
    IF OBJECT_ID('dbo.Orders', 'U') IS NOT NULL DELETE FROM dbo.Orders;
    IF OBJECT_ID('dbo.ProductRecipes', 'U') IS NOT NULL DELETE FROM dbo.ProductRecipes;
    IF OBJECT_ID('dbo.ProductVariants', 'U') IS NOT NULL DELETE FROM dbo.ProductVariants;
    IF OBJECT_ID('dbo.Products', 'U') IS NOT NULL DELETE FROM dbo.Products;
    IF OBJECT_ID('dbo.Categories', 'U') IS NOT NULL DELETE FROM dbo.Categories;
    IF OBJECT_ID('dbo.Toppings', 'U') IS NOT NULL DELETE FROM dbo.Toppings;
    IF OBJECT_ID('dbo.InventoryDisposalReviews', 'U') IS NOT NULL DELETE FROM dbo.InventoryDisposalReviews;
    IF OBJECT_ID('dbo.InventoryTransactions', 'U') IS NOT NULL DELETE FROM dbo.InventoryTransactions;
    IF OBJECT_ID('dbo.Ingredients', 'U') IS NOT NULL DELETE FROM dbo.Ingredients;
    IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DELETE FROM dbo.Customers;
    IF OBJECT_ID('dbo.Branches', 'U') IS NOT NULL DELETE FROM dbo.Branches;

    -- Reset Identity cho các bảng đã xóa
    DECLARE @SqlReseed NVARCHAR(MAX) = N'';
    SELECT @SqlReseed = @SqlReseed + N'DBCC CHECKIDENT (''' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name) + N''', RESEED, 0);' + CHAR(13)
    FROM sys.tables t
    INNER JOIN sys.identity_columns ic ON t.object_id = ic.object_id
    WHERE t.name NOT IN ('Roles', 'Permissions', 'RolePermissions', 'sysdiagrams');

    IF LEN(@SqlReseed) > 0
        EXEC sp_executesql @SqlReseed;

    -- Tạo lại 1 tài khoản Admin duy nhất (RoleId = 1 -> Cấp 5, Full Permission)
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, Email, PhoneNumber, IsActive, MustChangePassword)
    VALUES ('admin', @AdminPasswordHash, N'Quản trị viên Hệ thống', 'admin@fiincoffee.vn', '0901234567', 1, 0);

    DECLARE @NewAdminUserId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.UserRoles (UserId, RoleId)
    VALUES (@NewAdminUserId, 1);

    -- Bật lại toàn bộ trigger
    EXEC sp_MSforeachtable 'ALTER TABLE ? ENABLE TRIGGER ALL';

    COMMIT TRANSACTION;
    PRINT N'-> Đã xóa toàn bộ dữ liệu (chừa Roles, Permissions, RolePermissions) và tạo lại 1 tài khoản admin (Cấp 5 - Full Permission).';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    EXEC sp_MSforeachtable 'ALTER TABLE ? ENABLE TRIGGER ALL';
    THROW;
END CATCH;
GO
