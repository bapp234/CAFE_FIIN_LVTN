-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Các thủ tục lưu trữ (Stored Procedures): MODULE HRM
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/stored_procedures/hrm_procedures.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

-- =======================================================================================
-- 1. THỦ TỤC ĐĂNG KÝ / XẾP CA LÀM VIỆC (CÓ KIỂM TRA CHỐNG TRÙNG CA)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AssignShift
    @EmployeeId INT,
    @TemplateId INT,
    @BranchId INT,
    @WorkDate DATE,
    @RegisteredBy VARCHAR(20) = 'manager',
    @Note NVARCHAR(255) = NULL,
    @NewAssignmentId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Kiểm tra tồn tại nhân viên
    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId AND Status != 'resigned')
    BEGIN
        RAISERROR(N'Nhân viên không tồn tại hoặc đã nghỉ việc.', 16, 1);
        RETURN;
    END

    -- 2. Kiểm tra tồn tại mẫu ca
    IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE TemplateId = @TemplateId AND IsActive = 1)
    BEGIN
        RAISERROR(N'Mẫu ca làm việc không tồn tại hoặc đã ngừng hoạt động.', 16, 1);
        RETURN;
    END

    -- 3. Kiểm tra chống xếp trùng ca trong ngày
    IF EXISTS (
        SELECT 1 FROM dbo.ShiftAssignments
        WHERE EmployeeId = @EmployeeId 
          AND WorkDate = @WorkDate 
          AND TemplateId = @TemplateId 
          AND Status != 'cancelled'
    )
    BEGIN
        RAISERROR(N'Nhân viên đã được xếp ca này trong cùng ngày làm việc.', 16, 1);
        RETURN;
    END

    -- 4. Thêm bản ghi phân ca
    INSERT INTO dbo.ShiftAssignments (
        EmployeeId, TemplateId, BranchId, WorkDate, RegisteredBy, Status, Note, CreatedAt
    )
    VALUES (
        @EmployeeId, @TemplateId, @BranchId, @WorkDate, @RegisteredBy, 'scheduled', @Note, SYSDATETIME()
    );

    SET @NewAssignmentId = SCOPE_IDENTITY();
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_AssignShift.';
GO

-- =======================================================================================
-- 2. THỦ TỤC HỦY HOẶC XÓA LỊCH XẾP CA
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_RemoveShiftAssignment
    @AssignmentId INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu ca đã được dùng để chấm công thì không xóa mà chuyển sang 'cancelled'
    IF EXISTS (SELECT 1 FROM dbo.Attendances WHERE ShiftAssignmentId = @AssignmentId)
    BEGIN
        UPDATE dbo.ShiftAssignments
        SET Status = 'cancelled'
        WHERE AssignmentId = @AssignmentId;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.ShiftAssignments
        WHERE AssignmentId = @AssignmentId;
    END
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_RemoveShiftAssignment.';
GO

-- =======================================================================================
-- 3. THỦ TỤC CHẤM CÔNG (ĐỐI SOÁT VỚI LỊCH ĐĂNG KÝ TRƯỚC TỰ ĐỘNG)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_RecordAttendance
    @EmployeeId INT,
    @WorkDate DATE,
    @CheckInTime DATETIME2(0),
    @CheckOutTime DATETIME2(0) = NULL,
    @AttendanceMethod VARCHAR(30) = 'SimulatedButton',
    @Notes NVARCHAR(255) = NULL,
    @AttendanceId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;

    -- Tìm lịch làm việc đã đăng ký hôm nay của nhân viên
    DECLARE @AssignmentId INT = NULL;
    DECLARE @SchedStart TIME(0) = NULL;
    DECLARE @SchedEnd TIME(0) = NULL;
    DECLARE @StdHours DECIMAL(4,2) = 0.00;
    DECLARE @BreakMins INT = 0;

    SELECT TOP 1
        @AssignmentId = a.AssignmentId,
        @SchedStart = t.StartTime,
        @SchedEnd = t.EndTime,
        @StdHours = t.StandardHours,
        @BreakMins = t.BreakMinutes
    FROM dbo.ShiftAssignments a
    INNER JOIN dbo.ShiftTemplates t ON a.TemplateId = t.TemplateId
    WHERE a.EmployeeId = @EmployeeId
      AND a.WorkDate = @WorkDate
      AND a.Status != 'cancelled';

    -- Tính số phút đi muộn và về sớm
    DECLARE @LateMins INT = 0;
    DECLARE @EarlyMins INT = 0;
    DECLARE @WorkHrs DECIMAL(4,2) = 0.00;
    DECLARE @OtHrs DECIMAL(4,2) = 0.00;
    DECLARE @Status VARCHAR(20) = 'on_time';

    IF @SchedStart IS NOT NULL
        SET @LateMins = dbo.fn_HRM_CalculateLateMinutes(@CheckInTime, @SchedStart);

    IF @CheckOutTime IS NOT NULL
    BEGIN
        IF @SchedEnd IS NOT NULL
            SET @EarlyMins = dbo.fn_HRM_CalculateEarlyLeaveMinutes(@CheckOutTime, @SchedEnd);

        -- Tính giờ làm việc thực tế
        DECLARE @ActualHours DECIMAL(4,2) = dbo.fn_HRM_CalculateWorkHours(@CheckInTime, @CheckOutTime, @BreakMins);
        
        IF @StdHours > 0 AND @ActualHours > @StdHours
        BEGIN
            SET @WorkHrs = @StdHours;
            SET @OtHrs = @ActualHours - @StdHours;
        END
        ELSE
        BEGIN
            SET @WorkHrs = @ActualHours;
            SET @OtHrs = 0.00;
        END
    END
    ELSE
    BEGIN
        -- Mới check-in chưa check-out, tạm tính bằng giờ chuẩn ca
        SET @WorkHrs = ISNULL(@StdHours, 0.00);
    END

    -- Xác định trạng thái chấm công
    IF @LateMins > 0
        SET @Status = 'late';
    ELSE IF @EarlyMins > 0
        SET @Status = 'early_leave';
    ELSE
        SET @Status = 'on_time';

    -- Kiểm tra xem đã có bản ghi chấm công của ngày này chưa
    DECLARE @ExistingId INT = NULL;
    SELECT @ExistingId = AttendanceId FROM dbo.Attendances WHERE EmployeeId = @EmployeeId AND WorkDate = @WorkDate;

    IF @ExistingId IS NULL
    BEGIN
        INSERT INTO dbo.Attendances (
            EmployeeId, WorkDate, CheckInTime, CheckOutTime, AttendanceMethod, Notes,
            ShiftAssignmentId, ScheduledStartTime, ScheduledEndTime,
            WorkHours, OvertimeHours, LateMinutes, EarlyLeaveMinutes,
            Status, IsManualAdjusted
        )
        VALUES (
            @EmployeeId, @WorkDate, @CheckInTime, @CheckOutTime, @AttendanceMethod, @Notes,
            @AssignmentId, @SchedStart, @SchedEnd,
            @WorkHrs, @OtHrs, @LateMins, @EarlyMins,
            @Status, 0
        );
        SET @AttendanceId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.Attendances
        SET CheckOutTime = ISNULL(@CheckOutTime, CheckOutTime),
            WorkHours = @WorkHrs,
            OvertimeHours = @OtHrs,
            LateMinutes = @LateMins,
            EarlyLeaveMinutes = @EarlyMins,
            Status = @Status,
            Notes = ISNULL(@Notes, Notes)
        WHERE AttendanceId = @ExistingId;
        SET @AttendanceId = @ExistingId;
    END
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_RecordAttendance.';
GO

-- =======================================================================================
-- 4. THỦ TỤC ĐIỀU CHỈNH CHẤM CÔNG THỦ CÔNG (AUDIT LOG ĐẦY ĐỦ)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AdjustAttendanceManual
    @AttendanceId INT,
    @CheckInTime DATETIME2(0),
    @CheckOutTime DATETIME2(0),
    @AdjustedBy NVARCHAR(100),
    @AdjustedReason NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra lý do bắt buộc
    IF @AdjustedReason IS NULL OR LTRIM(RTRIM(@AdjustedReason)) = ''
    BEGIN
        RAISERROR(N'Lý do điều chỉnh chấm công là bắt buộc để đảm bảo tính minh bạch kiểm toán.', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.Attendances WHERE AttendanceId = @AttendanceId)
    BEGIN
        RAISERROR(N'Không tìm thấy bản ghi chấm công cần điều chỉnh.', 16, 1);
        RETURN;
    END

    -- Tính toán lại giờ công thực tế sau khi điều chỉnh
    DECLARE @WorkHrs DECIMAL(4,2) = dbo.fn_HRM_CalculateWorkHours(@CheckInTime, @CheckOutTime, 15);

    UPDATE dbo.Attendances
    SET CheckInTime = @CheckInTime,
        CheckOutTime = @CheckOutTime,
        WorkHours = @WorkHrs,
        LateMinutes = 0,
        EarlyLeaveMinutes = 0,
        Status = 'on_time',
        IsManualAdjusted = 1,
        AdjustedBy = @AdjustedBy,
        AdjustedReason = @AdjustedReason,
        AdjustedAt = SYSDATETIME()
    WHERE AttendanceId = @AttendanceId;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_AdjustAttendanceManual.';
GO

-- =======================================================================================
-- 5. THỦ TỤC TỰ ĐỘNG TÍNH LƯƠNG THÁNG (GIỜ THỰC TẾ + OT x1.5 + TRANSACTION)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CalculatePayroll
    @PeriodMonth VARCHAR(7),        -- 'YYYY-MM' (ví dụ: '2026-11')
    @BranchId INT = NULL,           -- NULL = Toàn hệ thống
    @CalculatedBy NVARCHAR(100) = N'Hệ thống',
    @PeriodId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- 1. Kiểm tra kỳ lương đã tồn tại và bị khóa chưa
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

    -- 2. Tạo hoặc lấy PeriodId
    IF @ExistingPeriodId IS NULL
    BEGIN
        INSERT INTO dbo.PayrollPeriods (PeriodMonth, BranchId, Status, IsLocked, CreatedAt)
        VALUES (@PeriodMonth, @BranchId, 'draft', 0, SYSDATETIME());

        SET @PeriodId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SET @PeriodId = @ExistingPeriodId;
        -- Xóa phiếu lương cũ chưa duyệt để tính lại
        DELETE FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId;
    END

    -- 3. Quét danh sách nhân viên đang làm việc và tính toán phiếu lương
    INSERT INTO dbo.PayrollSlips (
        PeriodId, EmployeeId, HourlyRate, StandardHours, OvertimeHours,
        BasePay, OvertimePay, Allowance, Deduction, Advance, NetPay, Status, CreatedAt
    )
    SELECT 
        @PeriodId,
        e.EmployeeId,
        e.HourlyRate,
        -- Giờ chuẩn từ bảng chấm công hoặc mặc định theo loại hợp đồng
        ISNULL(ts.TotalStandardHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) AS StandardHours,
        -- Giờ tăng ca
        ISNULL(ts.TotalOvertimeHours, 0.00) AS OvertimeHours,
        -- BasePay = StandardHours * HourlyRate
        ISNULL(ts.TotalStandardHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) * e.HourlyRate AS BasePay,
        -- OvertimePay = OvertimeHours * (HourlyRate * 1.5) -> OT x1.5!
        ISNULL(ts.TotalOvertimeHours, 0.00) * (e.HourlyRate * 1.5) AS OvertimePay,
        -- Phụ cấp: Full-time: 1.000.000đ, Part-time: 300.000đ
        CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END AS Allowance,
        -- Khấu trừ
        0.00 AS Deduction,
        -- Tạm ứng
        0.00 AS Advance,
        -- NetPay = BasePay + OvertimePay + Allowance - Deduction - Advance
        (ISNULL(ts.TotalStandardHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) * e.HourlyRate)
        + (ISNULL(ts.TotalOvertimeHours, 0.00) * (e.HourlyRate * 1.5))
        + (CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END) AS NetPay,
        'draft',
        SYSDATETIME()
    FROM dbo.Employees e
    OUTER APPLY dbo.tvf_HRM_GetEmployeeMonthlyTimesheet(e.EmployeeId, @PeriodMonth) ts
    WHERE e.Status != 'resigned'
      AND (@BranchId IS NULL OR e.BranchId = @BranchId);

    -- 4. Cập nhật tổng quỹ lương và số lượng nhân sự vào PayrollPeriods
    UPDATE dbo.PayrollPeriods
    SET TotalEmployees = (SELECT COUNT(*) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId),
        TotalNetPay = ISNULL((SELECT SUM(NetPay) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId), 0),
        Status = 'draft'
    WHERE PeriodId = @PeriodId;

    COMMIT TRANSACTION;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_CalculatePayroll.';
GO

-- =======================================================================================
-- 6. THỦ TỤC PHÊ DUYỆT VÀ KHÓA KỲ LƯƠNG (LOCK PERIOD)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockPayrollPeriod
    @PeriodId INT,
    @ApproverName NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.PayrollPeriods WHERE PeriodId = @PeriodId)
    BEGIN
        RAISERROR(N'Không tìm thấy kỳ lương cần phê duyệt.', 16, 1);
        RETURN;
    END

    -- Cập nhật phiếu lương sang 'approved' TRƯỚC khi khóa kỳ lương (để không bị Trigger chặn)
    UPDATE dbo.PayrollSlips
    SET Status = 'approved'
    WHERE PeriodId = @PeriodId;

    -- Sau đó mới chính thức khóa kỳ lương
    UPDATE dbo.PayrollPeriods
    SET Status = 'approved',
        IsLocked = 1,
        ApprovedBy = @ApproverName,
        ApprovedAt = SYSDATETIME()
    WHERE PeriodId = @PeriodId;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_LockPayrollPeriod.';
GO

-- =======================================================================================
-- 7. THỦ TỤC LẤY DANH SÁCH CHẤM CÔNG NGÀY & ĐỐI SOÁT VỚI LỊCH PHÂN CA
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetDailyAttendanceMonitor
    @WorkDate           DATE            = NULL,
    @BranchId           INT             = NULL,
    @Status             VARCHAR(20)     = NULL,
    @Search             NVARCHAR(100)   = NULL,
    @CurrentUsername    VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @WorkDate = ISNULL(@WorkDate, CAST(SYSDATETIME() AS DATE));

    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    ;WITH DailyUnion AS (
        SELECT 
            sa.AssignmentId,
            sa.EmployeeId,
            sa.BranchId,
            sa.WorkDate,
            st.ShiftCode,
            st.ShiftName,
            st.StartTime AS ScheduledStartTime,
            st.EndTime   AS ScheduledEndTime,
            st.StandardHours,
            att.AttendanceId,
            att.CheckInTime,
            att.CheckOutTime,
            ISNULL(att.WorkHours, 0.00) AS WorkHours,
            ISNULL(att.OvertimeHours, 0.00) AS OvertimeHours,
            ISNULL(att.LateMinutes, 0) AS LateMinutes,
            ISNULL(att.EarlyLeaveMinutes, 0) AS EarlyLeaveMinutes,
            CASE WHEN att.AttendanceId IS NULL THEN 'absent' ELSE att.Status END AS AttendanceStatus,
            ISNULL(att.IsManualAdjusted, 0) AS IsManualAdjusted,
            att.AdjustedBy,
            att.AdjustedReason,
            att.AdjustedAt
        FROM dbo.ShiftAssignments sa
        INNER JOIN dbo.ShiftTemplates st ON sa.TemplateId = st.TemplateId
        LEFT JOIN dbo.Attendances att ON sa.AssignmentId = att.ShiftAssignmentId 
                                      OR (sa.EmployeeId = att.EmployeeId AND sa.WorkDate = att.WorkDate)
        WHERE sa.WorkDate = @WorkDate
          AND sa.Status <> 'cancelled'

        UNION ALL

        SELECT 
            NULL AS AssignmentId,
            att.EmployeeId,
            e.BranchId,
            att.WorkDate,
            'CA-EXTRA' AS ShiftCode,
            N'Ca phát sinh / Không báo trước' AS ShiftName,
            att.ScheduledStartTime,
            att.ScheduledEndTime,
            att.WorkHours AS StandardHours,
            att.AttendanceId,
            att.CheckInTime,
            att.CheckOutTime,
            att.WorkHours,
            att.OvertimeHours,
            att.LateMinutes,
            att.EarlyLeaveMinutes,
            att.Status AS AttendanceStatus,
            att.IsManualAdjusted,
            att.AdjustedBy,
            att.AdjustedReason,
            att.AdjustedAt
        FROM dbo.Attendances att
        INNER JOIN dbo.Employees e ON att.EmployeeId = e.EmployeeId
        WHERE att.WorkDate = @WorkDate
          AND att.ShiftAssignmentId IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM dbo.ShiftAssignments sa2 
              WHERE sa2.EmployeeId = att.EmployeeId AND sa2.WorkDate = att.WorkDate AND sa2.Status <> 'cancelled'
          )
    )
    SELECT 
        du.AttendanceId,
        du.AssignmentId,
        du.EmployeeId,
        e.EmployeeCode,
        u.FullName,
        e.Position,
        LEFT(u.FullName, 1) AS AvatarInitial,
        b.BranchId,
        b.BranchCode,
        b.BranchName,
        du.ShiftCode,
        du.ShiftName,
        du.ScheduledStartTime,
        du.ScheduledEndTime,
        CASE 
            WHEN du.ScheduledStartTime IS NOT NULL AND du.ScheduledEndTime IS NOT NULL 
            THEN CONVERT(VARCHAR(5), du.ScheduledStartTime, 108) + ' - ' + CONVERT(VARCHAR(5), du.ScheduledEndTime, 108)
            ELSE N'Chưa xếp ca'
        END AS ScheduledTimeRange,
        du.CheckInTime,
        du.CheckOutTime,
        CASE 
            WHEN du.CheckInTime IS NOT NULL AND du.CheckOutTime IS NOT NULL 
            THEN CONVERT(VARCHAR(5), CAST(du.CheckInTime AS TIME), 108) + N' → ' + CONVERT(VARCHAR(5), CAST(du.CheckOutTime AS TIME), 108)
            WHEN du.CheckInTime IS NOT NULL 
            THEN CONVERT(VARCHAR(5), CAST(du.CheckInTime AS TIME), 108) + N' → Đang làm việc'
            ELSE N'Chưa chấm công'
        END AS ActualTimeRange,
        du.WorkHours,
        du.OvertimeHours,
        du.LateMinutes,
        du.EarlyLeaveMinutes,
        du.AttendanceStatus,
        CASE 
            WHEN du.AttendanceStatus = 'on_time' THEN N'Đúng giờ'
            WHEN du.AttendanceStatus = 'late' THEN N'Đi muộn ' + CAST(du.LateMinutes AS NVARCHAR(10)) + N'p'
            WHEN du.AttendanceStatus = 'early_leave' THEN N'Về sớm ' + CAST(du.EarlyLeaveMinutes AS NVARCHAR(10)) + N'p'
            WHEN du.AttendanceStatus = 'absent' THEN N'Vắng mặt (Có lịch)'
            ELSE du.AttendanceStatus
        END AS StatusLabel,
        du.IsManualAdjusted,
        du.AdjustedBy,
        du.AdjustedReason,
        du.AdjustedAt
    INTO #TempDailyAttendance
    FROM DailyUnion du
    INNER JOIN dbo.Employees e ON du.EmployeeId = e.EmployeeId
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON du.BranchId = b.BranchId
    WHERE (@BranchId IS NULL OR du.BranchId = @BranchId)
      AND (@HasHierarchyFilter = 0 OR du.EmployeeId IN (SELECT EmployeeId FROM @AllowedEmployees))
      AND (@Status IS NULL OR @Status = 'all' OR du.AttendanceStatus = @Status)
      AND (
          @Search IS NULL OR LTRIM(RTRIM(@Search)) = '' OR
          e.EmployeeCode LIKE '%' + @Search + '%' OR
          u.FullName LIKE N'%' + @Search + N'%' OR
          e.Position LIKE N'%' + @Search + N'%'
      );

    SELECT * 
    FROM #TempDailyAttendance
    ORDER BY 
        CASE WHEN AttendanceStatus = 'absent' THEN 1 ELSE 0 END,
        ScheduledStartTime ASC, 
        EmployeeCode ASC;

    SELECT 
        @WorkDate AS WorkDate,
        COUNT(*) AS TotalScheduled,
        ISNULL(SUM(CASE WHEN AttendanceStatus = 'on_time' THEN 1 ELSE 0 END), 0) AS TotalOnTime,
        ISNULL(SUM(CASE WHEN AttendanceStatus = 'late' OR AttendanceStatus = 'early_leave' THEN 1 ELSE 0 END), 0) AS TotalLate,
        ISNULL(SUM(CASE WHEN AttendanceStatus = 'absent' THEN 1 ELSE 0 END), 0) AS TotalAbsent,
        ISNULL(SUM(WorkHours), 0.00) AS TotalWorkHours,
        ISNULL(SUM(OvertimeHours), 0.00) AS TotalOvertimeHours
    FROM #TempDailyAttendance;

    DROP TABLE #TempDailyAttendance;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_GetDailyAttendanceMonitor.';
GO

-- =======================================================================================
-- 8. THỦ TỤC XUẤT BÁO CÁO CHẤM CÔNG & ĐỐI SOÁT CHUỖI
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ExportAttendanceReport
    @FromDate           DATE,
    @ToDate             DATE,
    @BranchId           INT             = NULL,
    @CurrentUsername    VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        u.FullName,
        e.Position,
        b.BranchCode,
        b.BranchName,
        ct.ContractName,
        COUNT(DISTINCT att.WorkDate) AS TotalWorkDays,
        COUNT(DISTINCT sa.AssignmentId) AS TotalScheduledShifts,
        ISNULL(SUM(att.WorkHours), 0.00) AS TotalStandardHours,
        ISNULL(SUM(att.OvertimeHours), 0.00) AS TotalOvertimeHours,
        ISNULL(SUM(att.LateMinutes), 0) AS TotalLateMinutes,
        ISNULL(SUM(CASE WHEN att.Status = 'late' THEN 1 ELSE 0 END), 0) AS LateCount,
        ISNULL(SUM(CASE WHEN att.Status = 'early_leave' THEN 1 ELSE 0 END), 0) AS EarlyLeaveCount,
        ISNULL(SUM(CASE WHEN att.Status = 'on_time' THEN 1 ELSE 0 END), 0) AS OnTimeCount,
        ISNULL(SUM(CASE WHEN sa.AssignmentId IS NOT NULL AND att.AttendanceId IS NULL THEN 1 ELSE 0 END), 0) AS AbsentCount,
        CASE 
            WHEN COUNT(DISTINCT att.WorkDate) > 0 
            THEN CAST(ROUND((SUM(CASE WHEN att.Status = 'on_time' THEN 1.0 ELSE 0.0 END) / COUNT(DISTINCT att.WorkDate)) * 100.0, 1) AS DECIMAL(5,1))
            ELSE 0.0
        END AS OnTimeRatePercentage
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
    LEFT JOIN dbo.ShiftAssignments sa ON e.EmployeeId = sa.EmployeeId 
                                      AND sa.WorkDate BETWEEN @FromDate AND @ToDate 
                                      AND sa.Status <> 'cancelled'
    LEFT JOIN dbo.Attendances att ON e.EmployeeId = att.EmployeeId 
                                  AND att.WorkDate BETWEEN @FromDate AND @ToDate
    WHERE (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (@HasHierarchyFilter = 0 OR e.EmployeeId IN (SELECT EmployeeId FROM @AllowedEmployees))
      AND e.Status <> 'resigned'
    GROUP BY 
        e.EmployeeId, e.EmployeeCode, u.FullName, e.Position, 
        b.BranchCode, b.BranchName, ct.ContractName
    ORDER BY b.BranchCode, e.EmployeeCode;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_ExportAttendanceReport.';
GO

-- =======================================================================================
-- 9. THỦ TỤC LẤY CHI TIẾT BẢNG LƯƠNG & TÌNH TRẠNG PHÊ DUYỆT
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetPayrollPeriodDetails
    @PeriodMonth        VARCHAR(7),
    @BranchId           INT             = NULL,
    @Status             VARCHAR(20)     = NULL,
    @Search             NVARCHAR(100)   = NULL,
    @CurrentUsername    VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    DECLARE @PeriodId INT;
    SELECT TOP 1 @PeriodId = PeriodId
    FROM dbo.PayrollPeriods
    WHERE PeriodMonth = @PeriodMonth 
      AND (@BranchId IS NULL OR BranchId = @BranchId OR BranchId IS NULL)
    ORDER BY BranchId DESC;

    SELECT 
        p.PeriodId,
        p.PeriodMonth,
        p.BranchId,
        b.BranchName,
        p.Status,
        p.IsLocked,
        p.TotalEmployees,
        p.TotalNetPay,
        p.ApprovedBy,
        p.ApprovedAt,
        p.CreatedAt
    FROM dbo.PayrollPeriods p
    LEFT JOIN dbo.Branches b ON p.BranchId = b.BranchId
    WHERE p.PeriodId = @PeriodId;

    SELECT 
        s.SlipId,
        s.PeriodId,
        s.EmployeeId,
        e.EmployeeCode,
        u.FullName,
        e.Position,
        b.BranchCode,
        b.BranchName,
        ct.ContractCode,
        ct.ContractName,
        s.HourlyRate,
        s.StandardHours,
        s.OvertimeHours,
        s.BasePay,
        s.OvertimePay,
        s.Allowance,
        s.Deduction,
        s.Advance,
        s.NetPay,
        s.Status AS SlipStatus,
        e.BankName,
        e.BankAccountNumber,
        e.BankAccountName,
        s.CreatedAt
    FROM dbo.PayrollSlips s
    INNER JOIN dbo.Employees e ON s.EmployeeId = e.EmployeeId
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
    WHERE s.PeriodId = @PeriodId
      AND (@Status IS NULL OR @Status = 'all' OR s.Status = @Status)
      AND (@HasHierarchyFilter = 0 OR s.EmployeeId IN (SELECT EmployeeId FROM @AllowedEmployees))
      AND (
          @Search IS NULL OR LTRIM(RTRIM(@Search)) = '' OR
          e.EmployeeCode LIKE '%' + @Search + '%' OR
          u.FullName LIKE N'%' + @Search + N'%' OR
          e.Position LIKE N'%' + @Search + N'%'
      )
    ORDER BY b.BranchCode, e.EmployeeCode;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_GetPayrollPeriodDetails.';
GO

-- =======================================================================================
-- 10. THỦ TỤC THÊM HOẶC CẬP NHẬT CA MẪU
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpsertShiftTemplate
    @TemplateId         INT             = NULL OUTPUT,
    @ShiftCode          VARCHAR(20),
    @ShiftName          NVARCHAR(100),
    @StartTime          TIME(0),
    @EndTime            TIME(0),
    @BreakMinutes       INT             = 0,
    @StandardHours      DECIMAL(4,2)    = NULL,
    @ColorCode          VARCHAR(20)     = 'emerald',
    @IsActive           BIT             = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @StandardHours IS NULL OR @StandardHours <= 0
    BEGIN
        DECLARE @TotalMins INT = DATEDIFF(MINUTE, @StartTime, @EndTime);
        IF @TotalMins <= 0
            SET @TotalMins = @TotalMins + 1440;
        
        SET @TotalMins = @TotalMins - ISNULL(@BreakMinutes, 0);
        SET @StandardHours = CAST(ROUND(@TotalMins / 60.0, 2) AS DECIMAL(4,2));
    END

    IF @TemplateId IS NULL OR @TemplateId = 0
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = @ShiftCode)
        BEGIN
            RAISERROR(N'Mã ca làm việc %s đã tồn tại trên hệ thống.', 16, 1, @ShiftCode);
            RETURN;
        END

        INSERT INTO dbo.ShiftTemplates (
            ShiftCode, ShiftName, StartTime, EndTime, BreakMinutes, StandardHours, ColorCode, IsActive, CreatedAt
        )
        VALUES (
            @ShiftCode, @ShiftName, @StartTime, @EndTime, ISNULL(@BreakMinutes, 0), @StandardHours, @ColorCode, @IsActive, SYSDATETIME()
        );

        SET @TemplateId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE TemplateId = @TemplateId)
        BEGIN
            RAISERROR(N'Không tìm thấy ca làm việc có TemplateId = %d.', 16, 1, @TemplateId);
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM dbo.ShiftTemplates WHERE ShiftCode = @ShiftCode AND TemplateId <> @TemplateId)
        BEGIN
            RAISERROR(N'Mã ca %s đang được sử dụng bởi một ca mẫu khác.', 16, 1, @ShiftCode);
            RETURN;
        END

        UPDATE dbo.ShiftTemplates
        SET ShiftCode = @ShiftCode,
            ShiftName = @ShiftName,
            StartTime = @StartTime,
            EndTime = @EndTime,
            BreakMinutes = ISNULL(@BreakMinutes, 0),
            StandardHours = @StandardHours,
            ColorCode = @ColorCode,
            IsActive = @IsActive
        WHERE TemplateId = @TemplateId;
    END
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_UpsertShiftTemplate.';
GO

-- =======================================================================================
-- 11. THỦ TỤC XUẤT MA TRẬN PHÂN CA TUẦN RA EXCEL
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ExportWeeklySchedule
    @BranchId           INT,
    @StartDate          DATE,
    @EndDate            DATE,
    @CurrentUsername    VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    DECLARE @D1 DATE = @StartDate;
    DECLARE @D2 DATE = DATEADD(DAY, 1, @StartDate);
    DECLARE @D3 DATE = DATEADD(DAY, 2, @StartDate);
    DECLARE @D4 DATE = DATEADD(DAY, 3, @StartDate);
    DECLARE @D5 DATE = DATEADD(DAY, 4, @StartDate);
    DECLARE @D6 DATE = DATEADD(DAY, 5, @StartDate);
    DECLARE @D7 DATE = DATEADD(DAY, 6, @StartDate);

    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        u.FullName,
        e.Position,
        b.BranchCode,
        b.BranchName,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D1 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Monday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D2 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Tuesday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D3 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Wednesday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D4 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Thursday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D5 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Friday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D6 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Saturday_Schedule,
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D7 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Sunday_Schedule,
        COUNT(sa.AssignmentId) AS TotalShiftsScheduled,
        ISNULL(SUM(st.StandardHours), 0.00) AS TotalScheduledHours
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ShiftAssignments sa ON e.EmployeeId = sa.EmployeeId 
                                      AND sa.WorkDate BETWEEN @StartDate AND @EndDate 
                                      AND sa.Status <> 'cancelled'
    LEFT JOIN dbo.ShiftTemplates st ON sa.TemplateId = st.TemplateId
    WHERE e.BranchId = @BranchId
      AND e.Status <> 'resigned'
      AND (@HasHierarchyFilter = 0 OR e.EmployeeId IN (SELECT EmployeeId FROM @AllowedEmployees))
    GROUP BY e.EmployeeId, e.EmployeeCode, u.FullName, e.Position, b.BranchCode, b.BranchName
    ORDER BY e.EmployeeCode;
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_ExportWeeklySchedule.';
GO

-- =======================================================================================
-- 12. THỦ TỤC CẬP NHẬT HỒ SƠ NHÂN SỰ TOÀN DIỆN
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpdateEmployeeProfile
    @EmployeeId             INT,
    @FullName               NVARCHAR(100)   = NULL,
    @PhoneNumber            VARCHAR(20)     = NULL,
    @Email                  VARCHAR(100)    = NULL,
    @DateOfBirth            DATE            = NULL,
    @Gender                 VARCHAR(10)     = NULL,
    @CitizenId              VARCHAR(20)     = NULL,
    @BankName               NVARCHAR(100)   = NULL,
    @BankAccountNumber      VARCHAR(50)     = NULL,
    @BankAccountName        NVARCHAR(100)   = NULL,
    @ContractTypeId         INT             = NULL,
    @HourlyRate             DECIMAL(18,2)   = NULL,
    @Allowance              DECIMAL(18,2)   = NULL,
    @Note                   NVARCHAR(500)   = NULL,
    @Status                 VARCHAR(20)     = NULL,
    @Position               NVARCHAR(50)    = NULL,
    @BranchId               INT             = NULL,
    @UpdatedByUsername      VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    IF @UserId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Không tìm thấy nhân sự có EmployeeId = %d.', 16, 1, @EmployeeId);
        RETURN;
    END

    UPDATE dbo.Employees
    SET Position = ISNULL(@Position, Position),
        BranchId = ISNULL(@BranchId, BranchId),
        HourlyRate = ISNULL(@HourlyRate, HourlyRate),
        ContractTypeId = ISNULL(@ContractTypeId, ContractTypeId),
        CitizenId = ISNULL(@CitizenId, CitizenId),
        BankName = ISNULL(@BankName, BankName),
        BankAccountNumber = ISNULL(@BankAccountNumber, BankAccountNumber),
        BankAccountName = ISNULL(@BankAccountName, BankAccountName),
        DateOfBirth = ISNULL(@DateOfBirth, DateOfBirth),
        Gender = ISNULL(@Gender, Gender),
        Note = ISNULL(@Note, Note),
        Status = ISNULL(@Status, Status),
        UpdatedAt = SYSDATETIME()
    WHERE EmployeeId = @EmployeeId;

    UPDATE dbo.Users
    SET FullName = ISNULL(@FullName, FullName),
        PhoneNumber = ISNULL(@PhoneNumber, PhoneNumber),
        Email = ISNULL(@Email, Email)
    WHERE UserId = @UserId;

    IF @ContractTypeId IS NOT NULL OR @HourlyRate IS NOT NULL OR @Allowance IS NOT NULL
    BEGIN
        UPDATE dbo.EmployeeContracts
        SET ContractTypeId = ISNULL(@ContractTypeId, ContractTypeId),
            HourlyRate = ISNULL(@HourlyRate, HourlyRate),
            Allowance = ISNULL(@Allowance, Allowance),
            UpdatedAt = SYSDATETIME()
        WHERE EmployeeId = @EmployeeId AND Status = 'active';
    END

    COMMIT TRANSACTION;
    PRINT N'-> Đã cập nhật thành công hồ sơ nhân sự ID: ' + CAST(@EmployeeId AS NVARCHAR(10));
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_UpdateEmployeeProfile.';
GO

-- =======================================================================================
-- 13. THỦ TỤC GÁN VÀ PHÂN CẤP THẨM QUYỀN PHÊ DUYỆT (LEVEL 1..5)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AssignApprovalAuthority
    @EmployeeId                 INT,
    @ApprovalLevel              TINYINT,
    @BranchId                   INT             = NULL,
    @ParentApproverEmployeeId   INT             = NULL,
    @WorkflowCode               VARCHAR(50)     = NULL,
    @GrantedByUsername          VARCHAR(50),
    @Note                       NVARCHAR(255)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    IF @ApprovalLevel NOT BETWEEN 1 AND 5
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Cấp độ phê duyệt không hợp lệ: Phải nằm trong khoảng từ Cấp 1 đến Cấp 5.', 16, 1);
        RETURN;
    END

    DECLARE @GrantorLevel TINYINT = 1;
    SELECT TOP 1 @GrantorLevel = dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId)
    FROM dbo.Users u
    INNER JOIN dbo.Employees e ON u.UserId = e.UserId
    WHERE u.Username = @GrantedByUsername;

    IF @GrantorLevel < 5 AND @GrantorLevel < @ApprovalLevel
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Vi phạm thẩm quyền: Tài khoản %s có thẩm quyền Cấp %d, không thể trao quyền Cấp %d cho nhân sự.', 16, 1, @GrantedByUsername, @GrantorLevel, @ApprovalLevel);
        RETURN;
    END

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    IF @UserId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Không tìm thấy hồ sơ nhân sự có ID = %d.', 16, 1, @EmployeeId);
        RETURN;
    END

    DECLARE @TargetRoleId INT = CASE 
        WHEN @ApprovalLevel = 5 THEN 1
        WHEN @ApprovalLevel = 4 THEN 2
        WHEN @ApprovalLevel = 3 THEN 3
        WHEN @ApprovalLevel = 2 THEN 6
        ELSE 5
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = @TargetRoleId)
    BEGIN
        DELETE FROM dbo.UserRoles WHERE UserId = @UserId;
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @TargetRoleId);
    END

    DECLARE @ParentApproverId INT = NULL;
    IF @ParentApproverEmployeeId IS NOT NULL
    BEGIN
        SELECT TOP 1 @ParentApproverId = ApproverId 
        FROM dbo.Approvers 
        WHERE EmployeeId = @ParentApproverEmployeeId AND IsActive = 1;

        IF @ParentApproverId IS NULL
        BEGIN
            DECLARE @ParentLevel TINYINT = dbo.fn_Sys_GetEmployeeHierarchyLevel(@ParentApproverEmployeeId);
            INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, AssignedDate, Note)
            VALUES (@ParentApproverEmployeeId, NULL, @ParentLevel, NULL, NULL, 1, CAST(GETDATE() AS DATE), N'Tự động sinh Approver quản lý');
            SET @ParentApproverId = SCOPE_IDENTITY();
        END
    END

    IF EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @EmployeeId)
    BEGIN
        UPDATE dbo.Approvers
        SET ApprovalLevel = @ApprovalLevel,
            BranchId = @BranchId,
            ParentApproverId = @ParentApproverId,
            WorkflowCode = @WorkflowCode,
            IsActive = 1,
            AssignedDate = CAST(GETDATE() AS DATE),
            Note = ISNULL(@Note, N'Cập nhật cấp phê duyệt bởi ' + @GrantedByUsername)
        WHERE EmployeeId = @EmployeeId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Approvers (
            EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, AssignedDate, Note
        )
        VALUES (
            @EmployeeId, @BranchId, @ApprovalLevel, @ParentApproverId, @WorkflowCode, 1, CAST(GETDATE() AS DATE), 
            ISNULL(@Note, N'Trao quyền thẩm quyền bởi ' + @GrantedByUsername)
        );
    END

    COMMIT TRANSACTION;
    PRINT N'-> Đã gán thành công Cấp duyệt ' + CAST(@ApprovalLevel AS NVARCHAR(2)) + N' cho Nhân viên ID: ' + CAST(@EmployeeId AS NVARCHAR(10));
END;
GO
PRINT N'-> Đã tạo thủ tục sp_HRM_AssignApprovalAuthority.';
GO

PRINT N'>>> HOÀN TẤT TẠO STORED PROCEDURES CHO MODULE HRM THÀNH CÔNG 100%! <<<';
GO
