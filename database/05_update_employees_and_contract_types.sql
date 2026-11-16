-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Kịch bản: BẢNG CONTRACTTYPES, CẬP NHẬT EMPLOYEES & STORED PROCEDURE THÊM NHÂN VIÊN MỚI
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/05_update_employees_and_contract_types.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- 1. TẠO BẢNG LOẠI HỢP ĐỒNG LAO ĐỘNG (ContractTypes) NẾU CHƯA CÓ TRONG COFFEESHOPDB
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ContractTypes')
BEGIN
    CREATE TABLE dbo.ContractTypes (
        ContractTypeId INT IDENTITY(1,1) PRIMARY KEY,
        ContractCode VARCHAR(30) UNIQUE NOT NULL DEFAULT '000',
        ContractName NVARCHAR(100) NOT NULL,
        StandardHourlyRate DECIMAL(18,2) NULL,
        Allowance DECIMAL(18,2) NULL,
        SalaryPercentage DECIMAL(5,2) NULL,
        DurationMonths INT NULL,
        BenefitsDescription NVARCHAR(500) NULL,
        IsActive BIT DEFAULT 1
    );
    PRINT N'-> Đã tạo bảng ContractTypes trong CoffeeShopDB.';
END
ELSE
BEGIN
    PRINT N'-> Bảng ContractTypes đã tồn tại trong CoffeeShopDB.';
END
GO

-- =======================================================================================
-- 2. NẠP DỮ LIỆU MẪU 5 LOẠI HỢP ĐỒNG LAO ĐỘNG CHUẨN
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractCode = 'HD-HOC-VIEC')
    INSERT INTO dbo.ContractTypes (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES ('HD-HOC-VIEC', N'Hợp đồng Đào tạo / Học việc', 20000.00, 200000.00, 80.00, 1, 
            N'Hỗ trợ 1 ly cà phê/ca làm việc, cấp tài liệu đào tạo barista chuyên nghiệp, có người kèm cặp 1-1.', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractCode = 'HD-THU-VIEC')
    INSERT INTO dbo.ContractTypes (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES ('HD-THU-VIEC', N'Hợp đồng Thử việc (2 tháng)', 24000.00, 500000.00, 85.00, 2, 
            N'Phụ cấp cơm trưa, hỗ trợ gửi xe, 1 ly cà phê/ca làm, cấp phát đồng phục miễn phí.', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractCode = 'HD-CHINH-THUC')
    INSERT INTO dbo.ContractTypes (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES ('HD-CHINH-THUC', N'Hợp đồng Lao động Chính thức (Full-time)', 28000.00, 1000000.00, 100.00, 12, 
            N'Tham gia đầy đủ BHXH/BHYT theo luật, phụ cấp cơm trưa 1.000.000đ/tháng, thưởng doanh số chi nhánh, thưởng lễ tết.', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractCode = 'HD-PART-TIME')
    INSERT INTO dbo.ContractTypes (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES ('HD-PART-TIME', N'Hợp đồng Bán thời gian (Part-time)', 25000.00, 300000.00, 100.00, 6, 
            N'Lịch làm việc linh hoạt theo ca học, hỗ trợ 1 ly cà phê/ca làm, thưởng chuyên cần hàng tháng.', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractCode = 'HD-QUAN-LY')
    INSERT INTO dbo.ContractTypes (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES ('HD-QUAN-LY', N'Hợp đồng Quản lý Cửa hàng / Trưởng ca', 38000.00, 1500000.00, 100.00, 24, 
            N'Đầy đủ chế độ bảo hiểm, phụ cấp trách nhiệm quản lý 1.500.000đ, thưởng theo KPI tăng trưởng cửa hàng, xét tăng lương 6 tháng/lần.', 1);

PRINT N'-> Đã nạp 5 loại hợp đồng mẫu.';
GO

-- =======================================================================================
-- 3. CẬP NHẬT CẤU TRÚC BẢNG EMPLOYEES
-- =======================================================================================

-- 3.1. Thêm cột ContractTypeId
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'ContractTypeId')
BEGIN
    ALTER TABLE dbo.Employees ADD ContractTypeId INT NULL;
    PRINT N'-> Đã thêm cột ContractTypeId vào Employees.';
END
GO

-- 3.2. Cập nhật dữ liệu ContractTypeId cho 10 nhân viên hiện có trước khi gán ràng buộc FK
DECLARE @HdChinhThuc INT = (SELECT ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-CHINH-THUC');
DECLARE @HdPartTime INT = (SELECT ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-PART-TIME');
DECLARE @HdThuViec INT = (SELECT ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-THU-VIEC');
DECLARE @HdQuanLy INT = (SELECT ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-QUAN-LY');

UPDATE dbo.Employees SET ContractTypeId = @HdQuanLy WHERE Position LIKE N'%Quản lý%' OR Position LIKE N'%Trưởng ca%';
UPDATE dbo.Employees SET ContractTypeId = @HdChinhThuc WHERE ContractTypeId IS NULL AND ContractType = 'full_time';
UPDATE dbo.Employees SET ContractTypeId = @HdPartTime WHERE ContractTypeId IS NULL AND ContractType = 'part_time';
UPDATE dbo.Employees SET ContractTypeId = @HdChinhThuc WHERE ContractTypeId IS NULL;
GO

-- 3.3. Thêm khóa ngoại FK_Employees_ContractTypes
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Employees_ContractTypes')
BEGIN
    ALTER TABLE dbo.Employees ADD CONSTRAINT FK_Employees_ContractTypes 
        FOREIGN KEY (ContractTypeId) REFERENCES dbo.ContractTypes(ContractTypeId);
    PRINT N'-> Đã tạo khóa ngoại FK_Employees_ContractTypes.';
END
GO

-- 3.4. Thêm CitizenId (Số CCCD 12 chữ số)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'CitizenId')
BEGIN
    ALTER TABLE dbo.Employees ADD CitizenId VARCHAR(20) NULL;
    PRINT N'-> Đã thêm cột CitizenId vào Employees.';
END
GO

-- 3.5. Thêm BankName, BankAccountNumber, BankAccountName
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankName')
BEGIN
    ALTER TABLE dbo.Employees ADD BankName NVARCHAR(100) NULL;
    PRINT N'-> Đã thêm cột BankName vào Employees.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankAccountNumber')
BEGIN
    ALTER TABLE dbo.Employees ADD BankAccountNumber VARCHAR(30) NULL;
    PRINT N'-> Đã thêm cột BankAccountNumber vào Employees.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankAccountName')
BEGIN
    ALTER TABLE dbo.Employees ADD BankAccountName NVARCHAR(100) NULL;
    PRINT N'-> Đã thêm cột BankAccountName vào Employees.';
END
GO

-- 3.6. Cập nhật dữ liệu mẫu CCCD và Tài khoản ngân hàng cho 10 nhân viên cũ
UPDATE dbo.Employees 
SET CitizenId = '079' + RIGHT('000000000' + CAST(EmployeeId * 12345 AS VARCHAR(20)), 9),
    BankName = CASE (EmployeeId % 4)
        WHEN 0 THEN N'Vietcombank'
        WHEN 1 THEN N'MB Bank'
        WHEN 2 THEN N'Techcombank'
        ELSE N'ACB'
    END,
    BankAccountNumber = '10' + RIGHT('00000000' + CAST(EmployeeId * 987654 AS VARCHAR(20)), 8),
    BankAccountName = UPPER(u.FullName)
FROM dbo.Employees e
INNER JOIN dbo.Users u ON e.UserId = u.UserId
WHERE e.CitizenId IS NULL;
PRINT N'-> Đã cập nhật CCCD và Ngân hàng mẫu cho nhân viên hiện có.';
GO

-- 3.7. Rút gọn Status: Chỉ còn 'active' và 'resigned'
-- Xóa Check Constraint cũ nếu có TRƯỚC KHI cập nhật giá trị mới
DECLARE @OldConstraintName NVARCHAR(200);
SELECT @OldConstraintName = name 
FROM sys.check_constraints 
WHERE parent_object_id = OBJECT_ID('Employees') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('Employees'), 'Status', 'ColumnId');

IF @OldConstraintName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.Employees DROP CONSTRAINT ' + @OldConstraintName);
    PRINT N'-> Đã gỡ Check Constraint cũ trên cột Status.';
END
GO

-- Xóa Default Constraint cũ nếu có
DECLARE @OldDefConstraint NVARCHAR(200);
SELECT @OldDefConstraint = name 
FROM sys.default_constraints 
WHERE parent_object_id = OBJECT_ID('Employees') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('Employees'), 'Status', 'ColumnId');

IF @OldDefConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.Employees DROP CONSTRAINT ' + @OldDefConstraint);
    PRINT N'-> Đã gỡ Default Constraint cũ trên cột Status.';
END
GO

-- Chuyển đổi dữ liệu cũ ('working', 'probation' -> 'active')
UPDATE dbo.Employees 
SET Status = 'active' 
WHERE Status IN ('working', 'probation') OR Status IS NULL;

-- Thêm Default Constraint và Check Constraint mới ('active', 'resigned')
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Employees_Status')
    ALTER TABLE dbo.Employees ADD CONSTRAINT DF_Employees_Status DEFAULT 'active' FOR Status;

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Employees_Status')
    ALTER TABLE dbo.Employees ADD CONSTRAINT CK_Employees_Status CHECK (Status IN ('active', 'resigned'));
PRINT N'-> Đã chuẩn hóa Status thành active/resigned.';
GO

-- Thêm chỉ mục tra cứu CCCD duy nhất (chỉ áp dụng với giá trị không NULL)
SET QUOTED_IDENTIFIER ON;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Employees_CitizenId')
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UX_Employees_CitizenId 
    ON dbo.Employees(CitizenId) 
    WHERE CitizenId IS NOT NULL;
    PRINT N'-> Đã tạo chỉ mục duy nhất UX_Employees_CitizenId.';
END
GO

-- =======================================================================================
-- 4. VIẾT STORED PROCEDURE: sp_HRM_CreateEmployee (ACID TRANSACTION TOÀN VẸN)
-- =======================================================================================
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateEmployee
    -- Thông tin tài khoản đăng nhập
    @Username VARCHAR(50),
    @PasswordHash VARCHAR(255),
    
    -- Thông tin cá nhân
    @FullName NVARCHAR(100),
    @PhoneNumber VARCHAR(20) = NULL,
    @Email VARCHAR(100) = NULL,
    @DateOfBirth DATE = NULL,
    @Gender VARCHAR(10) = NULL,
    
    -- Thông tin định danh & Ngân hàng
    @CitizenId VARCHAR(20),
    @BankName NVARCHAR(100) = NULL,
    @BankAccountNumber VARCHAR(30) = NULL,
    @BankAccountName NVARCHAR(100) = NULL,
    
    -- Phân bổ công việc & Hợp đồng
    @BranchId INT,
    @Position NVARCHAR(50),
    @ContractTypeId INT,
    @HourlyRate DECIMAL(18,2) = NULL, -- NULL nghĩa là tự động lấy theo loại hợp đồng
    @Note NVARCHAR(500) = NULL,
    @RoleId INT = NULL,               -- NULL nghĩa là gán Role mặc định
    
    -- Tham số đầu ra Output
    @NewEmployeeId INT OUTPUT,
    @NewEmployeeCode VARCHAR(20) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- 1. Kiểm tra chống trùng Username
    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Tên đăng nhập (Username) "%s" đã tồn tại trong hệ thống. Vui lòng chọn tên đăng nhập khác.', 16, 1, @Username);
        RETURN;
    END

    -- 2. Kiểm tra chống trùng Số CCCD
    IF @CitizenId IS NOT NULL AND LTRIM(RTRIM(@CitizenId)) != ''
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Employees WHERE CitizenId = @CitizenId)
        BEGIN
            ROLLBACK TRANSACTION;
            RAISERROR(N'Số Căn cước công dân (CCCD) "%s" đã được đăng ký cho một nhân sự khác trong hệ thống.', 16, 1, @CitizenId);
            RETURN;
        END
    END
    ELSE
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Số Căn cước công dân (CCCD) là bắt buộc để lập hồ sơ nhân sự và ký kết hợp đồng.', 16, 1);
        RETURN;
    END

    -- 3. Kiểm tra chi nhánh tồn tại
    IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId AND IsActive = 1)
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Chi nhánh làm việc không tồn tại hoặc đã ngừng hoạt động.', 16, 1);
        RETURN;
    END

    -- 4. Kiểm tra loại hợp đồng và lấy mức lương giờ chuẩn + phụ cấp
    DECLARE @StandardRate DECIMAL(18,2);
    DECLARE @ContractDuration INT;

    SELECT 
        @StandardRate = StandardHourlyRate,
        @ContractDuration = DurationMonths
    FROM dbo.ContractTypes
    WHERE ContractTypeId = @ContractTypeId AND IsActive = 1;

    IF @StandardRate IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Loại hợp đồng lao động không tồn tại hoặc đã ngừng áp dụng.', 16, 1);
        RETURN;
    END

    -- Lương giờ áp dụng: ưu tiên mức lương riêng nếu có thỏa thuận, không thì lấy từ hợp đồng
    DECLARE @FinalHourlyRate DECIMAL(18,2) = ISNULL(@HourlyRate, @StandardRate);

    -- 5. Tạo bản ghi tài khoản người dùng trong bảng Users
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive, CreatedAt)
    VALUES (@Username, @PasswordHash, @FullName, @PhoneNumber, @Email, 1, SYSDATETIME());

    DECLARE @NewUserId INT = SCOPE_IDENTITY();

    -- 6. Gán vai trò (UserRoles)
    IF @RoleId IS NULL
    BEGIN
        SELECT TOP 1 @RoleId = RoleId FROM dbo.Roles WHERE RoleName IN ('Staff', 'Barista', 'HRM');
        IF @RoleId IS NULL SET @RoleId = 1;
    END

    INSERT INTO dbo.UserRoles (UserId, RoleId)
    VALUES (@NewUserId, @RoleId);

    -- 7. Tự động sinh mã nhân viên chuẩn hóa (Ví dụ: NV011, NV012...)
    DECLARE @MaxNum INT = 0;
    SELECT @MaxNum = ISNULL(MAX(CAST(SUBSTRING(EmployeeCode, 3, 10) AS INT)), 0)
    FROM dbo.Employees
    WHERE EmployeeCode LIKE 'NV[0-9]%';

    SET @NewEmployeeCode = 'NV' + RIGHT('000' + CAST(@MaxNum + 1 AS VARCHAR(10)), 3);

    -- 8. Tạo bản ghi hồ sơ nhân viên trong bảng Employees
    INSERT INTO dbo.Employees (
        UserId,
        EmployeeCode,
        Position,
        HireDate,
        HourlyRate,
        BranchId,
        Status,
        ContractTypeId,
        CitizenId,
        BankName,
        BankAccountNumber,
        BankAccountName,
        DateOfBirth,
        Gender,
        Note,
        UpdatedAt
    )
    VALUES (
        @NewUserId,
        @NewEmployeeCode,
        @Position,
        CAST(SYSDATETIME() AS DATE),
        @FinalHourlyRate,
        @BranchId,
        'active',
        @ContractTypeId,
        @CitizenId,
        @BankName,
        @BankAccountNumber,
        ISNULL(@BankAccountName, UPPER(@FullName)),
        @DateOfBirth,
        @Gender,
        @Note,
        SYSDATETIME()
    );

    SET @NewEmployeeId = SCOPE_IDENTITY();

    -- 9. Trả về toàn bộ dữ liệu nhân viên mới kèm thông tin chi nhánh & hợp đồng
    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        u.UserId,
        u.Username,
        u.FullName,
        u.PhoneNumber,
        u.Email,
        e.CitizenId,
        e.BankName,
        e.BankAccountNumber,
        e.BankAccountName,
        b.BranchId,
        b.BranchCode,
        b.BranchName,
        e.Position,
        ct.ContractTypeId,
        ct.ContractCode,
        ct.ContractName,
        e.HourlyRate,
        ct.Allowance,
        ct.BenefitsDescription,
        e.Status,
        e.HireDate,
        e.DateOfBirth,
        e.Gender,
        e.Note,
        e.UpdatedAt
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    INNER JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
    WHERE e.EmployeeId = @NewEmployeeId;

    COMMIT TRANSACTION;
END;
GO

PRINT N'-> Đã tạo Stored Procedure sp_HRM_CreateEmployee thành công.';
GO

PRINT N'>>> HOÀN TẤT TOÀN BỘ CẬP NHẬT CSDL & STORED PROCEDURE THÊM NHÂN VIÊN MỚI! <<<';
GO
