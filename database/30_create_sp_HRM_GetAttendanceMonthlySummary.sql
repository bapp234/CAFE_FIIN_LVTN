USE [CoffeeShopDB];
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetAttendanceMonthlySummary
    @PeriodMonth VARCHAR(7),
    @BranchId    INT = NULL,
    @Search      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @PeriodMonth IS NULL OR @PeriodMonth NOT LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    BEGIN
        RAISERROR(N'PeriodMonth phải có định dạng YYYY-MM.', 16, 1);
        RETURN;
    END

    DECLARE @MonthStart DATE = CAST(@PeriodMonth + '-01' AS DATE);
    DECLARE @MonthEnd   DATE = EOMONTH(@MonthStart);
    DECLARE @SearchTerm NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    -- Tính số ngày công chuẩn trong tháng (tổng số ngày trong tháng trừ Chủ nhật, độc lập DATEFIRST)
    DECLARE @StandardDays INT = 0;
    SELECT @StandardDays = COUNT(*)
    FROM (
        SELECT TOP (DATEDIFF(DAY, @MonthStart, @MonthEnd) + 1)
            DATEADD(DAY, ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1, @MonthStart) AS D
        FROM sys.all_objects
    ) AS DaysInMonth
    WHERE ((DATEDIFF(DAY, '1900-01-07', D) % 7) + 7) % 7 <> 0; -- 1900-01-07 là Chủ nhật

    ;WITH NormalizedAttendance AS (
        SELECT
            a.EmployeeId,
            a.AttendanceId,
            a.LateMinutes,
            a.EarlyLeaveMinutes,
            a.IsMissingPunch,
            a.CheckInTime,
            a.CheckOutTime,
            CASE
                WHEN a.CheckInTime IS NULL OR a.CheckOutTime IS NULL THEN CAST(0.0 AS DECIMAL(10, 4))
                WHEN COALESCE(a.ScheduledStartTime, st.StartTime) IS NULL
                  OR COALESCE(a.ScheduledEndTime, st.EndTime) IS NULL
                THEN
                    CASE
                        WHEN ISNULL(a.WorkHours, 0) > 8.0 THEN CAST(8.0 AS DECIMAL(10, 4))
                        WHEN ISNULL(a.WorkHours, 0) < 0 THEN CAST(0.0 AS DECIMAL(10, 4))
                        ELSE CAST(a.WorkHours AS DECIMAL(10, 4))
                    END
                ELSE
                    (
                        SELECT
                            CASE
                                WHEN NetMinutes > StdMinutes THEN CAST(StdMinutes / 60.0 AS DECIMAL(10, 4))
                                WHEN NetMinutes < 0 THEN CAST(0.0 AS DECIMAL(10, 4))
                                ELSE CAST(NetMinutes / 60.0 AS DECIMAL(10, 4))
                            END
                        FROM (
                            SELECT
                                StdMinutes = CAST(ROUND(
                                    ISNULL(
                                        st.StandardHours,
                                        (DATEDIFF(MINUTE, COALESCE(a.ScheduledStartTime, st.StartTime), COALESCE(a.ScheduledEndTime, st.EndTime)) - BrkMinutes) / 60.0
                                    ) * 60.0, 0) AS INT),
                                NetMinutes =
                                    CASE
                                        WHEN BrkMinutes > 0 AND RawInsideMinutes > 300 THEN RawInsideMinutes - BrkMinutes
                                        ELSE RawInsideMinutes
                                    END
                            FROM (
                                SELECT
                                    BrkMinutes = ISNULL(
                                        st.BreakMinutes,
                                        CASE
                                            WHEN DATEDIFF(MINUTE, COALESCE(a.ScheduledStartTime, st.StartTime), COALESCE(a.ScheduledEndTime, st.EndTime)) >= 510 THEN 60
                                            ELSE 0
                                        END
                                    ),
                                    RawInsideMinutes =
                                        CASE
                                            WHEN EffEnd > EffStart THEN DATEDIFF(MINUTE, EffStart, EffEnd)
                                            ELSE 0
                                        END
                                FROM (
                                    SELECT
                                        EffStart = CASE
                                            WHEN CAST(a.CheckInTime AS TIME) > COALESCE(a.ScheduledStartTime, st.StartTime)
                                                THEN CAST(a.CheckInTime AS TIME)
                                            ELSE COALESCE(a.ScheduledStartTime, st.StartTime)
                                        END,
                                        EffEnd = CASE
                                            WHEN CAST(a.CheckOutTime AS TIME) < COALESCE(a.ScheduledEndTime, st.EndTime)
                                                THEN CAST(a.CheckOutTime AS TIME)
                                            ELSE COALESCE(a.ScheduledEndTime, st.EndTime)
                                        END
                                ) AS ClampedTimes
                            ) AS RawCalc
                        ) AS FinalCalc
                    )
            END AS NormalizedHours
        FROM dbo.Attendances a
        LEFT JOIN dbo.ShiftAssignments sa ON a.ShiftAssignmentId = sa.AssignmentId
        LEFT JOIN dbo.ShiftTemplates st ON sa.TemplateId = st.TemplateId
        WHERE a.WorkDate BETWEEN @MonthStart AND @MonthEnd
    ),
    AttAgg AS (
        SELECT
            EmployeeId,
            SUM(NormalizedHours) AS WorkHours,
            SUM(CASE WHEN ISNULL(LateMinutes, 0) > 0 OR ISNULL(EarlyLeaveMinutes, 0) > 0 THEN 1 ELSE 0 END) AS EarlyLateCount,
            SUM(CASE WHEN ISNULL(IsMissingPunch, 0) = 1 OR (CheckInTime IS NOT NULL AND CheckOutTime IS NULL) THEN 1 ELSE 0 END) AS MissingPunchCount
        FROM NormalizedAttendance
        GROUP BY EmployeeId
    ),
    OtAgg AS (
        SELECT
            EmployeeId,
            SUM(CASE WHEN LOWER(ISNULL(OTType, 'normal')) = 'normal' THEN ISNULL(Hours, 0) ELSE 0 END) AS OtNormalHours,
            SUM(CASE WHEN LOWER(ISNULL(OTType, '')) = 'weekend' THEN ISNULL(Hours, 0) ELSE 0 END) AS OtWeekendHours,
            SUM(CASE WHEN LOWER(ISNULL(OTType, '')) = 'holiday' THEN ISNULL(Hours, 0) ELSE 0 END) AS OtHolidayHours,
            SUM(ISNULL(Hours, 0)) AS TotalOtHours
        FROM dbo.EmployeeOvertimes
        WHERE WorkDate BETWEEN @MonthStart AND @MonthEnd
          AND LOWER(ISNULL(ApprovalStatus, '')) = 'approved'
        GROUP BY EmployeeId
    ),
    LeaveAgg AS (
        SELECT
            EmployeeId,
            SUM(
                CASE WHEN ISNULL(IsPaid, 0) = 1 THEN
                    CASE
                        WHEN FromDate >= @MonthStart AND ToDate <= @MonthEnd THEN ISNULL(LeaveDays, 0)
                        ELSE CAST(DATEDIFF(
                            DAY,
                            CASE WHEN FromDate < @MonthStart THEN @MonthStart ELSE FromDate END,
                            CASE WHEN ToDate > @MonthEnd THEN @MonthEnd ELSE ToDate END
                        ) + 1 AS DECIMAL(10, 2))
                    END
                ELSE 0 END
            ) AS PaidLeaveDays,
            SUM(
                CASE WHEN ISNULL(IsPaid, 0) = 0 THEN
                    CASE
                        WHEN FromDate >= @MonthStart AND ToDate <= @MonthEnd THEN ISNULL(LeaveDays, 0)
                        ELSE CAST(DATEDIFF(
                            DAY,
                            CASE WHEN FromDate < @MonthStart THEN @MonthStart ELSE FromDate END,
                            CASE WHEN ToDate > @MonthEnd THEN @MonthEnd ELSE ToDate END
                        ) + 1 AS DECIMAL(10, 2))
                    END
                ELSE 0 END
            ) AS UnpaidLeaveDays
        FROM dbo.EmployeeLeaves
        WHERE LOWER(ISNULL(ApprovalStatus, '')) = 'approved'
          AND FromDate <= @MonthEnd
          AND ToDate >= @MonthStart
        GROUP BY EmployeeId
    )
    SELECT
        e.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        e.BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        ISNULL(e.Status, 'working') AS WorkingStatus,
        @StandardDays AS StandardDays,
        CAST(ROUND(ISNULL(att.WorkHours, 0) / 8.0, 2) AS DECIMAL(10, 2)) AS WorkDays,
        CAST(ROUND(ISNULL(att.WorkHours, 0), 2) AS DECIMAL(10, 2)) AS WorkHours,
        CAST(ROUND(ISNULL(att.WorkHours, 0) + ISNULL(ot.TotalOtHours, 0), 2) AS DECIMAL(10, 2)) AS TotalWorkHours,
        CAST(ROUND(ISNULL(lv.PaidLeaveDays, 0), 2) AS DECIMAL(10, 2)) AS PaidLeaveDays,
        CAST(ROUND(ISNULL(lv.UnpaidLeaveDays, 0), 2) AS DECIMAL(10, 2)) AS UnpaidLeaveDays,
        CAST(ROUND(ISNULL(ot.OtNormalHours, 0), 2) AS DECIMAL(10, 2)) AS OtNormalHours,
        CAST(ROUND(ISNULL(ot.OtWeekendHours, 0), 2) AS DECIMAL(10, 2)) AS OtWeekendHours,
        CAST(ROUND(ISNULL(ot.OtHolidayHours, 0), 2) AS DECIMAL(10, 2)) AS OtHolidayHours,
        ISNULL(att.EarlyLateCount, 0) AS EarlyLateCount,
        ISNULL(att.MissingPunchCount, 0) AS MissingPunchCount
    FROM dbo.Employees e
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN AttAgg att ON e.EmployeeId = att.EmployeeId
    LEFT JOIN OtAgg ot ON e.EmployeeId = ot.EmployeeId
    LEFT JOIN LeaveAgg lv ON e.EmployeeId = lv.EmployeeId
    WHERE (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (
            LOWER(ISNULL(e.Status, 'working')) <> 'resigned'
            OR ISNULL(att.WorkHours, 0) > 0
            OR ISNULL(ot.TotalOtHours, 0) > 0
            OR ISNULL(lv.PaidLeaveDays, 0) > 0
            OR ISNULL(lv.UnpaidLeaveDays, 0) > 0
          )
      AND (
            @SearchTerm IS NULL
            OR e.FullName LIKE N'%' + @SearchTerm + N'%'
            OR e.EmployeeCode LIKE N'%' + @SearchTerm + N'%'
          )
    ORDER BY e.EmployeeCode ASC;
END
GO
