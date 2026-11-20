-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN (COFFEE SHOP MANAGEMENT SYSTEM)
-- RELEASE 13: KỊCH BẢN TỔNG HỢP RESET & SEED DỮ LIỆU TOÀN DIỆN (MASTER SEED 2022 - 2026)
-- QUY MÔ:
--   - 5 CHI NHÁNH (4 CỬA HÀNG BÁN LẺ + 1 TRỤ SỞ CHÍNH / VĂN PHÒNG TỔNG)
--   - 132 HỒ SƠ NHÂN SỰ (93 ACTIVE, 34 RESIGNED, 5 SUSPENDED)
--   - 5 CA LÀM VIỆC CHUẨN (SÁNG, CHIỀU, TỐI, GÃY/CAO ĐIỂM, FULL-TIME)
--   - ĐẦY ĐỦ: PHÂN CA, CHẤM CÔNG, TĂNG CA, NGHỈ PHÉP, QUỸ PHÉP, KỲ LƯƠNG & PHIẾU LƯƠNG
-- HỆ QUẢN TRỊ CSDL: MICROSOFT SQL SERVER 2022 / 2025
-- DATABASE: CoffeeShopDB
-- FILE: src/database/13_seed_master_hrm_2022_2026.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 13: DỌN DẸP & NẠP DỮ LIỆU LỊCH SỬ 2022 - 2026';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- BƯỚC 1: DỌN DẸP AN TOÀN TOÀN BỘ DỮ LIỆU HRM CŨ THEO ĐÚNG THỨ TỰ RÀNG BUỘC KHÓA NGOẠI
-- =======================================================================================
PRINT N'1. Đang dọn dẹp dữ liệu cũ...';

-- Vô hiệu hóa tất cả trigger trên các bảng HRM để quá trình xóa sạch diễn ra an toàn tuyệt đối
DISABLE TRIGGER ALL ON dbo.PayrollSlips;
IF OBJECT_ID('dbo.PayrollPeriods', 'U') IS NOT NULL DISABLE TRIGGER ALL ON dbo.PayrollPeriods;
DISABLE TRIGGER ALL ON dbo.ShiftAssignments;
DISABLE TRIGGER ALL ON dbo.Employees;
DISABLE TRIGGER ALL ON dbo.Attendances;
DISABLE TRIGGER ALL ON dbo.EmployeeOvertimes;
DISABLE TRIGGER ALL ON dbo.EmployeeLeaves;
DISABLE TRIGGER ALL ON dbo.EmployeeAnnualLeaves;

-- Mở khóa tất cả các kỳ lương đang bị khóa sổ
UPDATE dbo.PayrollPeriods SET IsLocked = 0;

-- Xóa dữ liệu theo thứ tự phụ thuộc khóa ngoại
DELETE FROM dbo.EmployeeOvertimes;
DELETE FROM dbo.EmployeeLeaves;
DELETE FROM dbo.EmployeeAnnualLeaves;
DELETE FROM dbo.PayrollSlips;
DELETE FROM dbo.PayrollPeriods;
DELETE FROM dbo.Attendances;
DELETE FROM dbo.ShiftAssignments;
DELETE FROM dbo.EmployeeContracts;

-- Xóa dữ liệu phê duyệt nếu có
IF OBJECT_ID('dbo.ApprovalSteps', 'U') IS NOT NULL DELETE FROM dbo.ApprovalSteps;
IF OBJECT_ID('dbo.ApprovalRequests', 'U') IS NOT NULL DELETE FROM dbo.ApprovalRequests;
IF OBJECT_ID('dbo.Approvers', 'U') IS NOT NULL DELETE FROM dbo.Approvers;

-- Xóa danh sách nhân viên cũ và ca làm việc cũ
DELETE FROM dbo.Employees;
DELETE FROM dbo.ShiftTemplates;

-- Reset Identity seed về 0 để ID tự tăng bắt đầu từ 1
DBCC CHECKIDENT ('dbo.ShiftTemplates', RESEED, 0);
DBCC CHECKIDENT ('dbo.Employees', RESEED, 0);
DBCC CHECKIDENT ('dbo.ShiftAssignments', RESEED, 0);
DBCC CHECKIDENT ('dbo.Attendances', RESEED, 0);
DBCC CHECKIDENT ('dbo.EmployeeOvertimes', RESEED, 0);
DBCC CHECKIDENT ('dbo.EmployeeLeaves', RESEED, 0);
DBCC CHECKIDENT ('dbo.EmployeeAnnualLeaves', RESEED, 0);
DBCC CHECKIDENT ('dbo.PayrollPeriods', RESEED, 0);
DBCC CHECKIDENT ('dbo.PayrollSlips', RESEED, 0);

PRINT N'-> Đã làm sạch toàn bộ dữ liệu HRM cũ và thiết lập lại Identity seeds.';
GO

-- =======================================================================================
-- BƯỚC 2: CẬP NHẬT 5 CHI NHÁNH CHUẨN (4 QUÁN CÀ PHÊ + 1 TRỤ SỞ VĂN PHÒNG TỔNG)
-- =======================================================================================
PRINT N'2. Thiết lập 5 Chi nhánh hệ thống...';

SET IDENTITY_INSERT dbo.Branches ON;

MERGE INTO dbo.Branches AS TARGET
USING (
    VALUES 
        (1, 'CN-Q1', N'Fiin Đinh Tiên Hoàng', N'12 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1, TP.HCM', '028 3822 1101', 1),
        (2, 'CN-Q3', N'Fiin Hồ Con Rùa', N'42 Trần Cao Vân, Phường 6, Quận 3, TP.HCM', '028 3822 1102', 1),
        (3, 'CN-THUDUC', N'Fiin Võ Văn Ngân', N'108 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM', '028 3822 1103', 1),
        (4, 'CN-BINHTHANH', N'Fiin Phan Xích Long', N'56 Phan Xích Long, Phường 2, Quận Bình Thạnh, TP.HCM', '028 3822 1104', 1),
        (5, 'CN-HQ', N'Trụ sở chính / Văn phòng Tổng Fiin', N'100 Nguyễn Thị Minh Khai, Phường Bến Nghé, Quận 1, TP.HCM', '028 3822 9999', 1)
) AS SOURCE (BranchId, BranchCode, BranchName, Address, PhoneNumber, IsActive)
ON TARGET.BranchId = SOURCE.BranchId
WHEN MATCHED THEN
    UPDATE SET 
        TARGET.BranchCode = SOURCE.BranchCode,
        TARGET.BranchName = SOURCE.BranchName,
        TARGET.Address = SOURCE.Address,
        TARGET.PhoneNumber = SOURCE.PhoneNumber,
        TARGET.IsActive = SOURCE.IsActive
WHEN NOT MATCHED THEN
    INSERT (BranchId, BranchCode, BranchName, Address, PhoneNumber, IsActive)
    VALUES (SOURCE.BranchId, SOURCE.BranchCode, SOURCE.BranchName, SOURCE.Address, SOURCE.PhoneNumber, SOURCE.IsActive);

SET IDENTITY_INSERT dbo.Branches OFF;
PRINT N'-> Đã hoàn thiện danh mục 5 Chi nhánh (BranchId 1..5).';
GO

-- =======================================================================================
-- BƯỚC 3: CẬP NHẬT 5 CA LÀM VIỆC CHUẨN (ShiftTemplates)
-- =======================================================================================
PRINT N'3. Thiết lập 5 Ca làm việc chuẩn...';

SET IDENTITY_INSERT dbo.ShiftTemplates ON;

INSERT INTO dbo.ShiftTemplates (TemplateId, ShiftCode, ShiftName, StartTime, EndTime, StandardHours, BreakMinutes, IsActive)
VALUES 
    (1, 'CA-SANG',  N'Ca Sáng (Mở quán & Cafe sáng)',       '06:30:00', '12:00:00', 5.50, 0,  1),
    (2, 'CA-CHIEU', N'Ca Chiều (Giờ cao điểm văn phòng)',   '12:00:00', '17:30:00', 5.50, 0,  1),
    (3, 'CA-TOI',   N'Ca Tối (Gặp gỡ & Đóng quán vệ sinh)',  '17:30:00', '23:00:00', 5.50, 0,  1),
    (4, 'CA-GAY',   N'Ca Gãy (Tăng cường trưa & tối)',       '11:00:00', '15:30:00', 4.50, 0,  1),
    (5, 'CA-FULL',  N'Ca Toàn thời gian (Quản lý & VP)',    '08:00:00', '17:00:00', 8.00, 60, 1);

SET IDENTITY_INSERT dbo.ShiftTemplates OFF;
PRINT N'-> Đã nạp 5 Ca làm việc chuẩn (TemplateId 1..5).';
GO

-- =======================================================================================
-- BƯỚC 4: NẠP 132 HỒ SƠ NHÂN SỰ TOÀN HỆ THỐNG
-- =======================================================================================
PRINT N'4. Đang nạp danh sách 132 nhân sự toàn chuỗi...';

IF OBJECT_ID('tempdb..#RawEmployees') IS NOT NULL DROP TABLE #RawEmployees;

CREATE TABLE #RawEmployees (
    EmpId           INT PRIMARY KEY,
    EmpCode         VARCHAR(20),
    FullName        NVARCHAR(100),
    Position        NVARCHAR(100),
    BranchId        INT,
    HireDate        DATE,
    HourlyRate      DECIMAL(18,2),
    ContractType    VARCHAR(20),
    Gender          VARCHAR(10),
    DOB             DATE,
    CitizenId       VARCHAR(20),
    Phone           VARCHAR(20),
    BankName        NVARCHAR(100),
    BankAccNumber   VARCHAR(30),
    [Status]        VARCHAR(20),
    ResignDate      DATE NULL,
    SuspendStart    DATE NULL,
    SuspendEnd      DATE NULL,
    Note            NVARCHAR(500)
);

-- 4.1 Khối Văn phòng Tổng (BranchId = 5, EmpId 1..18)
INSERT INTO #RawEmployees VALUES
(1,  'NV001', N'Trần Minh Hoàng',     N'Giám đốc Chuỗi (CEO)',                  5, '2022-01-01', 75000.00, 'full_time', 'male',   '1985-04-12', '079085001234', '0903111001', N'Vietcombank', '007100111001', 'active',    NULL, NULL, NULL, N'Đồng sáng lập & Điều hành chuỗi'),
(2,  'NV002', N'Lê Thanh Tùng',       N'Giám đốc Vận hành (COO)',               5, '2022-01-01', 58000.00, 'full_time', 'male',   '1988-09-20', '079088002345', '0903111002', N'Vietcombank', '007100111002', 'active',    NULL, NULL, NULL, N'Phụ trách tiêu chuẩn SOP 4 cửa hàng'),
(3,  'NV003', N'Đỗ Thị Kim Ngân',     N'Trưởng phòng Nhân sự (HRM)',            5, '2022-01-15', 45000.00, 'full_time', 'female', '1990-11-05', '079190003456', '0903111003', N'Techcombank', '190300111003', 'active',    NULL, NULL, NULL, N'Phụ trách HRM & Hợp đồng lao động'),
(4,  'NV004', N'Nguyễn Văn Phúc',     N'Chuyên viên Tuyển dụng & Đào tạo',     5, '2022-03-01', 35000.00, 'full_time', 'male',   '1994-06-18', '079094004567', '0903111004', N'Techcombank', '190300111004', 'active',    NULL, NULL, NULL, N'Tuyển dụng Barista & Thu ngân'),
(5,  'NV005', N'Hoàng Thùy Linh',     N'Chuyên viên Tiền lương & Phúc lợi (C&B)', 5, '2022-04-10', 36000.00, 'full_time', 'female', '1993-02-28', '079193005678', '0903111005', N'MB Bank',      '080100111005', 'active',    NULL, NULL, NULL, N'Chốt công & tính bảng lương'),
(6,  'NV006', N'Phạm Ngọc Mai',       N'Chuyên viên Tuyển dụng cũ',             5, '2022-02-01', 32000.00, 'full_time', 'female', '1995-10-15', '079195006789', '0903111006', N'ACB',          '210100111006', 'resigned',  '2023-08-31', NULL, NULL, N'Nghỉ việc định cư nước ngoài'),
(7,  'NV007', N'Vũ Đình Trọng',       N'Kế toán trưởng (Chief Accountant)',    5, '2022-01-15', 52000.00, 'full_time', 'male',   '1987-07-25', '079087007890', '0903111007', N'Vietcombank', '007100111007', 'active',    NULL, NULL, NULL, N'Kiểm soát dòng tiền & Báo cáo thuế'),
(8,  'NV008', N'Bùi Thị Mai Hương',   N'Kế toán Tổng hợp & Thuế',               5, '2022-03-15', 38000.00, 'full_time', 'female', '1991-12-10', '079191008901', '0903111008', N'Vietcombank', '007100111008', 'active',    NULL, NULL, NULL, N'Báo cáo hóa đơn & Thuế GTGT'),
(9,  'NV009', N'Đặng Quốc Dũng',      N'Kế toán Kho & Giá thành (ERP)',        5, '2022-05-01', 35000.00, 'full_time', 'male',   '1993-08-14', '079093009012', '0903111009', N'BIDV',         '310100111009', 'active',    NULL, NULL, NULL, N'Đối soát định lượng kho nguyên liệu 4 quán'),
(10, 'NV010', N'Trương Mỹ Duyên',     N'Kế toán Thanh toán',                    5, '2023-02-15', 32000.00, 'full_time', 'female', '1996-03-22', '079196010123', '0903111010', N'Techcombank', '190300111010', 'active',    NULL, NULL, NULL, N'Thanh toán nhà cung cấp sữa & cà phê'),
(11, 'NV011', N'Nguyễn Thu Hà',       N'Kế toán viên',                          5, '2023-06-01', 30000.00, 'full_time', 'female', '1997-09-08', '079197011234', '0903111011', N'MB Bank',      '080100111011', 'suspended', NULL, '2026-06-01', '2026-11-30', N'Nghỉ chế độ thai sản 6 tháng'),
(12, 'NV012', N'Lý Hải Long',         N'Kế toán Kho cũ',                        5, '2022-06-01', 32000.00, 'full_time', 'male',   '1994-01-30', '079094012345', '0903111012', N'ACB',          '210100111012', 'resigned',  '2024-04-30', NULL, NULL, N'Chuyển công tác về quê'),
(13, 'NV013', N'Cao Thái Sơn',        N'Trưởng nhóm Marketing (CMS)',           5, '2022-03-01', 42000.00, 'full_time', 'male',   '1991-05-19', '079091013456', '0903111013', N'Vietcombank', '007100111013', 'active',    NULL, NULL, NULL, N'Quản trị chiến dịch truyền thông & CMS'),
(14, 'NV014', N'Phan Mỹ Hạnh',        N'Chuyên viên Sáng tạo Nội dung / Web',   5, '2022-08-01', 32000.00, 'full_time', 'female', '1996-11-12', '079196014567', '0903111014', N'Techcombank', '190300111014', 'active',    NULL, NULL, NULL, N'Viết bài blog & cập nhật banner CMS'),
(15, 'NV015', N'Võ Thành Đạt',        N'Chuyên viên Thiết kế đồ họa (Graphic)', 5, '2023-04-01', 34000.00, 'full_time', 'male',   '1995-07-04', '079095015678', '0903111015', N'VPBank',       '150100111015', 'active',    NULL, NULL, NULL, N'Thiết kế menu vintage, ấn phẩm quán'),
(16, 'NV016', N'Đinh Thu Trang',      N'Content Creator cũ',                    5, '2022-05-15', 30000.00, 'full_time', 'female', '1998-04-20', '079198016789', '0903111016', N'Techcombank', '190300111016', 'resigned',  '2024-07-31', NULL, NULL, N'Hết hạn hợp đồng 2 năm'),
(17, 'NV017', N'Lâm Thảo My',         N'Trưởng nhóm CSKH & Loyalty (CRM)',      5, '2022-04-01', 38000.00, 'full_time', 'female', '1992-10-30', '079192017890', '0903111017', N'Vietcombank', '007100111017', 'active',    NULL, NULL, NULL, N'Quản trị hạng thành viên CRM & Voucher'),
(18, 'NV018', N'Huỳnh Quốc Bảo',      N'Chuyên viên CSKH & Hội viên',           5, '2023-01-10', 29000.00, 'full_time', 'male',   '1997-02-15', '079097018901', '0903111018', N'MB Bank',      '080100111018', 'active',    NULL, NULL, NULL, N'Giải đáp hotline & khiếu nại khách hàng');

-- 4.2 Sinh danh sách nhân viên 4 Quán cà phê (EmpId 19..132)
DECLARE @FirstNames TABLE (ID INT IDENTITY(1,1), Name NVARCHAR(50), Gender VARCHAR(10));
INSERT INTO @FirstNames (Name, Gender) VALUES 
(N'Nguyễn', 'male'), (N'Trần', 'female'), (N'Lê', 'male'), (N'Phạm', 'female'), 
(N'Hoàng', 'male'), (N'Huỳnh', 'female'), (N'Phan', 'male'), (N'Vũ', 'female'), 
(N'Võ', 'male'), (N'Đặng', 'female'), (N'Bùi', 'male'), (N'Đỗ', 'female');

DECLARE @MiddleNames TABLE (ID INT IDENTITY(1,1), Name NVARCHAR(50));
INSERT INTO @MiddleNames (Name) VALUES 
(N'Văn'), (N'Thị'), (N'Hữu'), (N'Ngọc'), (N'Thanh'), (N'Minh'), (N'Đức'), (N'Quốc'), (N'Kim'), (N'Hải'), (N'Gia'), (N'Bảo');

DECLARE @LastNames TABLE (ID INT IDENTITY(1,1), Name NVARCHAR(50));
INSERT INTO @LastNames (Name) VALUES 
(N'An'), (N'Bình'), (N'Cường'), (N'Dương'), (N'Dung'), (N'Giang'), (N'Hương'), (N'Hùng'), 
(N'Khánh'), (N'Khoa'), (N'Linh'), (N'Long'), (N'Nam'), (N'Nhi'), (N'Phong'), (N'Phúc'), 
(N'Quân'), (N'Quỳnh'), (N'Sơn'), (N'Tài'), (N'Thảo'), (N'Tâm'), (N'Thịnh'), (N'Trang'), 
(N'Tuấn'), (N'Tú'), (N'Việt'), (N'Vinh'), (N'Vy'), (N'Yến');

DECLARE @EmpCounter INT = 19;
DECLARE @b INT = 1;

WHILE @b <= 4
BEGIN
    DECLARE @i INT = 1;
    WHILE @i <= 29
    BEGIN
        -- Chi nhánh 2 và 3 có 28 người
        IF (@b = 2 OR @b = 3) AND @i = 29
        BEGIN
            SET @i = @i + 1;
            CONTINUE;
        END

        DECLARE @Position NVARCHAR(100);
        DECLARE @ContractType VARCHAR(20) = 'full_time';
        DECLARE @HourlyRate DECIMAL(18,2) = 28000.00;
        DECLARE @Status VARCHAR(20) = 'active';
        DECLARE @HireDate DATE;
        DECLARE @ResignDate DATE = NULL;
        DECLARE @SuspendStart DATE = NULL;
        DECLARE @SuspendEnd DATE = NULL;

        DECLARE @BranchOpenDate DATE = CASE 
            WHEN @b IN (1, 2) THEN '2022-01-01'
            WHEN @b = 3 THEN '2023-03-01'
            ELSE '2024-01-01'
        END;

        IF @i = 1 -- Cửa hàng trưởng
        BEGIN
            SET @Position = N'Cửa hàng trưởng (Store Manager)';
            SET @HourlyRate = 42000.00;
            SET @HireDate = @BranchOpenDate;
        END
        ELSE IF @i IN (2, 3) -- Trưởng ca
        BEGIN
            SET @Position = N'Trưởng ca Pha chế (Shift Leader)';
            SET @HourlyRate = 34000.00;
            SET @HireDate = DATEADD(MONTH, @i, @BranchOpenDate);
        END
        ELSE IF @i BETWEEN 4 AND 7 -- Barista chính
        BEGIN
            SET @Position = N'Barista Chuyên nghiệp';
            SET @HourlyRate = 29000.00;
            SET @HireDate = DATEADD(MONTH, @i * 2, @BranchOpenDate);
        END
        ELSE IF @i BETWEEN 8 AND 10 -- Barista phụ
        BEGIN
            SET @Position = N'Barista Học việc / Phụ bar';
            SET @ContractType = 'part_time';
            SET @HourlyRate = 25000.00;
            SET @HireDate = DATEADD(MONTH, @i + 4, @BranchOpenDate);
        END
        ELSE IF @i BETWEEN 11 AND 14 -- Thu ngân
        BEGIN
            SET @Position = N'Thu ngân bán hàng POS';
            SET @HourlyRate = 27000.00;
            SET @HireDate = DATEADD(MONTH, @i, @BranchOpenDate);
        END
        ELSE IF @i BETWEEN 15 AND 20 -- Phục vụ bàn
        BEGIN
            SET @Position = N'Nhân viên Phục vụ & Chăm sóc bàn';
            SET @ContractType = 'part_time';
            SET @HourlyRate = 23000.00;
            SET @HireDate = DATEADD(MONTH, @i - 5, @BranchOpenDate);
        END
        ELSE IF @i = 21 -- Tạm hoãn (Suspended)
        BEGIN
            SET @Position = N'Nhân viên Phục vụ bàn';
            SET @ContractType = 'part_time';
            SET @HourlyRate = 23000.00;
            SET @Status = 'suspended';
            SET @HireDate = DATEADD(MONTH, 3, @BranchOpenDate);
            SET @SuspendStart = '2026-05-01';
            SET @SuspendEnd = '2026-10-31';
        END
        ELSE -- Nhân viên đã nghỉ việc (Resigned 22..29)
        BEGIN
            SET @Position = CASE (@i % 3)
                WHEN 0 THEN N'Nhân viên Phục vụ bàn'
                WHEN 1 THEN N'Barista Học việc'
                ELSE N'Thu ngân bán hàng POS'
            END;
            SET @ContractType = 'part_time';
            SET @HourlyRate = 24000.00;
            SET @Status = 'resigned';
            SET @HireDate = DATEADD(MONTH, (@i - 20) * 3, @BranchOpenDate);
            SET @ResignDate = DATEADD(MONTH, (@i - 20) * 3 + 10, @BranchOpenDate);
            IF @ResignDate > '2026-10-31' SET @ResignDate = '2026-08-31';
        END

        DECLARE @fn NVARCHAR(50) = (SELECT Name FROM @FirstNames WHERE ID = ((@EmpCounter * 7) % 12) + 1);
        DECLARE @mn NVARCHAR(50) = (SELECT Name FROM @MiddleNames WHERE ID = ((@EmpCounter * 5) % 12) + 1);
        DECLARE @ln NVARCHAR(50) = (SELECT Name FROM @LastNames WHERE ID = ((@EmpCounter * 3) % 30) + 1);
        DECLARE @EmpName NVARCHAR(100) = @fn + N' ' + @mn + N' ' + @ln;
        DECLARE @Gender VARCHAR(10) = CASE WHEN @mn IN (N'Thị', N'Ngọc', N'Kim') THEN 'female' ELSE 'male' END;

        INSERT INTO #RawEmployees VALUES (
            @EmpCounter,
            'NV' + RIGHT('000' + CAST(@EmpCounter AS VARCHAR(10)), 3),
            @EmpName,
            @Position,
            @b,
            @HireDate,
            @HourlyRate,
            @ContractType,
            @Gender,
            DATEFROMPARTS(1995 + (@EmpCounter % 8), ((@EmpCounter * 3) % 12) + 1, ((@EmpCounter * 7) % 27) + 1),
            '079' + RIGHT('000000000' + CAST(@EmpCounter * 1234567 AS VARCHAR(20)), 9),
            '090' + RIGHT('0000000' + CAST(@EmpCounter * 76543 AS VARCHAR(20)), 7),
            CASE (@EmpCounter % 4) WHEN 0 THEN N'Vietcombank' WHEN 1 THEN N'Techcombank' WHEN 2 THEN N'MB Bank' ELSE N'ACB' END,
            '0071' + RIGHT('00000000' + CAST(@EmpCounter * 9876 AS VARCHAR(20)), 8),
            @Status,
            @ResignDate,
            @SuspendStart,
            @SuspendEnd,
            CASE @Status 
                WHEN 'resigned' THEN N'Đã thôi việc - Bàn giao ca đầy đủ'
                WHEN 'suspended' THEN N'Tạm hoãn hợp đồng lao động'
                ELSE N'Nhân sự hoạt động chuẩn'
            END
        );

        SET @EmpCounter = @EmpCounter + 1;
        SET @i = @i + 1;
    END

    SET @b = @b + 1;
END;

-- Đổ dữ liệu vào bảng chính dbo.Employees
SET IDENTITY_INSERT dbo.Employees ON;

INSERT INTO dbo.Employees (
    EmployeeId, EmployeeCode, FullName, Position, BranchId, HireDate,
    HourlyRate, ContractType, Gender, DateOfBirth, CitizenId, PhoneNumber,
    BankName, BankAccountNumber, BankAccountName, Status, Note, UpdatedAt
)
SELECT 
    EmpId, EmpCode, FullName, Position, BranchId, HireDate,
    HourlyRate, ContractType, Gender, DOB, CitizenId, Phone,
    BankName, BankAccNumber, FullName, [Status], Note, SYSDATETIME()
FROM #RawEmployees;

SET IDENTITY_INSERT dbo.Employees OFF;

DECLARE @TotalEmps INT = (SELECT COUNT(*) FROM dbo.Employees);
DECLARE @ActiveEmps INT = (SELECT COUNT(*) FROM dbo.Employees WHERE Status = 'active');
DECLARE @ResignedEmps INT = (SELECT COUNT(*) FROM dbo.Employees WHERE Status = 'resigned');
DECLARE @SuspendedEmps INT = (SELECT COUNT(*) FROM dbo.Employees WHERE Status = 'suspended');

PRINT N'-> Đã nạp thành công ' + CAST(@TotalEmps AS NVARCHAR) + N' nhân sự: ' 
    + CAST(@ActiveEmps AS NVARCHAR) + N' Active, ' 
    + CAST(@ResignedEmps AS NVARCHAR) + N' Resigned, ' 
    + CAST(@SuspendedEmps AS NVARCHAR) + N' Suspended.';
GO

-- =======================================================================================
-- BƯỚC 5: NẠP QUỸ PHÉP NĂM (EmployeeAnnualLeaves) CHO TỪNG NĂM 2022 - 2026
-- =======================================================================================
PRINT N'5. Đang nạp Quỹ phép năm (EmployeeAnnualLeaves) từ 2022 đến 2026...';

DECLARE @y INT = 2022;
WHILE @y <= 2026
BEGIN
    INSERT INTO dbo.EmployeeAnnualLeaves (
        EmployeeId, [Year], StandardDays, SeniorityDays, CarriedOverDays, UsedDays, Note
    )
    SELECT 
        e.EmployeeId,
        @y,
        12.0 AS StandardDays,
        CAST(CASE 
            WHEN DATEDIFF(YEAR, e.HireDate, DATEFROMPARTS(@y, 12, 31)) >= 5 THEN 1.0 
            ELSE 0.0 
        END AS DECIMAL(4,1)) AS SeniorityDays,
        CAST((e.EmployeeId % 3) AS DECIMAL(4,1)) AS CarriedOverDays,
        0.0 AS UsedDays,
        N'Quỹ phép năm chính thức ' + CAST(@y AS NVARCHAR(4))
    FROM dbo.Employees e
    WHERE YEAR(e.HireDate) <= @y
      AND NOT EXISTS (
          SELECT 1 FROM dbo.EmployeeAnnualLeaves eal 
          WHERE eal.EmployeeId = e.EmployeeId AND eal.[Year] = @y
      );

    SET @y = @y + 1;
END;

DECLARE @TotalAnnualLeaves INT = (SELECT COUNT(*) FROM dbo.EmployeeAnnualLeaves);
PRINT N'-> Đã nạp ' + CAST(@TotalAnnualLeaves AS NVARCHAR) + N' bản ghi Quỹ phép năm.';
GO

-- =======================================================================================
-- BƯỚC 6: TẠO BẢNG TẠM LỊCH NGÀY & NẠP LỊCH PHÂN CA + CHẤM CÔNG (2022 - 2026)
-- =======================================================================================
PRINT N'6. Đang tổng hợp dữ liệu Lịch phân ca & Chấm công lịch sử (2022 - 2026)...';

IF OBJECT_ID('tempdb..#Calendar') IS NOT NULL DROP TABLE #Calendar;

;WITH Tally AS (
    SELECT TOP (DATEDIFF(DAY, '2022-01-01', '2026-11-18') + 1)
        ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS DayOffset
    FROM sys.all_objects a CROSS JOIN sys.all_objects b
),
Calendar AS (
    SELECT 
        DATEADD(DAY, DayOffset, '2022-01-01') AS CalDate,
        (DATEDIFF(DAY, '19000107', DATEADD(DAY, DayOffset, '2022-01-01')) % 7) AS DayOfWeekIdx -- 0: Chủ Nhật, 1..6: T2..T7
    FROM Tally
)
SELECT CalDate, DayOfWeekIdx
INTO #Calendar
FROM Calendar;

CREATE UNIQUE CLUSTERED INDEX CIX_Calendar ON #Calendar(CalDate);

IF OBJECT_ID('tempdb..#AttendanceStaging') IS NOT NULL DROP TABLE #AttendanceStaging;

CREATE TABLE #AttendanceStaging (
    EmployeeId          INT,
    BranchId            INT,
    TemplateId          INT,
    WorkDate            DATE,
    SchedStartTime      TIME(0),
    SchedEndTime        TIME(0),
    ActualCheckIn       DATETIME2(0),
    ActualCheckOut      DATETIME2(0),
    WorkHours           DECIMAL(4,2),
    LateMin             INT,
    EarlyLeaveMin       INT,
    IsMissingPunch      BIT,
    AttStatus           VARCHAR(20)
);

INSERT INTO #AttendanceStaging (
    EmployeeId, BranchId, TemplateId, WorkDate, SchedStartTime, SchedEndTime,
    ActualCheckIn, ActualCheckOut, WorkHours, LateMin, EarlyLeaveMin, IsMissingPunch, AttStatus
)
SELECT 
    e.EmployeeId,
    e.BranchId,
    st.TemplateId,
    c.CalDate,
    st.StartTime,
    st.EndTime,
    -- Giờ CheckIn thực tế kết hợp qua DATETIMEFROMPARTS (luôn có CheckInTime NOT NULL)
    CASE 
        WHEN (e.EmployeeId * 13 + DAY(c.CalDate)) % 12 = 0 THEN 
            -- Đi muộn 5..20 phút
            DATEADD(MINUTE, ((e.EmployeeId + DAY(c.CalDate)) % 16) + 5, 
                DATETIMEFROMPARTS(YEAR(c.CalDate), MONTH(c.CalDate), DAY(c.CalDate), DATEPART(HOUR, st.StartTime), DATEPART(MINUTE, st.StartTime), 0, 0))
        ELSE 
            -- Đúng giờ (sớm 2..8 phút)
            DATEADD(MINUTE, -(((e.EmployeeId + DAY(c.CalDate)) % 7) + 2), 
                DATETIMEFROMPARTS(YEAR(c.CalDate), MONTH(c.CalDate), DAY(c.CalDate), DATEPART(HOUR, st.StartTime), DATEPART(MINUTE, st.StartTime), 0, 0))
    END AS ActualCheckIn,

    -- Giờ CheckOut thực tế kết hợp qua DATETIMEFROMPARTS (có thể NULL khi quên quẹt thẻ ra)
    CASE 
        WHEN (e.EmployeeId * 23 + DAY(c.CalDate)) % 40 = 0 THEN NULL -- Quên quẹt ra (Missing Punch)
        WHEN (e.EmployeeId * 19 + DAY(c.CalDate)) % 20 = 0 THEN 
            -- Về sớm 5..15 phút
            DATEADD(MINUTE, -(((e.EmployeeId + DAY(c.CalDate)) % 11) + 5), 
                DATETIMEFROMPARTS(YEAR(c.CalDate), MONTH(c.CalDate), DAY(c.CalDate), DATEPART(HOUR, st.EndTime), DATEPART(MINUTE, st.EndTime), 0, 0))
        ELSE 
            -- Đúng giờ hoặc nán lại vài phút
            DATEADD(MINUTE, ((e.EmployeeId + DAY(c.CalDate)) % 8) + 1, 
                DATETIMEFROMPARTS(YEAR(c.CalDate), MONTH(c.CalDate), DAY(c.CalDate), DATEPART(HOUR, st.EndTime), DATEPART(MINUTE, st.EndTime), 0, 0))
    END AS ActualCheckOut,

    st.StandardHours AS WorkHours,
    0 AS LateMin,
    0 AS EarlyLeaveMin,
    0 AS IsMissingPunch,
    'on_time' AS AttStatus
FROM dbo.Employees e
INNER JOIN #RawEmployees r ON e.EmployeeId = r.EmpId
CROSS JOIN #Calendar c
CROSS JOIN dbo.ShiftTemplates st
WHERE 
    c.CalDate >= e.HireDate
    AND (r.ResignDate IS NULL OR c.CalDate <= r.ResignDate)
    AND (r.SuspendStart IS NULL OR c.CalDate NOT BETWEEN r.SuspendStart AND r.SuspendEnd)
    AND (
        -- Khối Văn phòng: Đi ca Full (T2..T6, nghỉ T7 và CN)
        (e.BranchId = 5 AND st.ShiftCode = 'CA-FULL' AND c.DayOfWeekIdx BETWEEN 1 AND 5)

        -- Cửa hàng trưởng (SM): Đi ca Full (T2..T7, nghỉ CN)
        OR (e.BranchId < 5 AND e.Position LIKE N'%Cửa hàng trưởng%' AND st.ShiftCode = 'CA-FULL' AND c.DayOfWeekIdx BETWEEN 1 AND 6)

        -- Nhân viên cửa hàng: Xoay ca theo ID và ngày trong tháng
        OR (
            e.BranchId < 5 
            AND e.Position NOT LIKE N'%Cửa hàng trưởng%'
            AND c.DayOfWeekIdx <> ((e.EmployeeId * 3) % 7) -- 1 ngày nghỉ tuần
            AND (
                (st.ShiftCode = 'CA-SANG'  AND (e.EmployeeId + DAY(c.CalDate)) % 4 = 0)
                OR (st.ShiftCode = 'CA-CHIEU' AND (e.EmployeeId + DAY(c.CalDate)) % 4 = 1)
                OR (st.ShiftCode = 'CA-TOI'   AND (e.EmployeeId + DAY(c.CalDate)) % 4 = 2)
                OR (st.ShiftCode = 'CA-GAY'   AND (e.EmployeeId + DAY(c.CalDate)) % 4 = 3 AND e.ContractType = 'part_time')
            )
        )
    );

DECLARE @StagingCount INT = (SELECT COUNT(*) FROM #AttendanceStaging);
PRINT N'-> Đã tổng hợp staging ' + CAST(@StagingCount AS NVARCHAR) + N' ca làm việc.';

-- Cập nhật tính toán chi tiết LateMin, EarlyLeaveMin, MissingPunch và Status trên Staging
UPDATE stg
SET 
    stg.LateMin = CASE 
        WHEN stg.ActualCheckIn IS NOT NULL AND CAST(stg.ActualCheckIn AS TIME) > stg.SchedStartTime THEN
            DATEDIFF(MINUTE, stg.SchedStartTime, CAST(stg.ActualCheckIn AS TIME))
        ELSE 0
    END,
    stg.EarlyLeaveMin = CASE 
        WHEN stg.ActualCheckOut IS NOT NULL AND CAST(stg.ActualCheckOut AS TIME) < stg.SchedEndTime THEN
            DATEDIFF(MINUTE, CAST(stg.ActualCheckOut AS TIME), stg.SchedEndTime)
        ELSE 0
    END,
    stg.IsMissingPunch = CASE 
        WHEN (stg.ActualCheckIn IS NOT NULL AND stg.ActualCheckOut IS NULL)
          OR (stg.ActualCheckIn IS NULL AND stg.ActualCheckOut IS NOT NULL) THEN 1
        ELSE 0
    END,
    stg.WorkHours = CASE 
        WHEN stg.ActualCheckIn IS NOT NULL AND stg.ActualCheckOut IS NOT NULL THEN
            CAST(ROUND(DATEDIFF(MINUTE, stg.ActualCheckIn, stg.ActualCheckOut) / 60.0, 2) AS DECIMAL(4,2))
        ELSE 0.00
    END,
    stg.AttStatus = CASE 
        WHEN (stg.ActualCheckIn IS NOT NULL AND stg.ActualCheckOut IS NULL)
          OR (stg.ActualCheckIn IS NULL AND stg.ActualCheckOut IS NOT NULL) THEN 'missing_punch'
        WHEN stg.ActualCheckIn IS NULL AND stg.ActualCheckOut IS NULL THEN 'absent'
        WHEN stg.ActualCheckIn IS NOT NULL AND CAST(stg.ActualCheckIn AS TIME) > stg.SchedStartTime THEN 'late'
        WHEN stg.ActualCheckOut IS NOT NULL AND CAST(stg.ActualCheckOut AS TIME) < stg.SchedEndTime THEN 'early_leave'
        ELSE 'on_time'
    END
FROM #AttendanceStaging stg;

-- Đổ vào bảng chính ShiftAssignments
INSERT INTO dbo.ShiftAssignments (EmployeeId, TemplateId, BranchId, WorkDate, RegisteredBy, Status, Note, CreatedAt)
SELECT 
    EmployeeId, TemplateId, BranchId, WorkDate, 'manager', 'scheduled', N'Phân ca lịch tự động', SYSDATETIME()
FROM #AttendanceStaging;

DECLARE @TotalAssignments INT = (SELECT COUNT(*) FROM dbo.ShiftAssignments);
PRINT N'-> Đã nạp thành công ' + CAST(@TotalAssignments AS NVARCHAR) + N' bản ghi ShiftAssignments.';

-- Đổ vào bảng chính Attendances
INSERT INTO dbo.Attendances (
    EmployeeId, BranchId, ShiftAssignmentId, WorkDate, ScheduledStartTime, ScheduledEndTime,
    CheckInTime, CheckOutTime, WorkHours, OvertimeHours, LateMinutes, EarlyLeaveMinutes,
    AttendanceMethod, Status, IsMissingPunch, IsManualAdjusted, Notes
)
SELECT 
    stg.EmployeeId,
    stg.BranchId,
    sa.AssignmentId,
    stg.WorkDate,
    stg.SchedStartTime,
    stg.SchedEndTime,
    stg.ActualCheckIn,
    stg.ActualCheckOut,
    stg.WorkHours,
    0.00 AS OvertimeHours,
    stg.LateMin,
    stg.EarlyLeaveMin,
    'Fingerprint',
    stg.AttStatus,
    stg.IsMissingPunch,
    0,
    CASE 
        WHEN stg.AttStatus = 'late' THEN N'Đi trễ ' + CAST(stg.LateMin AS NVARCHAR) + N' phút'
        WHEN stg.AttStatus = 'early_leave' THEN N'Về sớm ' + CAST(stg.EarlyLeaveMin AS NVARCHAR) + N' phút'
        WHEN stg.AttStatus = 'missing_punch' THEN N'Quên quẹt thẻ ra/vào ca'
        ELSE N'Chấm công đúng giờ'
    END
FROM #AttendanceStaging stg
INNER JOIN dbo.ShiftAssignments sa 
    ON stg.EmployeeId = sa.EmployeeId 
    AND stg.WorkDate = sa.WorkDate 
    AND stg.TemplateId = sa.TemplateId;

DECLARE @TotalAttendances INT = (SELECT COUNT(*) FROM dbo.Attendances);
PRINT N'-> Đã nạp thành công ' + CAST(@TotalAttendances AS NVARCHAR) + N' bản ghi Attendances.';
GO

-- =======================================================================================
-- BƯỚC 7: NẠP DỮ LIỆU LÀM THÊM GIỜ (EmployeeOvertimes - PHƯƠNG ÁN 2)
-- =======================================================================================
PRINT N'7. Đang sinh dữ liệu Làm thêm giờ (EmployeeOvertimes)...';

-- 7.1 Tăng ca ngày Lễ (x300%)
INSERT INTO dbo.EmployeeOvertimes (
    EmployeeId, BranchId, AttendanceId, WorkDate, StartTime, EndTime, [Hours],
    OTType, PayMultiplier, Reason, ApprovalStatus, ApprovedBy, ApprovedAt, Note, CreatedAt
)
SELECT 
    att.EmployeeId,
    att.BranchId,
    att.AttendanceId,
    att.WorkDate,
    '17:30:00' AS StartTime,
    '20:30:00' AS EndTime,
    3.00 AS [Hours],
    'holiday' AS OTType,
    3.00 AS PayMultiplier,
    N'Tăng ca phục vụ khách giờ cao điểm ' + h.HolidayName,
    'approved',
    (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE BranchId = att.BranchId AND Position LIKE N'%Cửa hàng trưởng%'),
    DATETIMEFROMPARTS(YEAR(att.WorkDate), MONTH(att.WorkDate), DAY(att.WorkDate), 21, 0, 0, 0),
    N'Đã duyệt chi lương x3.0',
    SYSDATETIME()
FROM dbo.Attendances att
INNER JOIN dbo.Holidays h ON att.WorkDate = h.HolidayDate
WHERE (att.EmployeeId % 3 = 0)
  AND att.WorkHours > 0;

-- 7.2 Tăng ca cuối tuần Chủ Nhật (x200%)
INSERT INTO dbo.EmployeeOvertimes (
    EmployeeId, BranchId, AttendanceId, WorkDate, StartTime, EndTime, [Hours],
    OTType, PayMultiplier, Reason, ApprovalStatus, ApprovedBy, ApprovedAt, Note, CreatedAt
)
SELECT 
    att.EmployeeId,
    att.BranchId,
    att.AttendanceId,
    att.WorkDate,
    '12:00:00' AS StartTime,
    '14:30:00' AS EndTime,
    2.50 AS [Hours],
    'weekend' AS OTType,
    2.00 AS PayMultiplier,
    N'Hỗ trợ quầy bar ca trưa Chủ Nhật đông khách',
    'approved',
    (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE BranchId = att.BranchId AND Position LIKE N'%Cửa hàng trưởng%'),
    DATETIMEFROMPARTS(YEAR(att.WorkDate), MONTH(att.WorkDate), DAY(att.WorkDate), 15, 0, 0, 0),
    N'Duyệt tăng ca cuối tuần x2.0',
    SYSDATETIME()
FROM dbo.Attendances att
WHERE (DATEDIFF(DAY, '19000107', att.WorkDate) % 7) = 0 -- Chủ Nhật
  AND (att.EmployeeId % 5 = 0)
  AND att.WorkHours > 0
  AND NOT EXISTS (SELECT 1 FROM dbo.Holidays h WHERE h.HolidayDate = att.WorkDate);

-- 7.3 Tăng ca ngày thường (x150%)
INSERT INTO dbo.EmployeeOvertimes (
    EmployeeId, BranchId, AttendanceId, WorkDate, StartTime, EndTime, [Hours],
    OTType, PayMultiplier, Reason, ApprovalStatus, ApprovedBy, ApprovedAt, Note, CreatedAt
)
SELECT 
    att.EmployeeId,
    att.BranchId,
    att.AttendanceId,
    att.WorkDate,
    '23:00:00' AS StartTime,
    '01:00:00' AS EndTime,
    2.00 AS [Hours],
    'normal' AS OTType,
    1.50 AS PayMultiplier,
    N'Tổng vệ sinh máy pha & kiểm kê định kỳ cuối tháng',
    'approved',
    (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE BranchId = att.BranchId AND Position LIKE N'%Cửa hàng trưởng%'),
    DATETIMEFROMPARTS(YEAR(att.WorkDate), MONTH(att.WorkDate), DAY(att.WorkDate), 23, 30, 0, 0),
    N'Duyệt tăng ca ca đêm ngày thường x1.5',
    SYSDATETIME()
FROM dbo.Attendances att
WHERE DAY(att.WorkDate) IN (28, 29)
  AND (att.EmployeeId % 4 = 0)
  AND att.WorkHours > 0
  AND (DATEDIFF(DAY, '19000107', att.WorkDate) % 7) <> 0
  AND NOT EXISTS (SELECT 1 FROM dbo.Holidays h WHERE h.HolidayDate = att.WorkDate);

DECLARE @TotalOT INT = (SELECT COUNT(*) FROM dbo.EmployeeOvertimes);
PRINT N'-> Đã nạp thành công ' + CAST(@TotalOT AS NVARCHAR) + N' bản ghi EmployeeOvertimes.';
GO

-- =======================================================================================
-- BƯỚC 8: NẠP DỮ LIỆU NGHỈ PHÉP (EmployeeLeaves) & ĐỒNG BỘ VÀO QUỸ PHÉP NĂM
-- =======================================================================================
PRINT N'8. Đang nạp dữ liệu Đơn nghỉ phép (EmployeeLeaves)...';

INSERT INTO dbo.EmployeeLeaves (
    EmployeeId, BranchId, FromDate, ToDate, LeaveDays, LeaveType, IsPaid, Reason, ApprovalStatus, ApprovedBy, ApprovedAt, CreatedAt
)
SELECT 
    e.EmployeeId,
    e.BranchId,
    DATEFROMPARTS(y.[Year], m.[Month], ((e.EmployeeId * 7) % 20) + 1) AS FromDate,
    DATEFROMPARTS(y.[Year], m.[Month], ((e.EmployeeId * 7) % 20) + 1) AS ToDate,
    1.00 AS LeaveDays,
    CASE 
        WHEN (e.EmployeeId + m.[Month]) % 5 = 0 THEN 'unpaid'
        WHEN (e.EmployeeId + m.[Month]) % 5 = 1 THEN 'sick'
        ELSE 'annual'
    END AS LeaveType,
    CASE 
        WHEN (e.EmployeeId + m.[Month]) % 5 = 0 THEN 0
        ELSE 1
    END AS IsPaid,
    CASE 
        WHEN (e.EmployeeId + m.[Month]) % 5 = 0 THEN N'Giải quyết việc riêng gia đình (Nghỉ không lương)'
        WHEN (e.EmployeeId + m.[Month]) % 5 = 1 THEN N'Nghỉ ốm có giấy khám bệnh'
        ELSE N'Nghỉ phép năm theo quy chế công ty'
    END AS Reason,
    'approved' AS ApprovalStatus,
    (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE BranchId = e.BranchId AND Position LIKE N'%Cửa hàng trưởng%'),
    SYSDATETIME(),
    SYSDATETIME()
FROM dbo.Employees e
CROSS JOIN (VALUES (2022), (2023), (2024), (2025), (2026)) y ([Year])
CROSS JOIN (VALUES (3), (6), (9), (11)) m ([Month])
WHERE y.[Year] >= YEAR(e.HireDate)
  AND (e.Status <> 'resigned' OR DATEFROMPARTS(y.[Year], m.[Month], 1) <= '2026-08-01')
  AND (e.EmployeeId % 2 = 0);

DECLARE @TotalLeaves INT = (SELECT COUNT(*) FROM dbo.EmployeeLeaves);
PRINT N'-> Đã nạp thành công ' + CAST(@TotalLeaves AS NVARCHAR) + N' bản ghi EmployeeLeaves.';

-- Đồng bộ số ngày nghỉ phép năm đã dùng vào bảng EmployeeAnnualLeaves
;WITH ApprovedAnnualLeaves AS (
    SELECT 
        el.EmployeeId,
        YEAR(el.FromDate) AS [Year],
        SUM(el.LeaveDays) AS TotalUsed
    FROM dbo.EmployeeLeaves el
    WHERE el.LeaveType = 'annual' AND el.ApprovalStatus = 'approved'
    GROUP BY el.EmployeeId, YEAR(el.FromDate)
)
UPDATE eal
SET eal.UsedDays = ISNULL(aal.TotalUsed, 0.0),
    eal.LastUpdated = SYSDATETIME()
FROM dbo.EmployeeAnnualLeaves eal
INNER JOIN ApprovedAnnualLeaves aal 
    ON eal.EmployeeId = aal.EmployeeId AND eal.[Year] = aal.[Year];

PRINT N'-> Đã đồng bộ số ngày nghỉ phép vào Quỹ phép năm (EmployeeAnnualLeaves).';
GO

-- =======================================================================================
-- BƯỚC 9: TÍNH TOÁN & KHÓA SỔ BẢNG LƯƠNG 60 KỲ THÁNG (2022 - 2026)
-- Kỳ 2022-01 đến 2026-10: Trạng thái 'approved', IsLocked = 1
-- Kỳ 2026-11: Trạng thái 'draft', IsLocked = 0
-- =======================================================================================
PRINT N'9. Đang tổng hợp Kỳ tính lương & Phiếu lương tháng (2022 - 2026)...';

DECLARE @PeriodYear INT = 2022;
WHILE @PeriodYear <= 2026
BEGIN
    DECLARE @PeriodMonthNum INT = 1;
    WHILE @PeriodMonthNum <= 12
    BEGIN
        IF @PeriodYear = 2026 AND @PeriodMonthNum > 11 BREAK;

        DECLARE @PeriodCode VARCHAR(7) = CAST(@PeriodYear AS VARCHAR(4)) + '-' + RIGHT('0' + CAST(@PeriodMonthNum AS VARCHAR(2)), 2);
        DECLARE @IsLocked BIT = CASE WHEN @PeriodCode = '2026-11' THEN 0 ELSE 1 END;
        DECLARE @PeriodStatus VARCHAR(20) = CASE WHEN @PeriodCode = '2026-11' THEN 'draft' ELSE 'approved' END;

        INSERT INTO dbo.PayrollPeriods (PeriodMonth, BranchId, Status, IsLocked, TotalEmployees, TotalNetPay, ApprovedBy, ApprovedAt, CreatedAt)
        VALUES (@PeriodCode, NULL, @PeriodStatus, @IsLocked, 0, 0.00, N'Trần Minh Hoàng (CEO)', SYSDATETIME(), SYSDATETIME());

        DECLARE @CurPeriodId INT = SCOPE_IDENTITY();
        DECLARE @PeriodStart DATE = DATEFROMPARTS(@PeriodYear, @PeriodMonthNum, 1);
        DECLARE @PeriodEnd   DATE = EOMONTH(@PeriodStart);

        ;WITH MonthEmpAtt AS (
            SELECT 
                att.EmployeeId,
                ISNULL(SUM(att.WorkHours), 0.00) AS StdHours,
                ISNULL(SUM(att.LateMinutes), 0) AS LateMinutes
            FROM dbo.Attendances att
            WHERE att.WorkDate BETWEEN @PeriodStart AND @PeriodEnd
            GROUP BY att.EmployeeId
        ),
        MonthEmpOT AS (
            SELECT 
                eo.EmployeeId,
                ISNULL(SUM(eo.[Hours]), 0.00) AS OTHours,
                ISNULL(SUM(eo.[Hours] * eo.PayMultiplier), 0.00) AS WeightedOTHours
            FROM dbo.EmployeeOvertimes eo
            WHERE eo.WorkDate BETWEEN @PeriodStart AND @PeriodEnd
              AND eo.ApprovalStatus = 'approved'
            GROUP BY eo.EmployeeId
        )
        INSERT INTO dbo.PayrollSlips (
            PeriodId, EmployeeId, HourlyRate, StandardHours, OvertimeHours,
            BasePay, OvertimePay, Allowance, Deduction, Advance, NetPay, Status, CreatedAt
        )
        SELECT 
            @CurPeriodId,
            e.EmployeeId,
            e.HourlyRate,
            ISNULL(mea.StdHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) AS StandardHours,
            ISNULL(meo.OTHours, 0.00) AS OvertimeHours,

            ROUND(ISNULL(mea.StdHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) * e.HourlyRate, 0) AS BasePay,
            ROUND(ISNULL(meo.WeightedOTHours, 0.00) * e.HourlyRate, 0) AS OvertimePay,

            CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END AS Allowance,

            CASE WHEN ISNULL(mea.LateMinutes, 0) > 30 THEN CAST((mea.LateMinutes / 30) * 50000.00 AS DECIMAL(18,2)) ELSE 0.00 END AS Deduction,

            0.00 AS Advance,

            ROUND(
                (ISNULL(mea.StdHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) * e.HourlyRate)
                + (ISNULL(meo.WeightedOTHours, 0.00) * e.HourlyRate)
                + (CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END)
                - (CASE WHEN ISNULL(mea.LateMinutes, 0) > 30 THEN CAST((mea.LateMinutes / 30) * 50000.00 AS DECIMAL(18,2)) ELSE 0.00 END),
                0
            ) AS NetPay,

            @PeriodStatus,
            SYSDATETIME()
        FROM dbo.Employees e
        LEFT JOIN MonthEmpAtt mea ON e.EmployeeId = mea.EmployeeId
        LEFT JOIN MonthEmpOT meo  ON e.EmployeeId = meo.EmployeeId
        WHERE e.HireDate <= @PeriodEnd
          AND (
              e.Status <> 'resigned' 
              OR e.EmployeeId NOT IN (SELECT EmpId FROM #RawEmployees r WHERE r.ResignDate < @PeriodStart)
          )
          AND (
              e.Status <> 'suspended'
              OR NOT (@PeriodYear = 2026 AND @PeriodMonthNum BETWEEN 5 AND 10)
          );

        UPDATE pp
        SET pp.TotalEmployees = (SELECT COUNT(*) FROM dbo.PayrollSlips WHERE PeriodId = @CurPeriodId),
            pp.TotalNetPay = ISNULL((SELECT SUM(NetPay) FROM dbo.PayrollSlips WHERE PeriodId = @CurPeriodId), 0.00)
        FROM dbo.PayrollPeriods pp
        WHERE pp.PeriodId = @CurPeriodId;

        SET @PeriodMonthNum = @PeriodMonthNum + 1;
    END

    SET @PeriodYear = @PeriodYear + 1;
END;

DECLARE @TotalPeriods INT = (SELECT COUNT(*) FROM dbo.PayrollPeriods);
DECLARE @TotalSlips INT = (SELECT COUNT(*) FROM dbo.PayrollSlips);
PRINT N'-> Đã tính toán ' + CAST(@TotalPeriods AS NVARCHAR) + N' Kỳ lương và ' + CAST(@TotalSlips AS NVARCHAR) + N' Phiếu lương.';
GO

-- =======================================================================================
-- BƯỚC 10: TÁI KÍCH HOẠT CÁC TRIGGER VÀ HOÀN TẤT
-- =======================================================================================
PRINT N'10. Kích hoạt lại toàn bộ Triggers...';

ENABLE TRIGGER ALL ON dbo.PayrollSlips;
IF OBJECT_ID('dbo.PayrollPeriods', 'U') IS NOT NULL ENABLE TRIGGER ALL ON dbo.PayrollPeriods;
ENABLE TRIGGER ALL ON dbo.ShiftAssignments;
ENABLE TRIGGER ALL ON dbo.Employees;
ENABLE TRIGGER ALL ON dbo.Attendances;
ENABLE TRIGGER ALL ON dbo.EmployeeOvertimes;
ENABLE TRIGGER ALL ON dbo.EmployeeLeaves;
ENABLE TRIGGER ALL ON dbo.EmployeeAnnualLeaves;

PRINT N'=======================================================================================';
PRINT N'>>> HOÀN TẤT THÀNH CÔNG RELEASE 13: ĐÃ NẠP TOÀN BỘ DỮ LIỆU LỊCH SỬ 2022 - 2026! <<<';
PRINT N'=======================================================================================';
GO
