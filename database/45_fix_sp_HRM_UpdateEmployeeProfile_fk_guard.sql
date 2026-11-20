USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- CẬP NHẬT: dbo.sp_HRM_UpdateEmployeeProfile
-- BẢO VỆ KHÓA NGOẠI: Chỉ cập nhật ContractTypeId / BranchId khi giá trị tồn tại hợp lệ
-- (tránh xung đột FK_Employees_ContractTypes khi @ContractTypeId = 0 hoặc bảng ContractTypes trống)
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

        DECLARE @SafeContractTypeId INT = NULL;
        IF @ContractTypeId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.ContractTypes WHERE ContractTypeId = @ContractTypeId)
            SET @SafeContractTypeId = @ContractTypeId;

        DECLARE @SafeBranchId INT = NULL;
        IF @BranchId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
            SET @SafeBranchId = @BranchId;

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
            ContractTypeId    = ISNULL(@SafeContractTypeId, ContractTypeId),
            HourlyRate        = ISNULL(@HourlyRate, HourlyRate),
            Note              = ISNULL(@Note, Note),
            Status            = ISNULL(@Status, Status),
            Position          = ISNULL(@Position, Position),
            BranchId          = ISNULL(@SafeBranchId, BranchId),
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
        IF @Position IS NOT NULL OR @HourlyRate IS NOT NULL OR @Allowance IS NOT NULL OR @SafeContractTypeId IS NOT NULL
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
                    ContractTypeId = ISNULL(@SafeContractTypeId, ContractTypeId),
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
PRINT N'-> Đã cập nhật dbo.sp_HRM_UpdateEmployeeProfile (bảo vệ FK ContractTypes/Branches).';
GO
