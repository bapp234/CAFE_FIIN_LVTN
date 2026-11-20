USE [CoffeeShopDB];
GO

-- =======================================================================================
-- NÂNG CẤP THỦ TỤC TÍNH LƯƠNG THÁNG:
-- 1. Ràng buộc: PHẢI KHÓA BẢNG CÔNG THÁNG (AttendancePeriods.IsLocked = 1) mới được tính lương
-- 2. Công chuẩn thực tế: chuẩn hóa theo khung ca (Attendances + ShiftTemplates) + Nghỉ phép hưởng lương
-- 3. Tăng ca: lấy OT đã duyệt theo hệ số thực tế trong dbo.OvertimeTypes
-- 4. Phụ cấp: phụ cấp vị trí + phụ cấp cơm ca (25.000đ/ngày có đi làm thực tế)
-- 5. Khấu trừ: phạt đi trễ/về sớm từ lần thứ 3 trở đi (50.000đ/lần)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CalculatePayroll
    @PeriodMonth  VARCHAR(7),
    @BranchId     INT = NULL,
    @CalculatedBy NVARCHAR(100) = N'Hệ thống',
    @PeriodId     INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @PeriodMonth IS NULL OR @PeriodMonth NOT LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    BEGIN
        RAISERROR(N'PeriodMonth phải có định dạng YYYY-MM.', 16, 1);
        RETURN;
    END

    DECLARE @MonthStart DATE = CAST(@PeriodMonth + '-01' AS DATE);
    DECLARE @MonthEnd   DATE = EOMONTH(@MonthStart);

    BEGIN TRANSACTION;

    -- 1. BẮT BUỘC KHÓA BẢNG CÔNG THÁNG TRƯỚC KHI TÍNH LƯƠNG
    IF @BranchId IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM dbo.AttendancePeriods
            WHERE PeriodMonth = @PeriodMonth
              AND BranchId = @BranchId
              AND IsLocked = 1
        )
        BEGIN
            ROLLBACK TRANSACTION;
            RAISERROR(N'Bảng công tháng %s của chi nhánh chưa được chốt khóa. Vui lòng khóa công trước khi tính lương.', 16, 1, @PeriodMonth);
            RETURN;
        END
    END
    ELSE
    BEGIN
        IF EXISTS (
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
        BEGIN
            ROLLBACK TRANSACTION;
            RAISERROR(N'Còn chi nhánh chưa chốt khóa bảng công tháng %s. Vui lòng khóa công trước khi tính lương.', 16, 1, @PeriodMonth);
            RETURN;
        END
    END

    -- 2. Kiểm tra kỳ lương đã tồn tại và bị khóa chưa
    DECLARE @ExistingPeriodId INT = NULL;
    DECLARE @IsLocked BIT = 0;

    SELECT @ExistingPeriodId = PeriodId, @IsLocked = IsLocked
    FROM dbo.PayrollPeriods
    WHERE PeriodMonth = @PeriodMonth
      AND (BranchId = @BranchId OR (BranchId IS NULL AND @BranchId IS NULL));

    IF @IsLocked = 1
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Kỳ lương này đã được phê duyệt và khóa, không thể tính toán lại.', 16, 1);
        RETURN;
    END

    -- 3. Tạo hoặc lấy PeriodId
    IF @ExistingPeriodId IS NULL
    BEGIN
        INSERT INTO dbo.PayrollPeriods (PeriodMonth, BranchId, Status, IsLocked, CreatedAt)
        VALUES (@PeriodMonth, @BranchId, 'draft', 0, SYSDATETIME());

        SET @PeriodId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SET @PeriodId = @ExistingPeriodId;
        DELETE FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId;
    END

    -- 4. Chuẩn bị hệ số OT mặc định theo danh mục dbo.OvertimeTypes
    DECLARE @RateNormal  DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-DAY'     AND IsActive = 1), 1.50);
    DECLARE @RateWeekend DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-WEEKEND' AND IsActive = 1), 2.00);
    DECLARE @RateHoliday DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-HOLIDAY' AND IsActive = 1), 3.00);
    DECLARE @RateNight   DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-NIGHT'   AND IsActive = 1), 1.80);

    DECLARE @PaidPctAnnual DECIMAL(8, 4) = ISNULL((SELECT TOP 1 CASE WHEN IsPaid = 1 THEN PaidPercent / 100.0 ELSE 0 END FROM dbo.LeaveTypes WHERE LeaveCode = 'LV-PHEP' AND IsActive = 1), 1.00);
    DECLARE @PaidPctSick   DECIMAL(8, 4) = ISNULL((SELECT TOP 1 CASE WHEN IsPaid = 1 THEN PaidPercent / 100.0 ELSE 0 END FROM dbo.LeaveTypes WHERE LeaveCode = 'LV-OM'   AND IsActive = 1), 0.75);

    -- 5. Tổng hợp dữ liệu công chuẩn + OT + nghỉ phép + phụ cấp cơm ca + khấu trừ đi trễ
    ;WITH NormalizedAttendance AS (
        SELECT
            a.EmployeeId,
            a.WorkDate,
            a.LateMinutes,
            a.EarlyLeaveMinutes,
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
            COUNT(DISTINCT CASE WHEN NormalizedHours > 0 THEN WorkDate END) AS DaysWorked,
            SUM(CASE WHEN ISNULL(LateMinutes, 0) > 0 OR ISNULL(EarlyLeaveMinutes, 0) > 0 THEN 1 ELSE 0 END) AS EarlyLateCount
        FROM NormalizedAttendance
        GROUP BY EmployeeId
    ),
    OtAgg AS (
        SELECT
            EmployeeId,
            SUM(ISNULL(Hours, 0)) AS OvertimeHours,
            SUM(
                ISNULL(Hours, 0) *
                CASE LOWER(ISNULL(OTType, 'normal'))
                    WHEN 'weekend' THEN @RateWeekend
                    WHEN 'holiday' THEN @RateHoliday
                    WHEN 'night'   THEN @RateNight
                    ELSE @RateNormal
                END
            ) AS WeightedOtHours
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
                    (CASE
                        WHEN FromDate >= @MonthStart AND ToDate <= @MonthEnd THEN ISNULL(LeaveDays, 0)
                        ELSE CAST(DATEDIFF(
                            DAY,
                            CASE WHEN FromDate < @MonthStart THEN @MonthStart ELSE FromDate END,
                            CASE WHEN ToDate > @MonthEnd THEN @MonthEnd ELSE ToDate END
                        ) + 1 AS DECIMAL(10, 2))
                    END) * 8.0 *
                    CASE LOWER(ISNULL(LeaveType, 'annual'))
                        WHEN 'sick' THEN @PaidPctSick
                        ELSE @PaidPctAnnual
                    END
                ELSE 0 END
            ) AS PaidLeaveHours
        FROM dbo.EmployeeLeaves
        WHERE LOWER(ISNULL(ApprovalStatus, '')) = 'approved'
          AND FromDate <= @MonthEnd
          AND ToDate >= @MonthStart
        GROUP BY EmployeeId
    ),
    ComputedSlips AS (
        SELECT
            e.EmployeeId,
            e.HourlyRate,
            CAST(ROUND(ISNULL(att.WorkHours, 0) + ISNULL(lv.PaidLeaveHours, 0), 2) AS DECIMAL(10, 2)) AS StandardHours,
            CAST(ROUND(ISNULL(ot.OvertimeHours, 0), 2) AS DECIMAL(10, 2)) AS OvertimeHours,
            CAST(ROUND((ISNULL(att.WorkHours, 0) + ISNULL(lv.PaidLeaveHours, 0)) * e.HourlyRate, 0) AS DECIMAL(18, 0)) AS BasePay,
            CAST(ROUND(ISNULL(ot.WeightedOtHours, 0) * e.HourlyRate, 0) AS DECIMAL(18, 0)) AS OvertimePay,
            CAST(
                (CASE WHEN e.ContractType = 'full_time' THEN 1000000.0 ELSE 300000.0 END)
                + (ISNULL(att.DaysWorked, 0) * 25000.0)
                AS DECIMAL(18, 0)
            ) AS Allowance,
            CAST(
                CASE WHEN ISNULL(att.EarlyLateCount, 0) > 2 THEN (att.EarlyLateCount - 2) * 50000.0 ELSE 0.0 END
                AS DECIMAL(18, 0)
            ) AS Deduction,
            CAST(0.0 AS DECIMAL(18, 0)) AS Advance
        FROM dbo.Employees e
        LEFT JOIN AttAgg att ON e.EmployeeId = att.EmployeeId
        LEFT JOIN OtAgg ot ON e.EmployeeId = ot.EmployeeId
        LEFT JOIN LeaveAgg lv ON e.EmployeeId = lv.EmployeeId
        WHERE LOWER(ISNULL(e.Status, 'working')) <> 'resigned'
          AND (@BranchId IS NULL OR e.BranchId = @BranchId)
    )
    INSERT INTO dbo.PayrollSlips (
        PeriodId, EmployeeId, HourlyRate, StandardHours, OvertimeHours,
        BasePay, OvertimePay, Allowance, Deduction, Advance, NetPay, Status, CreatedAt
    )
    SELECT
        @PeriodId,
        EmployeeId,
        HourlyRate,
        StandardHours,
        OvertimeHours,
        BasePay,
        OvertimePay,
        Allowance,
        Deduction,
        Advance,
        CASE
            WHEN (BasePay + OvertimePay + Allowance - Deduction - Advance) < 0 THEN 0
            ELSE (BasePay + OvertimePay + Allowance - Deduction - Advance)
        END AS NetPay,
        'draft',
        SYSDATETIME()
    FROM ComputedSlips;

    -- 6. Cập nhật tổng quỹ lương và số lượng nhân sự vào PayrollPeriods
    UPDATE dbo.PayrollPeriods
    SET TotalEmployees = (SELECT COUNT(*) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId),
        TotalNetPay    = ISNULL((SELECT SUM(NetPay) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId), 0),
        Status         = 'draft'
    WHERE PeriodId = @PeriodId;

    COMMIT TRANSACTION;
END
GO
