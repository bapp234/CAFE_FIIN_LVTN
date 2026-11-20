-- =======================================================================================
-- TỆP MÃ NGUỒN: 19_hrm_cud_and_account_procedures.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH: 
--   Chuẩn hóa và hoàn thiện nhóm 6 Stored Procedures ghi dữ liệu & quản lý tài khoản nhân sự
--   đảm bảo toàn vẹn dữ liệu hợp đồng Temporal và liên kết tài khoản Users.
--
-- DANH SÁCH ĐỐI TƯỢNG:
--   1. dbo.sp_HRM_CreateEmployee (Tạo mới nhân viên + HĐLĐ ban đầu + Tài khoản nếu có)
--   2. dbo.sp_HRM_UpdateEmployeeProfile (Cập nhật hồ sơ, CCCD, ngân hàng, HĐLĐ an toàn)
--   3. dbo.sp_HRM_PromoteOrUpdateContract (Thăng chức / ký HĐLĐ mới Temporal)
--   4. dbo.sp_HRM_ProvisionAccount (Cấp phát tài khoản đăng nhập cho nhân viên chưa có TK)
--   5. dbo.sp_HRM_UpdateAccount (Khóa / mở khóa / đổi mật khẩu / gán vai trò tài khoản)
--   6. dbo.sp_HRM_ImportEmployees_Batch (Nhập danh sách nhân viên từ Excel hàng loạt)
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 19: CÁC THỦ TỤC GHI & QUẢN LÝ TÀI KHOẢN NHÂN SỰ (CUD)';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- 1. THỦ TỤC: dbo.sp_HRM_CreateEmployee
-- Tạo mới nhân sự, tự động sinh mã NVxxx, tạo hợp đồng ban đầu và trả về EmployeeDto
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateEmployee
    @Username           VARCHAR(50)   = NULL,
    @PasswordHash       VARCHAR(255)  = NULL,
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
    @NewEmployeeId      INT           = NULL OUTPUT,
    @NewEmployeeCode    VARCHAR(20)   = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Kiểm tra CCCD trùng lặp
        IF EXISTS (SELECT 1 FROM dbo.Employees WHERE CitizenId = @CitizenId)
        BEGIN
            THROW 50001, N'Số CCCD này đã tồn tại trong hệ thống hồ sơ nhân viên.', 1;
        END

        -- 2. Xử lý tài khoản người dùng nếu có cung cấp Username
        DECLARE @UserId INT = NULL;
        IF @Username IS NOT NULL AND LTRIM(RTRIM(@Username)) <> ''
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
            BEGIN
                THROW 50002, N'Tên đăng nhập (Username) này đã được sử dụng.', 1;
            END

            INSERT INTO dbo.Users (
                Username, PasswordHash, FullName, Email, PhoneNumber, 
                IsActive, MustChangePassword, CreatedAt
            )
            VALUES (
                @Username, @PasswordHash, @FullName, @Email, @PhoneNumber, 
                1, 1, SYSDATETIME()
            );

            SET @UserId = SCOPE_IDENTITY();

            -- Gán vai trò
            IF @RoleId IS NOT NULL
            BEGIN
                INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
            END
        END

        -- 3. Tự động sinh mã nhân viên chuẩn hóa NVxxx
        DECLARE @NextNum INT;
        SELECT @NextNum = ISNULL(MAX(
            CASE 
                WHEN EmployeeCode LIKE 'NV%' AND ISNUMERIC(SUBSTRING(EmployeeCode, 3, 10)) = 1 
                THEN CAST(SUBSTRING(EmployeeCode, 3, 10) AS INT)
                ELSE 0
            END
        ), 0) + 1
        FROM dbo.Employees;

        SET @NewEmployeeCode = 'NV' + RIGHT('000' + CAST(@NextNum AS VARCHAR(10)), 3);

        -- Lấy mức lương chuẩn theo loại hợp đồng nếu chưa truyền
        IF @HourlyRate IS NULL OR @HourlyRate <= 0
        BEGIN
            SELECT @HourlyRate = StandardHourlyRate 
            FROM dbo.ContractTypes 
            WHERE ContractTypeId = @ContractTypeId;
            
            IF @HourlyRate IS NULL SET @HourlyRate = 25000;
        END

        -- 4. Thêm bản ghi vào dbo.Employees
        INSERT INTO dbo.Employees (
            UserId, EmployeeCode, FullName, PhoneNumber, DateOfBirth, Gender, 
            CitizenId, BankName, BankAccountNumber, BankAccountName,
            BranchId, Position, ContractTypeId, HourlyRate, Status, HireDate, Note, UpdatedAt
        )
        VALUES (
            @UserId, @NewEmployeeCode, @FullName, @PhoneNumber, @DateOfBirth, @Gender, 
            @CitizenId, @BankName, @BankAccountNumber, ISNULL(@BankAccountName, UPPER(@FullName)),
            @BranchId, @Position, @ContractTypeId, @HourlyRate, 'active', CAST(GETDATE() AS DATE), @Note, SYSDATETIME()
        );

        SET @NewEmployeeId = SCOPE_IDENTITY();

        -- 5. Tự động sinh hợp đồng khởi đầu trong dbo.EmployeeContracts (Temporal)
        DECLARE @ContractCode VARCHAR(30) = 'HD-' + @NewEmployeeCode + '-01';

        INSERT INTO dbo.EmployeeContracts (
            EmployeeId, ContractCode, ContractTypeId, Position, 
            HourlyRate, Allowance, StartDate, EndDate, SignDate, Status, Note, CreatedAt
        )
        VALUES (
            @NewEmployeeId, @ContractCode, 
            @ContractTypeId, @Position, @HourlyRate, 0, 
            CAST(GETDATE() AS DATE), NULL, CAST(GETDATE() AS DATE), 'active', N'Hợp đồng khởi tạo khi tạo mới nhân sự', SYSDATETIME()
        );

        COMMIT TRANSACTION;

        -- 6. Trả về đúng bản ghi vừa tạo tương thích với EmployeeDto
        SELECT TOP 1
            e.EmployeeId,
            e.EmployeeCode,
            ISNULL(e.UserId, 0) AS UserId,
            ISNULL(u.Username, '') AS Username,
            e.FullName,
            e.PhoneNumber,
            u.Email,
            e.CitizenId,
            e.BankName,
            e.BankAccountNumber,
            e.BankAccountName,
            e.BranchId,
            b.BranchCode,
            b.BranchName,
            e.Position,
            e.ContractTypeId,
            ct.ContractCode,
            ct.ContractName,
            e.HourlyRate,
            ct.Allowance,
            ct.BenefitsDescription,
            e.Status,
            e.HireDate,
            e.DateOfBirth,
            e.Gender,
            e.Note,
            CAST(e.UpdatedAt AS DATETIME) AS UpdatedAt
        FROM dbo.Employees e
        LEFT JOIN dbo.Users u ON e.UserId = u.UserId
        INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
        LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
        WHERE e.EmployeeId = @NewEmployeeId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_CreateEmployee.';
GO

-- =======================================================================================
-- 2. THỦ TỤC: dbo.sp_HRM_UpdateEmployeeProfile
-- Cập nhật đồng bộ thông tin hồ sơ nhân sự, tài khoản Users và HĐLĐ mới nhất
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpdateEmployeeProfile
    @EmployeeId             INT,
    @FullName               NVARCHAR(100)   = NULL,
    @PhoneNumber            VARCHAR(20)     = NULL,
    @Email                  VARCHAR(100)    = NULL,
    @DateOfBirth            DATE            = NULL,
    @Gender                 VARCHAR(10)     = NULL,
    @CitizenId              VARCHAR(20)     = NULL,
    @BankName               NVARCHAR(100)   = NULL,
    @BankAccountNumber      VARCHAR(50)     = NULL,
    @BankAccountName        NVARCHAR(100)   = NULL,
    @ContractTypeId         INT             = NULL,
    @HourlyRate             DECIMAL(18,2)   = NULL,
    @Allowance              DECIMAL(18,2)   = NULL,
    @Note                   NVARCHAR(500)   = NULL,
    @Status                 VARCHAR(20)     = NULL,
    @Position               NVARCHAR(50)    = NULL,
    @BranchId               INT             = NULL,
    @UpdatedByUsername      VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
        BEGIN
            THROW 50003, N'Không tìm thấy nhân viên trong hệ thống.', 1;
        END

        DECLARE @UserId INT;
        SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

        -- 1. Cập nhật bảng dbo.Employees
        UPDATE dbo.Employees
        SET 
            FullName          = ISNULL(@FullName, FullName),
            PhoneNumber       = ISNULL(@PhoneNumber, PhoneNumber),
            DateOfBirth       = ISNULL(@DateOfBirth, DateOfBirth),
            Gender            = ISNULL(@Gender, Gender),
            CitizenId         = ISNULL(@CitizenId, CitizenId),
            BankName          = ISNULL(@BankName, BankName),
            BankAccountNumber = ISNULL(@BankAccountNumber, BankAccountNumber),
            BankAccountName   = ISNULL(@BankAccountName, BankAccountName),
            ContractTypeId    = ISNULL(@ContractTypeId, ContractTypeId),
            HourlyRate        = ISNULL(@HourlyRate, HourlyRate),
            Note              = ISNULL(@Note, Note),
            Status            = ISNULL(@Status, Status),
            Position          = ISNULL(@Position, Position),
            BranchId          = ISNULL(@BranchId, BranchId),
            UpdatedAt         = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId;

        -- 2. Đồng bộ bảng Users nếu nhân viên này đã có tài khoản
        IF @UserId IS NOT NULL
        BEGIN
            UPDATE dbo.Users
            SET 
                FullName    = ISNULL(@FullName, FullName),
                PhoneNumber = ISNULL(@PhoneNumber, PhoneNumber),
                Email       = ISNULL(@Email, Email)
            WHERE UserId = @UserId;
        END

        -- 3. Cập nhật hợp đồng mới nhất nếu có thay đổi chức vụ, đơn giá hoặc phụ cấp
        IF @Position IS NOT NULL OR @HourlyRate IS NOT NULL OR @Allowance IS NOT NULL OR @ContractTypeId IS NOT NULL
        BEGIN
            DECLARE @LatestContractId INT;
            SELECT TOP 1 @LatestContractId = ContractId
            FROM dbo.EmployeeContracts
            WHERE EmployeeId = @EmployeeId
            ORDER BY StartDate DESC, ContractId DESC;

            IF @LatestContractId IS NOT NULL
            BEGIN
                UPDATE dbo.EmployeeContracts
                SET 
                    Position       = ISNULL(@Position, Position),
                    HourlyRate     = ISNULL(@HourlyRate, HourlyRate),
                    Allowance      = ISNULL(@Allowance, Allowance),
                    ContractTypeId = ISNULL(@ContractTypeId, ContractTypeId),
                    UpdatedAt      = SYSDATETIME()
                WHERE ContractId = @LatestContractId;
            END
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_UpdateEmployeeProfile.';
GO

-- =======================================================================================
-- 3. THỦ TỤC: dbo.sp_HRM_PromoteOrUpdateContract
-- Thăng chức, chuyển bộ phận, ký HĐLĐ mới bảo tồn lịch sử Temporal
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_PromoteOrUpdateContract
    @EmployeeId         INT,
    @NewContractTypeId  INT,
    @NewPosition        NVARCHAR(100),
    @NewHourlyRate      DECIMAL(18,2),
    @EffectiveDate      DATE,
    @Note               NVARCHAR(500) = NULL,
    @NewContractId      INT           = NULL OUTPUT,
    @NewContractCode    VARCHAR(30)   = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
        BEGIN
            THROW 50004, N'Không tìm thấy nhân viên trong hệ thống.', 1;
        END

        DECLARE @EmpCode VARCHAR(20);
        SELECT @EmpCode = EmployeeCode FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

        -- 1. Đóng hợp đồng cũ gần nhất (EndDate = ngày trước ngày hiệu lực)
        UPDATE dbo.EmployeeContracts
        SET 
            EndDate = DATEADD(DAY, -1, @EffectiveDate),
            Status = 'expired',
            UpdatedAt = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId
          AND (EndDate IS NULL OR EndDate >= @EffectiveDate);

        -- 2. Đếm số hợp đồng đã có để sinh mã tiếp theo
        DECLARE @ContractCount INT;
        SELECT @ContractCount = COUNT(*) FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId;
        SET @NewContractCode = 'HD-' + @EmpCode + '-' + RIGHT('00' + CAST(@ContractCount + 1 AS VARCHAR(5)), 2);

        -- 3. Thêm hợp đồng mới có hiệu lực từ @EffectiveDate
        INSERT INTO dbo.EmployeeContracts (
            EmployeeId, ContractCode, ContractTypeId, Position, 
            HourlyRate, Allowance, StartDate, EndDate, SignDate, Status, Note, CreatedAt
        )
        VALUES (
            @EmployeeId, @NewContractCode, 
            @NewContractTypeId, @NewPosition, @NewHourlyRate, 0, 
            @EffectiveDate, NULL, @EffectiveDate, 'active', @Note, SYSDATETIME()
        );

        SET @NewContractId = SCOPE_IDENTITY();

        -- 4. Đồng bộ chức vụ và mức lương sang bảng chính Employees
        UPDATE dbo.Employees
        SET 
            Position       = @NewPosition,
            ContractTypeId = @NewContractTypeId,
            HourlyRate     = @NewHourlyRate,
            UpdatedAt      = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_PromoteOrUpdateContract.';
GO

-- =======================================================================================
-- 4. THỦ TỤC: dbo.sp_HRM_ProvisionAccount
-- Cấp phát tài khoản đăng nhập cho nhân viên chưa có tài khoản (tab Tài khoản chưa thiết lập)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProvisionAccount
    @EmployeeId             INT,
    @Username               VARCHAR(50),
    @PasswordHash           VARCHAR(255),
    @RoleId                 INT = 5,
    @MustChangePassword     BIT = 1,
    @CreatedByUsername      VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Kiểm tra nhân viên tồn tại
        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
        BEGIN
            THROW 50005, N'Không tìm thấy nhân viên trong hệ thống.', 1;
        END

        -- 2. Kiểm tra nhân viên đã có tài khoản chưa
        IF EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId AND UserId IS NOT NULL)
        BEGIN
            THROW 50006, N'Nhân viên này đã được cấp tài khoản người dùng trước đó.', 1;
        END

        -- 3. Kiểm tra tính duy nhất của Username
        IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
        BEGIN
            THROW 50007, N'Tên đăng nhập (Username) này đã tồn tại, vui lòng chọn tên khác.', 1;
        END

        -- 4. Lấy thông tin họ tên, email, sđt của nhân viên để khởi tạo User
        DECLARE @FullName NVARCHAR(100), @Phone VARCHAR(20);
        SELECT @FullName = FullName, @Phone = PhoneNumber FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

        -- 5. Tạo bản ghi trong dbo.Users
        INSERT INTO dbo.Users (
            Username, PasswordHash, FullName, PhoneNumber, 
            IsActive, MustChangePassword, CreatedAt
        )
        VALUES (
            @Username, @PasswordHash, @FullName, @Phone, 
            1, @MustChangePassword, SYSDATETIME()
        );

        DECLARE @NewUserId INT = SCOPE_IDENTITY();

        -- 6. Gán tài khoản vào nhân sự
        UPDATE dbo.Employees
        SET UserId = @NewUserId, UpdatedAt = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId;

        -- 7. Gán vai trò (Role)
        IF @RoleId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId = @RoleId)
        BEGIN
            INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@NewUserId, @RoleId);
        END

        COMMIT TRANSACTION;

        -- 8. Trả về thông tin tài khoản vừa tạo
        SELECT 
            u.UserId,
            u.Username,
            u.FullName,
            r.RoleId,
            r.RoleName,
            u.IsActive,
            u.MustChangePassword
        FROM dbo.Users u
        LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
        LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId
        WHERE u.UserId = @NewUserId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_ProvisionAccount.';
GO

-- =======================================================================================
-- 5. THỦ TỤC: dbo.sp_HRM_UpdateAccount
-- Khóa / mở khóa tài khoản, đặt lại mật khẩu hoặc đổi vai trò của người dùng
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpdateAccount
    @UserId                 INT,
    @NewPasswordHash        VARCHAR(255) = NULL,
    @IsActive               BIT          = NULL,
    @MustChangePassword     BIT          = NULL,
    @RoleId                 INT          = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE UserId = @UserId)
        BEGIN
            THROW 50008, N'Không tìm thấy tài khoản người dùng tương ứng.', 1;
        END

        UPDATE dbo.Users
        SET 
            PasswordHash       = ISNULL(@NewPasswordHash, PasswordHash),
            IsActive           = ISNULL(@IsActive, IsActive),
            MustChangePassword = ISNULL(@MustChangePassword, MustChangePassword)
        WHERE UserId = @UserId;

        IF @RoleId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId = @RoleId)
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId)
            BEGIN
                UPDATE dbo.UserRoles SET RoleId = @RoleId WHERE UserId = @UserId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId);
            END
        END

        COMMIT TRANSACTION;

        SELECT 
            u.UserId,
            u.Username,
            u.FullName,
            r.RoleId,
            r.RoleName,
            u.IsActive,
            u.MustChangePassword
        FROM dbo.Users u
        LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
        LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId
        WHERE u.UserId = @UserId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_UpdateAccount.';
GO

-- =======================================================================================
-- 6. THỦ TỤC: dbo.sp_HRM_ImportEmployees_Batch
-- Nhập danh sách nhân sự hàng loạt từ JSON (Excel import), tự động tạo hợp đồng và tài khoản
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ImportEmployees_Batch
    @EmployeesJson          NVARCHAR(MAX),
    @CreateAccounts         BIT = 0,
    @DefaultPasswordHash    VARCHAR(255) = NULL,
    @ImportedByUsername     VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    -- Bảng tạm lưu các dòng dữ liệu JSON đã bóc tách
    CREATE TABLE #ImportRows (
        RowIndex            INT,
        EmployeeCode        VARCHAR(20),
        FullName            NVARCHAR(100),
        CitizenId           VARCHAR(20),
        PhoneNumber         VARCHAR(20),
        BranchInput         NVARCHAR(100),
        Position            NVARCHAR(50),
        ContractTypeInput   NVARCHAR(100),
        HourlyRate          DECIMAL(18,2),
        Allowance           DECIMAL(18,2),
        Status              VARCHAR(20),
        ResolvedBranchId    INT,
        ResolvedContractTypeId INT
    );

    INSERT INTO #ImportRows (
        RowIndex, EmployeeCode, FullName, CitizenId, PhoneNumber, 
        BranchInput, Position, ContractTypeInput, HourlyRate, Allowance, Status
    )
    SELECT 
        RowIndex, EmployeeCode, FullName, CitizenId, PhoneNumber, 
        BranchInput, Position, ContractTypeInput, HourlyRate, Allowance, ISNULL(Status, 'active')
    FROM OPENJSON(@EmployeesJson)
    WITH (
        RowIndex            INT           '$.rowIndex',
        EmployeeCode        VARCHAR(20)   '$.employeeCode',
        FullName            NVARCHAR(100) '$.fullName',
        CitizenId           VARCHAR(20)   '$.citizenId',
        PhoneNumber         VARCHAR(20)   '$.phoneNumber',
        BranchInput         NVARCHAR(100) '$.branchInput',
        Position            NVARCHAR(50)  '$.position',
        ContractTypeInput   NVARCHAR(100) '$.contractTypeInput',
        HourlyRate          DECIMAL(18,2) '$.hourlyRate',
        Allowance           DECIMAL(18,2) '$.allowance',
        Status              VARCHAR(20)   '$.status'
    );

    -- Giải quyết BranchId từ BranchInput
    UPDATE r
    SET ResolvedBranchId = b.BranchId
    FROM #ImportRows r
    INNER JOIN dbo.Branches b ON b.BranchName LIKE '%' + r.BranchInput + '%' OR b.BranchCode = r.BranchInput;

    -- Mặc định chi nhánh 1 nếu không khớp
    UPDATE #ImportRows SET ResolvedBranchId = 1 WHERE ResolvedBranchId IS NULL;

    -- Giải quyết ContractTypeId
    UPDATE r
    SET ResolvedContractTypeId = ct.ContractTypeId
    FROM #ImportRows r
    INNER JOIN dbo.ContractTypes ct ON ct.ContractName LIKE '%' + r.ContractTypeInput + '%' OR ct.ContractCode = r.ContractTypeInput;

    UPDATE #ImportRows SET ResolvedContractTypeId = 3 WHERE ResolvedContractTypeId IS NULL;

    -- Bảng lưu kết quả các nhân viên import thành công
    CREATE TABLE #ResultItems (
        EmployeeId   INT,
        EmployeeCode VARCHAR(20),
        FullName     NVARCHAR(100),
        CitizenId    VARCHAR(20),
        BranchName   NVARCHAR(100),
        Position     NVARCHAR(50),
        ContractName NVARCHAR(100),
        HourlyRate   DECIMAL(18,2),
        HasAccount   BIT
    );

    DECLARE @TotalReceived INT = (SELECT COUNT(*) FROM #ImportRows);
    DECLARE @TotalImported INT = 0;
    DECLARE @TotalSkipped  INT = 0;
    DECLARE @AccountsCreated INT = 0;

    -- Con trỏ duyệt qua từng dòng import
    DECLARE 
        @rIndex INT, @rCode VARCHAR(20), @rName NVARCHAR(100), @rCitizen VARCHAR(20),
        @rPhone VARCHAR(20), @rBranch INT, @rPos NVARCHAR(50), @rCtId INT,
        @rRate DECIMAL(18,2), @rAllow DECIMAL(18,2), @rStatus VARCHAR(20);

    DECLARE cur CURSOR LOCAL FAST_FORWARD FOR
    SELECT 
        RowIndex, EmployeeCode, FullName, CitizenId, PhoneNumber, 
        ResolvedBranchId, Position, ResolvedContractTypeId, HourlyRate, Allowance, Status
    FROM #ImportRows
    ORDER BY RowIndex;

    OPEN cur;
    FETCH NEXT FROM cur INTO 
        @rIndex, @rCode, @rName, @rCitizen, @rPhone, 
        @rBranch, @rPos, @rCtId, @rRate, @rAllow, @rStatus;

    WHILE @@FETCH_STATUS = 0
    BEGIN
        -- Bỏ qua nếu trùng CCCD
        IF EXISTS (SELECT 1 FROM dbo.Employees WHERE CitizenId = @rCitizen)
        BEGIN
            SET @TotalSkipped = @TotalSkipped + 1;
        END
        ELSE
        BEGIN
            -- Sinh mã nếu chưa có
            IF @rCode IS NULL OR LTRIM(RTRIM(@rCode)) = ''
            BEGIN
                DECLARE @NextSeq INT;
                SELECT @NextSeq = ISNULL(MAX(
                    CASE 
                        WHEN EmployeeCode LIKE 'NV%' AND ISNUMERIC(SUBSTRING(EmployeeCode, 3, 10)) = 1 
                        THEN CAST(SUBSTRING(EmployeeCode, 3, 10) AS INT)
                        ELSE 0
                    END
                ), 0) + 1
                FROM dbo.Employees;
                SET @rCode = 'NV' + RIGHT('000' + CAST(@NextSeq AS VARCHAR(10)), 3);
            END

            DECLARE @NewUserId INT = NULL;
            IF @CreateAccounts = 1 AND @DefaultPasswordHash IS NOT NULL
            BEGIN
                DECLARE @UsernameGen VARCHAR(50) = 'nv_' + LOWER(@rCode);
                IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @UsernameGen)
                BEGIN
                    INSERT INTO dbo.Users (Username, PasswordHash, FullName, PhoneNumber, IsActive, MustChangePassword, CreatedAt)
                    VALUES (@UsernameGen, @DefaultPasswordHash, @rName, @rPhone, 1, 1, SYSDATETIME());
                    SET @NewUserId = SCOPE_IDENTITY();
                    INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@NewUserId, 5); -- Barista/Staff
                    SET @AccountsCreated = @AccountsCreated + 1;
                END
            END

            IF @rRate IS NULL OR @rRate <= 0
            BEGIN
                SELECT @rRate = StandardHourlyRate FROM dbo.ContractTypes WHERE ContractTypeId = @rCtId;
                IF @rRate IS NULL SET @rRate = 25000;
            END

            INSERT INTO dbo.Employees (
                UserId, EmployeeCode, FullName, PhoneNumber, CitizenId,
                BranchId, Position, ContractTypeId, HourlyRate, Status, HireDate, UpdatedAt
            )
            VALUES (
                @NewUserId, @rCode, @rName, @rPhone, @rCitizen,
                @rBranch, @rPos, @rCtId, @rRate, @rStatus, CAST(GETDATE() AS DATE), SYSDATETIME()
            );

            DECLARE @NewEmpId INT = SCOPE_IDENTITY();

            -- Tạo hợp đồng ban đầu
            INSERT INTO dbo.EmployeeContracts (
                EmployeeId, ContractCode, ContractTypeId, Position,
                HourlyRate, Allowance, StartDate, EndDate, SignDate, Status, CreatedAt
            )
            VALUES (
                @NewEmpId, 'HD-' + @rCode + '-01', @rCtId, @rPos,
                @rRate, ISNULL(@rAllow, 0), CAST(GETDATE() AS DATE), NULL, CAST(GETDATE() AS DATE), 'active', SYSDATETIME()
            );

            INSERT INTO #ResultItems (EmployeeId, EmployeeCode, FullName, CitizenId, BranchName, Position, ContractName, HourlyRate, HasAccount)
            SELECT 
                @NewEmpId, @rCode, @rName, @rCitizen, b.BranchName, @rPos, ct.ContractName, @rRate, 
                CASE WHEN @NewUserId IS NOT NULL THEN 1 ELSE 0 END
            FROM dbo.Branches b
            CROSS JOIN dbo.ContractTypes ct
            WHERE b.BranchId = @rBranch AND ct.ContractTypeId = @rCtId;

            SET @TotalImported = @TotalImported + 1;
        END

        FETCH NEXT FROM cur INTO 
            @rIndex, @rCode, @rName, @rCitizen, @rPhone, 
            @rBranch, @rPos, @rCtId, @rRate, @rAllow, @rStatus;
    END

    CLOSE cur;
    DEALLOCATE cur;

    -- Result Set 1: Thống kê tổng hợp (EmployeeImportSaveResultDto)
    SELECT 
        @TotalReceived AS TotalReceived,
        @TotalImported AS TotalImported,
        @TotalSkipped  AS TotalSkipped,
        @AccountsCreated AS AccountsCreated;

    -- Result Set 2: Chi tiết nhân sự đã import (EmployeeImportedItemDto)
    SELECT 
        EmployeeId,
        EmployeeCode,
        FullName,
        CitizenId,
        BranchName,
        Position,
        ContractName,
        HourlyRate,
        HasAccount
    FROM #ResultItems
    ORDER BY EmployeeId;

    DROP TABLE #ImportRows;
    DROP TABLE #ResultItems;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_ImportEmployees_Batch.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG TỆP 19: TOÀN BỘ 6 THỦ TỤC GHI & QUẢN LÝ TÀI KHOẢN ĐÃ SẴN SÀNG!';
PRINT N'=======================================================================================';
GO
