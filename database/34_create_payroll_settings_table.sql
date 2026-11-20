USE [CoffeeShopDB];
GO

IF OBJECT_ID('dbo.PayrollSettings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PayrollSettings (
        SettingId   INT IDENTITY(1,1) PRIMARY KEY,
        Code        VARCHAR(40)    NOT NULL UNIQUE,
        Name        NVARCHAR(200)  NOT NULL,
        Category    VARCHAR(30)    NOT NULL DEFAULT 'allowance',   -- allowance | subsidy | insurance | tax | deduction
        CalcType    VARCHAR(30)    NOT NULL DEFAULT 'fixed_month', -- percent | fixed_month | fixed_shift | fixed_count
        RawValue    DECIMAL(18, 2) NOT NULL DEFAULT 0,
        Impact      VARCHAR(20)    NOT NULL DEFAULT 'Addition',    -- Addition | Deduction | Employer
        ApplyScope  NVARCHAR(150)  NOT NULL DEFAULT N'Toàn hệ thống',
        Note        NVARCHAR(500)  NULL,
        IsActive    BIT            NOT NULL DEFAULT 1,
        CreatedAt   DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt   DATETIME2      NULL
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.PayrollSettings)
BEGIN
    INSERT INTO dbo.PayrollSettings
        (Code, Name, Category, CalcType, RawValue, Impact, ApplyScope, Note, IsActive)
    VALUES
        ('PC-COM-CA',    N'Phụ cấp cơm ca theo ngày đi làm',               'allowance', 'fixed_shift',    25000, 'Addition',  N'Toàn hệ thống',       N'Đi làm thực tế 1 ngày được cộng 25.000đ tiền cơm ca', 1),
        ('PC-TRACH-NHIEM',N'Phụ cấp trách nhiệm (Quản lý / Trưởng ca)',     'allowance', 'fixed_month',  1000000, 'Addition',  N'Quản lý & Văn phòng', N'Khoản phụ cấp trách nhiệm cố định hàng tháng', 1),
        ('PC-PART-TIME', N'Phụ cấp hỗ trợ nhân viên Part-time',             'allowance', 'fixed_month',   300000, 'Addition',  N'Quán cà phê (PT)',    N'Hỗ trợ gửi xe / đồng phục cho nhân viên bán thời gian', 1),
        ('PC-CHUYEN-CAN',N'Thưởng chuyên cần đủ công tháng',                'subsidy',   'fixed_month',   300000, 'Addition',  N'Toàn hệ thống',       N'Đạt đủ công chuẩn tháng và không đi trễ quá 2 lần', 1),
        ('KT-DI-TRE',    N'Khấu trừ đi trễ / về sớm (từ lần thứ 3)',        'deduction', 'fixed_count',    50000, 'Deduction', N'Toàn hệ thống',       N'Miễn 2 lần đầu/tháng, từ lần thứ 3 trừ 50.000đ/lần', 1),
        ('BHXH-NLD',     N'Bảo hiểm Xã hội (NLĐ đóng - tùy chọn VP)',       'insurance', 'percent',            8, 'Deduction', N'Hợp đồng chính thức', N'Trích 8% trên mức lương tham gia BHXH', 0),
        ('BHYT-NLD',     N'Bảo hiểm Y tế (NLĐ đóng - tùy chọn VP)',         'insurance', 'percent',          1.5, 'Deduction', N'Hợp đồng chính thức', N'Trích 1.5% trên mức lương tham gia BHXH', 0),
        ('BHTN-NLD',     N'Bảo hiểm Thất nghiệp (NLĐ đóng - tùy chọn VP)',  'insurance', 'percent',            1, 'Deduction', N'Hợp đồng chính thức', N'Trích 1% trên mức lương tham gia BHXH', 0),
        ('THUE-GTGC-BT', N'Giảm trừ gia cảnh bản thân (tham chiếu TNCN)',   'tax',       'fixed_month', 11000000, 'Employer',  N'Khối văn phòng',      N'Mức giảm trừ bản thân theo quy định hiện hành', 0);
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetPayrollSettings
    @Category VARCHAR(30) = NULL,
    @CalcType VARCHAR(30) = NULL,
    @Search   NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Cat VARCHAR(30) = NULLIF(LOWER(LTRIM(RTRIM(@Category))), '');
    DECLARE @Calc VARCHAR(30) = NULLIF(LOWER(LTRIM(RTRIM(@CalcType))), '');
    DECLARE @Kw NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    SELECT
        SettingId, Code, Name, Category, CalcType, RawValue,
        Impact, ApplyScope, Note, IsActive, CreatedAt, UpdatedAt
    FROM dbo.PayrollSettings
    WHERE (@Cat IS NULL OR @Cat = 'all' OR LOWER(Category) = @Cat)
      AND (@Calc IS NULL OR @Calc = 'all' OR LOWER(CalcType) = @Calc)
      AND (
            @Kw IS NULL
            OR Code LIKE '%' + @Kw + '%'
            OR Name LIKE N'%' + @Kw + N'%'
            OR ApplyScope LIKE N'%' + @Kw + N'%'
          )
    ORDER BY IsActive DESC, Category ASC, Code ASC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_SavePayrollSetting
    @SettingId  INT = NULL,
    @Code       VARCHAR(40),
    @Name       NVARCHAR(200),
    @Category   VARCHAR(30) = 'allowance',
    @CalcType   VARCHAR(30) = 'fixed_month',
    @RawValue   DECIMAL(18, 2) = 0,
    @Impact     VARCHAR(20) = 'Addition',
    @ApplyScope NVARCHAR(150) = N'Toàn hệ thống',
    @Note       NVARCHAR(500) = NULL,
    @IsActive   BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CleanCode VARCHAR(40) = UPPER(LTRIM(RTRIM(@Code)));
    DECLARE @CleanName NVARCHAR(200) = LTRIM(RTRIM(@Name));

    IF @CleanCode = '' OR @CleanName = ''
    BEGIN
        RAISERROR(N'Mã khoản mục và Tên khoản mục không được để trống.', 16, 1);
        RETURN;
    END

    IF EXISTS (
        SELECT 1 FROM dbo.PayrollSettings
        WHERE Code = @CleanCode AND (@SettingId IS NULL OR SettingId <> @SettingId)
    )
    BEGIN
        RAISERROR(N'Mã khoản mục (%s) đã tồn tại.', 16, 1, @CleanCode);
        RETURN;
    END

    IF @SettingId IS NULL OR @SettingId <= 0
    BEGIN
        INSERT INTO dbo.PayrollSettings
            (Code, Name, Category, CalcType, RawValue, Impact, ApplyScope, Note, IsActive)
        VALUES
            (@CleanCode, @CleanName, @Category, @CalcType, @RawValue, @Impact, @ApplyScope, @Note, @IsActive);

        SELECT SCOPE_IDENTITY() AS SettingId;
    END
    ELSE
    BEGIN
        UPDATE dbo.PayrollSettings
        SET Code = @CleanCode,
            Name = @CleanName,
            Category = @Category,
            CalcType = @CalcType,
            RawValue = @RawValue,
            Impact = @Impact,
            ApplyScope = @ApplyScope,
            Note = @Note,
            IsActive = @IsActive,
            UpdatedAt = SYSUTCDATETIME()
        WHERE SettingId = @SettingId;

        SELECT @SettingId AS SettingId;
    END
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_DeletePayrollSetting
    @SettingId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.PayrollSettings WHERE SettingId = @SettingId;
    SELECT @@ROWCOUNT AS AffectedRows;
END
GO
