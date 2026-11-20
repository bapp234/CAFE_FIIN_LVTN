USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. TẠO BẢNG dbo.SalaryAdvances (PHIẾU TẠM ỨNG LƯƠNG NHÂN VIÊN)
-- ============================================================================
IF OBJECT_ID('dbo.SalaryAdvances', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.SalaryAdvances (
        AdvanceId       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SalaryAdvances PRIMARY KEY,
        AdvanceCode     VARCHAR(30)       NOT NULL CONSTRAINT UQ_SalaryAdvances_Code UNIQUE,
        EmployeeId      INT               NOT NULL CONSTRAINT FK_SalaryAdvances_Employees FOREIGN KEY REFERENCES dbo.Employees(EmployeeId),
        BranchId        INT               NULL,
        PeriodMonth     VARCHAR(7)        NOT NULL, -- Định dạng YYYY-MM
        RequestDate     DATE              NOT NULL,
        Amount          DECIMAL(18, 0)    NOT NULL CONSTRAINT CK_SalaryAdvances_Amount CHECK (Amount > 0),
        PaymentMethod   NVARCHAR(100)     NOT NULL CONSTRAINT DF_SalaryAdvances_PaymentMethod DEFAULT N'Chuyển khoản',
        Reason          NVARCHAR(500)     NOT NULL,
        Status          VARCHAR(20)       NOT NULL CONSTRAINT DF_SalaryAdvances_Status DEFAULT 'pending',
        ApprovedBy      NVARCHAR(100)     NULL,
        ApprovedAt      DATETIME2         NULL,
        DecisionNote    NVARCHAR(500)     NULL,
        CreatedBy       NVARCHAR(100)     NULL,
        CreatedAt       DATETIME2         NOT NULL CONSTRAINT DF_SalaryAdvances_CreatedAt DEFAULT SYSDATETIME(),
        UpdatedAt       DATETIME2         NOT NULL CONSTRAINT DF_SalaryAdvances_UpdatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT CK_SalaryAdvances_Status CHECK (Status IN ('pending', 'approved', 'rejected', 'deducted'))
    );

    CREATE INDEX IX_SalaryAdvances_Period_Status
        ON dbo.SalaryAdvances (PeriodMonth, Status, BranchId);

    CREATE INDEX IX_SalaryAdvances_Employee_Period
        ON dbo.SalaryAdvances (EmployeeId, PeriodMonth);
END
GO

-- ============================================================================
-- 2. LẤY DANH SÁCH PHIẾU TẠM ỨNG LƯƠNG
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetSalaryAdvances
    @PeriodMonth VARCHAR(7)    = NULL,
    @BranchId    INT           = NULL,
    @Status      VARCHAR(20)   = NULL,
    @Search      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Period VARCHAR(7)    = NULLIF(LTRIM(RTRIM(@PeriodMonth)), '');
    DECLARE @St     VARCHAR(20)   = NULLIF(LOWER(LTRIM(RTRIM(@Status))), '');
    DECLARE @Kw     NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    SELECT TOP 300
        a.AdvanceId,
        a.AdvanceCode,
        a.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS EmployeeName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        ISNULL(a.BranchId, e.BranchId) AS BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        CONVERT(VARCHAR(10), a.RequestDate, 23) AS RequestDate,
        a.PeriodMonth AS Period,
        a.Amount,
        a.PaymentMethod,
        a.Reason,
        LOWER(ISNULL(a.Status, 'pending')) AS Status,
        a.ApprovedBy,
        a.ApprovedAt,
        a.DecisionNote,
        a.CreatedBy,
        a.CreatedAt
    FROM dbo.SalaryAdvances a
    INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON ISNULL(a.BranchId, e.BranchId) = b.BranchId
    WHERE (@Period IS NULL OR a.PeriodMonth = @Period)
      AND (@BranchId IS NULL OR ISNULL(a.BranchId, e.BranchId) = @BranchId)
      AND (@St IS NULL OR @St = 'all' OR LOWER(ISNULL(a.Status, 'pending')) = @St)
      AND (
            @Kw IS NULL
            OR a.AdvanceCode LIKE '%' + @Kw + '%'
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR a.Reason LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        CASE LOWER(ISNULL(a.Status, 'pending'))
            WHEN 'pending' THEN 0
            WHEN 'approved' THEN 1
            WHEN 'deducted' THEN 2
            ELSE 3
        END,
        a.CreatedAt DESC,
        a.AdvanceId DESC;
END
GO

-- ============================================================================
-- 3. TẠO PHIẾU TẠM ỨNG LƯƠNG MỚI
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateSalaryAdvance
    @EmployeeId    INT,
    @PeriodMonth   VARCHAR(7),
    @RequestDate   DATE,
    @Amount        DECIMAL(18, 0),
    @PaymentMethod NVARCHAR(100) = N'Chuyển khoản',
    @Reason        NVARCHAR(500),
    @CreatedBy     NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Period VARCHAR(7) = LTRIM(RTRIM(ISNULL(@PeriodMonth, '')));
    DECLARE @Method NVARCHAR(100) = ISNULL(NULLIF(LTRIM(RTRIM(@PaymentMethod)), N''), N'Chuyển khoản');
    DECLARE @CleanReason NVARCHAR(500) = LTRIM(RTRIM(ISNULL(@Reason, N'')));

    IF @Period NOT LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    BEGIN
        RAISERROR(N'Kỳ khấu trừ không hợp lệ (định dạng YYYY-MM).', 16, 1);
        RETURN;
    END

    IF @Amount IS NULL OR @Amount < 100000
    BEGIN
        RAISERROR(N'Số tiền tạm ứng tối thiểu là 100.000đ.', 16, 1);
        RETURN;
    END

    IF LEN(@CleanReason) < 3
    BEGIN
        RAISERROR(N'Vui lòng nhập lý do tạm ứng lương (tối thiểu 3 ký tự).', 16, 1);
        RETURN;
    END

    DECLARE @BranchId INT;
    SELECT @BranchId = BranchId
    FROM dbo.Employees
    WHERE EmployeeId = @EmployeeId;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR(N'Không tìm thấy nhân viên được chọn.', 16, 1);
        RETURN;
    END

    BEGIN TRAN;
    BEGIN TRY
        DECLARE @Prefix VARCHAR(20) = 'TU-' + REPLACE(@Period, '-', '') + '-';
        DECLARE @NextSeq INT;

        SELECT @NextSeq = ISNULL(MAX(TRY_CAST(RIGHT(AdvanceCode, 3) AS INT)), 0) + 1
        FROM dbo.SalaryAdvances WITH (UPDLOCK, HOLDLOCK)
        WHERE AdvanceCode LIKE @Prefix + '%';

        DECLARE @AdvanceCode VARCHAR(30) = @Prefix + RIGHT('000' + CAST(@NextSeq AS VARCHAR(10)), 3);

        INSERT INTO dbo.SalaryAdvances (
            AdvanceCode, EmployeeId, BranchId, PeriodMonth, RequestDate,
            Amount, PaymentMethod, Reason, Status, CreatedBy, CreatedAt, UpdatedAt
        )
        VALUES (
            @AdvanceCode, @EmployeeId, @BranchId, @Period, @RequestDate,
            @Amount, @Method, @CleanReason, 'pending',
            NULLIF(LTRIM(RTRIM(@CreatedBy)), N''), SYSDATETIME(), SYSDATETIME()
        );

        DECLARE @NewId INT = CAST(SCOPE_IDENTITY() AS INT);

        COMMIT TRAN;

        SELECT @NewId AS AdvanceId, @AdvanceCode AS AdvanceCode;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- ============================================================================
-- 4. PHÊ DUYỆT HOẶC TỪ CHỐI PHIẾU TẠM ỨNG LƯƠNG
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessSalaryAdvance
    @AdvanceId    INT,
    @Action       VARCHAR(20),
    @ApproverName NVARCHAR(100),
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));
    DECLARE @Approver NVARCHAR(100) = ISNULL(NULLIF(LTRIM(RTRIM(@ApproverName)), N''), N'Quản lý');
    DECLARE @CleanNote NVARCHAR(500) = NULLIF(LTRIM(RTRIM(ISNULL(@Note, N''))), N'');

    IF @Act NOT IN ('approve', 'reject')
    BEGIN
        RAISERROR(N'Hành động xử lý không hợp lệ (chỉ hỗ trợ approve hoặc reject).', 16, 1);
        RETURN;
    END

    IF @Act = 'reject' AND (@CleanNote IS NULL OR LEN(@CleanNote) < 3)
    BEGIN
        RAISERROR(N'Vui lòng nhập lý do từ chối phiếu tạm ứng (tối thiểu 3 ký tự).', 16, 1);
        RETURN;
    END

    DECLARE @CurrentStatus VARCHAR(20);
    SELECT @CurrentStatus = LOWER(ISNULL(Status, 'pending'))
    FROM dbo.SalaryAdvances
    WHERE AdvanceId = @AdvanceId;

    IF @CurrentStatus IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy phiếu tạm ứng lương.', 16, 1);
        RETURN;
    END

    IF @CurrentStatus <> 'pending'
    BEGIN
        RAISERROR(N'Phiếu tạm ứng này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

    DECLARE @NewStatus VARCHAR(20) = CASE WHEN @Act = 'approve' THEN 'approved' ELSE 'rejected' END;

    UPDATE dbo.SalaryAdvances
    SET Status       = @NewStatus,
        ApprovedBy   = @Approver,
        ApprovedAt   = SYSDATETIME(),
        DecisionNote = @CleanNote,
        UpdatedAt    = SYSDATETIME()
    WHERE AdvanceId = @AdvanceId
      AND LOWER(ISNULL(Status, 'pending')) = 'pending';

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO
