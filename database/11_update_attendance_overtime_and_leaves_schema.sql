-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN (COFFEE SHOP MANAGEMENT SYSTEM)
-- RELEASE 11: NÂNG CẤP PHÂN HỆ CHẤM CÔNG, LÀM THÊM GIỜ (OVERTIME) & NGHỈ PHÉP (LEAVES)
-- THEO ĐỊNH HƯỚNG PHƯƠNG ÁN 2: BẢNG LÀM THÊM GIỜ CHI TIẾT (EmployeeOvertimes)
-- HỆ QUẢN TRỊ CSDL: MICROSOFT SQL SERVER 2022 / 2025
-- DATABASE: CoffeeShopDB
-- FILE: src/database/11_update_attendance_overtime_and_leaves_schema.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 11: BẢNG CHẤM CÔNG, LÀM THÊM GIỜ (OT), NGHỈ PHÉP & QUỸ PHÉP';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 1: NÂNG CẤP BẢNG CHẤM CÔNG (Attendances) & BẢNG NHÂN SỰ (Employees)
-- =======================================================================================

-- 1.1 Thêm cột BranchId vào Attendances để lọc theo chi nhánh tốc độ cao mà không cần join
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Attendances') AND name = 'BranchId')
BEGIN
    ALTER TABLE dbo.Attendances ADD BranchId INT NULL
        CONSTRAINT FK_Attendances_Branches FOREIGN KEY REFERENCES dbo.Branches(BranchId);
    PRINT N'-> Đã thêm cột BranchId vào bảng Attendances.';

    -- Cập nhật dữ liệu cũ nếu có: lấy BranchId từ ShiftAssignments hoặc Employees
    EXEC(N'
        UPDATE a
        SET a.BranchId = ISNULL(sa.BranchId, e.BranchId)
        FROM dbo.Attendances a
        LEFT JOIN dbo.ShiftAssignments sa ON a.ShiftAssignmentId = sa.AssignmentId
        LEFT JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
        WHERE a.BranchId IS NULL;
    ');
    PRINT N'-> Đã đồng bộ BranchId cho các bản ghi Attendances hiện hữu.';
END
GO

-- 1.2 Thêm cờ IsMissingPunch (Quên quẹt thẻ vào/ra) vào Attendances
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Attendances') AND name = 'IsMissingPunch')
BEGIN
    ALTER TABLE dbo.Attendances ADD IsMissingPunch BIT NOT NULL 
        CONSTRAINT DF_Attendances_IsMissingPunch DEFAULT 0;
    PRINT N'-> Đã thêm cột IsMissingPunch vào bảng Attendances.';
END
GO

-- 1.3 Mở rộng ràng buộc CK_Attendances_Status để hỗ trợ các trạng thái thực tế
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.Attendances') AND definition LIKE '%Status%')
BEGIN
    DECLARE @AttStatusCK NVARCHAR(200);
    SELECT @AttStatusCK = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.Attendances') AND definition LIKE '%Status%';

    IF @AttStatusCK IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Attendances DROP CONSTRAINT ' + @AttStatusCK);
        PRINT N'-> Đã gỡ bỏ ràng buộc cũ CK_Attendances_Status.';
    END
END

ALTER TABLE dbo.Attendances 
ADD CONSTRAINT CK_Attendances_Status 
CHECK (Status IN ('on_time', 'late', 'early_leave', 'absent', 'missing_punch', 'leave', 'incomplete'));
PRINT N'-> Đã nâng cấp ràng buộc CK_Attendances_Status (hỗ trợ on_time, late, early_leave, absent, missing_punch, leave, incomplete).';
GO

-- 1.4 Mở rộng ràng buộc CK_Employees_Status để hỗ trợ trạng thái 'suspended' (Tạm hoãn)
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id = OBJECT_ID('dbo.Employees') AND definition LIKE '%Status%')
BEGIN
    DECLARE @EmpStatusCK NVARCHAR(200);
    SELECT @EmpStatusCK = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.Employees') AND definition LIKE '%Status%';

    IF @EmpStatusCK IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Employees DROP CONSTRAINT ' + @EmpStatusCK);
        PRINT N'-> Đã gỡ bỏ ràng buộc cũ CK_Employees_Status.';
    END
END

ALTER TABLE dbo.Employees 
ADD CONSTRAINT CK_Employees_Status 
CHECK (Status IN ('active', 'resigned', 'suspended'));
PRINT N'-> Đã nâng cấp ràng buộc CK_Employees_Status (hỗ trợ active, resigned, suspended).';
GO

-- =======================================================================================
-- PHẦN 2: BẢNG DANH MỤC NGÀY LỄ TẾT QUỐC GIA (Holidays)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Holidays')
BEGIN
    CREATE TABLE dbo.Holidays (
        HolidayId       INT IDENTITY(1,1) NOT NULL,
        HolidayDate     DATE NOT NULL,
        HolidayName     NVARCHAR(150) NOT NULL,
        [Year]          INT NOT NULL,
        PayMultiplier   DECIMAL(3,2) NOT NULL CONSTRAINT DF_Holidays_Multiplier DEFAULT 3.00, -- Hệ số lương ngày lễ x300%
        IsPaid          BIT NOT NULL CONSTRAINT DF_Holidays_IsPaid DEFAULT 1,                 -- Mặc định được hưởng nguyên lương
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_Holidays_CreatedAt DEFAULT SYSDATETIME(),

        CONSTRAINT PK_Holidays PRIMARY KEY CLUSTERED (HolidayId),
        CONSTRAINT UQ_Holidays_Date UNIQUE (HolidayDate)
    );
    PRINT N'-> Đã tạo mới bảng dbo.Holidays.';

    CREATE NONCLUSTERED INDEX IX_Holidays_Year ON dbo.Holidays([Year]) INCLUDE (HolidayDate, HolidayName, PayMultiplier);
    PRINT N'-> Đã tạo chỉ mục IX_Holidays_Year.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.Holidays đã tồn tại.';
END
GO

-- =======================================================================================
-- PHẦN 3: BẢNG CHI TIẾT LÀM THÊM GIỜ (EmployeeOvertimes - PHƯƠNG ÁN 2)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeOvertimes')
BEGIN
    CREATE TABLE dbo.EmployeeOvertimes (
        OvertimeId      INT IDENTITY(1,1) NOT NULL,
        EmployeeId      INT NOT NULL,
        BranchId        INT NOT NULL,
        AttendanceId    INT NULL,                                                         -- Có thể liên kết ca quẹt thẻ hôm đó
        WorkDate        DATE NOT NULL,
        StartTime       TIME(0) NOT NULL,                                                 -- Khung giờ bắt đầu OT (VD: 17:30)
        EndTime         TIME(0) NOT NULL,                                                 -- Khung giờ kết thúc OT (VD: 20:30)
        [Hours]         DECIMAL(4,2) NOT NULL,                                            -- Số giờ làm thêm (VD: 3.00)
        OTType          VARCHAR(20) NOT NULL,                                             -- 'normal' (ngày thường), 'weekend' (cuối tuần), 'holiday' (lễ tết)
        PayMultiplier   DECIMAL(3,2) NOT NULL CONSTRAINT DF_EmployeeOvertimes_Multiplier DEFAULT 1.50, -- Hệ số: 1.5, 2.0, 3.0
        Reason          NVARCHAR(500) NULL,                                               -- Lý do tăng ca (khách đông, cover ca, kiểm kê kho)
        ApprovalStatus  VARCHAR(20) NOT NULL CONSTRAINT DF_EmployeeOvertimes_Status DEFAULT 'pending',
        ApprovedBy      INT NULL,                                                         -- Quản lý ca / Cửa hàng trưởng duyệt
        ApprovedAt      DATETIME2(0) NULL,
        Note            NVARCHAR(500) NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeOvertimes_CreatedAt DEFAULT SYSDATETIME(),
        CreatedBy       INT NULL,

        CONSTRAINT PK_EmployeeOvertimes PRIMARY KEY CLUSTERED (OvertimeId),
        CONSTRAINT FK_EmployeeOvertimes_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT FK_EmployeeOvertimes_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_EmployeeOvertimes_Attendances FOREIGN KEY (AttendanceId) REFERENCES dbo.Attendances(AttendanceId),
        CONSTRAINT FK_EmployeeOvertimes_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT CK_EmployeeOvertimes_Hours CHECK ([Hours] > 0.00 AND [Hours] <= 24.00),
        CONSTRAINT CK_EmployeeOvertimes_OTType CHECK (OTType IN ('normal', 'weekend', 'holiday')),
        CONSTRAINT CK_EmployeeOvertimes_Status CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected', 'cancelled'))
    );
    PRINT N'-> Đã tạo mới bảng dbo.EmployeeOvertimes (Phương án 2).';

    CREATE NONCLUSTERED INDEX IX_EmployeeOvertimes_Date_Emp 
    ON dbo.EmployeeOvertimes(WorkDate, EmployeeId) 
    INCLUDE ([Hours], OTType, PayMultiplier, ApprovalStatus, BranchId);

    CREATE NONCLUSTERED INDEX IX_EmployeeOvertimes_Branch_Status 
    ON dbo.EmployeeOvertimes(BranchId, ApprovalStatus, WorkDate);

    PRINT N'-> Đã tạo các chỉ mục tối ưu cho dbo.EmployeeOvertimes.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.EmployeeOvertimes đã tồn tại.';
END
GO

-- =======================================================================================
-- PHẦN 4: BẢNG QUẢN LÝ ĐƠN & NGÀY NGHỈ PHÉP (EmployeeLeaves)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeLeaves')
BEGIN
    CREATE TABLE dbo.EmployeeLeaves (
        LeaveId         INT IDENTITY(1,1) NOT NULL,
        EmployeeId      INT NOT NULL,
        BranchId        INT NOT NULL,
        FromDate        DATE NOT NULL,
        ToDate          DATE NOT NULL,
        LeaveDays       DECIMAL(4,2) NOT NULL,                                            -- Số ngày nghỉ (VD: 0.5 ngày hoặc 1.0, 2.0 ngày)
        LeaveType       VARCHAR(30) NOT NULL,                                             -- 'annual', 'holiday', 'special_paid', 'unpaid', 'sick', 'maternity'
        IsPaid          BIT NOT NULL CONSTRAINT DF_EmployeeLeaves_IsPaid DEFAULT 1,       -- 1 = Hưởng lương, 0 = Không hưởng lương
        Reason          NVARCHAR(500) NULL,
        ApprovalStatus  VARCHAR(20) NOT NULL CONSTRAINT DF_EmployeeLeaves_Status DEFAULT 'pending',
        ApprovedBy      INT NULL,
        ApprovedAt      DATETIME2(0) NULL,
        CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeLeaves_CreatedAt DEFAULT SYSDATETIME(),

        CONSTRAINT PK_EmployeeLeaves PRIMARY KEY CLUSTERED (LeaveId),
        CONSTRAINT FK_EmployeeLeaves_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT FK_EmployeeLeaves_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_EmployeeLeaves_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT CK_EmployeeLeaves_Days CHECK (LeaveDays > 0.00),
        CONSTRAINT CK_EmployeeLeaves_Type CHECK (LeaveType IN ('annual', 'holiday', 'special_paid', 'unpaid', 'sick', 'maternity')),
        CONSTRAINT CK_EmployeeLeaves_Status CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected', 'cancelled'))
    );
    PRINT N'-> Đã tạo mới bảng dbo.EmployeeLeaves.';

    CREATE NONCLUSTERED INDEX IX_EmployeeLeaves_Dates_Emp 
    ON dbo.EmployeeLeaves(FromDate, ToDate, EmployeeId) 
    INCLUDE (LeaveDays, LeaveType, IsPaid, ApprovalStatus, BranchId);

    PRINT N'-> Đã tạo chỉ mục tối ưu cho dbo.EmployeeLeaves.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.EmployeeLeaves đã tồn tại.';
END
GO

-- =======================================================================================
-- PHẦN 5: BẢNG QUẢN TRỊ QUỸ PHÉP NĂM NHÂN SỰ (EmployeeAnnualLeaves)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeAnnualLeaves')
BEGIN
    CREATE TABLE dbo.EmployeeAnnualLeaves (
        AnnualLeaveId   INT IDENTITY(1,1) NOT NULL,
        EmployeeId      INT NOT NULL,
        [Year]          INT NOT NULL,
        StandardDays    DECIMAL(4,1) NOT NULL CONSTRAINT DF_EmployeeAnnualLeaves_Standard DEFAULT 12.0, -- Tiêu chuẩn 12 ngày/năm
        SeniorityDays   DECIMAL(4,1) NOT NULL CONSTRAINT DF_EmployeeAnnualLeaves_Seniority DEFAULT 0.0, -- Thâm niên (cứ 5 năm làm việc +1 ngày)
        CarriedOverDays DECIMAL(4,1) NOT NULL CONSTRAINT DF_EmployeeAnnualLeaves_Carried DEFAULT 0.0,   -- Tồn năm cũ chuyển qua
        TotalDays       AS (StandardDays + SeniorityDays + CarriedOverDays) PERSISTED,                  -- Tổng quỹ phép năm
        UsedDays        DECIMAL(4,1) NOT NULL CONSTRAINT DF_EmployeeAnnualLeaves_Used DEFAULT 0.0,      -- Đã nghỉ trong năm
        RemainingDays   AS ((StandardDays + SeniorityDays + CarriedOverDays) - UsedDays) PERSISTED,     -- Còn lại
        Note            NVARCHAR(500) NULL,
        LastUpdated     DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeAnnualLeaves_Updated DEFAULT SYSDATETIME(),

        CONSTRAINT PK_EmployeeAnnualLeaves PRIMARY KEY CLUSTERED (AnnualLeaveId),
        CONSTRAINT FK_EmployeeAnnualLeaves_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT UQ_EmployeeAnnualLeaves_Emp_Year UNIQUE (EmployeeId, [Year]),
        CONSTRAINT CK_EmployeeAnnualLeaves_Year CHECK ([Year] BETWEEN 2000 AND 2100),
        CONSTRAINT CK_EmployeeAnnualLeaves_NonNegative CHECK (StandardDays >= 0 AND SeniorityDays >= 0 AND CarriedOverDays >= 0 AND UsedDays >= 0)
    );
    PRINT N'-> Đã tạo mới bảng dbo.EmployeeAnnualLeaves.';

    CREATE NONCLUSTERED INDEX IX_EmployeeAnnualLeaves_Year_Emp 
    ON dbo.EmployeeAnnualLeaves([Year], EmployeeId) 
    INCLUDE (TotalDays, UsedDays, RemainingDays);

    PRINT N'-> Đã tạo chỉ mục tối ưu cho dbo.EmployeeAnnualLeaves.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.EmployeeAnnualLeaves đã tồn tại.';
END
GO

-- =======================================================================================
-- PHẦN 6: SEED DỮ LIỆU DANH MỤC LỄ TẾT VIỆT NAM (2016 - 2026) VÀO BẢNG Holidays
-- =======================================================================================
PRINT N'-> Nạp danh mục ngày lễ quốc gia (2016 - 2026)...';

DECLARE @HolidaysList TABLE (
    HDate DATE,
    HName NVARCHAR(150),
    HYear INT,
    Multiplier DECIMAL(3,2),
    Paid BIT
);

-- Danh mục các ngày lễ dương lịch cố định từ 2016 đến 2026:
-- Tết Dương Lịch (01/01), Ngày Chiến thắng (30/04), Quốc tế Lao động (01/05), Quốc khánh (02/09)
DECLARE @y INT = 2016;
WHILE @y <= 2026
BEGIN
    INSERT INTO @HolidaysList (HDate, HName, HYear, Multiplier, Paid)
    VALUES 
        (DATEFROMPARTS(@y, 1, 1), N'Tết Dương Lịch', @y, 3.00, 1),
        (DATEFROMPARTS(@y, 4, 30), N'Ngày Giải phóng miền Nam (30/4)', @y, 3.00, 1),
        (DATEFROMPARTS(@y, 5, 1), N'Ngày Quốc tế Lao động (1/5)', @y, 3.00, 1),
        (DATEFROMPARTS(@y, 9, 2), N'Ngày Quốc khánh (2/9)', @y, 3.00, 1),
        (DATEFROMPARTS(@y, 9, 3), N'Ngày nghỉ liền kề Quốc khánh', @y, 3.00, 1);
    
    SET @y = @y + 1;
END

-- Bổ sung các ngày Lễ Âm Lịch tiêu biểu (Tết Nguyên Đán & Giỗ Tổ Hùng Vương) các năm chính:
-- Năm 2026:
INSERT INTO @HolidaysList VALUES 
    ('2026-02-16', N'Tết Nguyên Đán (29 Tết Bính Ngọ)', 2026, 3.00, 1),
    ('2026-02-17', N'Tết Nguyên Đán (30 Tết Bính Ngọ)', 2026, 3.00, 1),
    ('2026-02-18', N'Tết Nguyên Đán (Mùng 1 Tết Bính Ngọ)', 2026, 3.00, 1),
    ('2026-02-19', N'Tết Nguyên Đán (Mùng 2 Tết Bính Ngọ)', 2026, 3.00, 1),
    ('2026-02-20', N'Tết Nguyên Đán (Mùng 3 Tết Bính Ngọ)', 2026, 3.00, 1),
    ('2026-04-26', N'Giỗ Tổ Hùng Vương (10/3 ÂL)', 2026, 3.00, 1);

-- Năm 2025:
INSERT INTO @HolidaysList VALUES 
    ('2025-01-28', N'Tết Nguyên Đán (29 Tết Ất Tỵ)', 2025, 3.00, 1),
    ('2025-01-29', N'Tết Nguyên Đán (Mùng 1 Tết Ất Tỵ)', 2025, 3.00, 1),
    ('2025-01-30', N'Tết Nguyên Đán (Mùng 2 Tết Ất Tỵ)', 2025, 3.00, 1),
    ('2025-01-31', N'Tết Nguyên Đán (Mùng 3 Tết Ất Tỵ)', 2025, 3.00, 1),
    ('2025-04-07', N'Giỗ Tổ Hùng Vương (10/3 ÂL)', 2025, 3.00, 1);

-- Merge vào bảng Holidays để tránh trùng lặp
MERGE INTO dbo.Holidays AS TARGET
USING @HolidaysList AS SOURCE
ON TARGET.HolidayDate = SOURCE.HDate
WHEN MATCHED THEN
    UPDATE SET 
        TARGET.HolidayName = SOURCE.HName,
        TARGET.[Year] = SOURCE.HYear,
        TARGET.PayMultiplier = SOURCE.Multiplier,
        TARGET.IsPaid = SOURCE.Paid
WHEN NOT MATCHED THEN
    INSERT (HolidayDate, HolidayName, [Year], PayMultiplier, IsPaid)
    VALUES (SOURCE.HDate, SOURCE.HName, SOURCE.HYear, SOURCE.Multiplier, SOURCE.Paid);

PRINT N'-> Đã đồng bộ danh mục ngày lễ Việt Nam vào bảng Holidays thành công.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG RELEASE 11: CẤU TRÚC BẢNG CHẤM CÔNG, LÀM THÊM GIỜ & NGHỈ PHÉP';
PRINT N'=======================================================================================';
GO
