USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- SỬA LỖI FK_AttendancePeriods_Branches KHI LẤY TRẠNG THÁI / KHÓA / MỞ KHÓA BẢNG CÔNG THÁNG
-- (Không gán cứng @BranchId = 1 vì DB có thể không có BranchId = 1;
--  hỗ trợ @BranchId IS NULL / <= 0 cho chế độ "Tất cả chi nhánh")
-- =======================================================================================

CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetAttendancePeriodStatus
    @BranchId       INT = NULL,
    @PeriodMonth    VARCHAR(7) -- 'YYYY-MM'
AS
BEGIN
    SET NOCOUNT ON;

    IF @BranchId IS NULL OR @BranchId <= 0
    BEGIN
        -- Chế độ toàn hệ thống: chỉ coi là đã khóa khi mọi chi nhánh có nhân viên đang làm việc đều đã khóa
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.Branches b
            WHERE EXISTS (
                SELECT 1
                FROM dbo.Employees e
                WHERE e.BranchId = b.BranchId
                  AND LOWER(ISNULL(e.Status, 'working')) <> 'resigned'
            )
            AND NOT EXISTS (
                SELECT 1
                FROM dbo.AttendancePeriods ap
                WHERE ap.BranchId = b.BranchId
                  AND ap.PeriodMonth = @PeriodMonth
                  AND ap.IsLocked = 1
            )
        )
        AND EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND IsLocked = 1)
        BEGIN
            SELECT TOP 1
                PeriodId,
                BranchId,
                PeriodMonth,
                IsLocked,
                LockedBy,
                LockedAt,
                UnlockedBy,
                UnlockedAt,
                UnlockReason
            FROM dbo.AttendancePeriods
            WHERE PeriodMonth = @PeriodMonth AND IsLocked = 1
            ORDER BY LockedAt DESC, PeriodId DESC;
            RETURN;
        END

        -- Có ít nhất 1 chi nhánh chưa khóa -> trả về trạng thái chưa khóa (nếu có bản ghi unlocked thì trả về bản ghi đó)
        SELECT TOP 1
            PeriodId,
            BranchId,
            PeriodMonth,
            CAST(0 AS BIT) AS IsLocked,
            LockedBy,
            LockedAt,
            UnlockedBy,
            UnlockedAt,
            UnlockReason
        FROM dbo.AttendancePeriods
        WHERE PeriodMonth = @PeriodMonth
        ORDER BY IsLocked ASC, PeriodId ASC;
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
        SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

    SELECT TOP 1
        PeriodId,
        BranchId,
        PeriodMonth,
        IsLocked,
        LockedBy,
        LockedAt,
        UnlockedBy,
        UnlockedAt,
        UnlockReason
    FROM dbo.AttendancePeriods
    WHERE BranchId = @BranchId AND PeriodMonth = @PeriodMonth;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockAttendancePeriod
    @BranchId       INT,
    @PeriodMonth    VARCHAR(7), -- 'YYYY-MM'
    @LockedBy       VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Branches)
        THROW 54011, N'Chưa có chi nhánh nào trong hệ thống để khóa bảng công.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @BranchId IS NULL OR @BranchId <= 0
        BEGIN
            -- Chốt khóa kỳ công cho tất cả chi nhánh hợp lệ trong dbo.Branches
            MERGE dbo.AttendancePeriods AS target
            USING (
                SELECT BranchId, @PeriodMonth AS PeriodMonth
                FROM dbo.Branches
            ) AS source
            ON target.BranchId = source.BranchId AND target.PeriodMonth = source.PeriodMonth
            WHEN MATCHED THEN
                UPDATE SET
                    IsLocked     = 1,
                    LockedBy     = @LockedBy,
                    LockedAt     = SYSDATETIME(),
                    UnlockedBy   = NULL,
                    UnlockedAt   = NULL,
                    UnlockReason = NULL
            WHEN NOT MATCHED THEN
                INSERT (BranchId, PeriodMonth, IsLocked, LockedBy, LockedAt)
                VALUES (source.BranchId, source.PeriodMonth, 1, @LockedBy, SYSDATETIME());
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
                SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

            MERGE dbo.AttendancePeriods AS target
            USING (SELECT @BranchId AS BranchId, @PeriodMonth AS PeriodMonth) AS source
            ON target.BranchId = source.BranchId AND target.PeriodMonth = source.PeriodMonth
            WHEN MATCHED THEN
                UPDATE SET
                    IsLocked     = 1,
                    LockedBy     = @LockedBy,
                    LockedAt     = SYSDATETIME(),
                    UnlockedBy   = NULL,
                    UnlockedAt   = NULL,
                    UnlockReason = NULL
            WHEN NOT MATCHED THEN
                INSERT (BranchId, PeriodMonth, IsLocked, LockedBy, LockedAt)
                VALUES (source.BranchId, source.PeriodMonth, 1, @LockedBy, SYSDATETIME());
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

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

        -- 1. Kiểm tra nguyên tắc thác nước: Nếu Lương tháng này đã khóa thì TUYỆT ĐỐI CẤM mở khóa công
        IF EXISTS (
            SELECT 1 FROM dbo.PayrollPeriods
            WHERE PeriodMonth = @PeriodMonth
              AND IsLocked = 1
              AND (@BranchId IS NULL OR @BranchId <= 0 OR BranchId = @BranchId OR BranchId IS NULL)
        )
        BEGIN
            THROW 50025, N'Vi phạm nguyên tắc dòng thác: Bảng lương tháng này đã bị KHÓA SỔ. Bạn bắt buộc phải yêu cầu Ban Giám đốc mở khóa bảng lương trước khi mở khóa bảng công.', 1;
        END

        -- 2. Kiểm tra mật khẩu ủy quyền IT lưu trong dbo.HrmSettings
        DECLARE @SavedPassword NVARCHAR(MAX);
        SELECT @SavedPassword = SettingValue
        FROM dbo.HrmSettings
        WHERE SettingKey = 'ATTENDANCE_UNLOCK_PASSWORD';

        IF @SavedPassword IS NULL OR @SavedPassword <> @UnlockPassword
        BEGIN
            THROW 50026, N'Mật khẩu thẩm quyền IT không chính xác. Thao tác mở khóa bảng công bị từ chối.', 1;
        END

        -- 3. Kiểm tra lý do mở khóa
        IF @UnlockReason IS NULL OR LEN(LTRIM(RTRIM(@UnlockReason))) < 5
        BEGIN
            THROW 50027, N'Lý do mở khóa không hợp lệ: Vui lòng nhập tối thiểu 5 ký tự giải trình phục vụ kiểm toán.', 1;
        END

        -- 4. Cập nhật mở khóa bảng công & ghi vết kiểm toán (Audit Log)
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
PRINT N'-> Đã sửa lỗi FK_AttendancePeriods_Branches cho sp_HRM_GetAttendancePeriodStatus, sp_HRM_LockAttendancePeriod, sp_HRM_UnlockAttendancePeriod.';
GO
