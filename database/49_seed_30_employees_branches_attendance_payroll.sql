USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- KHỞI TẠO 3 CHI NHÁNH BÁN LẺ + 30 NHÂN VIÊN CHIA ĐỀU CẤP / QUYỀN / CHI NHÁNH
-- KÈM PHÂN CA, CHẤM CÔNG & BẢNG LƯƠNG THÁNG 11/2026 ĐẾN NGÀY 20/11/2026
-- ============================================================================
BEGIN TRY
    BEGIN TRANSACTION;

    IF OBJECT_ID('dbo.ShiftAssignments', 'U') IS NOT NULL
        DISABLE TRIGGER ALL ON dbo.ShiftAssignments;
    IF OBJECT_ID('dbo.Attendances', 'U') IS NOT NULL
        DISABLE TRIGGER ALL ON dbo.Attendances;

    -- Lấy PasswordHash của admin để dùng chung cho tài khoản test nhân viên
    DECLARE @DefaultHash NVARCHAR(255) = (SELECT TOP 1 PasswordHash FROM dbo.Users WHERE Username = 'admin');
    IF @DefaultHash IS NULL
        THROW 55001, N'Không tìm thấy tài khoản admin để lấy PasswordHash mẫu.', 1;

    -- 1. ĐẢM BẢO 4 CHI NHÁNH (00 Trụ sở chính + 01, 02, 03 Cửa hàng)
    MERGE INTO dbo.Branches AS target
    USING (VALUES
        ('00', N'Trụ sở chính (Toàn hệ thống)', N'120 Đinh Tiên Hoàng, Đa Kao, Quận 1, TP.HCM', '0901234567'),
        ('01', N'Fiin Đinh Tiên Hoàng',        N'12 Đinh Tiên Hoàng, Đa Kao, Quận 1, TP.HCM',  '02838221101'),
        ('02', N'Fiin Hồ Con Rùa',             N'42 Trần Cao Vân, Phường 6, Quận 3, TP.HCM',   '02838221102'),
        ('03', N'Fiin Võ Văn Ngân',            N'108 Võ Văn Ngân, Linh Chiểu, Thủ Đức, TP.HCM', '02838221103')
    ) AS src (BranchCode, BranchName, Address, PhoneNumber)
    ON target.BranchCode = src.BranchCode
    WHEN NOT MATCHED THEN
        INSERT (BranchCode, BranchName, Address, PhoneNumber, IsActive)
        VALUES (src.BranchCode, src.BranchName, src.Address, src.PhoneNumber, 1);

    DECLARE @B00 INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = '00');
    DECLARE @B01 INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = '01');
    DECLARE @B02 INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = '02');
    DECLARE @B03 INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE BranchCode = '03');

    -- 2. ĐẢM BẢO DANH MỤC CÔNG / OT / PHÉP / LƯƠNG CƠ BẢN
    IF NOT EXISTS (SELECT 1 FROM dbo.OvertimeTypes)
    BEGIN
        INSERT INTO dbo.OvertimeTypes (OTCode, OTName, OTCategory, Scope, PayMultiplier, NightExtraRate, MaxHoursPerDay, MaxHoursPerMonth, RoundingMinutes, RequireApproval, AllowCompensatoryLeave, Description, IsActive)
        VALUES
            ('OT-NORMAL',  N'Tăng ca ngày thường (150%)', 'normal',  'all', 150, 0, 4, 40, 15, 1, 0, N'Làm thêm giờ ngày làm việc bình thường', 1),
            ('OT-WEEKEND', N'Tăng ca cuối tuần (200%)',    'weekend', 'all', 200, 0, 8, 40, 15, 1, 0, N'Làm thêm giờ Thứ 7 / Chủ Nhật', 1),
            ('OT-HOLIDAY', N'Tăng ca ngày lễ (300%)',      'holiday', 'all', 300, 0, 8, 40, 15, 1, 0, N'Làm thêm giờ ngày Lễ Tết', 1);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.LeaveTypes)
    BEGIN
        INSERT INTO dbo.LeaveTypes (LeaveCode, LeaveName, Scope, IsPaid, PaidPercent, DeductAnnualLeave, StandardDaysPerYear, IsActive)
        VALUES
            ('AL',   N'Nghỉ phép năm (hưởng lương)',  'all', 1, 100, 1, 12, 1),
            ('SL',   N'Nghỉ ốm (hưởng BHXH/lương)',   'all', 1, 75,  0, 30, 1),
            ('UL',   N'Nghỉ không lương',             'all', 0, 0,   0, 30, 1);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.PayrollSettings)
    BEGIN
        INSERT INTO dbo.PayrollSettings (Code, Name, Category, CalcType, RawValue, Impact, ApplyScope, Note, IsActive)
        VALUES
            ('STANDARD_WORK_DAYS',   N'Số ngày công chuẩn/tháng',  N'general',   N'fixed', 26,    N'neutral', N'all', N'Số ngày công chuẩn để quy đổi lương tháng', 1),
            ('MEAL_ALLOWANCE_DAY',   N'Phụ cấp cơm ca / ngày',     N'allowance', N'fixed', 25000, N'add',     N'all', N'Phụ cấp tiền cơm mỗi ngày đi làm thực tế', 1),
            ('LATE_PENALTY_AMOUNT',  N'Phạt đi trễ từ lần thứ 3',  N'deduction', N'fixed', 50000, N'deduct',  N'all', N'Khấu trừ mỗi lần đi trễ/về sớm từ lần 3', 1);
    END

    -- Lấy ID các loại hợp đồng và ca làm việc
    DECLARE @CT_ThuViec   INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-THU-VIEC');
    DECLARE @CT_LaoDong   INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-LAO-DONG');
    DECLARE @CT_CoThoiHan INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-CO-THOI-HAN');
    DECLARE @CT_VoThoiHan INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-VO-THOI-HAN');
    DECLARE @CT_PartTime  INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-PART-TIME');

    DECLARE @ShiftSang  INT = (SELECT TOP 1 TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-SANG');
    DECLARE @ShiftChieu INT = (SELECT TOP 1 TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-CHIEU');
    DECLARE @ShiftHC    INT = (SELECT TOP 1 TemplateId FROM dbo.ShiftTemplates WHERE ShiftCode = 'CA-HC');

    -- 3. DANH SÁCH 30 NHÂN VIÊN CHUẨN (CHIA ĐỀU CẤP 1..4, QUYỀN VÀ CHI NHÁNH 00, 01, 02, 03)
    DECLARE @SeedEmps TABLE (
        Idx            INT IDENTITY(1,1),
        EmpCode        VARCHAR(20),
        Username       VARCHAR(50),
        FullName       NVARCHAR(100),
        Phone          VARCHAR(20),
        CitizenId      VARCHAR(20),
        Gender         VARCHAR(10),
        Position       NVARCHAR(50),
        BranchId       INT,
        RoleId         INT,
        ApprovalLvl    TINYINT,
        ContractTypeId INT,
        ContractCode   VARCHAR(20),
        HourlyRate     DECIMAL(12,0),
        Allowance      DECIMAL(12,0),
        HireDate       DATE
    );

    INSERT INTO @SeedEmps (EmpCode, Username, FullName, Phone, CitizenId, Gender, Position, BranchId, RoleId, ApprovalLvl, ContractTypeId, ContractCode, HourlyRate, Allowance, HireDate)
    VALUES
        -- Cấp 4 (6 nhân sự tại Trụ sở 00: 3 HRManager + 3 Accountant)
        ('HRTP0040', 'hr_linh',   N'Nguyễn Ngọc Linh',   '0902000101', '079192001001', 'female', N'Trưởng phòng Nhân sự (HRM)',    @B00, 2, 4, @CT_VoThoiHan, 'full_time', 48000, 1500000, '2024-03-01'),
        ('HRTP0041', 'hr_minh',   N'Trần Quang Minh',    '0902000102', '079093001002', 'male',   N'Chuyên viên Nhân sự (HRM)',     @B00, 2, 4, @CT_CoThoiHan, 'full_time', 38000, 1000000, '2024-08-15'),
        ('HRTP0042', 'hr_thao',   N'Lê Phương Thảo',     '0902000103', '079195001003', 'female', N'Chuyên viên Tiền lương (C&B)',  @B00, 2, 4, @CT_CoThoiHan, 'full_time', 38000, 1000000, '2025-01-10'),
        ('KTNV0040', 'kt_hung',   N'Phạm Quốc Hùng',     '0902000104', '079091001004', 'male',   N'Kế toán trưởng (Accountant)',   @B00, 7, 4, @CT_VoThoiHan, 'full_time', 46000, 1500000, '2024-04-01'),
        ('KTNV0041', 'kt_mai',    N'Võ Tuyết Mai',       '0902000105', '079194001005', 'female', N'Kế toán tổng hợp',              @B00, 7, 4, @CT_CoThoiHan, 'full_time', 36000, 800000,  '2025-02-01'),
        ('KTNV0042', 'kt_tuan',   N'Đỗ Anh Tuấn',        '0902000106', '079096001006', 'male',   N'Kế toán công nợ & lương',       @B00, 7, 4, @CT_LaoDong,   'full_time', 34000, 700000,  '2025-06-01'),

        -- Cấp 3 (3 Cửa hàng trưởng - mỗi chi nhánh 01, 02, 03 có 1 người)
        ('SMCH0130', 'sm_q1',     N'Huỳnh Gia Bảo',      '0902000201', '079092002001', 'male',   N'Cửa hàng trưởng (Store Manager)', @B01, 3, 3, @CT_VoThoiHan, 'full_time', 42000, 1500000, '2024-05-01'),
        ('SMCH0230', 'sm_q3',     N'Bùi Thị Thanh Hằng', '0902000202', '079193002002', 'female', N'Cửa hàng trưởng (Store Manager)', @B02, 3, 3, @CT_VoThoiHan, 'full_time', 42000, 1500000, '2024-06-01'),
        ('SMCH0330', 'sm_td',     N'Đặng Hoàng Nam',     '0902000203', '079094002003', 'male',   N'Cửa hàng trưởng (Store Manager)', @B03, 3, 3, @CT_CoThoiHan, 'full_time', 40000, 1500000, '2024-09-01'),

        -- Cấp 2 (6 Trưởng ca - mỗi chi nhánh 01, 02, 03 có 2 người)
        ('SLTC0120', 'sl_q1_1',   N'Nguyễn Hữu Nghĩa',   '0902000301', '079097003001', 'male',   N'Trưởng ca Pha chế (Shift Leader)', @B01, 6, 2, @CT_LaoDong, 'full_time', 34000, 700000, '2025-01-15'),
        ('SLTC0121', 'sl_q1_2',   N'Phan Mỹ Duyên',      '0902000302', '079198003002', 'female', N'Trưởng ca Pha chế (Shift Leader)', @B01, 6, 2, @CT_LaoDong, 'full_time', 34000, 700000, '2025-03-01'),
        ('SLTC0220', 'sl_q3_1',   N'Lương Minh Trí',     '0902000303', '079097003003', 'male',   N'Trưởng ca Pha chế (Shift Leader)', @B02, 6, 2, @CT_LaoDong, 'full_time', 34000, 700000, '2025-02-10'),
        ('SLTC0221', 'sl_q3_2',   N'Trịnh Kim Ngân',     '0902000304', '079199003004', 'female', N'Trưởng ca Pha chế (Shift Leader)', @B02, 6, 2, @CT_LaoDong, 'full_time', 34000, 700000, '2025-04-01'),
        ('SLTC0320', 'sl_td_1',   N'Hồ Tấn Phát',        '0902000305', '079098003005', 'male',   N'Trưởng ca Pha chế (Shift Leader)', @B03, 6, 2, @CT_LaoDong, 'full_time', 33000, 700000, '2025-03-15'),
        ('SLTC0321', 'sl_td_2',   N'Vũ Hoàng Yến',       '0902000306', '079199003006', 'female', N'Trưởng ca Pha chế (Shift Leader)', @B03, 6, 2, @CT_LaoDong, 'full_time', 33000, 700000, '2025-05-01'),

        -- Cấp 1 - Chi nhánh 01 (5 nhân sự: 2 Barista, 2 Thu ngân, 1 Phục vụ)
        ('BRPC0110', 'br_q1_1',   N'Ngô Đức Thịnh',      '0902000401', '079200004001', 'male',   N'Barista Chuyên nghiệp',          @B01, 5, 1, @CT_LaoDong,   'full_time', 30000, 500000, '2025-07-01'),
        ('BRPC0111', 'br_q1_2',   N'Dương Bảo Ngọc',     '0902000402', '079301004002', 'female', N'Barista Học việc / Phụ bar',     @B01, 5, 1, @CT_ThuViec,   'full_time', 25000, 300000, '2026-10-01'),
        ('CSTN0110', 'cs_q1_1',   N'Tạ Minh Khang',      '0902000403', '079201004003', 'male',   N'Thu ngân bán hàng POS',          @B01, 4, 1, @CT_LaoDong,   'full_time', 28000, 500000, '2025-08-01'),
        ('CSTN0111', 'cs_q1_2',   N'Lý Thu Hà',          '0902000404', '079302004004', 'female', N'Thu ngân bán hàng POS',          @B01, 4, 1, @CT_PartTime,  'part_time', 25000, 0,      '2026-09-01'),
        ('SVPV0110', 'sv_q1_1',   N'Mai Gia Huy',        '0902000405', '079203004005', 'male',   N'Nhân viên Phục vụ & Chăm sóc bàn', @B01, 8, 1, @CT_PartTime, 'part_time', 24000, 0,     '2026-09-15'),

        -- Cấp 1 - Chi nhánh 02 (5 nhân sự)
        ('BRPC0210', 'br_q3_1',   N'Châu Vĩnh Khang',    '0902000406', '079200004006', 'male',   N'Barista Chuyên nghiệp',          @B02, 5, 1, @CT_LaoDong,   'full_time', 30000, 500000, '2025-07-15'),
        ('BRPC0211', 'br_q3_2',   N'Nguyễn Thảo Vy',     '0902000407', '079301004007', 'female', N'Barista Học việc / Phụ bar',     @B02, 5, 1, @CT_ThuViec,   'full_time', 25000, 300000, '2026-10-05'),
        ('CSTN0210', 'cs_q3_1',   N'Trương Nhật Hào',    '0902000408', '079201004008', 'male',   N'Thu ngân bán hàng POS',          @B02, 4, 1, @CT_LaoDong,   'full_time', 28000, 500000, '2025-09-01'),
        ('CSTN0211', 'cs_q3_2',   N'Phạm Cẩm Tú',        '0902000409', '079302004009', 'female', N'Thu ngân bán hàng POS',          @B02, 4, 1, @CT_PartTime,  'part_time', 25000, 0,      '2026-09-10'),
        ('SVPV0210', 'sv_q3_1',   N'Võ Thành Đạt',       '0902000410', '079203004010', 'male',   N'Nhân viên Phục vụ & Chăm sóc bàn', @B02, 8, 1, @CT_PartTime, 'part_time', 24000, 0,     '2026-10-01'),

        -- Cấp 1 - Chi nhánh 03 (5 nhân sự)
        ('BRPC0310', 'br_td_1',   N'Đoàn Thanh Tùng',    '0902000411', '079200004011', 'male',   N'Barista Chuyên nghiệp',          @B03, 5, 1, @CT_LaoDong,   'full_time', 30000, 500000, '2025-08-10'),
        ('BRPC0311', 'br_td_2',   N'Kiều Thiên Kim',     '0902000412', '079301004012', 'female', N'Barista Học việc / Phụ bar',     @B03, 5, 1, @CT_ThuViec,   'full_time', 25000, 300000, '2026-10-10'),
        ('CSTN0310', 'cs_td_1',   N'Nguyễn Hoàng Phúc',  '0902000413', '079201004013', 'male',   N'Thu ngân bán hàng POS',          @B03, 4, 1, @CT_LaoDong,   'full_time', 28000, 500000, '2025-09-15'),
        ('CSTN0311', 'cs_td_2',   N'Lâm Ánh Nguyệt',     '0902000414', '079302004014', 'female', N'Thu ngân bán hàng POS',          @B03, 4, 1, @CT_PartTime,  'part_time', 25000, 0,      '2026-09-20'),
        ('SVPV0310', 'sv_td_1',   N'Tống Gia Kiệt',      '0902000415', '079203004015', 'male',   N'Nhân viên Phục vụ & Chăm sóc bàn', @B03, 8, 1, @CT_PartTime, 'part_time', 24000, 0,     '2026-10-01');

    -- Chèn từng nhân sự: Users -> UserRoles -> Employees -> Approvers -> EmployeeContracts -> AnnualLeaves
    DECLARE @i INT = 1, @maxI INT = (SELECT COUNT(*) FROM @SeedEmps);
    DECLARE @AdminEmpId INT = (SELECT TOP 1 EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'ADGD0050');

    WHILE @i <= @maxI
    BEGIN
        DECLARE @eCode VARCHAR(20), @uName VARCHAR(50), @fName NVARCHAR(100), @phone VARCHAR(20), @cccd VARCHAR(20),
                @gender VARCHAR(10), @pos NVARCHAR(50), @bId INT, @rId INT, @appLvl TINYINT,
                @ctId INT, @ctCode VARCHAR(20), @hRate DECIMAL(12,0), @allow DECIMAL(12,0), @hDate DATE;

        SELECT
            @eCode = EmpCode, @uName = Username, @fName = FullName, @phone = Phone, @cccd = CitizenId,
            @gender = Gender, @pos = Position, @bId = BranchId, @rId = RoleId, @appLvl = ApprovalLvl,
            @ctId = ContractTypeId, @ctCode = ContractCode, @hRate = HourlyRate, @allow = Allowance, @hDate = HireDate
        FROM @SeedEmps WHERE Idx = @i;

        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeCode = @eCode)
        BEGIN
            INSERT INTO dbo.Users (Username, PasswordHash, FullName, Email, PhoneNumber, IsActive, MustChangePassword)
            VALUES (@uName, @DefaultHash, @fName, LOWER(@uName) + '@fiincoffee.vn', @phone, 1, 0);
            DECLARE @newUid INT = SCOPE_IDENTITY();

            INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@newUid, @rId);

            INSERT INTO dbo.Employees (
                UserId, EmployeeCode, FullName, PhoneNumber, DateOfBirth, Gender, CitizenId,
                BankName, BankAccountNumber, BankAccountName,
                Position, HireDate, HourlyRate, BranchId, Status, ContractType, ContractTypeId, Note, UpdatedAt
            )
            VALUES (
                @newUid, @eCode, @fName, @phone, DATEADD(YEAR, -24 - (@i % 8), '2026-01-01'), @gender, @cccd,
                CASE @i % 3 WHEN 0 THEN N'Vietcombank' WHEN 1 THEN N'Techcombank' ELSE N'MB Bank' END,
                '1000' + RIGHT('000000' + CAST(100000 + @i * 137 AS VARCHAR(10)), 6),
                UPPER(@fName),
                @pos, @hDate, @hRate, @bId,
                'active',
                @ctCode, @ctId, N'Nhân sự chuẩn khởi tạo hệ thống', SYSDATETIME()
            );
            DECLARE @newEmpId INT = SCOPE_IDENTITY();

            IF @appLvl >= 2
            BEGIN
                INSERT INTO dbo.Approvers (EmployeeId, ApprovalLevel, BranchId, IsActive)
                VALUES (@newEmpId, @appLvl, @bId, 1);
            END

            -- Hợp đồng active
            DECLARE @months INT = (SELECT DurationMonths FROM dbo.ContractTypes WHERE ContractTypeId = @ctId);
            DECLARE @endDate DATE = CASE WHEN @months IS NOT NULL AND @months > 0 THEN DATEADD(MONTH, @months, @hDate) ELSE NULL END;
            INSERT INTO dbo.EmployeeContracts (
                ContractCode, EmployeeId, ContractTypeId, Position,
                HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                RequestedByEmployeeId, ApprovedByEmployeeId, ApprovedAt, ActionType, CreatedAt, UpdatedAt
            )
            VALUES (
                'HD-' + @eCode + '-01', @newEmpId, @ctId, @pos,
                @hRate, @allow, @hDate, @endDate, 'active', @hDate, N'Hợp đồng lao động chính thức',
                @AdminEmpId, @AdminEmpId, SYSDATETIME(), 'new', SYSDATETIME(), SYSDATETIME()
            );

            -- Quỹ phép năm 2026
            INSERT INTO dbo.EmployeeAnnualLeaves (EmployeeId, [Year], StandardDays, SeniorityDays, CarriedOverDays, UsedDays)
            VALUES (@newEmpId, 2026, 12.0, 0, 0, CASE WHEN @i % 5 = 0 THEN 1.0 ELSE 0 END);
        END

        SET @i += 1;
    END

    -- 4. TẠO LỊCH PHÂN CA & CHẤM CÔNG TỪ 01/11/2026 ĐẾN 20/11/2026 (NGÀY HIỆN TẠI)
    DECLARE @WorkDate DATE = '2026-11-01';
    DECLARE @Today    DATE = '2026-11-20';

    WHILE @WorkDate <= @Today
    BEGIN
        DECLARE @Dow INT = ((DATEPART(WEEKDAY, @WorkDate) + @@DATEFIRST - 2) % 7) + 1; -- 1=Thứ 2 ... 7=CN

        -- Chèn ShiftAssignments cho 30 nhân viên (trừ ngày nghỉ theo lịch)
        INSERT INTO dbo.ShiftAssignments (EmployeeId, TemplateId, WorkDate, BranchId, RegisteredBy, Status, Note)
        SELECT
            e.EmployeeId,
            CASE
                WHEN e.BranchId = @B00 THEN @ShiftHC
                WHEN e.Position LIKE N'%Cửa hàng trưởng%' THEN @ShiftHC
                WHEN (e.EmployeeId + DAY(@WorkDate)) % 2 = 0 THEN @ShiftSang
                ELSE @ShiftChieu
            END AS TemplateId,
            @WorkDate,
            e.BranchId,
            'manager',
            'scheduled',
            N'Phân ca tháng 11/2026'
        FROM dbo.Employees e
        WHERE e.EmployeeCode <> 'ADGD0050'
          AND (
              (e.BranchId = @B00 AND @Dow BETWEEN 1 AND 5) -- Khối VP làm T2-T6
              OR (e.BranchId <> @B00 AND @Dow <> ((e.EmployeeId % 7) + 1)) -- Khối cửa hàng nghỉ 1 ngày/tuần
          );

        -- Chèn Attendances tương ứng cho mỗi ca đến ngày 20/11/2026
        INSERT INTO dbo.Attendances (
            EmployeeId, ShiftAssignmentId, WorkDate, CheckInTime, CheckOutTime,
            LateMinutes, EarlyLeaveMinutes, WorkHours, Status, IsManualAdjusted
        )
        SELECT
            sa.EmployeeId,
            sa.AssignmentId,
            @WorkDate,
            DATEADD(MINUTE,
                CASE WHEN (sa.EmployeeId + DAY(@WorkDate)) % 19 = 0 THEN 12 ELSE 0 END,
                CAST(CONCAT(CONVERT(VARCHAR(10), @WorkDate, 120), ' ', CONVERT(VARCHAR(8), st.StartTime, 108)) AS DATETIME2(0))
            ) AS CheckInTime,
            CAST(CONCAT(CONVERT(VARCHAR(10), @WorkDate, 120), ' ', CONVERT(VARCHAR(8), st.EndTime, 108)) AS DATETIME2(0)) AS CheckOutTime,
            CASE WHEN (sa.EmployeeId + DAY(@WorkDate)) % 19 = 0 THEN 12 ELSE 0 END AS LateMinutes,
            0 AS EarlyLeaveMinutes,
            st.StandardHours AS WorkHours,
            CASE WHEN (sa.EmployeeId + DAY(@WorkDate)) % 19 = 0 THEN 'late' ELSE 'on_time' END AS Status,
            0
        FROM dbo.ShiftAssignments sa
        INNER JOIN dbo.ShiftTemplates st ON sa.TemplateId = st.TemplateId
        WHERE sa.WorkDate = @WorkDate;

        SET @WorkDate = DATEADD(DAY, 1, @WorkDate);
    END

    -- 5. KHÓA KỲ CÔNG THÁNG 2026-11 CHO TẤT CẢ CHI NHÁNH ĐỂ TÍNH BẢNG LƯƠNG ĐẾN 20/11
    INSERT INTO dbo.AttendancePeriods (BranchId, PeriodMonth, IsLocked, LockedBy, LockedAt)
    SELECT BranchId, '2026-11', 1, 'ADGD0050', SYSDATETIME()
    FROM dbo.Branches b
    WHERE NOT EXISTS (SELECT 1 FROM dbo.AttendancePeriods ap WHERE ap.BranchId = b.BranchId AND ap.PeriodMonth = '2026-11');

    IF OBJECT_ID('dbo.ShiftAssignments', 'U') IS NOT NULL
        ENABLE TRIGGER ALL ON dbo.ShiftAssignments;
    IF OBJECT_ID('dbo.Attendances', 'U') IS NOT NULL
        ENABLE TRIGGER ALL ON dbo.Attendances;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
    IF OBJECT_ID('dbo.ShiftAssignments', 'U') IS NOT NULL
        ENABLE TRIGGER ALL ON dbo.ShiftAssignments;
    IF OBJECT_ID('dbo.Attendances', 'U') IS NOT NULL
        ENABLE TRIGGER ALL ON dbo.Attendances;
    THROW;
END CATCH;
GO

-- 6. CHẠY TÍNH BẢNG LƯƠNG THÁNG 2026-11 CHO TỪNG CHI NHÁNH (DỰA TRÊN CÔNG ĐẾN 20/11/2026)
DECLARE @CurBranchId INT, @CalcPeriodId INT;
DECLARE branch_cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT BranchId FROM dbo.Branches WHERE IsActive = 1 ORDER BY BranchId;

OPEN branch_cur;
FETCH NEXT FROM branch_cur INTO @CurBranchId;
WHILE @@FETCH_STATUS = 0
BEGIN
    EXEC dbo.sp_HRM_CalculatePayroll
        @PeriodMonth = '2026-11',
        @BranchId = @CurBranchId,
        @CalculatedBy = N'ADGD0050',
        @PeriodId = @CalcPeriodId OUTPUT;
    FETCH NEXT FROM branch_cur INTO @CurBranchId;
END
CLOSE branch_cur;
DEALLOCATE branch_cur;
GO
PRINT N'-> Đã tạo 4 chi nhánh, 30 nhân viên (chia đều cấp/quyền/chi nhánh), công 01/11-20/11/2026 và bảng lương kỳ 2026-11.';
GO
