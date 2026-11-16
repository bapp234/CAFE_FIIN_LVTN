-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- KỊCH BẢN NÂNG CẤP CSDL: BẢN CẬP NHẬT SỐ 01 (HRM & CHAIN ARCHITECTURE)
-- Hệ quản trị: Microsoft SQL Server 2022 / 2025
-- Database: CoffeeShopDB
-- File: src/database/06_hrm_migration_and_routines.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. BẢNG CHI NHÁNH (Branches)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Branches')
BEGIN
    CREATE TABLE dbo.Branches (
        BranchId INT IDENTITY(1,1) NOT NULL,
        BranchCode VARCHAR(20) NOT NULL,
        BranchName NVARCHAR(100) NOT NULL,
        Address NVARCHAR(255) NOT NULL,
        PhoneNumber VARCHAR(20) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Branches_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Branches_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Branches PRIMARY KEY CLUSTERED (BranchId),
        CONSTRAINT UQ_Branches_BranchCode UNIQUE (BranchCode)
    );
END
GO

-- 2. BẢNG LOẠI HỢP ĐỒNG LAO ĐỘNG (ContractTypes)
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
END
GO

-- Nạp 5 loại hợp đồng chuẩn
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
GO

-- 3. CẬP NHẬT BẢNG HỒ SƠ NHÂN VIÊN (Employees)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BranchId')
    ALTER TABLE dbo.Employees ADD BranchId INT NULL CONSTRAINT FK_Employees_Branches FOREIGN KEY REFERENCES dbo.Branches(BranchId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'ContractTypeId')
    ALTER TABLE dbo.Employees ADD ContractTypeId INT NULL CONSTRAINT FK_Employees_ContractTypes FOREIGN KEY REFERENCES dbo.ContractTypes(ContractTypeId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'CitizenId')
    ALTER TABLE dbo.Employees ADD CitizenId VARCHAR(20) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankName')
    ALTER TABLE dbo.Employees ADD BankName NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankAccountNumber')
    ALTER TABLE dbo.Employees ADD BankAccountNumber VARCHAR(30) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BankAccountName')
    ALTER TABLE dbo.Employees ADD BankAccountName NVARCHAR(100) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'DateOfBirth')
    ALTER TABLE dbo.Employees ADD DateOfBirth DATE NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Gender')
    ALTER TABLE dbo.Employees ADD Gender VARCHAR(10) NULL CONSTRAINT CK_Employees_Gender CHECK (Gender IN ('male', 'female', 'other'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Note')
    ALTER TABLE dbo.Employees ADD Note NVARCHAR(500) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'UpdatedAt')
    ALTER TABLE dbo.Employees ADD UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Employees_UpdatedAt DEFAULT SYSDATETIME();
GO

-- Gỡ Check Constraint cũ nếu có trước khi cập nhật giá trị mới
DECLARE @OldConstraintName NVARCHAR(200);
SELECT @OldConstraintName = name FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('Employees') AND parent_column_id = COLUMNPROPERTY(OBJECT_ID('Employees'), 'Status', 'ColumnId');
IF @OldConstraintName IS NOT NULL EXEC('ALTER TABLE dbo.Employees DROP CONSTRAINT ' + @OldConstraintName);
GO

UPDATE dbo.Employees SET Status = 'active' WHERE Status IN ('working', 'probation') OR Status IS NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Employees_Status')
    ALTER TABLE dbo.Employees ADD CONSTRAINT CK_Employees_Status CHECK (Status IN ('active', 'resigned'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Employees_CitizenId')
    CREATE UNIQUE NONCLUSTERED INDEX UX_Employees_CitizenId ON dbo.Employees(CitizenId) WHERE CitizenId IS NOT NULL;
GO

-- 4. BẢNG MẪU CA LÀM VIỆC (ShiftTemplates)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ShiftTemplates')
BEGIN
    CREATE TABLE dbo.ShiftTemplates (
        TemplateId INT IDENTITY(1,1) NOT NULL,
        ShiftCode VARCHAR(20) NOT NULL,
        ShiftName NVARCHAR(100) NOT NULL,
        StartTime TIME(0) NOT NULL,
        EndTime TIME(0) NOT NULL,
        BreakMinutes INT NOT NULL CONSTRAINT DF_ShiftTemplates_BreakMinutes DEFAULT 0,
        StandardHours DECIMAL(4,2) NOT NULL,
        ColorCode VARCHAR(20) NOT NULL CONSTRAINT DF_ShiftTemplates_Color DEFAULT 'emerald',
        IsActive BIT NOT NULL CONSTRAINT DF_ShiftTemplates_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShiftTemplates_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_ShiftTemplates PRIMARY KEY CLUSTERED (TemplateId),
        CONSTRAINT UQ_ShiftTemplates_ShiftCode UNIQUE (ShiftCode),
        CONSTRAINT CK_ShiftTemplates_Hours CHECK (StandardHours > 0)
    );
END
GO

-- 5. BẢNG ĐĂNG KÝ PHÂN CA TUẦN (ShiftAssignments)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ShiftAssignments')
BEGIN
    CREATE TABLE dbo.ShiftAssignments (
        AssignmentId INT IDENTITY(1,1) NOT NULL,
        EmployeeId INT NOT NULL,
        TemplateId INT NOT NULL,
        BranchId INT NOT NULL,
        WorkDate DATE NOT NULL,
        RegisteredBy VARCHAR(20) NOT NULL CONSTRAINT DF_ShiftAssignments_RegisteredBy DEFAULT 'manager',
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_ShiftAssignments_Status DEFAULT 'scheduled',
        Note NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ShiftAssignments_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_ShiftAssignments PRIMARY KEY CLUSTERED (AssignmentId),
        CONSTRAINT FK_ShiftAssignments_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT FK_ShiftAssignments_Templates FOREIGN KEY (TemplateId) REFERENCES dbo.ShiftTemplates(TemplateId),
        CONSTRAINT FK_ShiftAssignments_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT CK_ShiftAssignments_Status CHECK (Status IN ('scheduled', 'swapped', 'cancelled')),
        CONSTRAINT UQ_ShiftAssignments_Emp_Date_Template UNIQUE (EmployeeId, WorkDate, TemplateId)
    );
END
GO

-- 6. CẬP NHẬT BẢNG CHẤM CÔNG (Attendances)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'ShiftAssignmentId')
    ALTER TABLE dbo.Attendances ADD ShiftAssignmentId INT NULL CONSTRAINT FK_Attendances_Assignments FOREIGN KEY REFERENCES dbo.ShiftAssignments(AssignmentId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'ScheduledStartTime')
    ALTER TABLE dbo.Attendances ADD ScheduledStartTime TIME(0) NULL, ScheduledEndTime TIME(0) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'WorkHours')
    ALTER TABLE dbo.Attendances ADD WorkHours DECIMAL(4,2) NOT NULL CONSTRAINT DF_Attendances_WorkHours DEFAULT 0,
                                   OvertimeHours DECIMAL(4,2) NOT NULL CONSTRAINT DF_Attendances_OvertimeHours DEFAULT 0,
                                   LateMinutes INT NOT NULL CONSTRAINT DF_Attendances_LateMinutes DEFAULT 0,
                                   EarlyLeaveMinutes INT NOT NULL CONSTRAINT DF_Attendances_EarlyLeaveMinutes DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'Status')
    ALTER TABLE dbo.Attendances ADD Status VARCHAR(20) NOT NULL CONSTRAINT DF_Attendances_Status DEFAULT 'on_time'
                                   CONSTRAINT CK_Attendances_Status CHECK (Status IN ('on_time', 'late', 'early_leave', 'absent'));
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'IsManualAdjusted')
    ALTER TABLE dbo.Attendances ADD IsManualAdjusted BIT NOT NULL CONSTRAINT DF_Attendances_IsManualAdjusted DEFAULT 0,
                                   AdjustedBy NVARCHAR(100) NULL,
                                   AdjustedReason NVARCHAR(255) NULL,
                                   AdjustedAt DATETIME2(0) NULL;
GO

-- 7. BẢNG KỲ LƯƠNG & PHIẾU LƯƠNG (PayrollPeriods, PayrollSlips)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PayrollPeriods')
BEGIN
    CREATE TABLE dbo.PayrollPeriods (
        PeriodId INT IDENTITY(1,1) NOT NULL,
        PeriodMonth VARCHAR(7) NOT NULL,
        BranchId INT NULL,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_PayrollPeriods_Status DEFAULT 'draft',
        IsLocked BIT NOT NULL CONSTRAINT DF_PayrollPeriods_IsLocked DEFAULT 0,
        TotalEmployees INT NOT NULL CONSTRAINT DF_PayrollPeriods_TotalEmp DEFAULT 0,
        TotalNetPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollPeriods_TotalNet DEFAULT 0,
        ApprovedBy NVARCHAR(100) NULL,
        ApprovedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PayrollPeriods_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_PayrollPeriods PRIMARY KEY CLUSTERED (PeriodId),
        CONSTRAINT FK_PayrollPeriods_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT CK_PayrollPeriods_Status CHECK (Status IN ('draft', 'approved', 'paid')),
        CONSTRAINT UQ_PayrollPeriods_Month_Branch UNIQUE (PeriodMonth, BranchId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'PayrollSlips')
BEGIN
    CREATE TABLE dbo.PayrollSlips (
        SlipId INT IDENTITY(1,1) NOT NULL,
        PeriodId INT NOT NULL,
        EmployeeId INT NOT NULL,
        HourlyRate DECIMAL(18,2) NOT NULL,
        StandardHours DECIMAL(6,2) NOT NULL CONSTRAINT DF_PayrollSlips_StdHours DEFAULT 0,
        OvertimeHours DECIMAL(6,2) NOT NULL CONSTRAINT DF_PayrollSlips_OtHours DEFAULT 0,
        BasePay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_BasePay DEFAULT 0,
        OvertimePay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_OtPay DEFAULT 0,
        Allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Allowance DEFAULT 0,
        Deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Deduction DEFAULT 0,
        Advance DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Advance DEFAULT 0,
        NetPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_NetPay DEFAULT 0,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_PayrollSlips_Status DEFAULT 'draft',
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PayrollSlips_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_PayrollSlips PRIMARY KEY CLUSTERED (SlipId),
        CONSTRAINT FK_PayrollSlips_Periods FOREIGN KEY (PeriodId) REFERENCES dbo.PayrollPeriods(PeriodId) ON DELETE CASCADE,
        CONSTRAINT FK_PayrollSlips_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT CK_PayrollSlips_Status CHECK (Status IN ('draft', 'approved', 'paid')),
        CONSTRAINT UQ_PayrollSlips_Period_Employee UNIQUE (PeriodId, EmployeeId)
    );
END
GO

-- 8. SEQUENCE VÀ VIEW HỖ TRỢ CLEAN CODE
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'Seq_EmployeeCode')
    CREATE SEQUENCE dbo.Seq_EmployeeCode START WITH 12 INCREMENT BY 1;
GO

CREATE OR ALTER VIEW dbo.v_EmployeeDetails
AS
SELECT 
    e.EmployeeId, e.EmployeeCode,
    u.UserId, u.Username, u.FullName, u.PhoneNumber, u.Email,
    e.CitizenId, e.BankName, e.BankAccountNumber, e.BankAccountName,
    b.BranchId, b.BranchCode, b.BranchName,
    e.Position,
    ct.ContractTypeId, ct.ContractCode, ct.ContractName,
    e.HourlyRate, ct.Allowance, ct.BenefitsDescription,
    e.Status, e.HireDate, e.DateOfBirth, e.Gender, e.Note, e.UpdatedAt
FROM dbo.Employees e
INNER JOIN dbo.Users u ON e.UserId = u.UserId
INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
INNER JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId;
GO

-- 9. STORED PROCEDURE THÊM NHÂN VIÊN (BẢN TỐI ƯU SIÊU GỌN ~45 DÒNG)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateEmployee
    @Username           VARCHAR(50),
    @PasswordHash       VARCHAR(255),
    @FullName           NVARCHAR(100),
    @PhoneNumber        VARCHAR(20)   = NULL,
    @Email              VARCHAR(100)  = NULL,
    @DateOfBirth        DATE          = NULL,
    @Gender             VARCHAR(10)   = NULL,
    @CitizenId          VARCHAR(20),
    @BankName           NVARCHAR(100) = NULL,
    @BankAccountNumber  VARCHAR(30)   = NULL,
    @BankAccountName    NVARCHAR(100) = NULL,
    @BranchId           INT,
    @Position           NVARCHAR(50),
    @ContractTypeId     INT,
    @HourlyRate         DECIMAL(18,2) = NULL,
    @Note               NVARCHAR(500) = NULL,
    @RoleId             INT           = NULL,
    @NewEmployeeId      INT           OUTPUT,
    @NewEmployeeCode    VARCHAR(20)   OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
        THROW 50001, N'Tên đăng nhập đã tồn tại trong hệ thống.', 1;

    IF EXISTS (SELECT 1 FROM dbo.Employees WHERE CitizenId = @CitizenId)
        THROW 50002, N'Số CCCD này đã được đăng ký cho một nhân viên khác.', 1;

    BEGIN TRANSACTION;

    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive, CreatedAt)
    VALUES (@Username, @PasswordHash, @FullName, @PhoneNumber, @Email, 1, SYSDATETIME());
    
    DECLARE @NewUserId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.UserRoles (UserId, RoleId)
    VALUES (@NewUserId, ISNULL(@RoleId, (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName IN ('Staff', 'Barista', 'HRM'))));

    SET @NewEmployeeCode = 'NV' + RIGHT('000' + CAST(NEXT VALUE FOR dbo.Seq_EmployeeCode AS VARCHAR(10)), 3);

    INSERT INTO dbo.Employees (
        UserId, EmployeeCode, Position, HireDate, HourlyRate,
        BranchId, Status, ContractTypeId, CitizenId,
        BankName, BankAccountNumber, BankAccountName,
        DateOfBirth, Gender, Note, UpdatedAt
    )
    VALUES (
        @NewUserId, @NewEmployeeCode, @Position, CAST(SYSDATETIME() AS DATE),
        ISNULL(@HourlyRate, (SELECT StandardHourlyRate FROM dbo.ContractTypes WHERE ContractTypeId = @ContractTypeId)),
        @BranchId, 'active', @ContractTypeId, @CitizenId,
        @BankName, @BankAccountNumber, ISNULL(@BankAccountName, UPPER(@FullName)),
        @DateOfBirth, @Gender, @Note, SYSDATETIME()
    );

    SET @NewEmployeeId = SCOPE_IDENTITY();

    SELECT * FROM dbo.v_EmployeeDetails WHERE EmployeeId = @NewEmployeeId;

    COMMIT TRANSACTION;
END;
GO

-- 10. TRIGGER BẢO VỆ PHIẾU LƯƠNG KHI ĐÃ KHÓA
CREATE OR ALTER TRIGGER dbo.trg_PayrollSlips_PreventModifyWhenLocked
ON dbo.PayrollSlips
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM deleted d
        INNER JOIN dbo.PayrollPeriods p ON d.PeriodId = p.PeriodId
        WHERE p.IsLocked = 1
    )
    BEGIN
        RAISERROR(N'Kỳ lương này đã được phê duyệt và khóa bảo mật. Tuyệt đối không được phép chỉnh sửa hoặc xóa phiếu lương!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

PRINT N'>>> TOÀN BỘ SCRIPT MIGRATION & THÀNH PHẦN HRM ĐÃ THỰC THI THÀNH CÔNG! <<<';
GO
