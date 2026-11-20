USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- CẬP NHẬT: dbo.sp_HRM_GetDashboardSummary
-- BỔ SUNG: SalaryCostVnd và WorkHours thực tế từ PayrollSlips + PayrollPeriods
--          cho biểu đồ Biến động Quỹ lương & Chi phí nhân sự 12 tháng
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetDashboardSummary
    @BranchId INT = NULL,
    @Year     INT = NULL,
    @Month    INT = NULL,
    @LoginID  INT = -1
AS
BEGIN
    SET NOCOUNT ON;

    IF @BranchId IS NOT NULL AND @BranchId <= 0 SET @BranchId = NULL;
    IF @Year IS NULL OR @Year < 2000 SET @Year = YEAR(SYSDATETIME());
    IF @Month IS NULL OR @Month < 1 OR @Month > 12 SET @Month = MONTH(SYSDATETIME());
    IF @LoginID IS NULL SET @LoginID = -1;

    DECLARE @TargetDate DATE = EOMONTH(DATEFROMPARTS(@Year, @Month, 1));
    DECLARE @MonthStart DATE = DATEFROMPARTS(@Year, @Month, 1);
    DECLARE @YearEnd    DATE = DATEFROMPARTS(@Year, 12, 31);

    SELECT
        EmployeeId,
        Position,
        BranchId,
        EmployeeStatus,
        HireDate
    INTO #TempDashEmployees
    FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@TargetDate, '-1', @LoginID)
    WHERE (@BranchId IS NULL OR BranchId = @BranchId);

    SELECT
        t.EmployeeId,
        t.BranchId,
        t.EmployeeStatus,
        t.HireDate,
        CAST(COALESCE(last_c.EndDate, e.UpdatedAt) AS DATE) AS ResignedRefDate
    INTO #TempYearEmployees
    FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@YearEnd, '-1', @LoginID) t
    INNER JOIN dbo.Employees e ON e.EmployeeId = t.EmployeeId
    OUTER APPLY (
        SELECT MAX(c.EndDate) AS EndDate
        FROM dbo.EmployeeContracts c
        WHERE c.EmployeeId = t.EmployeeId
    ) last_c
    WHERE (@BranchId IS NULL OR t.BranchId = @BranchId);

    -- RESULT SET 1: 4 CHỈ SỐ KPI NHÂN SỰ CỐT LÕI
    SELECT
        COUNT(*) AS TotalEmployees,
        ISNULL(SUM(CASE WHEN EmployeeStatus = 'active' THEN 1 ELSE 0 END), 0) AS WorkingEmployees,
        ISNULL(SUM(CASE WHEN EmployeeStatus IN ('resigned', 'terminated') THEN 1 ELSE 0 END), 0) AS ResignedEmployees,
        ISNULL(SUM(CASE WHEN EmployeeStatus IN ('suspended', 'probation') THEN 1 ELSE 0 END), 0) AS ProbationEmployees
    FROM #TempDashEmployees;

    -- RESULT SET 2: CƠ CẤU NHÂN SỰ THEO NHÓM CHỨC VỤ
    ;WITH ClassifiedPositions AS (
        SELECT
            CASE
                WHEN LOWER(ISNULL(Position, N'')) LIKE N'%pha chế%' OR LOWER(ISNULL(Position, N'')) LIKE N'%barista%'
                    THEN 'barista'
                WHEN LOWER(ISNULL(Position, N'')) LIKE N'%thu ngân%' OR LOWER(ISNULL(Position, N'')) LIKE N'%cashier%'
                    THEN 'cashier'
                WHEN LOWER(ISNULL(Position, N'')) LIKE N'%phục vụ%' OR LOWER(ISNULL(Position, N'')) LIKE N'%chạy bàn%'
                    THEN 'service'
                WHEN LOWER(ISNULL(Position, N'')) LIKE N'%quản lý%'
                  OR LOWER(ISNULL(Position, N'')) LIKE N'%giám sát%'
                  OR LOWER(ISNULL(Position, N'')) LIKE N'%trưởng%'
                  OR LOWER(ISNULL(Position, N'')) LIKE N'%giám đốc%'
                    THEN 'manager'
                ELSE 'office_support'
            END AS GroupId
        FROM #TempDashEmployees
    ),
    PositionCatalog AS (
        SELECT 1 AS SortOrder, 'barista'        AS GroupId, N'Pha chế (Barista)'        AS Label, '#2F5D58' AS Color UNION ALL
        SELECT 2 AS SortOrder, 'cashier'        AS GroupId, N'Thu ngân (Cashier)'       AS Label, '#9A7B4F' AS Color UNION ALL
        SELECT 3 AS SortOrder, 'service'        AS GroupId, N'Nhân viên Phục vụ'        AS Label, '#c25e36' AS Color UNION ALL
        SELECT 4 AS SortOrder, 'manager'        AS GroupId, N'Quản lý & Trưởng ca'      AS Label, '#1E3A8A' AS Color UNION ALL
        SELECT 5 AS SortOrder, 'office_support' AS GroupId, N'Khối Văn phòng & Hỗ trợ'  AS Label, '#78716c' AS Color
    )
    SELECT
        pc.GroupId,
        pc.Label,
        pc.Color,
        COUNT(cp.GroupId) AS [Count]
    FROM PositionCatalog pc
    LEFT JOIN ClassifiedPositions cp ON cp.GroupId = pc.GroupId
    GROUP BY pc.SortOrder, pc.GroupId, pc.Label, pc.Color
    ORDER BY pc.SortOrder;

    -- RESULT SET 3: BIẾN ĐỘNG QUY MÔ, TUYỂN MỚI / NGHỈ VIỆC & QUỸ LƯƠNG THỰC TẾ 12 THÁNG
    ;WITH Months AS (
        SELECT 1 AS MonthNum UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
        UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8
        UNION ALL SELECT 9 UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12
    )
    SELECT
        m.MonthNum AS [Month],
        (
            SELECT COUNT(*)
            FROM #TempYearEmployees ye
            WHERE ye.HireDate <= EOMONTH(DATEFROMPARTS(@Year, m.MonthNum, 1))
        ) AS Headcount,
        (
            SELECT COUNT(*)
            FROM #TempYearEmployees ye
            WHERE YEAR(ye.HireDate) = @Year AND MONTH(ye.HireDate) = m.MonthNum
        ) AS HiredCount,
        (
            SELECT COUNT(*)
            FROM #TempYearEmployees ye
            WHERE ye.EmployeeStatus IN ('resigned', 'terminated')
              AND ye.ResignedRefDate IS NOT NULL
              AND YEAR(ye.ResignedRefDate) = @Year
              AND MONTH(ye.ResignedRefDate) = m.MonthNum
        ) AS ResignedCount,
        ISNULL((
            SELECT SUM(ISNULL(ps.NetPay, 0))
            FROM dbo.PayrollSlips ps
            INNER JOIN dbo.PayrollPeriods pp ON ps.PeriodId = pp.PeriodId
            INNER JOIN dbo.Employees e ON ps.EmployeeId = e.EmployeeId
            WHERE pp.PeriodMonth = CONCAT(@Year, '-', RIGHT('0' + CAST(m.MonthNum AS VARCHAR(2)), 2))
              AND (@BranchId IS NULL OR e.BranchId = @BranchId)
        ), 0) AS SalaryCostVnd,
        ISNULL((
            SELECT SUM(ISNULL(ps.StandardHours, 0) + ISNULL(ps.OvertimeHours, 0))
            FROM dbo.PayrollSlips ps
            INNER JOIN dbo.PayrollPeriods pp ON ps.PeriodId = pp.PeriodId
            INNER JOIN dbo.Employees e ON ps.EmployeeId = e.EmployeeId
            WHERE pp.PeriodMonth = CONCAT(@Year, '-', RIGHT('0' + CAST(m.MonthNum AS VARCHAR(2)), 2))
              AND (@BranchId IS NULL OR e.BranchId = @BranchId)
        ), 0) AS WorkHours
    FROM Months m
    ORDER BY m.MonthNum;

    -- RESULT SET 4: TỔNG HỢP KỶ LUẬT CHẤM CÔNG TRONG THÁNG @Month/@Year
    SELECT
        COUNT(*) AS TotalShifts,
        ISNULL(SUM(CASE WHEN a.Status = 'on_time'       THEN 1 ELSE 0 END), 0) AS OnTimeCount,
        ISNULL(SUM(CASE WHEN a.Status = 'late'          THEN 1 ELSE 0 END), 0) AS LateCount,
        ISNULL(SUM(CASE WHEN a.Status = 'early_leave'   THEN 1 ELSE 0 END), 0) AS EarlyLeaveCount,
        ISNULL(SUM(CASE WHEN a.Status = 'absent'        THEN 1 ELSE 0 END), 0) AS AbsentCount,
        ISNULL(SUM(CASE WHEN a.Status = 'missing_punch' THEN 1 ELSE 0 END), 0) AS MissingPunchCount
    FROM dbo.Attendances a
    INNER JOIN dbo.Employees e ON e.EmployeeId = a.EmployeeId
    WHERE a.WorkDate >= @MonthStart
      AND a.WorkDate <= @TargetDate
      AND (@BranchId IS NULL OR e.BranchId = @BranchId);

    DROP TABLE #TempDashEmployees;
    DROP TABLE #TempYearEmployees;
END;
GO
PRINT N'-> Đã cập nhật sp_HRM_GetDashboardSummary bổ sung SalaryCostVnd và WorkHours thực tế.';
GO
