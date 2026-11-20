-- =======================================================================================
-- 24_hrm_shift_schedule_locking_routines.sql
-- Hoàn thiện thủ tục Khóa ca làm việc (Cấp 1) tiếp nhận @StartDate linh hoạt
-- =======================================================================================
USE CoffeeShopDB;
GO

-- 1. THỦ TỤC TRUY VẤN TRẠNG THÁI KHÓA CA TUẦN
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetShiftScheduleWeekStatus
    @BranchId   INT,
    @StartDate  DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 SET @BranchId = 1;
    IF @StartDate IS NULL SET @StartDate = CAST(GETDATE() AS DATE);

    DECLARE @Year INT = DATEPART(YEAR, @StartDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @StartDate);

    SELECT TOP 1
        WeekId,
        BranchId,
        [Year],
        WeekNumber,
        StartDate,
        EndDate,
        IsLocked,
        LockedBy,
        LockedAt,
        CreatedAt
    FROM dbo.ShiftScheduleWeeks
    WHERE BranchId = @BranchId 
      AND [Year] = @Year 
      AND WeekNumber = @WeekNumber;
END;
GO

-- 2. THỦ TỤC KHÓA CA LÀM VIỆC TUẦN
CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockShiftSchedule
    @BranchId       INT,
    @StartDate      DATE,
    @LockedBy       VARCHAR(50) = 'manager'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 SET @BranchId = 1;
    IF @StartDate IS NULL SET @StartDate = CAST(GETDATE() AS DATE);

    DECLARE @Year INT = DATEPART(YEAR, @StartDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @StartDate);
    DECLARE @EndDate DATE = DATEADD(DAY, 6, @StartDate);

    BEGIN TRY
        BEGIN TRANSACTION;

        MERGE dbo.ShiftScheduleWeeks AS target
        USING (SELECT @BranchId AS BranchId, @Year AS [Year], @WeekNumber AS WeekNumber) AS source
        ON target.BranchId = source.BranchId AND target.[Year] = source.[Year] AND target.WeekNumber = source.WeekNumber
        WHEN MATCHED THEN
            UPDATE SET 
                IsLocked  = 1,
                LockedBy  = @LockedBy,
                LockedAt  = SYSDATETIME(),
                StartDate = @StartDate,
                EndDate   = @EndDate
        WHEN NOT MATCHED THEN
            INSERT (BranchId, [Year], WeekNumber, StartDate, EndDate, IsLocked, LockedBy, LockedAt, CreatedAt)
            VALUES (@BranchId, @Year, @WeekNumber, @StartDate, @EndDate, 1, @LockedBy, SYSDATETIME(), SYSDATETIME());

        COMMIT TRANSACTION;

        SELECT 1 AS Success;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 3. THỦ TỤC MỞ KHÓA CA LÀM VIỆC TUẦN
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockShiftSchedule
    @BranchId       INT,
    @StartDate      DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 SET @BranchId = 1;
    IF @StartDate IS NULL SET @StartDate = CAST(GETDATE() AS DATE);

    DECLARE @Year INT = DATEPART(YEAR, @StartDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @StartDate);

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Kiểm tra ràng buộc thác nước: Nếu kỳ công tháng của tuần này đã bị KHÓA CÔNG thì chặn mở khóa ca
        DECLARE @PeriodMonth VARCHAR(7) = FORMAT(@StartDate, 'yyyy-MM');
        IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE BranchId = @BranchId AND PeriodMonth = @PeriodMonth AND IsLocked = 1)
        BEGIN
            THROW 50022, N'Không thể mở khóa ca làm: Bảng công tháng này đã bị khóa sổ. Phải mở khóa công trước khi mở khóa lịch ca.', 1;
        END;

        UPDATE dbo.ShiftScheduleWeeks
        SET IsLocked = 0, LockedBy = NULL, LockedAt = NULL
        WHERE BranchId = @BranchId AND [Year] = @Year AND WeekNumber = @WeekNumber;

        COMMIT TRANSACTION;

        SELECT 1 AS Success;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
