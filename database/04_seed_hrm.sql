-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Kịch bản nạp dữ liệu mẫu (Seed Data): MODULE QUẢN TRỊ NHÂN SỰ (HRM) & CHI NHÁNH
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/04_seed_hrm.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

-- =======================================================================================
-- 1. NẠP DANH MỤC VAI TRÒ (Roles)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Admin')
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('Admin', N'Quản trị viên toàn hệ thống');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'HRM')
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('HRM', N'Chuyên viên Quản trị Nhân sự & Tiền lương');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Manager')
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('Manager', N'Quản lý Cửa hàng Chi nhánh');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Cashier')
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('Cashier', N'Thu ngân bán hàng POS');

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Barista')
    INSERT INTO dbo.Roles (RoleName, Description) VALUES ('Barista', N'Pha chế quầy bar');

PRINT N'-> Đã nạp Roles.';
GO

-- =======================================================================================
-- 2. NẠP 4 CHI NHÁNH CHUỖI CÀ PHÊ FIIN (Branches)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchCode = 'CN-Q1')
    INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive)
    VALUES ('CN-Q1', N'Fiin Đinh Tiên Hoàng', N'12 Đinh Tiên Hoàng, Phường Đa Kao, Quận 1, TP.HCM', '028 3822 1101', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchCode = 'CN-Q3')
    INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive)
    VALUES ('CN-Q3', N'Fiin Hồ Con Rùa', N'42 Trần Cao Vân, Phường 6, Quận 3, TP.HCM', '028 3822 1102', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchCode = 'CN-THUDUC')
    INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive)
    VALUES ('CN-THUDUC', N'Fiin Võ Văn Ngân', N'108 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM', '028 3822 1103', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchCode = 'CN-BINHTHANH')
    INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive)
    VALUES ('CN-BINHTHANH', N'Fiin Phan Xích Long', N'56 Phan Xích Long, Phường 2, Quận Bình Thạnh, TP.HCM', '028 3822 1104', 1);

PRINT N'-> Đã nạp 4 Chi nhánh chuỗi.';
GO

-- =======================================================================================
-- 3. NẠP 4 MẪU CA LÀM VIỆC CHUẨN (ShiftTemplates)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-SANG')
    INSERT INTO dbo.ShiftTemplates (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
    VALUES ('CA-SANG', N'Ca Sáng (Mở quán & Pha chế)', '06:30:00', '12:00:00', 15, 5.50, 'emerald', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-CHIEU')
    INSERT INTO dbo.ShiftTemplates (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
    VALUES ('CA-CHIEU', N'Ca Chiều (Giờ cao điểm)', '12:00:00', '17:30:00', 15, 5.50, 'amber', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-TOI')
    INSERT INTO dbo.ShiftTemplates (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
    VALUES ('CA-TOI', N'Ca Tối (Đóng quán & Vệ sinh)', '17:30:00', '23:00:00', 15, 5.50, 'indigo', 1);

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-FULL')
    INSERT INTO dbo.ShiftTemplates (ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive)
    VALUES ('CA-FULL', N'Ca Toàn thời gian (Quản lý)', '08:00:00', '17:00:00', 60, 8.00, 'sky', 1);

PRINT N'-> Đã nạp 4 Mẫu ca chuẩn.';
GO

-- =======================================================================================
-- 4. NẠP TÀI KHOẢN VÀ HỒ SƠ 10 NHÂN VIÊN MẪU (Users & Employees)
-- =======================================================================================
DECLARE @BranchQ1 INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-Q1');
DECLARE @BranchQ3 INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-Q3');
DECLARE @BranchTD INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-THUDUC');
DECLARE @BranchBT INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-BINHTHANH');

-- Password mẫu cho toàn bộ tài khoản demo: Fiin@123 (mã băm SHA256 mẫu)
DECLARE @SampleHash VARCHAR(255) = 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3';

-- 1. NV001: Đặng Quốc Anh
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'quocanh')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('quocanh', @SampleHash, N'Đặng Quốc Anh', '0901 234 567', 'quocanh@fiin.vn', 1);
    DECLARE @Uid1 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender, Note)
    VALUES (@Uid1, 'NV001', N'Trưởng ca Pha chế', '2025-01-15', 35000.00, @BranchQ1, 'working', 'full_time', '1998-04-12', 'male', N'Chứng chỉ Barista Specialty, quản lý ca sáng tốt.');
END

-- 2. NV002: Nguyễn Thị Hương
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'huongnt')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('huongnt', @SampleHash, N'Nguyễn Thị Hương', '0902 345 678', 'huongnt@fiin.vn', 1);
    DECLARE @Uid2 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid2, 'NV002', N'Barista Chuyên nghiệp', '2025-03-01', 28000.00, @BranchQ1, 'working', 'full_time', '2001-08-20', 'female');
END

-- 3. NV003: Lê Thanh Tùng
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'tunglt')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('tunglt', @SampleHash, N'Lê Thanh Tùng', '0903 456 789', 'tunglt@fiin.vn', 1);
    DECLARE @Uid3 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid3, 'NV003', N'Quản lý Cửa hàng', '2024-11-10', 42000.00, @BranchQ3, 'working', 'full_time', '1995-11-05', 'male');
END

-- 4. NV004: Phạm Minh Tuấn
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'tuanpm')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('tuanpm', @SampleHash, N'Phạm Minh Tuấn', '0904 567 890', 'tuanpm@fiin.vn', 1);
    DECLARE @Uid4 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid4, 'NV004', N'Thu ngân & Phục vụ', '2025-06-15', 24000.00, @BranchQ3, 'working', 'part_time', '2003-02-14', 'male');
END

-- 5. NV005: Trần Thảo Vy
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'vytt')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('vytt', @SampleHash, N'Trần Thảo Vy', '0905 678 901', 'vytt@fiin.vn', 1);
    DECLARE @Uid5 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid5, 'NV005', N'Barista Chuyên nghiệp', '2025-02-20', 28000.00, @BranchTD, 'working', 'full_time', '2000-09-30', 'female');
END

-- 6. NV006: Hoàng Gia Bảo
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'baohg')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('baohg', @SampleHash, N'Hoàng Gia Bảo', '0906 789 012', 'baohg@fiin.vn', 1);
    DECLARE @Uid6 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid6, 'NV006', N'Phục vụ & Bàn', '2025-10-01', 22000.00, @BranchTD, 'probation', 'part_time', '2004-12-03', 'male');
END

-- 7. NV007: Bùi Mỹ Linh
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'linhbm')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('linhbm', @SampleHash, N'Bùi Mỹ Linh', '0907 890 123', 'linhbm@fiin.vn', 1);
    DECLARE @Uid7 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid7, 'NV007', N'Trưởng ca Cửa hàng', '2024-09-01', 36000.00, @BranchBT, 'working', 'full_time', '1997-03-18', 'female');
END

-- 8. NV008: Vũ Anh Khoa
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'khoava')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('khoava', @SampleHash, N'Vũ Anh Khoa', '0908 901 234', 'khoava@fiin.vn', 1);
    DECLARE @Uid8 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid8, 'NV008', N'Thu ngân & Phục vụ', '2025-05-10', 24000.00, @BranchBT, 'working', 'part_time', '2002-06-25', 'male');
END

-- 9. NV009: Nguyễn Hải Đăng
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'dangnh')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('dangnh', @SampleHash, N'Nguyễn Hải Đăng', '0909 012 345', 'dangnh@fiin.vn', 1);
    DECLARE @Uid9 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid9, 'NV009', N'Barista Học việc', '2025-11-01', 25000.00, @BranchQ1, 'probation', 'part_time', '2004-01-10', 'male');
END

-- 10. NV010: Đỗ Tiến Dũng
IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = 'dungdt')
BEGIN
    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
    VALUES ('dungdt', @SampleHash, N'Đỗ Tiến Dũng', '0910 123 456', 'dungdt@fiin.vn', 1);
    DECLARE @Uid10 INT = SCOPE_IDENTITY();

    INSERT INTO dbo.Employees (UserId, EmployeeCode, Position, HireDate, HourlyRate, BranchId, Status, ContractType, DateOfBirth, Gender)
    VALUES (@Uid10, 'NV010', N'Barista Chuyên nghiệp', '2025-08-01', 29000.00, @BranchQ3, 'working', 'full_time', '1999-07-22', 'male');
END

PRINT N'-> Đã nạp 10 Nhân viên mẫu.';
GO

-- =======================================================================================
-- 5. NẠP LỊCH ĐĂNG KÝ CA LÀM VIỆC TUẦN HIỆN TẠI (ShiftAssignments)
-- =======================================================================================
DECLARE @Emp1 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV001');
DECLARE @Emp2 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV002');
DECLARE @Emp3 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV003');
DECLARE @Emp4 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV004');
DECLARE @Emp5 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV005');

DECLARE @ShiftSang INT = (SELECT TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-SANG');
DECLARE @ShiftChieu INT = (SELECT TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-CHIEU');
DECLARE @ShiftFull INT = (SELECT TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-FULL');

DECLARE @BranchQ1 INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-Q1');
DECLARE @BranchQ3 INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-Q3');
DECLARE @BranchTD INT = (SELECT BranchId FROM dbo.Branches WHERE BranchCode = 'CN-THUDUC');

-- Đăng ký ca ngày 2026-11-15 (Hôm nay mẫu)
DECLARE @AsgId INT;
IF NOT EXISTS (SELECT 1 FROM dbo.ShiftAssignments WHERE EmployeeId = @Emp1 AND WorkDate = '2026-11-15')
    EXEC dbo.sp_HRM_AssignShift @Emp1, @ShiftSang, @BranchQ1, '2026-11-15', 'manager', N'Trực ca chính sáng', @AsgId OUTPUT;

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftAssignments WHERE EmployeeId = @Emp2 AND WorkDate = '2026-11-15')
    EXEC dbo.sp_HRM_AssignShift @Emp2, @ShiftSang, @BranchQ1, '2026-11-15', 'employee', N'Hỗ trợ quầy pha chế', @AsgId OUTPUT;

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftAssignments WHERE EmployeeId = @Emp3 AND WorkDate = '2026-11-15')
    EXEC dbo.sp_HRM_AssignShift @Emp3, @ShiftFull, @BranchQ3, '2026-11-15', 'manager', N'Trực quản lý cả ngày', @AsgId OUTPUT;

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftAssignments WHERE EmployeeId = @Emp4 AND WorkDate = '2026-11-15')
    EXEC dbo.sp_HRM_AssignShift @Emp4, @ShiftChieu, @BranchQ3, '2026-11-15', 'employee', N'Thu ngân ca chiều', @AsgId OUTPUT;

IF NOT EXISTS (SELECT 1 FROM dbo.ShiftAssignments WHERE EmployeeId = @Emp5 AND WorkDate = '2026-11-15')
    EXEC dbo.sp_HRM_AssignShift @Emp5, @ShiftSang, @BranchTD, '2026-11-15', 'employee', NULL, @AsgId OUTPUT;

PRINT N'-> Đã nạp Lịch phân ca tuần mẫu.';
GO

-- =======================================================================================
-- 6. NẠP DỮ LIỆU CHẤM CÔNG THỰC TẾ ĐỐI SOÁT (Attendances)
-- =======================================================================================
DECLARE @Emp1 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV001');
DECLARE @Emp2 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV002');
DECLARE @Emp3 INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV003');

DECLARE @AttId INT;
-- 1. NV001: Đúng giờ (Ca 06:30 - Vào 06:28, Ra 12:02)
EXEC dbo.sp_HRM_RecordAttendance 
    @Emp1, '2026-11-15', '2026-11-15 06:28:00', '2026-11-15 12:02:00', 'SimulatedButton', N'Đúng giờ ca sáng', @AttId OUTPUT;

-- 2. NV002: Đi muộn 15p (Ca 06:30 - Vào 06:45, Ra 12:00)
EXEC dbo.sp_HRM_RecordAttendance 
    @Emp2, '2026-11-15', '2026-11-15 06:45:00', '2026-11-15 12:00:00', 'SimulatedButton', N'Kẹt xe đường Đinh Tiên Hoàng', @AttId OUTPUT;

-- 3. NV003: Chấm công thủ công (Điều chỉnh giờ do máy vân tay lỗi)
EXEC dbo.sp_HRM_RecordAttendance 
    @Emp3, '2026-11-15', '2026-11-15 08:30:00', '2026-11-15 17:00:00', 'SimulatedButton', N'Vào ca quản lý', @AttId OUTPUT;

-- Điều chỉnh bản ghi của NV003 sang đúng 08:00
EXEC dbo.sp_HRM_AdjustAttendanceManual 
    @AttId, '2026-11-15 08:00:00', '2026-11-15 17:00:00', N'Nguyễn Quản Lý (Admin)', N'Máy chấm công vân tay bị lỗi cảm biến, quản lý xác nhận có mặt từ 07:55';

PRINT N'-> Đã nạp Dữ liệu chấm công đối soát mẫu.';
GO

-- =======================================================================================
-- 7. CHẠY THỬ THỦ TỤC TÍNH LƯƠNG TỰ ĐỘNG THÁNG 2026-11 VÀ 2026-10
-- =======================================================================================
DECLARE @PayPeriodNov INT;
EXEC dbo.sp_HRM_CalculatePayroll '2026-11', NULL, N'Admin Hệ thống', @PayPeriodNov OUTPUT;
PRINT N'-> Đã tính bảng lương tháng 2026-11 (Bản nháp).';

DECLARE @PayPeriodOct INT;
EXEC dbo.sp_HRM_CalculatePayroll '2026-10', NULL, N'Admin Hệ thống', @PayPeriodOct OUTPUT;
-- Phê duyệt và KHÓA kỳ lương tháng 10
EXEC dbo.sp_HRM_LockPayrollPeriod @PayPeriodOct, N'Lê Kế Toán Trưởng';
PRINT N'-> Đã tính và KHÓA bảng lương tháng 2026-10.';
GO

PRINT N'>>> HOÀN TẤT NẠP TOÀN BỘ DỮ LIỆU SEED CHO MODULE HRM THÀNH CÔNG! <<<';
GO
