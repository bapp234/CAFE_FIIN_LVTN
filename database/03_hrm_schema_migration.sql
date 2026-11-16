-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Kịch bản mở rộng Cơ sở dữ liệu: MODULE QUẢN TRỊ NHÂN SỰ (HRM) & CHI NHÁNH
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/03_hrm_schema_migration.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

-- =======================================================================================
-- 1. BẢNG CHI NHÁNH (Branches) - HỖ TRỢ MÔ HÌNH CHUỖI CỬA HÀNG
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Branches')
BEGIN
    CREATE TABLE Branches (
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
    PRINT N'-> Đã tạo bảng Branches.';
END
ELSE
BEGIN
    PRINT N'-> Bảng Branches đã tồn tại.';
END
GO

-- =======================================================================================
-- 2. CẬP NHẬT BẢNG HỒ SƠ NHÂN VIÊN (Employees)
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'BranchId')
BEGIN
    ALTER TABLE Employees ADD BranchId INT NULL 
        CONSTRAINT FK_Employees_Branches FOREIGN KEY REFERENCES Branches(BranchId);
    PRINT N'-> Đã thêm cột BranchId vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Status')
BEGIN
    ALTER TABLE Employees ADD Status VARCHAR(20) NOT NULL 
        CONSTRAINT DF_Employees_Status DEFAULT 'probation'
        CONSTRAINT CK_Employees_Status CHECK (Status IN ('working', 'probation', 'resigned'));
    PRINT N'-> Đã thêm cột Status vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'ContractType')
BEGIN
    ALTER TABLE Employees ADD ContractType VARCHAR(20) NOT NULL 
        CONSTRAINT DF_Employees_ContractType DEFAULT 'part_time'
        CONSTRAINT CK_Employees_ContractType CHECK (ContractType IN ('full_time', 'part_time'));
    PRINT N'-> Đã thêm cột ContractType vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'DateOfBirth')
BEGIN
    ALTER TABLE Employees ADD DateOfBirth DATE NULL;
    PRINT N'-> Đã thêm cột DateOfBirth vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Gender')
BEGIN
    ALTER TABLE Employees ADD Gender VARCHAR(10) NULL
        CONSTRAINT CK_Employees_Gender CHECK (Gender IN ('male', 'female', 'other'));
    PRINT N'-> Đã thêm cột Gender vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'Note')
BEGIN
    ALTER TABLE Employees ADD Note NVARCHAR(500) NULL;
    PRINT N'-> Đã thêm cột Note vào Employees.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Employees') AND name = 'UpdatedAt')
BEGIN
    ALTER TABLE Employees ADD UpdatedAt DATETIME2(0) NOT NULL 
        CONSTRAINT DF_Employees_UpdatedAt DEFAULT SYSDATETIME();
    PRINT N'-> Đã thêm cột UpdatedAt vào Employees.';
END
GO

-- =======================================================================================
-- 3. BẢNG MẪU CA LÀM VIỆC (ShiftTemplates)
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShiftTemplates')
BEGIN
    CREATE TABLE ShiftTemplates (
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
    PRINT N'-> Đã tạo bảng ShiftTemplates.';
END
ELSE
BEGIN
    PRINT N'-> Bảng ShiftTemplates đã tồn tại.';
END
GO

-- =======================================================================================
-- 4. BẢNG ĐĂNG KÝ / PHÂN CA LÀM VIỆC TRƯỚC (ShiftAssignments)
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ShiftAssignments')
BEGIN
    CREATE TABLE ShiftAssignments (
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
        CONSTRAINT FK_ShiftAssignments_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
        CONSTRAINT FK_ShiftAssignments_Templates FOREIGN KEY (TemplateId) REFERENCES ShiftTemplates(TemplateId),
        CONSTRAINT FK_ShiftAssignments_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
        CONSTRAINT CK_ShiftAssignments_Status CHECK (Status IN ('scheduled', 'swapped', 'cancelled')),
        CONSTRAINT UQ_ShiftAssignments_Emp_Date_Template UNIQUE (EmployeeId, WorkDate, TemplateId)
    );
    PRINT N'-> Đã tạo bảng ShiftAssignments.';
END
ELSE
BEGIN
    PRINT N'-> Bảng ShiftAssignments đã tồn tại.';
END
GO

-- =======================================================================================
-- 5. CẬP NHẬT BẢNG CHẤM CÔNG (Attendances)
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'ShiftAssignmentId')
BEGIN
    ALTER TABLE Attendances ADD ShiftAssignmentId INT NULL
        CONSTRAINT FK_Attendances_Assignments FOREIGN KEY REFERENCES ShiftAssignments(AssignmentId);
    PRINT N'-> Đã thêm cột ShiftAssignmentId vào Attendances.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'ScheduledStartTime')
BEGIN
    ALTER TABLE Attendances ADD ScheduledStartTime TIME(0) NULL;
    ALTER TABLE Attendances ADD ScheduledEndTime TIME(0) NULL;
    PRINT N'-> Đã thêm cột ScheduledStartTime, ScheduledEndTime vào Attendances.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'WorkHours')
BEGIN
    ALTER TABLE Attendances ADD WorkHours DECIMAL(4,2) NOT NULL CONSTRAINT DF_Attendances_WorkHours DEFAULT 0;
    ALTER TABLE Attendances ADD OvertimeHours DECIMAL(4,2) NOT NULL CONSTRAINT DF_Attendances_OvertimeHours DEFAULT 0;
    ALTER TABLE Attendances ADD LateMinutes INT NOT NULL CONSTRAINT DF_Attendances_LateMinutes DEFAULT 0;
    ALTER TABLE Attendances ADD EarlyLeaveMinutes INT NOT NULL CONSTRAINT DF_Attendances_EarlyLeaveMinutes DEFAULT 0;
    PRINT N'-> Đã thêm các cột tính giờ công vào Attendances.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'Status')
BEGIN
    ALTER TABLE Attendances ADD Status VARCHAR(20) NOT NULL 
        CONSTRAINT DF_Attendances_Status DEFAULT 'on_time'
        CONSTRAINT CK_Attendances_Status CHECK (Status IN ('on_time', 'late', 'early_leave', 'absent'));
    PRINT N'-> Đã thêm cột Status vào Attendances.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('Attendances') AND name = 'IsManualAdjusted')
BEGIN
    ALTER TABLE Attendances ADD IsManualAdjusted BIT NOT NULL CONSTRAINT DF_Attendances_IsManualAdjusted DEFAULT 0;
    ALTER TABLE Attendances ADD AdjustedBy NVARCHAR(100) NULL;
    ALTER TABLE Attendances ADD AdjustedReason NVARCHAR(255) NULL;
    ALTER TABLE Attendances ADD AdjustedAt DATETIME2(0) NULL;
    PRINT N'-> Đã thêm các cột Audit chỉnh sửa thủ công vào Attendances.';
END
GO

-- =======================================================================================
-- 6. BẢNG KỲ TÍNH LƯƠNG (PayrollPeriods)
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PayrollPeriods')
BEGIN
    CREATE TABLE PayrollPeriods (
        PeriodId INT IDENTITY(1,1) NOT NULL,
        PeriodMonth VARCHAR(7) NOT NULL, -- 'YYYY-MM'
        BranchId INT NULL,              -- NULL nghĩa là toàn chuỗi
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_PayrollPeriods_Status DEFAULT 'draft',
        IsLocked BIT NOT NULL CONSTRAINT DF_PayrollPeriods_IsLocked DEFAULT 0,
        TotalEmployees INT NOT NULL CONSTRAINT DF_PayrollPeriods_TotalEmp DEFAULT 0,
        TotalNetPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollPeriods_TotalNet DEFAULT 0,
        ApprovedBy NVARCHAR(100) NULL,
        ApprovedAt DATETIME2(0) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PayrollPeriods_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_PayrollPeriods PRIMARY KEY CLUSTERED (PeriodId),
        CONSTRAINT FK_PayrollPeriods_Branches FOREIGN KEY (BranchId) REFERENCES Branches(BranchId),
        CONSTRAINT CK_PayrollPeriods_Status CHECK (Status IN ('draft', 'approved', 'paid')),
        CONSTRAINT UQ_PayrollPeriods_Month_Branch UNIQUE (PeriodMonth, BranchId)
    );
    PRINT N'-> Đã tạo bảng PayrollPeriods.';
END
ELSE
BEGIN
    PRINT N'-> Bảng PayrollPeriods đã tồn tại.';
END
GO

-- =======================================================================================
-- 7. BẢNG PHIẾU LƯƠNG NHÂN VIÊN (PayrollSlips) - CÔNG THỨC GIỜ THỰC TẾ + OT x1.5
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PayrollSlips')
BEGIN
    CREATE TABLE PayrollSlips (
        SlipId INT IDENTITY(1,1) NOT NULL,
        PeriodId INT NOT NULL,
        EmployeeId INT NOT NULL,
        HourlyRate DECIMAL(18,2) NOT NULL,
        StandardHours DECIMAL(6,2) NOT NULL CONSTRAINT DF_PayrollSlips_StdHours DEFAULT 0,
        OvertimeHours DECIMAL(6,2) NOT NULL CONSTRAINT DF_PayrollSlips_OtHours DEFAULT 0,
        BasePay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_BasePay DEFAULT 0,
        OvertimePay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_OtPay DEFAULT 0, -- OT x 1.5
        Allowance DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Allowance DEFAULT 0,
        Deduction DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Deduction DEFAULT 0,
        Advance DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_Advance DEFAULT 0,
        NetPay DECIMAL(18,2) NOT NULL CONSTRAINT DF_PayrollSlips_NetPay DEFAULT 0,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_PayrollSlips_Status DEFAULT 'draft',
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PayrollSlips_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_PayrollSlips PRIMARY KEY CLUSTERED (SlipId),
        CONSTRAINT FK_PayrollSlips_Periods FOREIGN KEY (PeriodId) REFERENCES PayrollPeriods(PeriodId) ON DELETE CASCADE,
        CONSTRAINT FK_PayrollSlips_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId),
        CONSTRAINT CK_PayrollSlips_Status CHECK (Status IN ('draft', 'approved', 'paid')),
        CONSTRAINT UQ_PayrollSlips_Period_Employee UNIQUE (PeriodId, EmployeeId)
    );
    PRINT N'-> Đã tạo bảng PayrollSlips.';
END
ELSE
BEGIN
    PRINT N'-> Bảng PayrollSlips đã tồn tại.';
END
GO

-- =======================================================================================
-- 8. CHIẾN LƯỢC ĐÁNH CHỈ MỤC TỐI ƯU TRUY VẤN CHO HRM
-- =======================================================================================
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ShiftAssignments_Date_Branch')
    CREATE NONCLUSTERED INDEX IX_ShiftAssignments_Date_Branch ON ShiftAssignments(WorkDate, BranchId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Attendances_WorkDate_Employee')
    CREATE NONCLUSTERED INDEX IX_Attendances_WorkDate_Employee ON Attendances(WorkDate, EmployeeId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PayrollSlips_PeriodId')
    CREATE NONCLUSTERED INDEX IX_PayrollSlips_PeriodId ON PayrollSlips(PeriodId);
GO

PRINT N'>>> HOÀN TẤT SCHEMA MIGRATION CHO MODULE HRM & CHI NHÁNH THÀNH CÔNG 100%! <<<';
GO
