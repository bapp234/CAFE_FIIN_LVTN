USE [CoffeeShopDB];
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. BỔ SUNG CỘT Note CHO dbo.EmployeeLeaves (ĐỂ LƯU LÝ DO TỪ CHỐI / TỰ ĐỘNG TỪ CHỐI)
-- ============================================================================
IF COL_LENGTH('dbo.EmployeeLeaves', 'Note') IS NULL
BEGIN
    ALTER TABLE dbo.EmployeeLeaves ADD Note NVARCHAR(500) NULL;
END
GO

-- ============================================================================
-- 2. NÂNG CẤP dbo.sp_HRM_GetSalaryAdvances:
--    Bổ sung 6 cột Hạn mức Tăng ca tháng & Quỹ phép năm + Trạng thái khóa kỳ công
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetSalaryAdvances
    @PeriodMonth VARCHAR(7)    = NULL,
    @BranchId    INT           = NULL,
    @Status      VARCHAR(20)   = NULL,
    @Search      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Period VARCHAR(7)    = NULLIF(LTRIM(RTRIM(@PeriodMonth)), '');
    DECLARE @St     VARCHAR(20)   = NULLIF(LOWER(LTRIM(RTRIM(@Status))), '');
    DECLARE @Kw     NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');
    DECLARE @MonthlyOtLimit DECIMAL(5,2) = 40.00;

    ;WITH OtMonthlyAgg AS (
        SELECT
            ot.EmployeeId,
            CONVERT(VARCHAR(7), ot.WorkDate, 126) AS PeriodMonth,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'approved' THEN ot.Hours ELSE 0 END), 0) AS OtApprovedHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'pending'  THEN ot.Hours ELSE 0 END), 0) AS OtPendingHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'pending') THEN ot.Hours ELSE 0 END), 0) AS OtTotalRegisteredHours
        FROM dbo.EmployeeOvertimes ot
        WHERE (@Period IS NULL OR CONVERT(VARCHAR(7), ot.WorkDate, 126) = @Period)
        GROUP BY ot.EmployeeId, CONVERT(VARCHAR(7), ot.WorkDate, 126)
    ),
    LeaveYearlyAgg AS (
        SELECT
            lv.EmployeeId,
            YEAR(lv.FromDate) AS LeaveYear,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'approved' AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeaveApprovedDays,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'pending'  AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeavePendingDays
        FROM dbo.EmployeeLeaves lv
        LEFT JOIN dbo.LeaveTypes lt ON lv.LeaveCode = lt.LeaveCode
        GROUP BY lv.EmployeeId, YEAR(lv.FromDate)
    )
    SELECT TOP 300
        a.AdvanceId,
        a.AdvanceCode,
        a.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS EmployeeName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        ISNULL(a.BranchId, e.BranchId) AS BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        CONVERT(VARCHAR(10), a.RequestDate, 23) AS RequestDate,
        a.PeriodMonth AS Period,
        a.Amount,
        a.PaymentMethod,
        a.Reason,
        LOWER(ISNULL(a.Status, 'pending')) AS Status,
        a.ApprovedBy,
        a.ApprovedAt,
        a.DecisionNote,
        a.CreatedBy,
        a.CreatedAt,
        -- 6 Cột Hạn mức Tăng ca tháng
        @MonthlyOtLimit AS OtMonthlyLimit,
        CAST(ISNULL(ota.OtApprovedHours, 0) AS DECIMAL(5,2)) AS OtApprovedHours,
        CAST(ISNULL(ota.OtPendingHours, 0) AS DECIMAL(5,2)) AS OtPendingHours,
        CAST(ISNULL(ota.OtTotalRegisteredHours, 0) AS DECIMAL(5,2)) AS OtTotalRegisteredHours,
        CAST(CASE
            WHEN @MonthlyOtLimit - ISNULL(ota.OtApprovedHours, 0) < 0 THEN 0
            ELSE @MonthlyOtLimit - ISNULL(ota.OtApprovedHours, 0)
        END AS DECIMAL(5,2)) AS OtRemainingHours,
        CASE
            WHEN ISNULL(ota.OtApprovedHours, 0) >= @MonthlyOtLimit THEN N'Đã đạt tối đa'
            WHEN ISNULL(ota.OtTotalRegisteredHours, 0) > @MonthlyOtLimit THEN N'Vượt hạn mức (Chờ duyệt)'
            WHEN ISNULL(ota.OtApprovedHours, 0) >= (@MonthlyOtLimit * 0.8) THEN N'Sắp chạm trần (>=80%)'
            ELSE N'Trong hạn mức'
        END AS OtWarningStatus,
        -- Các cột Quỹ phép năm của nhân sự
        CAST(ISNULL(eal.TotalDays, 12.0) AS DECIMAL(5,2)) AS AnnualLeaveTotalDays,
        CAST(ISNULL(eal.UsedDays, ISNULL(lva.LeaveApprovedDays, 0)) AS DECIMAL(5,2)) AS AnnualLeaveApprovedDays,
        CAST(ISNULL(lva.LeavePendingDays, 0) AS DECIMAL(5,2)) AS AnnualLeavePendingDays,
        CAST(CASE
            WHEN ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0)) < 0 THEN 0
            ELSE ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0))
        END AS DECIMAL(5,2)) AS AnnualLeaveRemainingDays,
        CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.AttendancePeriods ap
            WHERE ap.PeriodMonth = a.PeriodMonth
              AND ap.BranchId = ISNULL(a.BranchId, e.BranchId)
              AND ap.IsLocked = 1
        ) THEN 1 ELSE 0 END AS BIT) AS IsAttendanceLocked
    FROM dbo.SalaryAdvances a
    INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON ISNULL(a.BranchId, e.BranchId) = b.BranchId
    LEFT JOIN OtMonthlyAgg ota ON a.EmployeeId = ota.EmployeeId AND a.PeriodMonth = ota.PeriodMonth
    LEFT JOIN dbo.EmployeeAnnualLeaves eal ON a.EmployeeId = eal.EmployeeId AND eal.[Year] = TRY_CAST(LEFT(a.PeriodMonth, 4) AS INT)
    LEFT JOIN LeaveYearlyAgg lva ON a.EmployeeId = lva.EmployeeId AND lva.LeaveYear = TRY_CAST(LEFT(a.PeriodMonth, 4) AS INT)
    WHERE (@Period IS NULL OR a.PeriodMonth = @Period)
      AND (@BranchId IS NULL OR ISNULL(a.BranchId, e.BranchId) = @BranchId)
      AND (@St IS NULL OR @St = 'all' OR LOWER(ISNULL(a.Status, 'pending')) = @St)
      AND (
            @Kw IS NULL
            OR a.AdvanceCode LIKE '%' + @Kw + '%'
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR a.Reason LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        CASE LOWER(ISNULL(a.Status, 'pending'))
            WHEN 'pending' THEN 0
            WHEN 'approved' THEN 1
            WHEN 'deducted' THEN 2
            ELSE 3
        END,
        a.CreatedAt DESC,
        a.AdvanceId DESC;
END
GO

-- ============================================================================
-- 3. NÂNG CẤP dbo.sp_HRM_CreateSalaryAdvance & dbo.sp_HRM_ProcessSalaryAdvance:
--    Chặn tạo/duyệt phiếu tạm ứng nếu Bảng công hoặc Bảng lương kỳ đó đã khóa
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateSalaryAdvance
    @EmployeeId    INT,
    @PeriodMonth   VARCHAR(7),
    @RequestDate   DATE,
    @Amount        DECIMAL(18, 0),
    @PaymentMethod NVARCHAR(100) = N'Chuyển khoản',
    @Reason        NVARCHAR(500),
    @CreatedBy     NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Period VARCHAR(7) = LTRIM(RTRIM(ISNULL(@PeriodMonth, '')));
    DECLARE @Method NVARCHAR(100) = ISNULL(NULLIF(LTRIM(RTRIM(@PaymentMethod)), N''), N'Chuyển khoản');
    DECLARE @CleanReason NVARCHAR(500) = LTRIM(RTRIM(ISNULL(@Reason, N'')));

    IF @Period NOT LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]'
    BEGIN
        RAISERROR(N'Kỳ khấu trừ không hợp lệ (định dạng YYYY-MM).', 16, 1);
        RETURN;
    END

    IF @Amount IS NULL OR @Amount < 100000
    BEGIN
        RAISERROR(N'Số tiền tạm ứng tối thiểu là 100.000đ.', 16, 1);
        RETURN;
    END

    IF LEN(@CleanReason) < 3
    BEGIN
        RAISERROR(N'Vui lòng nhập lý do tạm ứng lương (tối thiểu 3 ký tự).', 16, 1);
        RETURN;
    END

    DECLARE @BranchId INT;
    SELECT @BranchId = BranchId
    FROM dbo.Employees
    WHERE EmployeeId = @EmployeeId;

    IF @@ROWCOUNT = 0
    BEGIN
        RAISERROR(N'Không tìm thấy nhân viên được chọn.', 16, 1);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @Period AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể lập phiếu tạm ứng mới.', 16, 1, @Period);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.PayrollPeriods WHERE PeriodMonth = @Period AND (BranchId = @BranchId OR BranchId IS NULL) AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng lương kỳ %s đã khóa, không thể lập phiếu tạm ứng mới.', 16, 1, @Period);
        RETURN;
    END

    BEGIN TRAN;
    BEGIN TRY
        DECLARE @Prefix VARCHAR(20) = 'TU-' + REPLACE(@Period, '-', '') + '-';
        DECLARE @NextSeq INT;

        SELECT @NextSeq = ISNULL(MAX(TRY_CAST(RIGHT(AdvanceCode, 3) AS INT)), 0) + 1
        FROM dbo.SalaryAdvances WITH (UPDLOCK, HOLDLOCK)
        WHERE AdvanceCode LIKE @Prefix + '%';

        DECLARE @AdvanceCode VARCHAR(30) = @Prefix + RIGHT('000' + CAST(@NextSeq AS VARCHAR(10)), 3);

        INSERT INTO dbo.SalaryAdvances (
            AdvanceCode, EmployeeId, BranchId, PeriodMonth, RequestDate,
            Amount, PaymentMethod, Reason, Status, CreatedBy, CreatedAt, UpdatedAt
        )
        VALUES (
            @AdvanceCode, @EmployeeId, @BranchId, @Period, @RequestDate,
            @Amount, @Method, @CleanReason, 'pending',
            NULLIF(LTRIM(RTRIM(@CreatedBy)), N''), SYSDATETIME(), SYSDATETIME()
        );

        DECLARE @NewId INT = CAST(SCOPE_IDENTITY() AS INT);

        COMMIT TRAN;

        SELECT @NewId AS AdvanceId, @AdvanceCode AS AdvanceCode;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRAN;
        THROW;
    END CATCH
END
GO

-- ============================================================================
-- 4. STORED PROCEDURE MỚI: dbo.sp_HRM_GetEmployeeMonthlyQuotas
--    Trả về bảng đối soát hạn mức Tăng ca tháng & Quỹ phép năm của từng nhân viên
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeMonthlyQuotas
    @PeriodMonth VARCHAR(7),
    @BranchId    INT = NULL,
    @EmployeeId  INT = NULL,
    @Search      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Period VARCHAR(7) = ISNULL(NULLIF(LTRIM(RTRIM(@PeriodMonth)), ''), '2026-11');
    DECLARE @Year INT = ISNULL(TRY_CAST(LEFT(@Period, 4) AS INT), 2026);
    DECLARE @Kw NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');
    DECLARE @MonthlyOtLimit DECIMAL(5,2) = 40.00;

    ;WITH OtMonthlyAgg AS (
        SELECT
            ot.EmployeeId,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'approved' THEN ot.Hours ELSE 0 END), 0) AS OtApprovedHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'pending'  THEN ot.Hours ELSE 0 END), 0) AS OtPendingHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'pending') THEN ot.Hours ELSE 0 END), 0) AS OtTotalRegisteredHours
        FROM dbo.EmployeeOvertimes ot
        WHERE CONVERT(VARCHAR(7), ot.WorkDate, 126) = @Period
        GROUP BY ot.EmployeeId
    ),
    LeaveYearlyAgg AS (
        SELECT
            lv.EmployeeId,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'approved' AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeaveApprovedDays,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'pending'  AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeavePendingDays
        FROM dbo.EmployeeLeaves lv
        LEFT JOIN dbo.LeaveTypes lt ON lv.LeaveCode = lt.LeaveCode
        WHERE YEAR(lv.FromDate) = @Year
        GROUP BY lv.EmployeeId
    )
    SELECT
        e.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        e.BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        @Period AS PeriodMonth,
        -- 6 Cột Hạn mức Tăng ca tháng
        @MonthlyOtLimit AS OtMonthlyLimit,
        CAST(ISNULL(ota.OtApprovedHours, 0) AS DECIMAL(5,2)) AS OtApprovedHours,
        CAST(ISNULL(ota.OtPendingHours, 0) AS DECIMAL(5,2)) AS OtPendingHours,
        CAST(ISNULL(ota.OtTotalRegisteredHours, 0) AS DECIMAL(5,2)) AS OtTotalRegisteredHours,
        CAST(CASE
            WHEN @MonthlyOtLimit - ISNULL(ota.OtApprovedHours, 0) < 0 THEN 0
            ELSE @MonthlyOtLimit - ISNULL(ota.OtApprovedHours, 0)
        END AS DECIMAL(5,2)) AS OtRemainingHours,
        CASE
            WHEN ISNULL(ota.OtApprovedHours, 0) >= @MonthlyOtLimit THEN N'Đã đạt tối đa'
            WHEN ISNULL(ota.OtTotalRegisteredHours, 0) > @MonthlyOtLimit THEN N'Vượt hạn mức (Chờ duyệt)'
            WHEN ISNULL(ota.OtApprovedHours, 0) >= (@MonthlyOtLimit * 0.8) THEN N'Sắp chạm trần (>=80%)'
            ELSE N'Trong hạn mức'
        END AS OtWarningStatus,
        -- Các cột Quỹ phép năm
        CAST(ISNULL(eal.TotalDays, 12.0) AS DECIMAL(5,2)) AS AnnualLeaveTotalDays,
        CAST(ISNULL(eal.UsedDays, ISNULL(lva.LeaveApprovedDays, 0)) AS DECIMAL(5,2)) AS AnnualLeaveApprovedDays,
        CAST(ISNULL(lva.LeavePendingDays, 0) AS DECIMAL(5,2)) AS AnnualLeavePendingDays,
        CAST(ISNULL(eal.UsedDays, ISNULL(lva.LeaveApprovedDays, 0)) + ISNULL(lva.LeavePendingDays, 0) AS DECIMAL(5,2)) AS AnnualLeaveTotalRegisteredDays,
        CAST(CASE
            WHEN ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0)) < 0 THEN 0
            ELSE ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0))
        END AS DECIMAL(5,2)) AS AnnualLeaveRemainingDays,
        CASE
            WHEN ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0)) <= 0 THEN N'Hết phép năm'
            WHEN (ISNULL(eal.UsedDays, ISNULL(lva.LeaveApprovedDays, 0)) + ISNULL(lva.LeavePendingDays, 0)) > ISNULL(eal.TotalDays, 12.0) THEN N'Vượt quỹ phép (Chờ duyệt)'
            WHEN ISNULL(eal.RemainingDays, 12.0 - ISNULL(lva.LeaveApprovedDays, 0)) <= 2.0 THEN N'Sắp hết phép'
            ELSE N'Còn phép năm'
        END AS AnnualLeaveWarningStatus,
        CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.AttendancePeriods ap
            WHERE ap.PeriodMonth = @Period
              AND ap.BranchId = e.BranchId
              AND ap.IsLocked = 1
        ) THEN 1 ELSE 0 END AS BIT) AS IsAttendanceLocked
    FROM dbo.Employees e
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN OtMonthlyAgg ota ON e.EmployeeId = ota.EmployeeId
    LEFT JOIN dbo.EmployeeAnnualLeaves eal ON e.EmployeeId = eal.EmployeeId AND eal.[Year] = @Year
    LEFT JOIN LeaveYearlyAgg lva ON e.EmployeeId = lva.EmployeeId
    WHERE LOWER(ISNULL(e.Status, 'active')) IN ('active', 'working')
      AND (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (@EmployeeId IS NULL OR e.EmployeeId = @EmployeeId)
      AND (
            @Kw IS NULL
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR ISNULL(e.Position, N'') LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        ISNULL(ota.OtTotalRegisteredHours, 0) DESC,
        e.EmployeeCode ASC;
END
GO

-- ============================================================================
-- 5. NÂNG CẤP dbo.sp_HRM_CreateOvertimeRequest & dbo.sp_HRM_ProcessOvertimeRequest
--    - Chặn làm đơn khi bảng công khóa
--    - Chặn trùng khung giờ (Overlap Detection)
--    - Chặn tạo đơn nếu Số giờ đơn > Hạn mức còn lại thực tế (chỉ tính trên giờ ĐÃ DUYỆT)
--    - Khi duyệt 1 đơn: kiểm tra lại hạn mức còn lại; nếu đủ thì duyệt & TỰ ĐỘNG TỪ CHỐI
--      (Auto-Reject Cascading) các đơn pending khác trong tháng bị vượt số giờ còn lại mới!
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateOvertimeRequest
    @EmployeeId INT,
    @WorkDate   DATE,
    @StartTime  TIME,
    @EndTime    TIME,
    @OTCode     VARCHAR(30),
    @Reason     NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    DECLARE @BranchId INT = (SELECT BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId);

    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể tạo đơn tăng ca mới.', 16, 1, @PeriodMonth);
        RETURN;
    END

    IF @EndTime <= @StartTime
    BEGIN
        RAISERROR(N'Giờ kết thúc tăng ca phải lớn hơn giờ bắt đầu.', 16, 1);
        RETURN;
    END

    -- Kiểm tra trùng khung giờ tăng ca trong cùng ngày (pending hoặc approved)
    IF EXISTS (
        SELECT 1
        FROM dbo.EmployeeOvertimes
        WHERE EmployeeId = @EmployeeId
          AND WorkDate = @WorkDate
          AND LOWER(ISNULL(ApprovalStatus, 'pending')) IN ('pending', 'approved')
          AND @StartTime < EndTime
          AND @EndTime > StartTime
    )
    BEGIN
        RAISERROR(N'Nhân sự đã có đơn tăng ca khác trùng khung giờ trong ngày này.', 16, 1);
        RETURN;
    END

    DECLARE @Hours DECIMAL(5, 2) = ROUND(DATEDIFF(MINUTE, @StartTime, @EndTime) / 60.0, 2);
    DECLARE @OTCategory VARCHAR(20) = 'normal';
    DECLARE @Multiplier DECIMAL(5, 2) = 1.50;
    DECLARE @MaxDay DECIMAL(5, 2) = 4.00;
    DECLARE @MaxMonth DECIMAL(5, 2) = 40.00;

    SELECT TOP 1
        @OTCategory = OTCategory,
        @Multiplier = ROUND((PayMultiplier + NightExtraRate) / 100.0, 2),
        @MaxDay     = MaxHoursPerDay,
        @MaxMonth   = ISNULL(MaxHoursPerMonth, 40.00)
    FROM dbo.OvertimeTypes
    WHERE OTCode = @OTCode AND IsActive = 1;

    IF @Hours > @MaxDay
    BEGIN
        DECLARE @HoursStr VARCHAR(20) = CAST(@Hours AS VARCHAR(20));
        DECLARE @MaxDayStr VARCHAR(20) = CAST(@MaxDay AS VARCHAR(20));
        RAISERROR(N'Số giờ đăng ký (%sh) vượt quá giới hạn tối đa/ngày (%sh) của mã %s.', 16, 1, @HoursStr, @MaxDayStr, @OTCode);
        RETURN;
    END

    -- Kiểm tra tổng số giờ ĐÃ DUYỆT trong ngày không vượt trần ngày
    DECLARE @ApprovedToday DECIMAL(5, 2) = ISNULL((
        SELECT SUM(Hours)
        FROM dbo.EmployeeOvertimes
        WHERE EmployeeId = @EmployeeId
          AND WorkDate = @WorkDate
          AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'approved'
    ), 0);

    IF (@ApprovedToday + @Hours) > @MaxDay
    BEGIN
        DECLARE @RemDayStr VARCHAR(20) = CAST(CASE WHEN @MaxDay - @ApprovedToday < 0 THEN 0 ELSE @MaxDay - @ApprovedToday END AS VARCHAR(20));
        RAISERROR(N'Số giờ tăng ca trong ngày vượt quá hạn mức ngày còn lại (%sh).', 16, 1, @RemDayStr);
        RETURN;
    END

    -- Kiểm tra hạn mức tháng còn lại (Chỉ trừ những đơn ĐÃ DUYỆT; đơn pending chưa trừ hạn mức)
    DECLARE @ApprovedMonth DECIMAL(5, 2) = ISNULL((
        SELECT SUM(Hours)
        FROM dbo.EmployeeOvertimes
        WHERE EmployeeId = @EmployeeId
          AND CONVERT(VARCHAR(7), WorkDate, 126) = @PeriodMonth
          AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'approved'
    ), 0);

    DECLARE @RemainingMonth DECIMAL(5, 2) = CASE WHEN @MaxMonth - @ApprovedMonth < 0 THEN 0 ELSE @MaxMonth - @ApprovedMonth END;

    IF @RemainingMonth <= 0
    BEGIN
        DECLARE @MaxMonthStr0 VARCHAR(20) = CAST(@MaxMonth AS VARCHAR(20));
        RAISERROR(N'Nhân sự đã đạt tối đa hạn mức tăng ca trong tháng (%sh). Không thể tạo thêm đơn.', 16, 1, @MaxMonthStr0);
        RETURN;
    END

    IF @Hours > @RemainingMonth
    BEGIN
        DECLARE @ReqStr VARCHAR(20) = CAST(@Hours AS VARCHAR(20));
        DECLARE @RemStr VARCHAR(20) = CAST(@RemainingMonth AS VARCHAR(20));
        RAISERROR(N'Số giờ đăng ký (%sh) vượt quá hạn mức tăng ca còn lại trong tháng (%sh).', 16, 1, @ReqStr, @RemStr);
        RETURN;
    END

    INSERT INTO dbo.EmployeeOvertimes (
        EmployeeId, BranchId, WorkDate, StartTime, EndTime,
        Hours, OTType, OTCode, PayMultiplier, Reason, ApprovalStatus, CreatedAt
    )
    VALUES (
        @EmployeeId, @BranchId, @WorkDate, @StartTime, @EndTime,
        @Hours, @OTCategory, @OTCode, @Multiplier, @Reason, 'pending', SYSDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS OvertimeId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessOvertimeRequest
    @OvertimeId   INT,
    @Action       VARCHAR(20), -- approved | rejected
    @ApproverName NVARCHAR(100) = N'Quản lý',
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EmpId INT, @WorkDate DATE, @BranchId INT, @ReqHours DECIMAL(5,2), @OTCode VARCHAR(30), @CurrentSt VARCHAR(20);
    SELECT
        @EmpId     = EmployeeId,
        @WorkDate  = WorkDate,
        @BranchId  = BranchId,
        @ReqHours  = Hours,
        @OTCode    = ISNULL(OTCode, 'OT-DAY'),
        @CurrentSt = LOWER(ISNULL(ApprovalStatus, 'pending'))
    FROM dbo.EmployeeOvertimes
    WHERE OvertimeId = @OvertimeId;

    IF @WorkDate IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đơn tăng ca.', 16, 1);
        RETURN;
    END

    IF @CurrentSt <> 'pending'
    BEGIN
        RAISERROR(N'Đơn tăng ca này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể duyệt/từ chối đơn.', 16, 1, @PeriodMonth);
        RETURN;
    END

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));

    IF @Act = 'approved'
    BEGIN
        DECLARE @MaxMonth DECIMAL(5,2) = ISNULL((
            SELECT TOP 1 MaxHoursPerMonth FROM dbo.OvertimeTypes WHERE OTCode = @OTCode AND IsActive = 1
        ), 40.00);

        DECLARE @ApprovedMonth DECIMAL(5,2) = ISNULL((
            SELECT SUM(Hours)
            FROM dbo.EmployeeOvertimes WITH (UPDLOCK, HOLDLOCK)
            WHERE EmployeeId = @EmpId
              AND CONVERT(VARCHAR(7), WorkDate, 126) = @PeriodMonth
              AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'approved'
        ), 0);

        DECLARE @RemainingBefore DECIMAL(5,2) = CASE WHEN @MaxMonth - @ApprovedMonth < 0 THEN 0 ELSE @MaxMonth - @ApprovedMonth END;

        -- Nếu đơn này vượt quá số giờ còn lại -> Tự động chuyển đơn này sang Từ chối (rejected) và báo lỗi rõ ràng
        IF @ReqHours > @RemainingBefore
        BEGIN
            DECLARE @ReqStr VARCHAR(20) = CAST(@ReqHours AS VARCHAR(20));
            DECLARE @RemStr VARCHAR(20) = CAST(@RemainingBefore AS VARCHAR(20));
            DECLARE @AutoRejectNote NVARCHAR(500) = N'Tự động từ chối: Số giờ đơn (' + @ReqStr + N'h) vượt quá hạn mức tăng ca tháng còn lại (' + @RemStr + N'h).';

            UPDATE dbo.EmployeeOvertimes
            SET ApprovalStatus = 'rejected',
                ApprovedAt     = SYSDATETIME(),
                Note           = @AutoRejectNote
            WHERE OvertimeId = @OvertimeId;

            RAISERROR(N'Không đủ hạn mức tăng ca còn lại (%sh) để duyệt đơn (%sh). Hệ thống đã tự động chuyển đơn sang trạng thái Từ chối.', 16, 1, @RemStr, @ReqStr);
            RETURN;
        END

        BEGIN TRAN;

        -- 1. Duyệt đơn hiện tại
        UPDATE dbo.EmployeeOvertimes
        SET ApprovalStatus = 'approved',
            ApprovedAt     = SYSDATETIME(),
            Note           = COALESCE(@Note, Note)
        WHERE OvertimeId = @OvertimeId;

        -- 2. Tính số giờ hạn mức tháng còn lại SAU khi duyệt đơn này
        DECLARE @RemainingAfter DECIMAL(5,2) = CASE
            WHEN @MaxMonth - (@ApprovedMonth + @ReqHours) < 0 THEN 0
            ELSE @MaxMonth - (@ApprovedMonth + @ReqHours)
        END;
        DECLARE @RemAfterStr VARCHAR(20) = CAST(@RemainingAfter AS VARCHAR(20));

        -- 3. Tự động từ chối (Cascading Auto-Reject) các đơn pending khác trong cùng tháng của nhân viên đó mà có Hours > @RemainingAfter
        UPDATE dbo.EmployeeOvertimes
        SET ApprovalStatus = 'rejected',
            ApprovedAt     = SYSDATETIME(),
            Note           = N'Tự động từ chối do không đủ hạn mức tăng ca tháng còn lại (' + @RemAfterStr + N'h) sau khi duyệt đơn #' + CAST(@OvertimeId AS NVARCHAR(20)) + N'.'
        WHERE EmployeeId = @EmpId
          AND OvertimeId <> @OvertimeId
          AND CONVERT(VARCHAR(7), WorkDate, 126) = @PeriodMonth
          AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'pending'
          AND Hours > @RemainingAfter;

        COMMIT TRAN;
        SELECT 1 AS AffectedRows;
        RETURN;
    END

    -- Trường hợp Từ chối thủ công
    UPDATE dbo.EmployeeOvertimes
    SET ApprovalStatus = 'rejected',
        ApprovedAt     = SYSDATETIME(),
        Note           = COALESCE(@Note, Note, N'Quản lý từ chối đơn tăng ca.')
    WHERE OvertimeId = @OvertimeId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 6. NÂNG CẤP dbo.sp_HRM_GetLeaveRequests, sp_HRM_CreateLeaveRequest & sp_HRM_ProcessLeaveRequest
--    - Phân biệt rõ mã phép có DeductAnnualLeave = 1 (LV-PHEP) và không trừ phép năm
--    - Chặn trùng ngày nghỉ phép
--    - Chặn tạo đơn nếu Số ngày xin nghỉ > Số ngày phép năm còn lại (RemainingDays)
--    - Khi chưa duyệt (pending) thì chưa trừ vào quỹ phép; khi duyệt đơn này thì
--      tự động từ chối các đơn pending còn lại nếu vượt số ngày phép còn lại mới!
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetLeaveRequests
    @PeriodMonth VARCHAR(7)    = NULL,
    @BranchId    INT           = NULL,
    @Status      VARCHAR(20)   = NULL,
    @Search      NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @MonthStart DATE = CASE WHEN @PeriodMonth LIKE '[0-9][0-9][0-9][0-9]-[0-9][0-9]' THEN CAST(@PeriodMonth + '-01' AS DATE) ELSE NULL END;
    DECLARE @MonthEnd   DATE = CASE WHEN @MonthStart IS NOT NULL THEN EOMONTH(@MonthStart) ELSE NULL END;
    DECLARE @St         VARCHAR(20)   = NULLIF(LOWER(LTRIM(RTRIM(@Status))), '');
    DECLARE @Kw         NVARCHAR(100) = NULLIF(LTRIM(RTRIM(@Search)), N'');

    SELECT TOP 200
        lv.LeaveId,
        lv.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        ISNULL(lv.BranchId, e.BranchId) AS BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        lv.FromDate,
        lv.ToDate,
        lv.LeaveDays,
        ISNULL(lv.LeaveCode, 'LV-PHEP') AS LeaveCode,
        ISNULL(lt.LeaveName, N'Nghỉ phép') AS LeaveName,
        lv.LeaveType,
        lv.IsPaid,
        ISNULL(lt.PaidPercent, CASE WHEN lv.IsPaid = 1 THEN 100.00 ELSE 0.00 END) AS PaidPercent,
        ISNULL(lv.Reason, N'') AS Reason,
        ISNULL(lv.ApprovalStatus, 'pending') AS ApprovalStatus,
        lv.ApprovedAt,
        lv.Note,
        lv.CreatedAt
    FROM dbo.EmployeeLeaves lv
    INNER JOIN dbo.Employees e ON lv.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON ISNULL(lv.BranchId, e.BranchId) = b.BranchId
    LEFT JOIN dbo.LeaveTypes lt ON lv.LeaveCode = lt.LeaveCode
    WHERE (@MonthStart IS NULL OR (lv.FromDate <= @MonthEnd AND lv.ToDate >= @MonthStart))
      AND (@BranchId IS NULL OR ISNULL(lv.BranchId, e.BranchId) = @BranchId)
      AND (@St IS NULL OR @St = 'all' OR LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = @St)
      AND (
            @Kw IS NULL
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR ISNULL(lv.LeaveCode, '') LIKE '%' + @Kw + '%'
            OR ISNULL(lv.Reason, N'') LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'pending' THEN 0 ELSE 1 END,
        lv.FromDate DESC,
        lv.LeaveId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateLeaveRequest
    @EmployeeId INT,
    @FromDate   DATE,
    @ToDate     DATE,
    @LeaveCode  VARCHAR(30),
    @Reason     NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    IF @ToDate < @FromDate
    BEGIN
        RAISERROR(N'Ngày kết thúc nghỉ phải lớn hơn hoặc bằng ngày bắt đầu.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @FromDate, 126);
    DECLARE @BranchId INT = (SELECT BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId);

    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể tạo đơn nghỉ phép.', 16, 1, @PeriodMonth);
        RETURN;
    END

    -- Kiểm tra trùng ngày nghỉ phép (pending hoặc approved)
    IF EXISTS (
        SELECT 1
        FROM dbo.EmployeeLeaves
        WHERE EmployeeId = @EmployeeId
          AND LOWER(ISNULL(ApprovalStatus, 'pending')) IN ('pending', 'approved')
          AND @FromDate <= ToDate
          AND @ToDate >= FromDate
    )
    BEGIN
        RAISERROR(N'Nhân sự đã có đơn xin nghỉ phép khác trùng khoảng ngày này.', 16, 1);
        RETURN;
    END

    DECLARE @IsPaid BIT = 1;
    DECLARE @DeductAnnual BIT = 1;
    DECLARE @AllowNegative BIT = 0;

    SELECT TOP 1
        @IsPaid        = IsPaid,
        @DeductAnnual  = DeductAnnualLeave,
        @AllowNegative = AllowNegativeBalance
    FROM dbo.LeaveTypes
    WHERE LeaveCode = @LeaveCode AND IsActive = 1;

    DECLARE @LeaveType VARCHAR(20) = CASE
        WHEN @LeaveCode = 'LV-OM' THEN 'sick'
        WHEN @DeductAnnual = 1 THEN 'annual'
        WHEN @IsPaid = 0 THEN 'unpaid'
        ELSE 'special_paid'
    END;

    DECLARE @LeaveDays DECIMAL(5, 2) = CAST(DATEDIFF(DAY, @FromDate, @ToDate) + 1 AS DECIMAL(5, 2));

    -- Nếu là loại phép trừ vào quỹ phép năm (DeductAnnualLeave = 1), kiểm tra quỹ phép năm còn lại (chỉ tính những đơn đã duyệt)
    IF @DeductAnnual = 1 AND @AllowNegative = 0
    BEGIN
        DECLARE @Year INT = YEAR(@FromDate);
        DECLARE @TotalDays DECIMAL(5,2) = 12.00;
        DECLARE @UsedDays DECIMAL(5,2) = 0.00;

        SELECT TOP 1
            @TotalDays = TotalDays,
            @UsedDays  = UsedDays
        FROM dbo.EmployeeAnnualLeaves
        WHERE EmployeeId = @EmployeeId AND [Year] = @Year;

        IF @@ROWCOUNT = 0
        BEGIN
            SELECT @UsedDays = ISNULL(SUM(LeaveDays), 0)
            FROM dbo.EmployeeLeaves
            WHERE EmployeeId = @EmployeeId
              AND YEAR(FromDate) = @Year
              AND LeaveType = 'annual'
              AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'approved';
        END

        DECLARE @RemainingDays DECIMAL(5,2) = CASE WHEN @TotalDays - @UsedDays < 0 THEN 0 ELSE @TotalDays - @UsedDays END;

        IF @RemainingDays <= 0
        BEGIN
            RAISERROR(N'Nhân sự đã hết quỹ phép năm (%d). Vui lòng chọn mã Nghỉ không lương (LV-KHONG-LUONG).', 16, 1, @Year);
            RETURN;
        END

        IF @LeaveDays > @RemainingDays
        BEGIN
            DECLARE @ReqDaysStr VARCHAR(20) = CAST(@LeaveDays AS VARCHAR(20));
            DECLARE @RemDaysStr VARCHAR(20) = CAST(@RemainingDays AS VARCHAR(20));
            RAISERROR(N'Số ngày xin nghỉ (%s ngày) vượt quá quỹ phép năm còn lại (%s ngày).', 16, 1, @ReqDaysStr, @RemDaysStr);
            RETURN;
        END
    END

    INSERT INTO dbo.EmployeeLeaves (
        EmployeeId, BranchId, FromDate, ToDate, LeaveDays,
        LeaveType, LeaveCode, IsPaid, Reason, ApprovalStatus, CreatedAt
    )
    VALUES (
        @EmployeeId, @BranchId, @FromDate, @ToDate, @LeaveDays,
        @LeaveType, @LeaveCode, @IsPaid, @Reason, 'pending', SYSDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS LeaveId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessLeaveRequest
    @LeaveId      INT,
    @Action       VARCHAR(20), -- approved | rejected
    @ApproverName NVARCHAR(100) = N'Quản lý',
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EmpId INT, @FromDate DATE, @BranchId INT, @LeaveDays DECIMAL(5,2), @LeaveCode VARCHAR(30), @LeaveType VARCHAR(30), @CurrentSt VARCHAR(20);
    SELECT
        @EmpId     = EmployeeId,
        @FromDate  = FromDate,
        @BranchId  = BranchId,
        @LeaveDays = LeaveDays,
        @LeaveCode = ISNULL(LeaveCode, 'LV-PHEP'),
        @LeaveType = ISNULL(LeaveType, 'annual'),
        @CurrentSt = LOWER(ISNULL(ApprovalStatus, 'pending'))
    FROM dbo.EmployeeLeaves
    WHERE LeaveId = @LeaveId;

    IF @FromDate IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đơn nghỉ phép.', 16, 1);
        RETURN;
    END

    IF @CurrentSt <> 'pending'
    BEGIN
        RAISERROR(N'Đơn nghỉ phép này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @FromDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể duyệt/từ chối đơn nghỉ phép.', 16, 1, @PeriodMonth);
        RETURN;
    END

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));

    IF @Act = 'approved'
    BEGIN
        DECLARE @DeductAnnual BIT = CASE WHEN @LeaveType = 'annual' THEN 1 ELSE 0 END;
        DECLARE @AllowNegative BIT = 0;

        SELECT TOP 1
            @DeductAnnual  = DeductAnnualLeave,
            @AllowNegative = AllowNegativeBalance
        FROM dbo.LeaveTypes
        WHERE LeaveCode = @LeaveCode AND IsActive = 1;

        IF @DeductAnnual = 1 AND @AllowNegative = 0
        BEGIN
            DECLARE @Year INT = YEAR(@FromDate);
            DECLARE @TotalDays DECIMAL(5,2) = 12.00;
            DECLARE @UsedDays DECIMAL(5,2) = 0.00;

            SELECT TOP 1
                @TotalDays = TotalDays,
                @UsedDays  = UsedDays
            FROM dbo.EmployeeAnnualLeaves WITH (UPDLOCK, HOLDLOCK)
            WHERE EmployeeId = @EmpId AND [Year] = @Year;

            IF @@ROWCOUNT = 0
            BEGIN
                SELECT @UsedDays = ISNULL(SUM(LeaveDays), 0)
                FROM dbo.EmployeeLeaves WITH (UPDLOCK, HOLDLOCK)
                WHERE EmployeeId = @EmpId
                  AND YEAR(FromDate) = @Year
                  AND LeaveType = 'annual'
                  AND LOWER(ISNULL(ApprovalStatus, 'pending')) = 'approved';
            END

            DECLARE @RemainingBefore DECIMAL(5,2) = CASE WHEN @TotalDays - @UsedDays < 0 THEN 0 ELSE @TotalDays - @UsedDays END;

            IF @LeaveDays > @RemainingBefore
            BEGIN
                DECLARE @ReqStr VARCHAR(20) = CAST(@LeaveDays AS VARCHAR(20));
                DECLARE @RemStr VARCHAR(20) = CAST(@RemainingBefore AS VARCHAR(20));
                DECLARE @AutoRejectNote NVARCHAR(500) = N'Tự động từ chối: Số ngày đơn (' + @ReqStr + N' ngày) vượt quá quỹ phép năm còn lại (' + @RemStr + N' ngày).';

                UPDATE dbo.EmployeeLeaves
                SET ApprovalStatus = 'rejected',
                    ApprovedAt     = SYSDATETIME(),
                    Note           = @AutoRejectNote
                WHERE LeaveId = @LeaveId;

                RAISERROR(N'Không đủ ngày phép năm còn lại (%s ngày) để duyệt đơn (%s ngày). Hệ thống đã tự động chuyển đơn sang trạng thái Từ chối.', 16, 1, @RemStr, @ReqStr);
                RETURN;
            END

            BEGIN TRAN;

            -- 1. Duyệt đơn nghỉ phép hiện tại (Trigger trg_EmployeeLeaves_SyncAnnualLeave sẽ tự đồng bộ UsedDays)
            UPDATE dbo.EmployeeLeaves
            SET ApprovalStatus = 'approved',
                ApprovedAt     = SYSDATETIME(),
                Note           = COALESCE(@Note, Note)
            WHERE LeaveId = @LeaveId;

            -- 2. Tính quỹ phép năm còn lại SAU khi duyệt đơn này
            DECLARE @RemainingAfter DECIMAL(5,2) = CASE
                WHEN @TotalDays - (@UsedDays + @LeaveDays) < 0 THEN 0
                ELSE @TotalDays - (@UsedDays + @LeaveDays)
            END;
            DECLARE @RemAfterStr VARCHAR(20) = CAST(@RemainingAfter AS VARCHAR(20));

            -- 3. Tự động từ chối (Cascading Auto-Reject) các đơn phép năm pending khác trong cùng năm của nhân viên đó mà có LeaveDays > @RemainingAfter
            UPDATE lv
            SET lv.ApprovalStatus = 'rejected',
                lv.ApprovedAt     = SYSDATETIME(),
                lv.Note           = N'Tự động từ chối do không đủ ngày phép năm còn lại (' + @RemAfterStr + N' ngày) sau khi duyệt đơn #' + CAST(@LeaveId AS NVARCHAR(20)) + N'.'
            FROM dbo.EmployeeLeaves lv
            LEFT JOIN dbo.LeaveTypes lt ON lv.LeaveCode = lt.LeaveCode
            WHERE lv.EmployeeId = @EmpId
              AND lv.LeaveId <> @LeaveId
              AND YEAR(lv.FromDate) = @Year
              AND LOWER(ISNULL(lv.ApprovalStatus, 'pending')) = 'pending'
              AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1
              AND lv.LeaveDays > @RemainingAfter;

            COMMIT TRAN;
            SELECT 1 AS AffectedRows;
            RETURN;
        END
    END

    -- Trường hợp phép không trừ quỹ phép năm hoặc Từ chối thủ công
    UPDATE dbo.EmployeeLeaves
    SET ApprovalStatus = CASE WHEN @Act = 'approved' THEN 'approved' ELSE 'rejected' END,
        ApprovedAt     = SYSDATETIME(),
        Note           = COALESCE(@Note, Note)
    WHERE LeaveId = @LeaveId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO
