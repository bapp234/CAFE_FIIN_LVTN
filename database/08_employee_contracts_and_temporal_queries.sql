-- =======================================================================================
-- DỰ ÁN: HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ FIIN COFFEE
-- PHÂN HỆ: QUẢN TRỊ NHÂN SỰ & HỢP ĐỒNG LAO ĐỘNG (HRM & CONTRACTS)
-- KỊCH BẢN: BẢNG EMPLOYEE_CONTRACTS, POINT-IN-TIME TEMPORAL QUERY & WORKFLOW THĂNG CHỨC
-- TÁC GIẢ: AGENT A - SOFTWARE DEVELOPER
-- NGÀY TẠO: 2026-11-15
-- =======================================================================================

USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'===============================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI GIAI ĐOẠN 1 (DATABASE): EMPLOYEE CONTRACTS & TEMPORAL QUERIES';
PRINT N'===============================================================================';
GO

-- =======================================================================================
-- PHẦN 1: TẠO BẢNG QUẢN LÝ LỊCH SỬ HỢP ĐỒNG & CHỨC VỤ (dbo.EmployeeContracts)
-- Mô hình SCD Type 2 / Effective Dating lưu trữ các chặng công tác theo dải ngày (StartDate -> EndDate)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EmployeeContracts')
BEGIN
    CREATE TABLE dbo.EmployeeContracts (
        ContractId          INT IDENTITY(1,1) NOT NULL,
        ContractCode        VARCHAR(30) NOT NULL,
        EmployeeId          INT NOT NULL,
        ContractTypeId      INT NOT NULL,
        Position            NVARCHAR(100) NOT NULL,
        HourlyRate          DECIMAL(18,2) NOT NULL,
        Allowance           DECIMAL(18,2) NOT NULL CONSTRAINT DF_EmployeeContracts_Allowance DEFAULT (0),
        StartDate           DATE NOT NULL,
        EndDate             DATE NULL,
        Status              VARCHAR(20) NOT NULL CONSTRAINT DF_EmployeeContracts_Status DEFAULT ('active'),
        SignDate            DATE NULL,
        Note                NVARCHAR(500) NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeContracts_CreatedAt DEFAULT (SYSDATETIME()),
        UpdatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_EmployeeContracts_UpdatedAt DEFAULT (SYSDATETIME()),

        CONSTRAINT PK_EmployeeContracts PRIMARY KEY CLUSTERED (ContractId),
        CONSTRAINT UQ_EmployeeContracts_ContractCode UNIQUE (ContractCode),
        CONSTRAINT FK_EmployeeContracts_Employees FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(EmployeeId),
        CONSTRAINT FK_EmployeeContracts_ContractTypes FOREIGN KEY (ContractTypeId) REFERENCES dbo.ContractTypes(ContractTypeId),
        CONSTRAINT CK_EmployeeContracts_Dates CHECK (EndDate IS NULL OR EndDate >= StartDate),
        CONSTRAINT CK_EmployeeContracts_Status CHECK (Status IN ('active', 'expired', 'terminated', 'pending'))
    );

    CREATE NONCLUSTERED INDEX IX_EmployeeContracts_Timeline 
    ON dbo.EmployeeContracts (EmployeeId, StartDate, EndDate)
    INCLUDE (ContractTypeId, Position, HourlyRate, Allowance, Status);

    PRINT N'-> Đã tạo bảng dbo.EmployeeContracts và Index tối ưu hóa truy vấn dải ngày.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.EmployeeContracts đã tồn tại.';
END
GO

-- =======================================================================================
-- PHẦN 2: CHUYỂN ĐỔI & SINH DỮ LIỆU KHỞI TẠO (DATA MIGRATION & SEEDING)
-- Đảm bảo toàn bộ nhân sự hiện tại đều có bản ghi hợp đồng khởi đầu
-- =======================================================================================
DECLARE @CountBefore INT = (SELECT COUNT(*) FROM dbo.EmployeeContracts);

IF @CountBefore = 0
BEGIN
    PRINT N'-> Bắt đầu di chuyển dữ liệu hợp đồng hiện tại từ dbo.Employees sang dbo.EmployeeContracts...';

    INSERT INTO dbo.EmployeeContracts (
        ContractCode, EmployeeId, ContractTypeId, Position, HourlyRate,
        Allowance, StartDate, EndDate, Status, SignDate, Note
    )
    SELECT 
        'HD-' + FORMAT(e.HireDate, 'yyyy') + '-' + RIGHT('0000' + CAST(e.EmployeeId AS VARCHAR(10)), 4),
        e.EmployeeId,
        ISNULL(e.ContractTypeId, 3), -- Mặc định hợp đồng chính thức nếu null
        e.Position,
        ISNULL(e.HourlyRate, 28000),
        ISNULL(ct.Allowance, 1000000),
        e.HireDate,
        CASE 
            WHEN ct.ContractCode = 'HD-THU-VIEC' THEN DATEADD(MONTH, 2, e.HireDate)
            WHEN ct.ContractCode = 'HD-HOC-VIEC' THEN DATEADD(MONTH, 1, e.HireDate)
            WHEN e.Status = 'resigned' THEN DATEADD(MONTH, 6, e.HireDate)
            ELSE NULL -- Vô thời hạn hoặc đang tiếp diễn
        END AS EndDate,
        CASE 
            WHEN e.Status = 'resigned' THEN 'terminated'
            ELSE 'active'
        END AS Status,
        e.HireDate AS SignDate,
        N'Hợp đồng lao động khởi tạo ban đầu theo hồ sơ nhân sự' AS Note
    FROM dbo.Employees e
    LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId;

    PRINT N'-> Đã di chuyển thành công ' + CAST(@@ROWCOUNT AS NVARCHAR(10)) + N' hợp đồng nhân sự khởi đầu.';

    -- TẠO MẪU KỊCH BẢN KIỂM CHỨNG THEO YÊU CẦU:
    -- Nhân viên NV011 (Nguyễn Văn Minh):
    -- - Kỳ 1 (15/11/2026 - 30/11/2026): Thử việc / Học việc, Chức vụ: "Barista Thử việc", Lương: 24.000đ/giờ
    -- - Kỳ 2 (01/12/2026 trở đi): Thăng chức, Chức vụ: "Barista Chuyên nghiệp", Lương: 28.000đ/giờ
    IF EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeCode = 'NV011')
    BEGIN
        DECLARE @Emp11Id INT = (SELECT EmployeeId FROM dbo.Employees WHERE EmployeeCode = 'NV011');

        -- Cập nhật hợp đồng giai đoạn 1 của NV011
        UPDATE dbo.EmployeeContracts
        SET Position = N'Barista Thử việc',
            ContractTypeId = 2, -- HD-THU-VIEC
            HourlyRate = 24000,
            Allowance = 500000,
            StartDate = '2026-11-15',
            EndDate = '2026-11-30',
            Status = 'expired',
            Note = N'Hợp đồng thử việc giai đoạn 15/11 đến 30/11'
        WHERE EmployeeId = @Emp11Id;

        -- Thêm hợp đồng thăng chức giai đoạn 2 từ 01/12/2026 của NV011
        INSERT INTO dbo.EmployeeContracts (
            ContractCode, EmployeeId, ContractTypeId, Position, HourlyRate,
            Allowance, StartDate, EndDate, Status, SignDate, Note
        )
        VALUES (
            'HD-202612-0011',
            @Emp11Id,
            3, -- HD-CHINH-THUC
            N'Barista Chuyên nghiệp',
            28000,
            1000000,
            '2026-12-01',
            NULL, -- Đang áp dụng
            'active',
            '2026-12-01',
            N'Quyết định thăng chức lên Barista Chuyên nghiệp sau khi đạt chuẩn kiểm tra quầy'
        );

        PRINT N'-> Đã thiết lập thành công ca kiểm thử thời gian cho nhân viên NV011 (Thử việc 15/11-30/11, Thăng chức từ 01/12).';
    END
END
ELSE
BEGIN
    PRINT N'-> Dữ liệu dbo.EmployeeContracts đã có sẵn (' + CAST(@CountBefore AS NVARCHAR(10)) + N' bản ghi).';
END
GO

-- =======================================================================================
-- PHẦN 3: FUNCTION TRUY VẤN THEO MỐC THỜI GIAN (POINT-IN-TIME INLINE TABLE-VALUED FUNCTION)
-- Cho phép truyền @TargetDate để lấy chính xác chức vụ, mức lương giờ và hợp đồng tại thời điểm đó
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetEmployeeAtDate (
    @EmployeeId INT = NULL,
    @EmployeeCode VARCHAR(20) = NULL,
    @TargetDate DATE = NULL
)
RETURNS TABLE
AS
RETURN (
    WITH TargetContract AS (
        SELECT 
            c.ContractId,
            c.ContractCode,
            c.EmployeeId,
            c.ContractTypeId,
            c.Position,
            c.HourlyRate,
            c.Allowance,
            c.StartDate AS ContractStartDate,
            c.EndDate AS ContractEndDate,
            c.Status AS ContractStatus,
            c.Note AS ContractNote,
            ROW_NUMBER() OVER (
                PARTITION BY c.EmployeeId 
                ORDER BY c.StartDate DESC, c.ContractId DESC
            ) AS Rn
        FROM dbo.EmployeeContracts c
        WHERE (@EmployeeId IS NULL OR c.EmployeeId = @EmployeeId)
          AND ISNULL(@TargetDate, CAST(SYSDATETIME() AS DATE)) >= c.StartDate
          AND (c.EndDate IS NULL OR ISNULL(@TargetDate, CAST(SYSDATETIME() AS DATE)) <= c.EndDate)
    )
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
        -- Thông tin chức vụ & hợp đồng hiệu lực tại @TargetDate
        ISNULL(tc.ContractId, 0) AS ContractId,
        ISNULL(tc.ContractTypeId, e.ContractTypeId) AS ContractTypeId,
        ISNULL(ct.ContractCode, 'HD-CHINH-THUC') AS ContractCode,
        ISNULL(ct.ContractName, N'Hợp đồng Lao động') AS ContractName,
        ISNULL(ct.SalaryPercentage, 100) AS SalaryPercentage,
        ISNULL(tc.Position, e.Position) AS Position,
        ISNULL(tc.HourlyRate, e.HourlyRate) AS HourlyRate,
        ISNULL(tc.Allowance, ISNULL(ct.Allowance, 0)) AS Allowance,
        ct.BenefitsDescription,
        tc.ContractStartDate,
        tc.ContractEndDate,
        ISNULL(tc.ContractStatus, 'active') AS ContractStatus,
        tc.ContractNote,
        -- Thông tin nhân sự nền tảng
        e.DateOfBirth,
        e.Gender,
        e.HireDate,
        e.Status AS EmployeeStatus,
        e.Note AS EmployeeNote,
        e.UpdatedAt
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN TargetContract tc ON e.EmployeeId = tc.EmployeeId AND tc.Rn = 1
    LEFT JOIN dbo.ContractTypes ct ON tc.ContractTypeId = ct.ContractTypeId
    WHERE (@EmployeeId IS NULL OR e.EmployeeId = @EmployeeId)
      AND (@EmployeeCode IS NULL OR e.EmployeeCode = @EmployeeCode)
);
GO
PRINT N'-> Đã tạo Function dùng chung: dbo.fn_HRM_GetEmployeeAtDate.';
GO

-- =======================================================================================
-- PHẦN 4: FUNCTION LẤY LỊCH SỬ DIỄN BIẾN HỢP ĐỒNG / CÔNG TÁC CỦA NHÂN VIÊN
-- Dùng để hiển thị Tab Lịch sử Hợp đồng & Diễn biến lương trên màn hình Hồ sơ nhân viên
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetEmployeeContractsHistory (
    @EmployeeId INT
)
RETURNS TABLE
AS
RETURN (
    SELECT 
        c.ContractId,
        c.ContractCode,
        c.EmployeeId,
        c.ContractTypeId,
        ct.ContractCode AS ContractTypeCode,
        ct.ContractName,
        c.Position,
        c.HourlyRate,
        c.Allowance,
        c.StartDate,
        c.EndDate,
        c.Status,
        c.SignDate,
        c.Note,
        c.CreatedAt
    FROM dbo.EmployeeContracts c
    INNER JOIN dbo.ContractTypes ct ON c.ContractTypeId = ct.ContractTypeId
    WHERE c.EmployeeId = @EmployeeId
);
GO
PRINT N'-> Đã tạo Function dùng chung: dbo.fn_HRM_GetEmployeeContractsHistory.';
GO

-- =======================================================================================
-- PHẦN 5: STORED PROCEDURE THĂNG CHỨC / ĐỔI HỢP ĐỒNG (SCD TYPE 2 WORKFLOW)
-- Đóng hợp đồng cũ và mở hợp đồng mới có hiệu lực từ ngày chỉ định, đảm bảo toàn vẹn dữ liệu
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_PromoteOrUpdateContract
    @EmployeeId         INT,
    @NewContractTypeId  INT,
    @NewPosition        NVARCHAR(100),
    @NewHourlyRate      DECIMAL(18,2),
    @EffectiveDate      DATE,
    @Note               NVARCHAR(500) = NULL,
    @NewContractId      INT OUTPUT,
    @NewContractCode    VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Kiểm tra tồn tại nhân viên
        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
        BEGIN
            THROW 50001, N'Không tìm thấy nhân viên trong hệ thống.', 1;
        END

        -- 2. Kiểm tra loại hợp đồng mới
        IF NOT EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractTypeId = @NewContractTypeId AND IsActive = 1)
        BEGIN
            THROW 50002, N'Loại hợp đồng mới không tồn tại hoặc đã ngưng áp dụng.', 1;
        END

        -- 3. Đóng hợp đồng đang active hiện tại (EndDate = ngày trước EffectiveDate)
        UPDATE dbo.EmployeeContracts
        SET EndDate = DATEADD(DAY, -1, @EffectiveDate),
            Status = 'expired',
            UpdatedAt = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId
          AND (EndDate IS NULL OR EndDate >= @EffectiveDate)
          AND Status = 'active';

        -- 4. Sinh mã hợp đồng mới tự động: HD-YYYYMM-XXXX
        EXEC dbo.sp_Sys_GenerateDocumentCode 
            @Prefix = 'HD', 
            @GeneratedCode = @NewContractCode OUTPUT;

        -- 5. Lấy phụ cấp chuẩn từ ContractTypes nếu không ghi đè
        DECLARE @Allowance DECIMAL(18,2) = (SELECT Allowance FROM dbo.ContractTypes WHERE ContractTypeId = @NewContractTypeId);

        -- 6. Tạo hợp đồng mới có hiệu lực từ @EffectiveDate
        INSERT INTO dbo.EmployeeContracts (
            ContractCode, EmployeeId, ContractTypeId, Position, HourlyRate,
            Allowance, StartDate, EndDate, Status, SignDate, Note
        )
        VALUES (
            @NewContractCode,
            @EmployeeId,
            @NewContractTypeId,
            @NewPosition,
            @NewHourlyRate,
            ISNULL(@Allowance, 0),
            @EffectiveDate,
            NULL, -- Hiệu lực tiếp diễn
            'active',
            @EffectiveDate,
            @Note
        );

        SET @NewContractId = SCOPE_IDENTITY();

        -- 7. Cập nhật thông tin hiện thời trên bảng dbo.Employees
        UPDATE dbo.Employees
        SET Position = @NewPosition,
            HourlyRate = @NewHourlyRate,
            ContractTypeId = @NewContractTypeId,
            UpdatedAt = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId;

        COMMIT TRANSACTION;

        -- 8. Trả về thông tin hồ sơ nhân viên tại mốc ngày mới
        SELECT * FROM dbo.fn_HRM_GetEmployeeAtDate(@EmployeeId, NULL, @EffectiveDate);

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_PromoteOrUpdateContract.';
GO

-- =======================================================================================
-- PHẦN 6: STORED PROCEDURE LẤY HỒ SƠ NHÂN VIÊN GIAO TIẾP VỚI BACKEND
-- Nhận @EmployeeId, @EmployeeCode, @TargetDate và trả về thông tin đầy đủ
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeProfile
    @EmployeeId     INT = NULL,
    @EmployeeCode   VARCHAR(20) = NULL,
    @TargetDate     DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT * 
    FROM dbo.fn_HRM_GetEmployeeAtDate(@EmployeeId, @EmployeeCode, @TargetDate);
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_GetEmployeeProfile.';
GO

-- =======================================================================================
-- PHẦN 7: NÂNG CẤP STORED PROCEDURE THÊM NHÂN VIÊN (dbo.sp_HRM_CreateEmployee)
-- Tự động sinh hợp đồng khởi đầu trong dbo.EmployeeContracts khi tạo nhân sự mới
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateEmployee
    @Username           VARCHAR(50),
    @PasswordHash       VARCHAR(255),
    @FullName           NVARCHAR(100),
    @PhoneNumber        VARCHAR(20)   = NULL,
    @Email              VARCHAR(100)  = NULL,
    @DateOfBirth        DATE          = NULL,
    @Gender             VARCHAR(10)   = 'male',
    @CitizenId          VARCHAR(20),
    @BankName           NVARCHAR(100) = NULL,
    @BankAccountNumber  VARCHAR(30)   = NULL,
    @BankAccountName    NVARCHAR(100) = NULL,
    @BranchId           INT,
    @Position           NVARCHAR(50),
    @ContractTypeId     INT           = 3,
    @HourlyRate         DECIMAL(18,2) = NULL,
    @Note               NVARCHAR(500) = NULL,
    @RoleId             INT           = 5,
    @NewEmployeeId      INT           OUTPUT,
    @NewEmployeeCode    VARCHAR(20)   OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
    BEGIN
        RAISERROR(N'Tên đăng nhập (Username) "%s" đã tồn tại trên hệ thống.', 16, 1, @Username);
        RETURN -1;
    END

    IF EXISTS (SELECT 1 FROM dbo.Employees WHERE CitizenId = @CitizenId)
    BEGIN
        RAISERROR(N'Số CMND/CCCD "%s" đã được đăng ký cho một nhân viên khác.', 16, 1, @CitizenId);
        RETURN -2;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Tạo tài khoản User
        INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, Email, IsActive)
        VALUES (@Username, @PasswordHash, @FullName, @PhoneNumber, @Email, 1);
        DECLARE @NewUserId INT = SCOPE_IDENTITY();

        -- 2. Gán Role hệ thống
        INSERT INTO dbo.UserRoles (UserId, RoleId)
        VALUES (@NewUserId, @RoleId);

        -- 3. Sinh mã nhân viên: NVxxx
        DECLARE @SeqVal BIGINT = NEXT VALUE FOR dbo.Seq_EmployeeCode;
        SET @NewEmployeeCode = 'NV' + RIGHT('000' + CAST(@SeqVal AS VARCHAR(10)), 3);

        -- Lấy mức lương chuẩn và thời hạn hợp đồng từ ContractTypes
        DECLARE @StandardRate DECIMAL(18,2);
        DECLARE @DurationMonths INT;
        DECLARE @Allowance DECIMAL(18,2);
        SELECT 
            @StandardRate = StandardHourlyRate,
            @DurationMonths = DurationMonths,
            @Allowance = ISNULL(Allowance, 0)
        FROM dbo.ContractTypes 
        WHERE ContractTypeId = @ContractTypeId;

        DECLARE @FinalHourlyRate DECIMAL(18,2) = ISNULL(@HourlyRate, @StandardRate);
        DECLARE @HireDate DATE = CAST(SYSDATETIME() AS DATE);

        -- 4. Tạo hồ sơ Employees cốt lõi
        INSERT INTO dbo.Employees (
            UserId, EmployeeCode, Position, HireDate, HourlyRate,
            BranchId, Status, ContractTypeId, CitizenId,
            BankName, BankAccountNumber, BankAccountName,
            DateOfBirth, Gender, Note, UpdatedAt
        )
        VALUES (
            @NewUserId, @NewEmployeeCode, @Position, @HireDate,
            @FinalHourlyRate, @BranchId, 'active', @ContractTypeId, @CitizenId,
            @BankName, @BankAccountNumber, ISNULL(@BankAccountName, UPPER(@FullName)),
            @DateOfBirth, @Gender, @Note, SYSDATETIME()
        );
        SET @NewEmployeeId = SCOPE_IDENTITY();

        -- 5. Sinh mã hợp đồng tự động & Tạo bản ghi khởi đầu trong EmployeeContracts
        DECLARE @InitialContractCode VARCHAR(30);
        EXEC dbo.sp_Sys_GenerateDocumentCode 
            @Prefix = 'HD', 
            @GeneratedCode = @InitialContractCode OUTPUT;

        DECLARE @InitialEndDate DATE = NULL;
        IF @DurationMonths IS NOT NULL AND @DurationMonths < 12
        BEGIN
            SET @InitialEndDate = DATEADD(MONTH, @DurationMonths, @HireDate);
        END

        INSERT INTO dbo.EmployeeContracts (
            ContractCode, EmployeeId, ContractTypeId, Position, HourlyRate,
            Allowance, StartDate, EndDate, Status, SignDate, Note
        )
        VALUES (
            @InitialContractCode,
            @NewEmployeeId,
            @ContractTypeId,
            @Position,
            @FinalHourlyRate,
            @Allowance,
            @HireDate,
            @InitialEndDate,
            'active',
            @HireDate,
            N'Hợp đồng tuyển dụng nhân sự mới ban đầu'
        );

        COMMIT TRANSACTION;

        -- Trả về dữ liệu chi tiết qua Function
        SELECT * FROM dbo.fn_HRM_GetEmployeeAtDate(@NewEmployeeId, NULL, @HireDate);

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã nâng cấp Stored Procedure: dbo.sp_HRM_CreateEmployee (tự động tạo hợp đồng khởi đầu).';
GO

-- =======================================================================================
-- PHẦN 8: CẬP NHẬT VIEW dbo.v_EmployeeDetails (ĐẢM BẢO TƯƠNG THÍCH NGƯỢC 100%)
-- =======================================================================================
CREATE OR ALTER VIEW dbo.v_EmployeeDetails
AS
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
    cur.Position,
    cur.ContractTypeId, 
    ct.ContractCode, 
    ct.ContractName,
    cur.HourlyRate, 
    cur.Allowance, 
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
OUTER APPLY (
    SELECT TOP 1 c.ContractTypeId, c.Position, c.HourlyRate, c.Allowance
    FROM dbo.EmployeeContracts c
    WHERE c.EmployeeId = e.EmployeeId
      AND CAST(SYSDATETIME() AS DATE) >= c.StartDate
      AND (c.EndDate IS NULL OR CAST(SYSDATETIME() AS DATE) <= c.EndDate)
    ORDER BY c.StartDate DESC, c.ContractId DESC
) cur
LEFT JOIN dbo.ContractTypes ct ON ISNULL(cur.ContractTypeId, e.ContractTypeId) = ct.ContractTypeId;
GO
PRINT N'-> Đã cập nhật View dbo.v_EmployeeDetails tương thích ngược với các query Dapper hiện hữu.';
GO

PRINT N'===============================================================================';
PRINT N'HOÀN TẤT TRIỂN KHAI GIAI ĐOẠN 1 (DATABASE) THÀNH CÔNG!';
PRINT N'===============================================================================';
GO
