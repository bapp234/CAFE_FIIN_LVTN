USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Đảm bảo mật khẩu khóa/mở khóa mặc định tồn tại trong dbo.HrmSettings
MERGE dbo.HrmSettings AS target
USING (SELECT 'ATTENDANCE_UNLOCK_PASSWORD' AS SettingKey) AS source
ON target.SettingKey = source.SettingKey
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, Description, UpdatedAt, UpdatedBy)
    VALUES ('ATTENDANCE_UNLOCK_PASSWORD', 'FiinUnlock@2026', N'Mật khẩu xác nhận khóa/mở khóa kỳ công & ca làm', SYSDATETIME(), 'IT_Admin');
GO

-- 2. Cập nhật sp_HRM_UnlockAttendancePeriod chấp nhận token đã xác thực từ Backend API (mật khẩu tài khoản hoặc mật khẩu IT)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockAttendancePeriod
    @BranchId           INT,
    @PeriodMonth        VARCHAR(7),
    @UnlockPassword     NVARCHAR(100),
    @UnlockReason       NVARCHAR(500),
    @UnlockedBy         VARCHAR(50),
    @ClientIp           VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @BranchId IS NOT NULL AND @BranchId > 0 AND NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
            SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

        -- 1. Kiểm tra nguyên tắc thác nước: Nếu Lương tháng này đã khóa thì CẤM mở khóa công
        IF EXISTS (
            SELECT 1 FROM dbo.PayrollPeriods
            WHERE PeriodMonth = @PeriodMonth
              AND IsLocked = 1
              AND (@BranchId IS NULL OR @BranchId <= 0 OR BranchId = @BranchId OR BranchId IS NULL)
        )
        BEGIN
            THROW 50025, N'Bảng lương tháng này đã khóa sổ. Vui lòng mở khóa bảng lương trước khi mở khóa bảng công.', 1;
        END

        -- 2. Kiểm tra mật khẩu (nếu chưa được xác thực qua Backend API)
        IF ISNULL(@UnlockPassword, N'') <> N'__VERIFIED_BY_API__'
        BEGIN
            DECLARE @SavedPassword NVARCHAR(MAX);
            SELECT @SavedPassword = SettingValue
            FROM dbo.HrmSettings
            WHERE SettingKey = 'ATTENDANCE_UNLOCK_PASSWORD';

            IF @SavedPassword IS NULL OR @SavedPassword <> @UnlockPassword
            BEGIN
                THROW 50026, N'Mật khẩu xác nhận không chính xác.', 1;
            END
        END

        -- 3. Kiểm tra lý do mở khóa
        IF @UnlockReason IS NULL OR LEN(LTRIM(RTRIM(@UnlockReason))) < 5
        BEGIN
            THROW 50027, N'Vui lòng nhập lý do mở khóa (tối thiểu 5 ký tự).', 1;
        END

        -- 4. Mở khóa bảng công & ghi vết kiểm toán
        DECLARE @UnlockedPeriods TABLE (PeriodId INT, BranchId INT);

        UPDATE dbo.AttendancePeriods
        SET
            IsLocked     = 0,
            UnlockedBy   = @UnlockedBy,
            UnlockedAt   = SYSDATETIME(),
            UnlockReason = @UnlockReason
        OUTPUT inserted.PeriodId, inserted.BranchId INTO @UnlockedPeriods(PeriodId, BranchId)
        WHERE PeriodMonth = @PeriodMonth
          AND IsLocked = 1
          AND (@BranchId IS NULL OR @BranchId <= 0 OR BranchId = @BranchId);

        INSERT INTO dbo.AttendanceUnlockLogs (PeriodId, BranchId, PeriodMonth, UnlockedBy, UnlockedAt, UnlockReason, ClientIp)
        SELECT PeriodId, BranchId, @PeriodMonth, @UnlockedBy, SYSDATETIME(), @UnlockReason, @ClientIp
        FROM @UnlockedPeriods;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã cấu hình mật khẩu khóa/mở khóa và cập nhật sp_HRM_UnlockAttendancePeriod.';
GO
