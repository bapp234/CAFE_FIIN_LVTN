USE [CoffeeShopDB];
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- 1. CHUẨN HÓA DANH MỤC THIẾT LẬP LƯƠNG, PHỤ CẤP & BẢO HIỂM (dbo.PayrollSettings)
--    - Category : general | allowance | subsidy | deduction | insurance | tax
--    - CalcType : fixed_month | fixed_shift | fixed_count | percent
--    - Impact   : Addition | Deduction | Employer
--    - ApplyScope: all | full_time | part_time
-- =======================================================================================
DELETE FROM dbo.PayrollSettings
WHERE Code IN ('MEAL_ALLOWANCE_DAY', 'LATE_PENALTY_AMOUNT');

;WITH SeedSettings (Code, Name, Category, CalcType, RawValue, Impact, ApplyScope, Note, IsActive) AS (
    SELECT 'STANDARD_WORK_DAYS', N'Số ngày công chuẩn / tháng',              'general',   'fixed_month',     26.00, 'Employer',  N'all',       N'Số ngày công chuẩn dùng quy đổi lương cơ bản tháng và mức lương tham gia BHXH', 1
    UNION ALL
    SELECT 'PC-COM-CA',          N'Phụ cấp cơm ca theo ngày đi làm',         'allowance', 'fixed_shift',  25000.00, 'Addition',  N'all',       N'Đi làm thực tế 1 ngày được cộng theo định mức tiền cơm ca', 1
    UNION ALL
    SELECT 'PC-CHUYEN-CAN',      N'Thưởng chuyên cần đủ công tháng',         'subsidy',   'fixed_month', 300000.00, 'Addition',  N'full_time', N'Cộng cho nhân sự chính thức đi làm >= 80% công chuẩn và đi trễ <= 2 lần/tháng', 1
    UNION ALL
    SELECT 'KT-DI-TRE',          N'Khấu trừ đi trễ / về sớm (từ lần thứ 3)', 'deduction', 'fixed_count',  50000.00, 'Deduction', N'all',       N'Miễn 2 lần đầu/tháng, từ lần thứ 3 trừ theo định mức mỗi lần vi phạm', 1
    UNION ALL
    SELECT 'BHXH-NLD',           N'Bảo hiểm Xã hội (NLĐ đóng)',              'insurance', 'percent',          8.00, 'Deduction', N'full_time', N'Trích 8% trên lương cơ bản hợp đồng (áp dụng hợp đồng chính thức)', 1
    UNION ALL
    SELECT 'BHYT-NLD',           N'Bảo hiểm Y tế (NLĐ đóng)',                'insurance', 'percent',          1.50, 'Deduction', N'full_time', N'Trích 1.5% trên lương cơ bản hợp đồng (áp dụng hợp đồng chính thức)', 1
    UNION ALL
    SELECT 'BHTN-NLD',           N'Bảo hiểm Thất nghiệp (NLĐ đóng)',         'insurance', 'percent',          1.00, 'Deduction', N'full_time', N'Trích 1% trên lương cơ bản hợp đồng (áp dụng hợp đồng chính thức)', 1
)
MERGE dbo.PayrollSettings AS target
USING SeedSettings AS src
ON target.Code = src.Code
WHEN MATCHED THEN
    UPDATE SET
        Name       = src.Name,
        Category   = src.Category,
        CalcType   = src.CalcType,
        RawValue   = src.RawValue,
        Impact     = src.Impact,
        ApplyScope = src.ApplyScope,
        Note       = src.Note,
        IsActive   = src.IsActive,
        UpdatedAt  = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (Code, Name, Category, CalcType, RawValue, Impact, ApplyScope, Note, IsActive)
    VALUES (src.Code, src.Name, src.Category, src.CalcType, src.RawValue, src.Impact, src.ApplyScope, src.Note, src.IsActive);
GO

-- =======================================================================================
-- 2. NÂNG CẤP dbo.sp_HRM_CalculatePayroll:
--    - Tầng 1 (Hợp đồng active): HourlyRate, Allowance, SalaryPercentage, loại hợp đồng
--    - Tầng 2 (dbo.PayrollSettings): Ngày công chuẩn, phụ cấp động, thưởng chuyên cần,
--      khấu trừ đi trễ, tỷ lệ BHXH/BHYT/BHTN (%) cho hợp đồng chính thức
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

    -- 4. Đọc tham số động từ dbo.OvertimeTypes, dbo.LeaveTypes và dbo.PayrollSettings
    DECLARE @RateNormal  DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-DAY'     AND IsActive = 1), 1.50);
    DECLARE @RateWeekend DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-WEEKEND' AND IsActive = 1), 2.00);
    DECLARE @RateHoliday DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-HOLIDAY' AND IsActive = 1), 3.00);
    DECLARE @RateNight   DECIMAL(8, 4) = ISNULL((SELECT TOP 1 (PayMultiplier + NightExtraRate) / 100.0 FROM dbo.OvertimeTypes WHERE OTCode = 'OT-NIGHT'   AND IsActive = 1), 1.80);

    DECLARE @PaidPctAnnual DECIMAL(8, 4) = ISNULL((SELECT TOP 1 CASE WHEN IsPaid = 1 THEN PaidPercent / 100.0 ELSE 0 END FROM dbo.LeaveTypes WHERE LeaveCode = 'LV-PHEP' AND IsActive = 1), 1.00);
    DECLARE @PaidPctSick   DECIMAL(8, 4) = ISNULL((SELECT TOP 1 CASE WHEN IsPaid = 1 THEN PaidPercent / 100.0 ELSE 0 END FROM dbo.LeaveTypes WHERE LeaveCode = 'LV-OM'   AND IsActive = 1), 0.75);

    DECLARE @StandardWorkDays DECIMAL(10, 2) = ISNULL((
        SELECT TOP 1 RawValue FROM dbo.PayrollSettings
        WHERE Code = 'STANDARD_WORK_DAYS' AND IsActive = 1
    ), 26.0);
    IF @StandardWorkDays <= 0 SET @StandardWorkDays = 26.0;

    DECLARE @DailyAllowanceAll DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_shift' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', N'toàn hệ thống')
    ), 0);

    DECLARE @DailyAllowanceFullTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_shift' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) = 'full_time'
    ), 0);

    DECLARE @DailyAllowancePartTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_shift' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) = 'part_time'
    ), 0);

    DECLARE @MonthlyPolicyAllowanceAll DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_month' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', N'toàn hệ thống')
    ), 0);

    DECLARE @MonthlyPolicyAllowanceFullTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_month' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) = 'full_time'
    ), 0);

    DECLARE @MonthlyPolicyAllowancePartTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'allowance' AND CalcType = 'fixed_month' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) = 'part_time'
    ), 0);

    DECLARE @AttendanceBonusFullTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'subsidy' AND CalcType = 'fixed_month' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', 'full_time', N'toàn hệ thống')
    ), 0);

    DECLARE @AttendanceBonusPartTime DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'subsidy' AND CalcType = 'fixed_month' AND Impact = 'Addition' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', 'part_time', N'toàn hệ thống')
    ), 0);

    DECLARE @LatePenaltyPerCount DECIMAL(18, 2) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'deduction' AND CalcType = 'fixed_count' AND Impact = 'Deduction' AND IsActive = 1
    ), 0);

    DECLARE @InsurancePctFullTime DECIMAL(10, 4) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'insurance' AND CalcType = 'percent' AND Impact = 'Deduction' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', 'full_time', N'hợp đồng chính thức', N'toàn hệ thống')
    ), 0);

    DECLARE @InsurancePctPartTime DECIMAL(10, 4) = ISNULL((
        SELECT SUM(RawValue) FROM dbo.PayrollSettings
        WHERE Category = 'insurance' AND CalcType = 'percent' AND Impact = 'Deduction' AND IsActive = 1
          AND LOWER(LTRIM(RTRIM(ApplyScope))) IN ('all', 'part_time', N'toàn hệ thống')
    ), 0);

    -- 5. Tổng hợp dữ liệu công chuẩn + OT + nghỉ phép + hợp đồng đang hiệu lực + phụ cấp + bảo hiểm
    ;WITH ActiveContracts AS (
        SELECT
            ec.EmployeeId,
            ec.HourlyRate,
            ec.Allowance,
            ct.ContractCode,
            ISNULL(ct.SalaryPercentage, 100.0) AS SalaryPercentage,
            ROW_NUMBER() OVER (
                PARTITION BY ec.EmployeeId
                ORDER BY
                    CASE WHEN LOWER(ISNULL(ec.Status, '')) = 'active' THEN 0 ELSE 1 END,
                    ec.StartDate DESC,
                    ec.ContractId DESC
            ) AS rn
        FROM dbo.EmployeeContracts ec
        LEFT JOIN dbo.ContractTypes ct ON ec.ContractTypeId = ct.ContractTypeId
        WHERE LOWER(ISNULL(ec.Status, '')) = 'active'
    ),
    NormalizedAttendance AS (
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
    EmployeeBase AS (
        SELECT
            e.EmployeeId,
            COALESCE(ac.HourlyRate, e.HourlyRate, 0) AS EffectiveHourlyRate,
            CAST(COALESCE(ac.SalaryPercentage, 100.0) / 100.0 AS DECIMAL(10, 4)) AS SalaryFactor,
            COALESCE(ac.Allowance, 0) AS ContractAllowance,
            CASE
                WHEN ac.ContractCode IN ('HD-CO-THOI-HAN', 'HD-VO-THOI-HAN', 'HD-LAO-DONG') THEN 1
                WHEN ac.ContractCode IS NULL AND LOWER(ISNULL(e.ContractType, '')) = 'full_time' THEN 1
                ELSE 0
            END AS IsOfficialFullTime,
            ISNULL(att.WorkHours, 0) AS WorkHours,
            ISNULL(att.DaysWorked, 0) AS DaysWorked,
            ISNULL(att.EarlyLateCount, 0) AS EarlyLateCount,
            ISNULL(ot.OvertimeHours, 0) AS OvertimeHours,
            ISNULL(ot.WeightedOtHours, 0) AS WeightedOtHours,
            ISNULL(lv.PaidLeaveHours, 0) AS PaidLeaveHours
        FROM dbo.Employees e
        LEFT JOIN ActiveContracts ac ON e.EmployeeId = ac.EmployeeId AND ac.rn = 1
        LEFT JOIN AttAgg att ON e.EmployeeId = att.EmployeeId
        LEFT JOIN OtAgg ot ON e.EmployeeId = ot.EmployeeId
        LEFT JOIN LeaveAgg lv ON e.EmployeeId = lv.EmployeeId
        WHERE LOWER(ISNULL(e.Status, 'working')) <> 'resigned'
          AND (@BranchId IS NULL OR e.BranchId = @BranchId)
    ),
    ComputedSlips AS (
        SELECT
            EmployeeId,
            EffectiveHourlyRate AS HourlyRate,
            CAST(ROUND(WorkHours + PaidLeaveHours, 2) AS DECIMAL(10, 2)) AS StandardHours,
            CAST(ROUND(OvertimeHours, 2) AS DECIMAL(10, 2)) AS OvertimeHours,
            CAST(ROUND((WorkHours + PaidLeaveHours) * EffectiveHourlyRate * SalaryFactor, 0) AS DECIMAL(18, 0)) AS BasePay,
            CAST(ROUND(WeightedOtHours * EffectiveHourlyRate * SalaryFactor, 0) AS DECIMAL(18, 0)) AS OvertimePay,
            CAST(ROUND(
                ContractAllowance
                + (DaysWorked * (@DailyAllowanceAll + CASE WHEN IsOfficialFullTime = 1 THEN @DailyAllowanceFullTime ELSE @DailyAllowancePartTime END))
                + (@MonthlyPolicyAllowanceAll + CASE WHEN IsOfficialFullTime = 1 THEN @MonthlyPolicyAllowanceFullTime ELSE @MonthlyPolicyAllowancePartTime END)
                + CASE
                    WHEN DaysWorked >= CEILING(@StandardWorkDays * 0.8) AND EarlyLateCount <= 2
                    THEN CASE WHEN IsOfficialFullTime = 1 THEN @AttendanceBonusFullTime ELSE @AttendanceBonusPartTime END
                    ELSE 0
                  END
            , 0) AS DECIMAL(18, 0)) AS Allowance,
            CAST(ROUND(
                -- Khấu trừ đi trễ / về sớm (từ lần thứ 3)
                (CASE WHEN EarlyLateCount > 2 THEN (EarlyLateCount - 2) * @LatePenaltyPerCount ELSE 0 END)
                -- Khấu trừ BHXH / BHYT / BHTN theo % trên lương cơ bản hợp đồng
                + (
                    (EffectiveHourlyRate * 8.0 * @StandardWorkDays * SalaryFactor)
                    * (CASE WHEN IsOfficialFullTime = 1 THEN @InsurancePctFullTime ELSE @InsurancePctPartTime END)
                    / 100.0
                )
            , 0) AS DECIMAL(18, 0)) AS Deduction,
            CAST(0.0 AS DECIMAL(18, 0)) AS Advance
        FROM EmployeeBase
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

PRINT N'-> Đã chuẩn hóa dbo.PayrollSettings (phụ cấp + BHXH/BHYT/BHTN) và nâng cấp dbo.sp_HRM_CalculatePayroll.';
GO
