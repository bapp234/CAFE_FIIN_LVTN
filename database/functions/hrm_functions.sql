-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Các hàm tính toán nghiệp vụ (User-Defined Functions): MODULE HRM
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/functions/hrm_functions.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

-- 1. Hàm tính số phút đi muộn so với giờ ca đăng ký
CREATE OR ALTER FUNCTION dbo.fn_HRM_CalculateLateMinutes (
    @ActualCheckIn DATETIME2(0),
    @ScheduledStartTime TIME(0)
)
RETURNS INT
WITH SCHEMABINDING
AS
BEGIN
    IF @ActualCheckIn IS NULL OR @ScheduledStartTime IS NULL
        RETURN 0;

    DECLARE @ActualTime TIME(0) = CAST(@ActualCheckIn AS TIME(0));
    DECLARE @DiffMinutes INT = DATEDIFF(MINUTE, @ScheduledStartTime, @ActualTime);

    IF @DiffMinutes > 0
        RETURN @DiffMinutes;

    RETURN 0;
END;
GO

PRINT N'-> Đã tạo hàm fn_HRM_CalculateLateMinutes.';
GO

-- 2. Hàm tính số phút về sớm so với giờ ca đăng ký
CREATE OR ALTER FUNCTION dbo.fn_HRM_CalculateEarlyLeaveMinutes (
    @ActualCheckOut DATETIME2(0),
    @ScheduledEndTime TIME(0)
)
RETURNS INT
WITH SCHEMABINDING
AS
BEGIN
    IF @ActualCheckOut IS NULL OR @ScheduledEndTime IS NULL
        RETURN 0;

    DECLARE @ActualTime TIME(0) = CAST(@ActualCheckOut AS TIME(0));
    DECLARE @DiffMinutes INT = DATEDIFF(MINUTE, @ActualTime, @ScheduledEndTime);

    IF @DiffMinutes > 0
        RETURN @DiffMinutes;

    RETURN 0;
END;
GO

PRINT N'-> Đã tạo hàm fn_HRM_CalculateEarlyLeaveMinutes.';
GO

-- 3. Hàm tính số giờ làm việc thực tế (trừ thời gian nghỉ)
CREATE OR ALTER FUNCTION dbo.fn_HRM_CalculateWorkHours (
    @ActualCheckIn DATETIME2(0),
    @ActualCheckOut DATETIME2(0),
    @BreakMinutes INT
)
RETURNS DECIMAL(4,2)
WITH SCHEMABINDING
AS
BEGIN
    IF @ActualCheckIn IS NULL OR @ActualCheckOut IS NULL
        RETURN 0.00;

    DECLARE @Break INT = ISNULL(@BreakMinutes, 0);
    DECLARE @TotalMinutes INT = DATEDIFF(MINUTE, @ActualCheckIn, @ActualCheckOut) - @Break;

    IF @TotalMinutes <= 0
        RETURN 0.00;

    RETURN CAST(ROUND(@TotalMinutes / 60.0, 2) AS DECIMAL(4,2));
END;
GO

PRINT N'-> Đã tạo hàm fn_HRM_CalculateWorkHours.';
GO

-- 4. Inline Table-Valued Function: Bảng tổng hợp công tháng của nhân viên
CREATE OR ALTER FUNCTION dbo.tvf_HRM_GetEmployeeMonthlyTimesheet (
    @EmployeeId INT,
    @PeriodMonth VARCHAR(7) -- 'YYYY-MM'
)
RETURNS TABLE
AS
RETURN (
    SELECT 
        a.EmployeeId,
        COUNT(DISTINCT a.WorkDate) AS TotalWorkDays,
        ISNULL(SUM(a.WorkHours), 0.00) AS TotalStandardHours,
        ISNULL(SUM(a.OvertimeHours), 0.00) AS TotalOvertimeHours,
        ISNULL(SUM(a.LateMinutes), 0) AS TotalLateMinutes,
        COUNT(CASE WHEN a.Status = 'late' THEN 1 END) AS LateOccurrences,
        COUNT(CASE WHEN a.Status = 'on_time' THEN 1 END) AS OnTimeOccurrences,
        COUNT(CASE WHEN a.IsManualAdjusted = 1 THEN 1 END) AS AdjustedOccurrences
    FROM dbo.Attendances a
    WHERE a.EmployeeId = @EmployeeId
      AND a.WorkDate >= CAST(@PeriodMonth + '-01' AS DATE)
      AND a.WorkDate < DATEADD(MONTH, 1, CAST(@PeriodMonth + '-01' AS DATE))
    GROUP BY a.EmployeeId
);
GO

PRINT N'-> Đã tạo hàm tvf_HRM_GetEmployeeMonthlyTimesheet.';
GO

PRINT N'>>> HOÀN TẤT TẠO FUNCTIONS CHO MODULE HRM! <<<';
GO
