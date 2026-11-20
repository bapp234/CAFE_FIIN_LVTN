USE [CoffeeShopDB];
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. MỞ RỘNG CHECK CONSTRAINT CHO TRẠNG THÁI XIN HỦY ĐƠN ('cancel_pending', 'cancelled')
-- ============================================================================

-- 1.1 Bảng dbo.SalaryAdvances
DECLARE @AdvStatusCK NVARCHAR(200);
SELECT @AdvStatusCK = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.SalaryAdvances') AND definition LIKE '%Status%';

IF @AdvStatusCK IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.SalaryAdvances DROP CONSTRAINT ' + @AdvStatusCK);
END
GO

ALTER TABLE dbo.SalaryAdvances
ADD CONSTRAINT CK_SalaryAdvances_Status
CHECK (Status IN ('pending', 'approved', 'rejected', 'deducted', 'cancel_pending', 'cancelled'));
GO

-- 1.2 Bảng dbo.EmployeeOvertimes
DECLARE @OtStatusCK NVARCHAR(200);
SELECT @OtStatusCK = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.EmployeeOvertimes') AND definition LIKE '%ApprovalStatus%';

IF @OtStatusCK IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.EmployeeOvertimes DROP CONSTRAINT ' + @OtStatusCK);
END
GO

ALTER TABLE dbo.EmployeeOvertimes
ADD CONSTRAINT CK_EmployeeOvertimes_Status
CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected', 'cancel_pending', 'cancelled'));
GO

-- 1.3 Bảng dbo.EmployeeLeaves
DECLARE @LvStatusCK NVARCHAR(200);
SELECT @LvStatusCK = name
FROM sys.check_constraints
WHERE parent_object_id = OBJECT_ID('dbo.EmployeeLeaves') AND definition LIKE '%ApprovalStatus%';

IF @LvStatusCK IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.EmployeeLeaves DROP CONSTRAINT ' + @LvStatusCK);
END
GO

ALTER TABLE dbo.EmployeeLeaves
ADD CONSTRAINT CK_EmployeeLeaves_Status
CHECK (ApprovalStatus IN ('pending', 'approved', 'rejected', 'cancel_pending', 'cancelled'));
GO

-- ============================================================================
-- 2. CẬP NHẬT TRIGGER ĐỒNG BỘ PHÉP NĂM (trg_EmployeeLeaves_SyncAnnualLeave)
--    Khi đơn ở trạng thái 'approved' hoặc 'cancel_pending' (đang chờ duyệt hủy)
--    thì vẫn đang giữ quỹ phép đã duyệt; khi duyệt hủy thành 'cancelled' sẽ tự hoàn lại phép!
-- ============================================================================
CREATE OR ALTER TRIGGER dbo.trg_EmployeeLeaves_SyncAnnualLeave
ON dbo.EmployeeLeaves
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    ;WITH AffectedRecords AS (
        SELECT EmployeeId, YEAR(FromDate) AS [Year]
        FROM inserted
        WHERE LeaveType = 'annual'
        UNION
        SELECT EmployeeId, YEAR(FromDate) AS [Year]
        FROM deleted
        WHERE LeaveType = 'annual'
    )
    INSERT INTO dbo.EmployeeAnnualLeaves (EmployeeId, [Year], StandardDays, SeniorityDays, CarriedOverDays, UsedDays, Note)
    SELECT
        ar.EmployeeId,
        ar.[Year],
        12.0 AS StandardDays,
        CAST(FLOOR(DATEDIFF(MONTH, ISNULL(e.HireDate, SYSDATETIME()), DATEFROMPARTS(ar.[Year], 12, 31)) / 60.0) AS DECIMAL(4,1)) AS SeniorityDays,
        0.0 AS CarriedOverDays,
        0.0 AS UsedDays,
        N'Tự động khởi tạo quỹ phép năm' AS Note
    FROM AffectedRecords ar
    INNER JOIN dbo.Employees e ON ar.EmployeeId = e.EmployeeId
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.EmployeeAnnualLeaves eal
        WHERE eal.EmployeeId = ar.EmployeeId AND eal.[Year] = ar.[Year]
    );

    ;WITH ApprovedLeaveSums AS (
        SELECT
            el.EmployeeId,
            YEAR(el.FromDate) AS [Year],
            ISNULL(SUM(el.LeaveDays), 0.0) AS TotalUsed
        FROM dbo.EmployeeLeaves el
        WHERE el.LeaveType = 'annual'
          AND LOWER(ISNULL(el.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending')
          AND EXISTS (
              SELECT 1 FROM inserted i WHERE i.EmployeeId = el.EmployeeId AND YEAR(i.FromDate) = YEAR(el.FromDate)
              UNION
              SELECT 1 FROM deleted d WHERE d.EmployeeId = el.EmployeeId AND YEAR(d.FromDate) = YEAR(el.FromDate)
          )
        GROUP BY el.EmployeeId, YEAR(el.FromDate)
    )
    UPDATE eal
    SET
        eal.UsedDays = ISNULL(als.TotalUsed, 0.0),
        eal.LastUpdated = SYSDATETIME()
    FROM dbo.EmployeeAnnualLeaves eal
    LEFT JOIN ApprovedLeaveSums als ON eal.EmployeeId = als.EmployeeId AND eal.[Year] = als.[Year]
    WHERE EXISTS (
        SELECT 1 FROM inserted i WHERE i.EmployeeId = eal.EmployeeId AND YEAR(i.FromDate) = eal.[Year]
        UNION
        SELECT 1 FROM deleted d WHERE d.EmployeeId = eal.EmployeeId AND YEAR(d.FromDate) = eal.[Year]
    );
END;
GO

-- ============================================================================
-- 3. NÂNG CẤP dbo.sp_HRM_GetSalaryAdvances & sp_HRM_ProcessSalaryAdvance (TẠM ỨNG LƯƠNG)
--    Hỗ trợ luồng:
--    - 'request_cancel': Cá nhân xin hủy phiếu đã duyệt ('approved' -> 'cancel_pending')
--    - 'approve_cancel': Cấp duyệt đồng ý hủy ('cancel_pending' -> 'cancelled')
--    - 'reject_cancel' : Cấp duyệt từ chối hủy ('cancel_pending' -> giữ nguyên 'approved')
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
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending') THEN ot.Hours ELSE 0 END), 0) AS OtApprovedHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'pending'  THEN ot.Hours ELSE 0 END), 0) AS OtPendingHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending', 'pending') THEN ot.Hours ELSE 0 END), 0) AS OtTotalRegisteredHours
        FROM dbo.EmployeeOvertimes ot
        WHERE (@Period IS NULL OR CONVERT(VARCHAR(7), ot.WorkDate, 126) = @Period)
        GROUP BY ot.EmployeeId, CONVERT(VARCHAR(7), ot.WorkDate, 126)
    ),
    LeaveYearlyAgg AS (
        SELECT
            lv.EmployeeId,
            YEAR(lv.FromDate) AS LeaveYear,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending') AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeaveApprovedDays,
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
            WHEN 'cancel_pending' THEN 0
            WHEN 'pending' THEN 1
            WHEN 'approved' THEN 2
            WHEN 'deducted' THEN 3
            WHEN 'cancelled' THEN 4
            ELSE 5
        END,
        a.CreatedAt DESC,
        a.AdvanceId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessSalaryAdvance
    @AdvanceId    INT,
    @Action       VARCHAR(20),
    @ApproverName NVARCHAR(100),
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));
    DECLARE @Approver NVARCHAR(100) = ISNULL(NULLIF(LTRIM(RTRIM(@ApproverName)), N''), N'Quản lý');
    DECLARE @CleanNote NVARCHAR(500) = NULLIF(LTRIM(RTRIM(ISNULL(@Note, N''))), N'');

    IF @Act NOT IN ('approve', 'reject', 'request_cancel', 'approve_cancel', 'reject_cancel')
    BEGIN
        RAISERROR(N'Hành động xử lý không hợp lệ.', 16, 1);
        RETURN;
    END

    DECLARE @CurrentStatus VARCHAR(20), @PeriodMonth VARCHAR(7), @BranchId INT;
    SELECT
        @CurrentStatus = LOWER(ISNULL(a.Status, 'pending')),
        @PeriodMonth   = a.PeriodMonth,
        @BranchId      = ISNULL(a.BranchId, e.BranchId)
    FROM dbo.SalaryAdvances a
    INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    WHERE a.AdvanceId = @AdvanceId;

    IF @CurrentStatus IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy phiếu tạm ứng lương.', 16, 1);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể thay đổi trạng thái phiếu tạm ứng.', 16, 1, @PeriodMonth);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM dbo.PayrollPeriods WHERE PeriodMonth = @PeriodMonth AND (BranchId = @BranchId OR BranchId IS NULL) AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng lương kỳ %s đã khóa, không thể thay đổi trạng thái phiếu tạm ứng.', 16, 1, @PeriodMonth);
        RETURN;
    END

    -- 1. Cá nhân gửi yêu cầu xin hủy phiếu tạm ứng đã duyệt
    IF @Act = 'request_cancel'
    BEGIN
        IF @CurrentStatus <> 'approved'
        BEGIN
            RAISERROR(N'Chỉ có thể gửi yêu cầu xin hủy đối với phiếu tạm ứng đã được duyệt.', 16, 1);
            RETURN;
        END

        UPDATE dbo.SalaryAdvances
        SET Status       = 'cancel_pending',
            DecisionNote = N'[Yêu cầu xin hủy đơn] ' + ISNULL(@CleanNote, N'Nhân sự xin hủy phiếu tạm ứng đã duyệt.'),
            UpdatedAt    = SYSDATETIME()
        WHERE AdvanceId = @AdvanceId;

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 2. Cấp duyệt xử lý yêu cầu xin hủy ('approve_cancel' hoặc 'reject_cancel')
    IF @Act IN ('approve_cancel', 'reject_cancel')
    BEGIN
        IF @CurrentStatus <> 'cancel_pending'
        BEGIN
            RAISERROR(N'Phiếu tạm ứng này không ở trạng thái chờ duyệt hủy.', 16, 1);
            RETURN;
        END

        IF @Act = 'approve_cancel'
        BEGIN
            UPDATE dbo.SalaryAdvances
            SET Status       = 'cancelled',
                ApprovedBy   = @Approver,
                ApprovedAt   = SYSDATETIME(),
                DecisionNote = N'[Đã duyệt hủy đơn] ' + ISNULL(@CleanNote, N'Cấp duyệt chấp thuận hủy phiếu tạm ứng.'),
                UpdatedAt    = SYSDATETIME()
            WHERE AdvanceId = @AdvanceId;
        END
        ELSE
        BEGIN
            UPDATE dbo.SalaryAdvances
            SET Status       = 'approved',
                ApprovedBy   = @Approver,
                ApprovedAt   = SYSDATETIME(),
                DecisionNote = N'[Từ chối hủy - Giữ hiệu lực] ' + ISNULL(@CleanNote, N'Cấp duyệt không đồng ý hủy phiếu.'),
                UpdatedAt    = SYSDATETIME()
            WHERE AdvanceId = @AdvanceId;
        END

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 3. Duyệt / Từ chối phiếu mới ('pending')
    IF @Act = 'reject' AND (@CleanNote IS NULL OR LEN(@CleanNote) < 3)
    BEGIN
        RAISERROR(N'Vui lòng nhập lý do từ chối phiếu tạm ứng (tối thiểu 3 ký tự).', 16, 1);
        RETURN;
    END

    IF @CurrentStatus <> 'pending'
    BEGIN
        RAISERROR(N'Phiếu tạm ứng này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

    DECLARE @NewStatus VARCHAR(20) = CASE WHEN @Act = 'approve' THEN 'approved' ELSE 'rejected' END;

    UPDATE dbo.SalaryAdvances
    SET Status       = @NewStatus,
        ApprovedBy   = @Approver,
        ApprovedAt   = SYSDATETIME(),
        DecisionNote = @CleanNote,
        UpdatedAt    = SYSDATETIME()
    WHERE AdvanceId = @AdvanceId
      AND LOWER(ISNULL(Status, 'pending')) = 'pending';

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 4. NÂNG CẤP dbo.sp_HRM_GetEmployeeMonthlyQuotas:
--    Đơn đang ở trạng thái 'cancel_pending' vẫn đang giữ hạn mức cho tới khi cấp duyệt bấm 'Đồng ý hủy' ('cancelled')
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
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending') THEN ot.Hours ELSE 0 END), 0) AS OtApprovedHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'pending'  THEN ot.Hours ELSE 0 END), 0) AS OtPendingHours,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending', 'pending') THEN ot.Hours ELSE 0 END), 0) AS OtTotalRegisteredHours
        FROM dbo.EmployeeOvertimes ot
        WHERE CONVERT(VARCHAR(7), ot.WorkDate, 126) = @Period
        GROUP BY ot.EmployeeId
    ),
    LeaveYearlyAgg AS (
        SELECT
            lv.EmployeeId,
            ISNULL(SUM(CASE WHEN LOWER(ISNULL(lv.ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending') AND ISNULL(lt.DeductAnnualLeave, CASE WHEN lv.LeaveType = 'annual' THEN 1 ELSE 0 END) = 1 THEN lv.LeaveDays ELSE 0 END), 0) AS LeaveApprovedDays,
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
-- 5. NÂNG CẤP dbo.sp_HRM_ProcessOvertimeRequest (ĐƠN XIN TĂNG CA)
--    Hỗ trợ 'request_cancel', 'approve_cancel', 'reject_cancel'
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessOvertimeRequest
    @OvertimeId   INT,
    @Action       VARCHAR(20), -- approved | rejected | request_cancel | approve_cancel | reject_cancel
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

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể thao tác trên đơn tăng ca.', 16, 1, @PeriodMonth);
        RETURN;
    END

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));

    -- 1. Cá nhân gửi yêu cầu xin hủy đơn tăng ca đã duyệt
    IF @Act = 'request_cancel'
    BEGIN
        IF @CurrentSt <> 'approved'
        BEGIN
            RAISERROR(N'Chỉ có thể xin hủy đối với đơn tăng ca đã được duyệt.', 16, 1);
            RETURN;
        END

        UPDATE dbo.EmployeeOvertimes
        SET ApprovalStatus = 'cancel_pending',
            Note           = N'[Xin hủy đơn đã duyệt] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Nhân sự xin hủy đơn tăng ca.')
        WHERE OvertimeId = @OvertimeId;

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 2. Cấp duyệt xử lý yêu cầu xin hủy đơn tăng ca
    IF @Act IN ('approve_cancel', 'reject_cancel')
    BEGIN
        IF @CurrentSt <> 'cancel_pending'
        BEGIN
            RAISERROR(N'Đơn tăng ca này không ở trạng thái chờ duyệt hủy.', 16, 1);
            RETURN;
        END

        IF @Act = 'approve_cancel'
        BEGIN
            -- Duyệt hủy -> Chuyển sang 'cancelled', số giờ OT tự động được hoàn lại vào hạn mức tháng!
            UPDATE dbo.EmployeeOvertimes
            SET ApprovalStatus = 'cancelled',
                ApprovedAt     = SYSDATETIME(),
                Note           = N'[Đã duyệt hủy đơn bởi ' + ISNULL(@ApproverName, N'Quản lý') + N'] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Đã hoàn lại giờ hạn mức tăng ca.')
            WHERE OvertimeId = @OvertimeId;
        END
        ELSE
        BEGIN
            -- Từ chối hủy -> Giữ nguyên trạng thái 'approved'
            UPDATE dbo.EmployeeOvertimes
            SET ApprovalStatus = 'approved',
                ApprovedAt     = SYSDATETIME(),
                Note           = N'[Từ chối yêu cầu hủy - Giữ hiệu lực] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'')
            WHERE OvertimeId = @OvertimeId;
        END

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 3. Xử lý đơn chờ duyệt ('pending')
    IF @CurrentSt <> 'pending'
    BEGIN
        RAISERROR(N'Đơn tăng ca này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

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
              AND LOWER(ISNULL(ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending')
        ), 0);

        DECLARE @RemainingBefore DECIMAL(5,2) = CASE WHEN @MaxMonth - @ApprovedMonth < 0 THEN 0 ELSE @MaxMonth - @ApprovedMonth END;

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

        UPDATE dbo.EmployeeOvertimes
        SET ApprovalStatus = 'approved',
            ApprovedAt     = SYSDATETIME(),
            Note           = COALESCE(@Note, Note)
        WHERE OvertimeId = @OvertimeId;

        DECLARE @RemainingAfter DECIMAL(5,2) = CASE
            WHEN @MaxMonth - (@ApprovedMonth + @ReqHours) < 0 THEN 0
            ELSE @MaxMonth - (@ApprovedMonth + @ReqHours)
        END;
        DECLARE @RemAfterStr VARCHAR(20) = CAST(@RemainingAfter AS VARCHAR(20));

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

    UPDATE dbo.EmployeeOvertimes
    SET ApprovalStatus = 'rejected',
        ApprovedAt     = SYSDATETIME(),
        Note           = COALESCE(@Note, Note, N'Quản lý từ chối đơn tăng ca.')
    WHERE OvertimeId = @OvertimeId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 6. NÂNG CẤP dbo.sp_HRM_ProcessAttendanceCorrectionRequest (ĐƠN BÙ CÔNG)
--    Hỗ trợ 'request_cancel', 'approve_cancel' (hoàn tác giờ chấm công về trạng thái gốc), 'reject_cancel'
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessAttendanceCorrectionRequest
    @RequestId    INT,
    @Action       VARCHAR(20), -- approved | rejected | request_cancel | approve_cancel | reject_cancel
    @ApproverName NVARCHAR(100) = N'Quản lý',
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EmpId INT, @BranchId INT, @AttId INT, @WorkDate DATE, @ReqIn TIME, @ReqOut TIME, @SchedStart TIME, @SchedEnd TIME, @OrigIn DATETIME2, @OrigOut DATETIME2, @Reason NVARCHAR(500), @CurrentSt VARCHAR(20);
    SELECT
        @EmpId      = EmployeeId,
        @BranchId   = BranchId,
        @AttId      = AttendanceId,
        @WorkDate   = WorkDate,
        @ReqIn      = RequestedCheckIn,
        @ReqOut     = RequestedCheckOut,
        @SchedStart = ISNULL(ScheduledStart, '08:00:00'),
        @SchedEnd   = ISNULL(ScheduledEnd, '17:00:00'),
        @OrigIn     = OriginalCheckIn,
        @OrigOut    = OriginalCheckOut,
        @Reason     = Reason,
        @CurrentSt  = LOWER(ISNULL(ApprovalStatus, 'pending'))
    FROM dbo.AttendanceCorrectionRequests
    WHERE RequestId = @RequestId;

    IF @WorkDate IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đơn bù công.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể thao tác trên đơn bù công.', 16, 1, @PeriodMonth);
        RETURN;
    END

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));

    -- 1. Cá nhân gửi yêu cầu xin hủy đơn bù công đã duyệt
    IF @Act = 'request_cancel'
    BEGIN
        IF @CurrentSt <> 'approved'
        BEGIN
            RAISERROR(N'Chỉ có thể xin hủy đối với đơn bù công đã được duyệt.', 16, 1);
            RETURN;
        END

        UPDATE dbo.AttendanceCorrectionRequests
        SET ApprovalStatus = 'cancel_pending',
            ApproverNote   = N'[Xin hủy đơn bù công] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Nhân sự xin hủy đơn bù công đã duyệt.')
        WHERE RequestId = @RequestId;

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 2. Cấp duyệt xử lý yêu cầu xin hủy đơn bù công
    IF @Act IN ('approve_cancel', 'reject_cancel')
    BEGIN
        IF @CurrentSt <> 'cancel_pending'
        BEGIN
            RAISERROR(N'Đơn bù công này không ở trạng thái chờ duyệt hủy.', 16, 1);
            RETURN;
        END

        BEGIN TRAN;

        IF @Act = 'approve_cancel'
        BEGIN
            UPDATE dbo.AttendanceCorrectionRequests
            SET ApprovalStatus = 'cancelled',
                ApprovedByName = @ApproverName,
                ApprovedAt     = SYSDATETIME(),
                ApproverNote   = N'[Đã duyệt hủy đơn bù công] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Đã hoàn tác dữ liệu chấm công.')
            WHERE RequestId = @RequestId;

            -- Hoàn tác dữ liệu chấm công về giờ quẹt thẻ gốc trước khi bù công
            IF @OrigIn IS NOT NULL OR @OrigOut IS NOT NULL
            BEGIN
                UPDATE dbo.Attendances
                SET CheckInTime      = @OrigIn,
                    CheckOutTime     = @OrigOut,
                    IsManualAdjusted = 0,
                    AdjustedBy       = @ApproverName,
                    AdjustedReason   = N'Hoàn tác do duyệt hủy đơn bù công #' + CAST(@RequestId AS NVARCHAR(20)),
                    AdjustedAt       = SYSDATETIME()
                WHERE EmployeeId = @EmpId AND WorkDate = @WorkDate;
            END
        END
        ELSE
        BEGIN
            UPDATE dbo.AttendanceCorrectionRequests
            SET ApprovalStatus = 'approved',
                ApprovedByName = @ApproverName,
                ApprovedAt     = SYSDATETIME(),
                ApproverNote   = N'[Từ chối yêu cầu hủy - Giữ hiệu lực] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'')
            WHERE RequestId = @RequestId;
        END

        COMMIT TRAN;
        SELECT 1 AS AffectedRows;
        RETURN;
    END

    -- 3. Xử lý đơn bù công chờ duyệt ('pending')
    BEGIN TRANSACTION;

    UPDATE dbo.AttendanceCorrectionRequests
    SET ApprovalStatus = @Act,
        ApprovedByName = @ApproverName,
        ApprovedAt     = SYSDATETIME(),
        ApproverNote   = @Note
    WHERE RequestId = @RequestId;

    IF @Act = 'approved'
    BEGIN
        DECLARE @CheckInDt  DATETIME2 = DATEADD(MINUTE, DATEDIFF(MINUTE, '00:00:00', @ReqIn), CAST(@WorkDate AS DATETIME2));
        DECLARE @CheckOutDt DATETIME2 = DATEADD(MINUTE, DATEDIFF(MINUTE, '00:00:00', @ReqOut), CAST(@WorkDate AS DATETIME2));
        DECLARE @WorkHours  DECIMAL(5, 2) = ROUND(DATEDIFF(MINUTE, @ReqIn, @ReqOut) / 60.0, 2);

        IF EXISTS (SELECT 1 FROM dbo.Attendances WHERE EmployeeId = @EmpId AND WorkDate = @WorkDate)
        BEGIN
            UPDATE dbo.Attendances
            SET CheckInTime       = @CheckInDt,
                CheckOutTime      = @CheckOutDt,
                WorkHours         = @WorkHours,
                LateMinutes       = CASE WHEN @ReqIn > ISNULL(ScheduledStartTime, @SchedStart) THEN DATEDIFF(MINUTE, ISNULL(ScheduledStartTime, @SchedStart), @ReqIn) ELSE 0 END,
                EarlyLeaveMinutes = CASE WHEN @ReqOut < ISNULL(ScheduledEndTime, @SchedEnd) THEN DATEDIFF(MINUTE, @ReqOut, ISNULL(ScheduledEndTime, @SchedEnd)) ELSE 0 END,
                IsMissingPunch    = 0,
                Status            = 'on_time',
                IsManualAdjusted  = 1,
                AdjustedBy        = @ApproverName,
                AdjustedReason    = @Reason,
                AdjustedAt        = SYSDATETIME()
            WHERE EmployeeId = @EmpId AND WorkDate = @WorkDate;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Attendances (
                EmployeeId, BranchId, WorkDate, ScheduledStartTime, ScheduledEndTime,
                CheckInTime, CheckOutTime, AttendanceMethod, WorkHours, OvertimeHours,
                LateMinutes, EarlyLeaveMinutes, Status, IsManualAdjusted, AdjustedBy, AdjustedReason, AdjustedAt, IsMissingPunch
            )
            VALUES (
                @EmpId, @BranchId, @WorkDate, @SchedStart, @SchedEnd,
                @CheckInDt, @CheckOutDt, 'manual_request', @WorkHours, 0,
                0, 0, 'on_time', 1, @ApproverName, @Reason, SYSDATETIME(), 0
            );
        END
    END

    COMMIT TRANSACTION;
    SELECT 1 AS AffectedRows;
END
GO

-- ============================================================================
-- 7. NÂNG CẤP dbo.sp_HRM_ProcessLeaveRequest (ĐƠN XIN NGHỈ PHÉP)
--    Hỗ trợ 'request_cancel', 'approve_cancel' (hoàn lại ngày phép năm), 'reject_cancel'
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessLeaveRequest
    @LeaveId      INT,
    @Action       VARCHAR(20), -- approved | rejected | request_cancel | approve_cancel | reject_cancel
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

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @FromDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể thao tác trên đơn nghỉ phép.', 16, 1, @PeriodMonth);
        RETURN;
    END

    DECLARE @Act VARCHAR(20) = LOWER(LTRIM(RTRIM(ISNULL(@Action, ''))));

    -- 1. Cá nhân gửi yêu cầu xin hủy đơn nghỉ phép đã duyệt
    IF @Act = 'request_cancel'
    BEGIN
        IF @CurrentSt <> 'approved'
        BEGIN
            RAISERROR(N'Chỉ có thể xin hủy đối với đơn nghỉ phép đã được duyệt.', 16, 1);
            RETURN;
        END

        UPDATE dbo.EmployeeLeaves
        SET ApprovalStatus = 'cancel_pending',
            Note           = N'[Xin hủy đơn nghỉ phép] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Nhân sự xin hủy đơn nghỉ phép đã duyệt.')
        WHERE LeaveId = @LeaveId;

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 2. Cấp duyệt xử lý yêu cầu xin hủy đơn nghỉ phép
    IF @Act IN ('approve_cancel', 'reject_cancel')
    BEGIN
        IF @CurrentSt <> 'cancel_pending'
        BEGIN
            RAISERROR(N'Đơn nghỉ phép này không ở trạng thái chờ duyệt hủy.', 16, 1);
            RETURN;
        END

        IF @Act = 'approve_cancel'
        BEGIN
            -- Duyệt hủy -> Trigger trg_EmployeeLeaves_SyncAnnualLeave sẽ tự động hoàn lại UsedDays vào quỹ phép năm!
            UPDATE dbo.EmployeeLeaves
            SET ApprovalStatus = 'cancelled',
                ApprovedAt     = SYSDATETIME(),
                Note           = N'[Đã duyệt hủy đơn bởi ' + ISNULL(@ApproverName, N'Quản lý') + N'] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'Đã hoàn lại ngày phép vào quỹ phép năm.')
            WHERE LeaveId = @LeaveId;
        END
        ELSE
        BEGIN
            UPDATE dbo.EmployeeLeaves
            SET ApprovalStatus = 'approved',
                ApprovedAt     = SYSDATETIME(),
                Note           = N'[Từ chối yêu cầu hủy - Giữ hiệu lực] ' + ISNULL(NULLIF(LTRIM(RTRIM(@Note)), N''), N'')
            WHERE LeaveId = @LeaveId;
        END

        SELECT @@ROWCOUNT AS AffectedRows;
        RETURN;
    END

    -- 3. Xử lý đơn nghỉ phép chờ duyệt ('pending')
    IF @CurrentSt <> 'pending'
    BEGIN
        RAISERROR(N'Đơn nghỉ phép này đã được xử lý trước đó.', 16, 1);
        RETURN;
    END

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
                  AND LOWER(ISNULL(ApprovalStatus, 'pending')) IN ('approved', 'cancel_pending');
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

            UPDATE dbo.EmployeeLeaves
            SET ApprovalStatus = 'approved',
                ApprovedAt     = SYSDATETIME(),
                Note           = COALESCE(@Note, Note)
            WHERE LeaveId = @LeaveId;

            DECLARE @RemainingAfter DECIMAL(5,2) = CASE
                WHEN @TotalDays - (@UsedDays + @LeaveDays) < 0 THEN 0
                ELSE @TotalDays - (@UsedDays + @LeaveDays)
            END;
            DECLARE @RemAfterStr VARCHAR(20) = CAST(@RemainingAfter AS VARCHAR(20));

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

    UPDATE dbo.EmployeeLeaves
    SET ApprovalStatus = CASE WHEN @Act = 'approved' THEN 'approved' ELSE 'rejected' END,
        ApprovedAt     = SYSDATETIME(),
        Note           = COALESCE(@Note, Note)
    WHERE LeaveId = @LeaveId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 8. CẬP NHẬT SẮP XẾP ƯU TIÊN ĐƠN XIN HỦY ('cancel_pending') & CHỜ DUYỆT ('pending') LÊN ĐẦU
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetOvertimeRequests
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
        ot.OvertimeId,
        ot.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        ISNULL(ot.BranchId, e.BranchId) AS BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        ot.WorkDate,
        CONVERT(VARCHAR(5), ot.StartTime, 108) AS StartTime,
        CONVERT(VARCHAR(5), ot.EndTime, 108) AS EndTime,
        ot.Hours,
        ISNULL(ot.OTCode, 'OT-DAY') AS OTCode,
        ISNULL(ott.OTName, N'Tăng ca') AS OTName,
        ot.OTType,
        ot.PayMultiplier,
        ISNULL(ot.Reason, N'') AS Reason,
        ISNULL(ot.ApprovalStatus, 'pending') AS ApprovalStatus,
        ot.ApprovedAt,
        ot.Note,
        ot.CreatedAt
    FROM dbo.EmployeeOvertimes ot
    INNER JOIN dbo.Employees e ON ot.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON ISNULL(ot.BranchId, e.BranchId) = b.BranchId
    LEFT JOIN dbo.OvertimeTypes ott ON ot.OTCode = ott.OTCode
    WHERE (@MonthStart IS NULL OR ot.WorkDate BETWEEN @MonthStart AND @MonthEnd)
      AND (@BranchId IS NULL OR ISNULL(ot.BranchId, e.BranchId) = @BranchId)
      AND (@St IS NULL OR @St = 'all' OR LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = @St)
      AND (
            @Kw IS NULL
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR ISNULL(ot.OTCode, '') LIKE '%' + @Kw + '%'
            OR ISNULL(ot.Reason, N'') LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        CASE LOWER(ISNULL(ot.ApprovalStatus, 'pending'))
            WHEN 'cancel_pending' THEN 0
            WHEN 'pending' THEN 1
            ELSE 2
        END,
        ot.WorkDate DESC,
        ot.OvertimeId DESC;
END
GO
