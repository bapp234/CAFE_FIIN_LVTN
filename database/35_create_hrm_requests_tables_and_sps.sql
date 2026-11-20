USE [CoffeeShopDB];
GO

-- ============================================================================
-- 1. BỔ SUNG CỘT OTCode / LeaveCode VÀO EmployeeOvertimes & EmployeeLeaves (NẾU CHƯA CÓ)
-- ============================================================================
IF COL_LENGTH('dbo.EmployeeOvertimes', 'OTCode') IS NULL
BEGIN
    ALTER TABLE dbo.EmployeeOvertimes ADD OTCode VARCHAR(30) NULL;
END
GO

IF COL_LENGTH('dbo.EmployeeLeaves', 'LeaveCode') IS NULL
BEGIN
    ALTER TABLE dbo.EmployeeLeaves ADD LeaveCode VARCHAR(30) NULL;
END
GO

-- Đồng bộ OTCode và LeaveCode cho dữ liệu sẵn có
UPDATE dbo.EmployeeOvertimes
SET OTCode = CASE LOWER(ISNULL(OTType, 'normal'))
    WHEN 'weekend' THEN 'OT-WEEKEND'
    WHEN 'holiday' THEN 'OT-HOLIDAY'
    WHEN 'night'   THEN 'OT-NIGHT'
    ELSE 'OT-DAY'
END
WHERE OTCode IS NULL;

UPDATE dbo.EmployeeLeaves
SET LeaveCode = CASE LOWER(ISNULL(LeaveType, 'annual'))
    WHEN 'sick'   THEN 'LV-OM'
    WHEN 'unpaid' THEN 'LV-KHONG-LUONG'
    ELSE 'LV-PHEP'
END
WHERE LeaveCode IS NULL;
GO

-- Tạo một số đơn OT và Nghỉ phép ở trạng thái 'pending' trong tháng 11/2026 để đối soát & duyệt
UPDATE TOP (8) dbo.EmployeeOvertimes
SET ApprovalStatus = 'pending', ApprovedBy = NULL, ApprovedAt = NULL
WHERE WorkDate >= '2026-11-10' AND ApprovalStatus = 'approved';

UPDATE TOP (6) dbo.EmployeeLeaves
SET ApprovalStatus = 'pending', ApprovedBy = NULL, ApprovedAt = NULL
WHERE FromDate >= '2026-11-10' AND ApprovalStatus = 'approved';
GO

-- ============================================================================
-- 2. BẢNG ĐƠN BÙ CÔNG / GIẢI TRÌNH CHẤM CÔNG (dbo.AttendanceCorrectionRequests)
-- ============================================================================
IF OBJECT_ID('dbo.AttendanceCorrectionRequests', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceCorrectionRequests (
        RequestId         INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId        INT           NOT NULL,
        BranchId          INT           NULL,
        AttendanceId      INT           NULL,
        WorkDate          DATE          NOT NULL,
        ScheduledStart    TIME          NULL,
        ScheduledEnd      TIME          NULL,
        OriginalCheckIn   DATETIME2     NULL,
        OriginalCheckOut  DATETIME2     NULL,
        RequestedCheckIn  TIME          NOT NULL,
        RequestedCheckOut TIME          NOT NULL,
        Reason            NVARCHAR(500) NOT NULL,
        ApprovalStatus    VARCHAR(20)   NOT NULL DEFAULT 'pending', -- pending | approved | rejected
        ApprovedByName    NVARCHAR(100) NULL,
        ApprovedAt        DATETIME2     NULL,
        ApproverNote      NVARCHAR(500) NULL,
        CreatedAt         DATETIME2     NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

-- Seed dữ liệu đơn bù công tháng 11/2026 từ các dòng quên chấm công / điều chỉnh tay trong Attendances
IF NOT EXISTS (SELECT 1 FROM dbo.AttendanceCorrectionRequests)
BEGIN
    INSERT INTO dbo.AttendanceCorrectionRequests (
        EmployeeId, BranchId, AttendanceId, WorkDate,
        ScheduledStart, ScheduledEnd, OriginalCheckIn, OriginalCheckOut,
        RequestedCheckIn, RequestedCheckOut, Reason,
        ApprovalStatus, ApprovedByName, ApprovedAt, CreatedAt
    )
    SELECT TOP 25
        a.EmployeeId,
        ISNULL(a.BranchId, e.BranchId),
        a.AttendanceId,
        a.WorkDate,
        ISNULL(a.ScheduledStartTime, '08:00:00'),
        ISNULL(a.ScheduledEndTime, '17:00:00'),
        a.CheckInTime,
        a.CheckOutTime,
        ISNULL(a.ScheduledStartTime, '08:00:00'),
        ISNULL(a.ScheduledEndTime, '17:00:00'),
        CASE
            WHEN a.IsMissingPunch = 1 THEN N'Quên bấm chấm công đầu ra do phục vụ khách cuối ca'
            ELSE N'Giải trình bổ sung giờ chấm công thực tế tại quầy'
        END,
        CASE WHEN a.WorkDate >= '2026-11-12' THEN 'pending' ELSE 'approved' END,
        CASE WHEN a.WorkDate >= '2026-11-12' THEN NULL ELSE N'Quản lý nhân sự' END,
        CASE WHEN a.WorkDate >= '2026-11-12' THEN NULL ELSE DATEADD(HOUR, 20, CAST(a.WorkDate AS DATETIME2)) END,
        DATEADD(HOUR, 18, CAST(a.WorkDate AS DATETIME2))
    FROM dbo.Attendances a
    INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
    WHERE a.WorkDate >= '2026-11-01'
      AND (a.IsMissingPunch = 1 OR a.LateMinutes > 0 OR a.IsManualAdjusted = 1)
    ORDER BY a.WorkDate DESC, a.AttendanceId DESC;
END
GO

-- ============================================================================
-- 3. STORED PROCEDURES TAB 1: ĐƠN XIN TĂNG CA (Overtime Requests)
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
        CASE WHEN LOWER(ISNULL(ot.ApprovalStatus, 'pending')) = 'pending' THEN 0 ELSE 1 END,
        ot.WorkDate DESC,
        ot.OvertimeId DESC;
END
GO

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

    DECLARE @Hours DECIMAL(5, 2) = ROUND(DATEDIFF(MINUTE, @StartTime, @EndTime) / 60.0, 2);
    DECLARE @OTCategory VARCHAR(20) = 'normal';
    DECLARE @Multiplier DECIMAL(5, 2) = 1.50;
    DECLARE @MaxDay DECIMAL(5, 2) = 8.00;

    SELECT TOP 1
        @OTCategory = OTCategory,
        @Multiplier = ROUND((PayMultiplier + NightExtraRate) / 100.0, 2),
        @MaxDay     = MaxHoursPerDay
    FROM dbo.OvertimeTypes
    WHERE OTCode = @OTCode AND IsActive = 1;

    IF @Hours > @MaxDay
    BEGIN
        DECLARE @HoursStr VARCHAR(20) = CAST(@Hours AS VARCHAR(20));
        DECLARE @MaxDayStr VARCHAR(20) = CAST(@MaxDay AS VARCHAR(20));
        RAISERROR(N'Số giờ đăng ký (%sh) vượt quá giới hạn tối đa/ngày (%sh) của mã %s.', 16, 1, @HoursStr, @MaxDayStr, @OTCode);
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
    DECLARE @WorkDate DATE, @BranchId INT;
    SELECT @WorkDate = WorkDate, @BranchId = BranchId FROM dbo.EmployeeOvertimes WHERE OvertimeId = @OvertimeId;

    IF @WorkDate IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đơn tăng ca.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể duyệt/từ chối đơn.', 16, 1, @PeriodMonth);
        RETURN;
    END

    UPDATE dbo.EmployeeOvertimes
    SET ApprovalStatus = LOWER(@Action),
        ApprovedAt     = SYSDATETIME(),
        Note           = COALESCE(@Note, Note)
    WHERE OvertimeId = @OvertimeId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO

-- ============================================================================
-- 4. STORED PROCEDURES TAB 2: ĐƠN BÙ CÔNG (Attendance Correction Requests)
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetAttendanceCorrectionRequests
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
        r.RequestId,
        r.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        ISNULL(r.BranchId, e.BranchId) AS BranchId,
        ISNULL(b.BranchName, N'Mặc định') AS BranchName,
        r.WorkDate,
        CONVERT(VARCHAR(5), ISNULL(r.ScheduledStart, '08:00:00'), 108) AS ScheduledStart,
        CONVERT(VARCHAR(5), ISNULL(r.ScheduledEnd, '17:00:00'), 108) AS ScheduledEnd,
        CONVERT(VARCHAR(5), r.RequestedCheckIn, 108) AS RequestedCheckIn,
        CONVERT(VARCHAR(5), r.RequestedCheckOut, 108) AS RequestedCheckOut,
        ROUND(DATEDIFF(MINUTE, r.RequestedCheckIn, r.RequestedCheckOut) / 60.0, 2) AS RequestedHours,
        r.Reason,
        r.ApprovalStatus,
        r.ApprovedByName,
        r.ApprovedAt,
        r.ApproverNote,
        r.CreatedAt
    FROM dbo.AttendanceCorrectionRequests r
    INNER JOIN dbo.Employees e ON r.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON ISNULL(r.BranchId, e.BranchId) = b.BranchId
    WHERE (@MonthStart IS NULL OR r.WorkDate BETWEEN @MonthStart AND @MonthEnd)
      AND (@BranchId IS NULL OR ISNULL(r.BranchId, e.BranchId) = @BranchId)
      AND (@St IS NULL OR @St = 'all' OR LOWER(r.ApprovalStatus) = @St)
      AND (
            @Kw IS NULL
            OR e.EmployeeCode LIKE '%' + @Kw + '%'
            OR COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Kw + N'%'
            OR r.Reason LIKE N'%' + @Kw + N'%'
          )
    ORDER BY
        CASE WHEN LOWER(r.ApprovalStatus) = 'pending' THEN 0 ELSE 1 END,
        r.WorkDate DESC,
        r.RequestId DESC;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_CreateAttendanceCorrectionRequest
    @EmployeeId        INT,
    @WorkDate          DATE,
    @RequestedCheckIn  TIME,
    @RequestedCheckOut TIME,
    @Reason            NVARCHAR(500)
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @WorkDate, 126);
    DECLARE @BranchId INT = (SELECT BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId);

    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể tạo đơn bù công.', 16, 1, @PeriodMonth);
        RETURN;
    END

    IF @RequestedCheckOut <= @RequestedCheckIn
    BEGIN
        RAISERROR(N'Giờ chấm ra phải lớn hơn giờ chấm vào.', 16, 1);
        RETURN;
    END

    DECLARE @AttId INT = NULL, @SchedStart TIME = '08:00:00', @SchedEnd TIME = '17:00:00', @OrigIn DATETIME2 = NULL, @OrigOut DATETIME2 = NULL;

    SELECT TOP 1
        @AttId      = AttendanceId,
        @SchedStart = ISNULL(ScheduledStartTime, '08:00:00'),
        @SchedEnd   = ISNULL(ScheduledEndTime, '17:00:00'),
        @OrigIn     = CheckInTime,
        @OrigOut    = CheckOutTime
    FROM dbo.Attendances
    WHERE EmployeeId = @EmployeeId AND WorkDate = @WorkDate;

    INSERT INTO dbo.AttendanceCorrectionRequests (
        EmployeeId, BranchId, AttendanceId, WorkDate,
        ScheduledStart, ScheduledEnd, OriginalCheckIn, OriginalCheckOut,
        RequestedCheckIn, RequestedCheckOut, Reason, ApprovalStatus, CreatedAt
    )
    VALUES (
        @EmployeeId, @BranchId, @AttId, @WorkDate,
        @SchedStart, @SchedEnd, @OrigIn, @OrigOut,
        @RequestedCheckIn, @RequestedCheckOut, @Reason, 'pending', SYSDATETIME()
    );

    SELECT CAST(SCOPE_IDENTITY() AS INT) AS RequestId;
END
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessAttendanceCorrectionRequest
    @RequestId    INT,
    @Action       VARCHAR(20), -- approved | rejected
    @ApproverName NVARCHAR(100) = N'Quản lý',
    @Note         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @EmpId INT, @BranchId INT, @AttId INT, @WorkDate DATE, @ReqIn TIME, @ReqOut TIME, @SchedStart TIME, @SchedEnd TIME, @Reason NVARCHAR(500);
    SELECT
        @EmpId      = EmployeeId,
        @BranchId   = BranchId,
        @AttId      = AttendanceId,
        @WorkDate   = WorkDate,
        @ReqIn      = RequestedCheckIn,
        @ReqOut     = RequestedCheckOut,
        @SchedStart = ISNULL(ScheduledStart, '08:00:00'),
        @SchedEnd   = ISNULL(ScheduledEnd, '17:00:00'),
        @Reason     = Reason
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
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể duyệt/từ chối đơn bù công.', 16, 1, @PeriodMonth);
        RETURN;
    END

    BEGIN TRANSACTION;

    UPDATE dbo.AttendanceCorrectionRequests
    SET ApprovalStatus = LOWER(@Action),
        ApprovedByName = @ApproverName,
        ApprovedAt     = SYSDATETIME(),
        ApproverNote   = @Note
    WHERE RequestId = @RequestId;

    -- Khi DUYỆT đơn bù công -> Cập nhật hoặc thêm mới vào dbo.Attendances để tính công thực tế
    IF LOWER(@Action) = 'approved'
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
-- 5. STORED PROCEDURES TAB 3: ĐƠN XIN NGHỈ PHÉP (Leave Requests)
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

    DECLARE @IsPaid BIT = 1;
    SELECT TOP 1 @IsPaid = IsPaid FROM dbo.LeaveTypes WHERE LeaveCode = @LeaveCode AND IsActive = 1;

    DECLARE @LeaveType VARCHAR(20) = CASE
        WHEN @LeaveCode = 'LV-OM' THEN 'sick'
        WHEN @IsPaid = 0 THEN 'unpaid'
        ELSE 'annual'
    END;

    DECLARE @LeaveDays DECIMAL(5, 2) = CAST(DATEDIFF(DAY, @FromDate, @ToDate) + 1 AS DECIMAL(5, 2));

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
    @ApproverName NVARCHAR(100) = N'Quản lý'
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @FromDate DATE, @BranchId INT;
    SELECT @FromDate = FromDate, @BranchId = BranchId FROM dbo.EmployeeLeaves WHERE LeaveId = @LeaveId;

    IF @FromDate IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy đơn nghỉ phép.', 16, 1);
        RETURN;
    END

    DECLARE @PeriodMonth VARCHAR(7) = CONVERT(VARCHAR(7), @FromDate, 126);
    IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE PeriodMonth = @PeriodMonth AND BranchId = @BranchId AND IsLocked = 1)
    BEGIN
        RAISERROR(N'Bảng công tháng %s đã khóa, không thể duyệt/từ chối đơn nghỉ phép.', 16, 1, @PeriodMonth);
        RETURN;
    END

    UPDATE dbo.EmployeeLeaves
    SET ApprovalStatus = LOWER(@Action),
        ApprovedAt     = SYSDATETIME()
    WHERE LeaveId = @LeaveId;

    SELECT @@ROWCOUNT AS AffectedRows;
END
GO
