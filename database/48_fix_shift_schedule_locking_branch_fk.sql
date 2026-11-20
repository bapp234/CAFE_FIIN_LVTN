USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- SỬA LỖI FK_ShiftScheduleWeeks_Branches KHI KHÓA / MỞ KHÓA CA TUẦN
-- (Thay vì gán cứng @BranchId = 1, tự lấy chi nhánh hợp lệ đầu tiên nếu @BranchId = 1 chưa tồn tại)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetShiftScheduleWeekStatus
    @BranchId   INT,
    @StartDate  DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 OR NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
        SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

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

CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockShiftSchedule
    @BranchId       INT,
    @StartDate      DATE,
    @LockedBy       VARCHAR(50) = 'manager'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 OR NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
        SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

    IF @BranchId IS NULL
        THROW 54010, N'Chưa có chi nhánh nào trong hệ thống để khóa lịch ca tuần.', 1;

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

CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockShiftSchedule
    @BranchId       INT,
    @StartDate      DATE
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @BranchId IS NULL OR @BranchId <= 0 OR NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE BranchId = @BranchId)
        SET @BranchId = (SELECT TOP 1 BranchId FROM dbo.Branches ORDER BY BranchId);

    IF @StartDate IS NULL SET @StartDate = CAST(GETDATE() AS DATE);

    DECLARE @Year INT = DATEPART(YEAR, @StartDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @StartDate);

    UPDATE dbo.ShiftScheduleWeeks
    SET IsLocked = 0
    WHERE BranchId = @BranchId
      AND [Year] = @Year
      AND WeekNumber = @WeekNumber;

    SELECT 1 AS Success;
END;
GO
PRINT N'-> Đã sửa sp_HRM_GetShiftScheduleWeekStatus, sp_HRM_LockShiftSchedule, sp_HRM_UnlockShiftSchedule.';
GO
