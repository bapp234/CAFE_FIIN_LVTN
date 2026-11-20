USE [CoffeeShopDB];
GO

-- ============================================================================
-- 1. BẢNG DANH MỤC MÃ TĂNG CA (dbo.OvertimeTypes)
-- ============================================================================
IF OBJECT_ID('dbo.OvertimeTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.OvertimeTypes (
        OvertimeTypeId         INT IDENTITY(1,1) PRIMARY KEY,
        OTCode                 VARCHAR(30)   NOT NULL UNIQUE,
        OTName                 NVARCHAR(150) NOT NULL,
        OTCategory             VARCHAR(20)   NOT NULL DEFAULT 'normal',   -- normal | weekend | holiday | night
        Scope                  VARCHAR(20)   NOT NULL DEFAULT 'all',      -- all | store | office
        PayMultiplier          DECIMAL(5,2)  NOT NULL DEFAULT 150.00,     -- % lương (150, 200, 300...)
        NightExtraRate         DECIMAL(5,2)  NOT NULL DEFAULT 0.00,       -- % phụ cấp đêm cộng thêm
        MaxHoursPerDay         DECIMAL(5,2)  NOT NULL DEFAULT 4.00,
        MaxHoursPerMonth       DECIMAL(5,2)  NOT NULL DEFAULT 40.00,
        RoundingMinutes        INT           NOT NULL DEFAULT 15,
        RequireApproval        BIT           NOT NULL DEFAULT 1,
        AllowCompensatoryLeave BIT           NOT NULL DEFAULT 0,
        Description            NVARCHAR(500) NULL,
        IsActive               BIT           NOT NULL DEFAULT 1,
        CreatedAt              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt              DATETIME2     NULL
    );
END
GO

-- ============================================================================
-- 2. BẢNG DANH MỤC MÃ NGHỈ PHÉP (dbo.LeaveTypes)
-- ============================================================================
IF OBJECT_ID('dbo.LeaveTypes', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.LeaveTypes (
        LeaveTypeId            INT IDENTITY(1,1) PRIMARY KEY,
        LeaveCode              VARCHAR(30)   NOT NULL UNIQUE,
        LeaveName              NVARCHAR(150) NOT NULL,
        Scope                  VARCHAR(20)   NOT NULL DEFAULT 'all',      -- all | store | office
        IsPaid                 BIT           NOT NULL DEFAULT 1,
        PaidPercent            DECIMAL(5,2)  NOT NULL DEFAULT 100.00,     -- % lương được hưởng khi nghỉ
        DeductAnnualLeave      BIT           NOT NULL DEFAULT 1,          -- Có trừ vào quỹ phép năm không
        StandardDaysPerYear    DECIMAL(5,2)  NOT NULL DEFAULT 12.00,
        MinNoticeDays          INT           NOT NULL DEFAULT 1,
        MonthlyAccrual         BIT           NOT NULL DEFAULT 1,
        ProbationEligible      BIT           NOT NULL DEFAULT 0,
        AllowNegativeBalance   BIT           NOT NULL DEFAULT 0,
        Description            NVARCHAR(500) NULL,
        IsActive               BIT           NOT NULL DEFAULT 1,
        CreatedAt              DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt              DATETIME2     NULL
    );
END
GO

-- ============================================================================
-- 3. SEED MÃ TĂNG CA MẶC ĐỊNH (QUÁN CÀ PHÊ & KHỐI VĂN PHÒNG)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.OvertimeTypes)
BEGIN
    INSERT INTO dbo.OvertimeTypes
        (OTCode, OTName, OTCategory, Scope, PayMultiplier, NightExtraRate, MaxHoursPerDay, MaxHoursPerMonth, RoundingMinutes, RequireApproval, AllowCompensatoryLeave, Description, IsActive)
    VALUES
        ('OT-DAY',     N'Tăng ca ngày thường',                 'normal',  'all',    150.00,  0.00, 4.00, 40.00, 15, 1, 0, N'Áp dụng chung cho tăng ca ngày làm việc bình thường (150%).', 1),
        ('OT-CA-GAY',  N'Tăng ca giờ cao điểm / Ca gãy quán',  'normal',  'store',  150.00,  0.00, 4.00, 40.00, 15, 1, 0, N'Hỗ trợ pha chế, phục vụ khi quán đông khách hoặc ghép ca.', 1),
        ('OT-WEEKEND', N'Tăng ca ngày nghỉ tuần',              'weekend', 'all',    200.00,  0.00, 8.00, 40.00, 15, 1, 0, N'Làm thêm vào ngày nghỉ hàng tuần (200%).', 1),
        ('OT-HOLIDAY', N'Tăng ca ngày Lễ, Tết',                'holiday', 'all',    300.00,  0.00, 8.00, 40.00, 15, 1, 0, N'Làm thêm vào ngày Lễ/Tết theo danh mục ngày lễ (300%).', 1),
        ('OT-NIGHT',   N'Tăng ca đêm (sau 22:00)',             'night',   'store',  150.00, 30.00, 4.00, 30.00, 15, 1, 0, N'Dành cho ca đóng quán trễ/vệ sinh kho sau 22h (+30% phụ cấp đêm).', 1),
        ('OT-BU',      N'Làm thêm quy đổi nghỉ bù',            'normal',  'office', 100.00,  0.00, 8.00, 32.00, 30, 1, 1, N'Khối văn phòng làm thêm ngoài giờ và đổi thành ngày nghỉ bù.', 1);
END
GO

-- ============================================================================
-- 4. SEED MÃ NGHỈ PHÉP MẶC ĐỊNH (QUÁN CÀ PHÊ & KHỐI VĂN PHÒNG)
-- ============================================================================
IF NOT EXISTS (SELECT 1 FROM dbo.LeaveTypes)
BEGIN
    INSERT INTO dbo.LeaveTypes
        (LeaveCode, LeaveName, Scope, IsPaid, PaidPercent, DeductAnnualLeave, StandardDaysPerYear, MinNoticeDays, MonthlyAccrual, ProbationEligible, AllowNegativeBalance, Description, IsActive)
    VALUES
        ('LV-PHEP',        N'Nghỉ phép năm',                   'all',    1, 100.00, 1, 12.00, 3, 1, 0, 0, N'Phép năm tiêu chuẩn (12 ngày/năm, cộng dồn mỗi tháng 1 ngày).', 1),
        ('LV-OM',          N'Nghỉ ốm (có giấy y tế)',          'all',    1,  75.00, 0, 30.00, 0, 0, 1, 0, N'Nghỉ ốm hưởng chế độ 75% hoặc theo hồ sơ BHXH, không trừ phép năm.', 1),
        ('LV-KHONG-LUONG', N'Nghỉ việc riêng không lương',     'all',    0,   0.00, 0,  0.00, 1, 0, 1, 0, N'Nghỉ có xin phép nhưng không hưởng lương, không trừ phép năm.', 1),
        ('LV-CUOI',        N'Nghỉ kết hôn (Luật LĐ)',          'all',    1, 100.00, 0,  3.00, 7, 0, 1, 0, N'Nghỉ chế độ kết hôn 03 ngày hưởng nguyên lương.', 1),
        ('LV-TANG',        N'Nghỉ việc hiếu / Tang chế',       'all',    1, 100.00, 0,  3.00, 0, 0, 1, 0, N'Nghỉ chế độ tang chế 03 ngày hưởng nguyên lương.', 1),
        ('LV-BU',          N'Nghỉ bù tăng ca',                 'office', 1, 100.00, 0,  0.00, 1, 0, 0, 0, N'Sử dụng quỹ giờ OT quy đổi nghỉ bù của khối văn phòng.', 1),
        ('LV-DOI-CA',      N'Nghỉ đột xuất / Bận ca quán',     'store',  0,   0.00, 0,  0.00, 0, 0, 1, 0, N'Nhân viên quán xin nghỉ đột xuất khi chưa tìm được người đổi ca.', 1);
END
GO

-- ============================================================================
-- 5. STORED PROCEDURES CHO MÃ TĂNG CA (OvertimeTypes)
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetOvertimeTypes
    @Scope  VARCHAR(20) = NULL,
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ScopeFilter VARCHAR(20) = NULLIF(LOWER(LTRIM(RTRIM(@Scope))), '');
    DECLARE @SearchTerm  NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    SELECT
        OvertimeTypeId, OTCode, OTName, OTCategory, Scope,
        PayMultiplier, NightExtraRate, MaxHoursPerDay, MaxHoursPerMonth,
        RoundingMinutes, RequireApproval, AllowCompensatoryLeave,
        Description, IsActive, CreatedAt, UpdatedAt
    FROM dbo.OvertimeTypes
    WHERE (@ScopeFilter IS NULL OR @ScopeFilter = 'all' OR Scope = @ScopeFilter)
      AND (
            @SearchTerm IS NULL
            OR OTCode LIKE '%' + @SearchTerm + '%'
            OR OTName LIKE N'%' + @SearchTerm + N'%'
          )
    ORDER BY IsActive DESC, OTCode ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_SaveOvertimeType
    @OvertimeTypeId         INT = NULL,
    @OTCode                 VARCHAR(30),
    @OTName                 NVARCHAR(150),
    @OTCategory             VARCHAR(20) = 'normal',
    @Scope                  VARCHAR(20) = 'all',
    @PayMultiplier          DECIMAL(5,2) = 150.00,
    @NightExtraRate         DECIMAL(5,2) = 0.00,
    @MaxHoursPerDay         DECIMAL(5,2) = 4.00,
    @MaxHoursPerMonth       DECIMAL(5,2) = 40.00,
    @RoundingMinutes        INT = 15,
    @RequireApproval        BIT = 1,
    @AllowCompensatoryLeave BIT = 0,
    @Description            NVARCHAR(500) = NULL,
    @IsActive               BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Code VARCHAR(30) = UPPER(LTRIM(RTRIM(@OTCode)));
    DECLARE @Name NVARCHAR(150) = LTRIM(RTRIM(@OTName));

    IF @Code = '' OR @Name = ''
    BEGIN
        RAISERROR(N'Mã OT và Tên loại tăng ca không được để trống.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM dbo.OvertimeTypes
        WHERE OTCode = @Code AND (@OvertimeTypeId IS NULL OR OvertimeTypeId <> @OvertimeTypeId)
    )
    BEGIN
        RAISERROR(N'Mã tăng ca (%s) đã tồn tại trong hệ thống.', 16, 1, @Code);
        RETURN;
    END

    IF @OvertimeTypeId IS NULL OR @OvertimeTypeId <= 0
    BEGIN
        INSERT INTO dbo.OvertimeTypes
            (OTCode, OTName, OTCategory, Scope, PayMultiplier, NightExtraRate, MaxHoursPerDay, MaxHoursPerMonth, RoundingMinutes, RequireApproval, AllowCompensatoryLeave, Description, IsActive)
        VALUES
            (@Code, @Name, @OTCategory, @Scope, @PayMultiplier, @NightExtraRate, @MaxHoursPerDay, @MaxHoursPerMonth, @RoundingMinutes, @RequireApproval, @AllowCompensatoryLeave, @Description, @IsActive);

        SELECT SCOPE_IDENTITY() AS OvertimeTypeId;
    END
    ELSE
    BEGIN
        UPDATE dbo.OvertimeTypes
        SET OTCode = @Code,
            OTName = @Name,
            OTCategory = @OTCategory,
            Scope = @Scope,
            PayMultiplier = @PayMultiplier,
            NightExtraRate = @NightExtraRate,
            MaxHoursPerDay = @MaxHoursPerDay,
            MaxHoursPerMonth = @MaxHoursPerMonth,
            RoundingMinutes = @RoundingMinutes,
            RequireApproval = @RequireApproval,
            AllowCompensatoryLeave = @AllowCompensatoryLeave,
            Description = @Description,
            IsActive = @IsActive,
            UpdatedAt = SYSUTCDATETIME()
        WHERE OvertimeTypeId = @OvertimeTypeId;

        SELECT @OvertimeTypeId AS OvertimeTypeId;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_DeleteOvertimeType
    @OvertimeTypeId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.OvertimeTypes WHERE OvertimeTypeId = @OvertimeTypeId;
    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 6. STORED PROCEDURES CHO MÃ NGHỈ PHÉP (LeaveTypes)
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetLeaveTypes
    @Scope  VARCHAR(20) = NULL,
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @ScopeFilter VARCHAR(20) = NULLIF(LOWER(LTRIM(RTRIM(@Scope))), '');
    DECLARE @SearchTerm  NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    SELECT
        LeaveTypeId, LeaveCode, LeaveName, Scope,
        IsPaid, PaidPercent, DeductAnnualLeave, StandardDaysPerYear,
        MinNoticeDays, MonthlyAccrual, ProbationEligible, AllowNegativeBalance,
        Description, IsActive, CreatedAt, UpdatedAt
    FROM dbo.LeaveTypes
    WHERE (@ScopeFilter IS NULL OR @ScopeFilter = 'all' OR Scope = @ScopeFilter)
      AND (
            @SearchTerm IS NULL
            OR LeaveCode LIKE '%' + @SearchTerm + '%'
            OR LeaveName LIKE N'%' + @SearchTerm + N'%'
          )
    ORDER BY IsActive DESC, LeaveCode ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_SaveLeaveType
    @LeaveTypeId          INT = NULL,
    @LeaveCode            VARCHAR(30),
    @LeaveName            NVARCHAR(150),
    @Scope                VARCHAR(20) = 'all',
    @IsPaid               BIT = 1,
    @PaidPercent          DECIMAL(5,2) = 100.00,
    @DeductAnnualLeave    BIT = 1,
    @StandardDaysPerYear  DECIMAL(5,2) = 12.00,
    @MinNoticeDays        INT = 1,
    @MonthlyAccrual       BIT = 1,
    @ProbationEligible    BIT = 0,
    @AllowNegativeBalance BIT = 0,
    @Description          NVARCHAR(500) = NULL,
    @IsActive             BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Code VARCHAR(30) = UPPER(LTRIM(RTRIM(@LeaveCode)));
    DECLARE @Name NVARCHAR(150) = LTRIM(RTRIM(@LeaveName));

    IF @Code = '' OR @Name = ''
    BEGIN
        RAISERROR(N'Mã nghỉ phép và Tên loại nghỉ phép không được để trống.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM dbo.LeaveTypes
        WHERE LeaveCode = @Code AND (@LeaveTypeId IS NULL OR LeaveTypeId <> @LeaveTypeId)
    )
    BEGIN
        RAISERROR(N'Mã nghỉ phép (%s) đã tồn tại trong hệ thống.', 16, 1, @Code);
        RETURN;
    END

    IF @IsPaid = 0
        SET @PaidPercent = 0.00;

    IF @LeaveTypeId IS NULL OR @LeaveTypeId <= 0
    BEGIN
        INSERT INTO dbo.LeaveTypes
            (LeaveCode, LeaveName, Scope, IsPaid, PaidPercent, DeductAnnualLeave, StandardDaysPerYear, MinNoticeDays, MonthlyAccrual, ProbationEligible, AllowNegativeBalance, Description, IsActive)
        VALUES
            (@Code, @Name, @Scope, @IsPaid, @PaidPercent, @DeductAnnualLeave, @StandardDaysPerYear, @MinNoticeDays, @MonthlyAccrual, @ProbationEligible, @AllowNegativeBalance, @Description, @IsActive);

        SELECT SCOPE_IDENTITY() AS LeaveTypeId;
    END
    ELSE
    BEGIN
        UPDATE dbo.LeaveTypes
        SET LeaveCode = @Code,
            LeaveName = @Name,
            Scope = @Scope,
            IsPaid = @IsPaid,
            PaidPercent = @PaidPercent,
            DeductAnnualLeave = @DeductAnnualLeave,
            StandardDaysPerYear = @StandardDaysPerYear,
            MinNoticeDays = @MinNoticeDays,
            MonthlyAccrual = @MonthlyAccrual,
            ProbationEligible = @ProbationEligible,
            AllowNegativeBalance = @AllowNegativeBalance,
            Description = @Description,
            IsActive = @IsActive,
            UpdatedAt = SYSUTCDATETIME()
        WHERE LeaveTypeId = @LeaveTypeId;

        SELECT @LeaveTypeId AS LeaveTypeId;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_DeleteLeaveType
    @LeaveTypeId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.LeaveTypes WHERE LeaveTypeId = @LeaveTypeId;
    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 7. STORED PROCEDURE LẤY NGÀY LỄ THEO NĂM (dbo.Holidays)
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetHolidaysByYear
    @Year INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @TargetYear INT = ISNULL(@Year, YEAR(GETDATE()));

    SELECT HolidayId, HolidayDate, HolidayName, Year, PayMultiplier, IsPaid
    FROM dbo.Holidays
    WHERE Year = @TargetYear
    ORDER BY HolidayDate ASC;
END
GO
