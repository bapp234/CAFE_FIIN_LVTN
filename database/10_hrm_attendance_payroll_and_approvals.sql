-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- RELEASE 10: TỔNG HỢP ROUTINES, PROCEDURES, FUNCTIONS & TRIGGERS CHO HRM
-- CÁC PHÂN HỆ:
--   1. CHẤM CÔNG & XUẤT BÁO CÁO CÔNG NGÀY / ĐỐI SOÁT
--   2. BẢNG LƯƠNG & TÍNH TOÁN LƯƠNG (GIỜ THỰC TẾ + OT x1.5 + PHỤ CẤP + KHẤU TRỪ)
--   3. CA LÀM VIỆC: THÊM CA MẪU & XUẤT EXCEL MA TRẬN PHÂN CA TUẦN
--   4. HỒ SƠ NHÂN SỰ: CẬP NHẬT TOÀN DIỆN & PHÂN CẤP THẨM QUYỀN PHÊ DUYỆT (LEVEL 1..5)
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- Database: CoffeeShopDB
-- File: src/database/10_hrm_attendance_payroll_and_approvals.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 10: CHẤM CÔNG, BẢNG LƯƠNG, CA MẪU & CẤP DUYỆT HỒ SƠ NHÂN SỰ';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 0: NÂNG CẤP BẢO TOÀN DỮ LIỆU & RÀNG BUỘC PHÂN CẤP THẨM QUYỀN (LEVEL 1..5)
-- =======================================================================================

-- 0.1 Nâng cấp ràng buộc ApprovalLevel trên bảng Approvers cho phép từ 1 đến 5 cấp
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Approvers')
BEGIN
    DECLARE @ConstraintName NVARCHAR(200);
    SELECT @ConstraintName = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.Approvers') AND definition LIKE '%ApprovalLevel%';

    IF @ConstraintName IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.Approvers DROP CONSTRAINT ' + @ConstraintName);
        PRINT N'-> Đã gỡ bỏ ràng buộc cũ của ApprovalLevel trên bảng Approvers.';
    END

    ALTER TABLE dbo.Approvers 
    ADD CONSTRAINT CK_Approvers_ApprovalLevel CHECK (ApprovalLevel BETWEEN 1 AND 5);
    PRINT N'-> Đã thiết lập ràng buộc chuẩn CK_Approvers_ApprovalLevel: Cấp 1 đến Cấp 5.';
END
GO

-- 0.2 Đảm bảo bảng Attendances có đầy đủ chỉ mục phục vụ truy vấn tốc độ cao
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Attendances_Date_Status' AND object_id = OBJECT_ID('dbo.Attendances'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_Attendances_Date_Status 
    ON dbo.Attendances(WorkDate, Status) 
    INCLUDE (EmployeeId, CheckInTime, CheckOutTime, WorkHours, OvertimeHours, LateMinutes);
    PRINT N'-> Đã tạo chỉ mục tối ưu IX_Attendances_Date_Status.';
END
GO

-- =======================================================================================
-- PHẦN 1: PHÂN HỆ CHẤM CÔNG & XUẤT BÁO CÁO CÔNG
-- =======================================================================================

-- 1.1 Stored Procedure: Lấy danh sách chấm công ngày & Đối soát với lịch phân ca
-- Thủ tục: dbo.sp_HRM_GetDailyAttendanceMonitor
-- Hỗ trợ phân quyền cây phả hệ (fn_HRM_GetAccessibleEmployees), lọc chi nhánh, tìm kiếm và thống kê KPI
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetDailyAttendanceMonitor
    @WorkDate           DATE            = NULL,
    @BranchId           INT             = NULL,
    @Status             VARCHAR(20)     = NULL, -- 'all', 'on_time', 'late', 'early_leave', 'absent'
    @Search             NVARCHAR(100)   = NULL,
    @CurrentUsername    VARCHAR(50)     = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu không truyền WorkDate, mặc định là ngày hôm nay
    SET @WorkDate = ISNULL(@WorkDate, CAST(SYSDATETIME() AS DATE));

    -- Lấy danh sách nhân viên người dùng có quyền tiếp cận theo cây phả hệ
    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    -- Bảng tạm chứa danh sách hợp nhất giữa Ca đăng ký trước (ShiftAssignments) và Thực tế quẹt vân tay (Attendances)
    ;WITH DailyUnion AS (
        -- Trường hợp 1: Có lịch đăng ký phân ca trước (ShiftAssignments)
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
            CASE 
                WHEN att.AttendanceId IS NULL THEN 'absent'
                ELSE att.Status
            END AS AttendanceStatus,
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

        -- Trường hợp 2: Quẹt thẻ phát sinh thực tế nhưng không có lịch đăng ký trước
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

    -- RESULT SET 1: Danh sách chi tiết bảng chấm công
    SELECT * 
    FROM #TempDailyAttendance
    ORDER BY 
        CASE WHEN AttendanceStatus = 'absent' THEN 1 ELSE 0 END,
        ScheduledStartTime ASC, 
        EmployeeCode ASC;

    -- RESULT SET 2: Thống kê KPI ngày (DevExtreme Cards)
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_GetDailyAttendanceMonitor.';
GO

-- 1.2 Stored Procedure: Xuất báo cáo chấm công & đối soát chuỗi (Export Report)
-- Thủ tục: dbo.sp_HRM_ExportAttendanceReport
-- Tổng hợp số ngày công, tổng giờ chuẩn, OT, đi muộn và tỷ lệ chuyên cần theo khoảng ngày
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_ExportAttendanceReport.';
GO

-- 1.3 Trigger kiểm soát tính toàn vẹn và tự động tính toán dữ liệu Chấm công
-- Trigger: dbo.trg_Attendances_AutoCalculateAndAudit
CREATE OR ALTER TRIGGER dbo.trg_Attendances_AutoCalculateAndAudit
ON dbo.Attendances
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra logic: Giờ check-out không được xảy ra trước giờ check-in
    IF EXISTS (
        SELECT 1 FROM inserted 
        WHERE CheckInTime IS NOT NULL 
          AND CheckOutTime IS NOT NULL 
          AND CheckOutTime < CheckInTime
    )
    BEGIN
        RAISERROR(N'Lỗi dữ liệu: Thời điểm Check-out không được sớm hơn thời điểm Check-in.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    -- Tự động ghi nhận ngày giờ Audit nếu được điều chỉnh thủ công
    IF UPDATE(IsManualAdjusted) OR UPDATE(CheckInTime) OR UPDATE(CheckOutTime)
    BEGIN
        UPDATE att
        SET AdjustedAt = SYSDATETIME()
        FROM dbo.Attendances att
        INNER JOIN inserted i ON att.AttendanceId = i.AttendanceId
        WHERE i.IsManualAdjusted = 1 AND i.AdjustedAt IS NULL;
    END
END;
GO
PRINT N'-> Đã tạo Trigger: dbo.trg_Attendances_AutoCalculateAndAudit.';
GO

-- =======================================================================================
-- PHẦN 2: PHÂN HỆ BẢNG LƯƠNG & TÍNH TOÁN LƯƠNG
-- =======================================================================================

-- 2.1 Stored Procedure: Lấy chi tiết bảng lương tháng & Tình trạng phê duyệt
-- Thủ tục: dbo.sp_HRM_GetPayrollPeriodDetails
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetPayrollPeriodDetails
    @PeriodMonth        VARCHAR(7),     -- 'YYYY-MM' (ví dụ: '2026-11')
    @BranchId           INT             = NULL,
    @Status             VARCHAR(20)     = NULL, -- 'draft', 'approved', 'paid'
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

    -- Lấy thông tin kỳ lương
    DECLARE @PeriodId INT;
    SELECT TOP 1 @PeriodId = PeriodId
    FROM dbo.PayrollPeriods
    WHERE PeriodMonth = @PeriodMonth 
      AND (@BranchId IS NULL OR BranchId = @BranchId OR BranchId IS NULL)
    ORDER BY BranchId DESC; -- Ưu tiên kỳ theo branch nếu có

    -- RESULT SET 1: Thông tin tổng quan kỳ lương (Header)
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

    -- RESULT SET 2: Danh sách phiếu lương chi tiết từng nhân viên
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_GetPayrollPeriodDetails.';
GO

-- 2.2 Stored Procedure: Tự động tính toán lương tháng toàn diện
-- Thủ tục: dbo.sp_HRM_CalculatePayroll (Nâng cấp)
-- Tính năng:
--   - Giờ thực tế từ bảng chấm công
--   - OvertimePay = OT * (HourlyRate * 1.5)
--   - Khấu trừ phạt đi muộn (nếu trễ > 30 phút tính phạt theo bậc)
--   - Lấy phụ cấp từ hợp đồng chính thức
--   - Bao bọc trong Transaction toàn vẹn dữ liệu
CREATE OR ALTER PROCEDURE dbo.sp_HRM_CalculatePayroll
    @PeriodMonth        VARCHAR(7),        -- 'YYYY-MM'
    @BranchId           INT             = NULL,
    @CalculatedBy       NVARCHAR(100)   = N'Hệ thống',
    @PeriodId           INT             OUTPUT
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
      AND ((BranchId IS NULL AND @BranchId IS NULL) OR BranchId = @BranchId);

    IF @IsLocked = 1
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Kỳ lương %s đã được phê duyệt và chính thức khóa sổ. Không thể tính toán lại.', 16, 1, @PeriodMonth);
        RETURN;
    END

    -- 2. Tạo mới hoặc tái sử dụng PeriodId
    IF @ExistingPeriodId IS NULL
    BEGIN
        INSERT INTO dbo.PayrollPeriods (PeriodMonth, BranchId, Status, IsLocked, CreatedAt)
        VALUES (@PeriodMonth, @BranchId, 'draft', 0, SYSDATETIME());

        SET @PeriodId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        SET @PeriodId = @ExistingPeriodId;
        -- Xóa các phiếu lương cũ đang ở trạng thái draft để tính lại chính xác
        DELETE FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId;
    END

    -- 3. Quét danh sách nhân viên và tính toán phiếu lương
    INSERT INTO dbo.PayrollSlips (
        PeriodId, EmployeeId, HourlyRate, StandardHours, OvertimeHours,
        BasePay, OvertimePay, Allowance, Deduction, Advance, NetPay, Status, CreatedAt
    )
    SELECT 
        @PeriodId,
        e.EmployeeId,
        -- Mức lương giờ (ưu tiên EmployeeContracts -> Employees -> ContractTypes -> Mặc định 25.000đ)
        COALESCE(ec.HourlyRate, e.HourlyRate, ct.StandardHourlyRate, 25000.00) AS HourlyRate,

        -- Giờ làm việc tiêu chuẩn
        ISNULL(ts.TotalStandardHours, 
            CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END
        ) AS StandardHours,

        -- Giờ tăng ca (OT)
        ISNULL(ts.TotalOvertimeHours, 0.00) AS OvertimeHours,

        -- Lương cơ bản = Giờ chuẩn * Lương giờ
        ISNULL(ts.TotalStandardHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) 
        * COALESCE(ec.HourlyRate, e.HourlyRate, ct.StandardHourlyRate, 25000.00) AS BasePay,

        -- Lương tăng ca = Giờ OT * Lương giờ * 1.5 (Hệ số OT luật định)
        ISNULL(ts.TotalOvertimeHours, 0.00) 
        * (COALESCE(ec.HourlyRate, e.HourlyRate, ct.StandardHourlyRate, 25000.00) * 1.5) AS OvertimePay,

        -- Phụ cấp trách nhiệm / ăn ca
        COALESCE(ec.Allowance, ct.Allowance, CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END) AS Allowance,

        -- Khấu trừ phạt đi muộn (nếu tổng trễ > 30 phút, phạt 50.000đ mỗi block 30 phút)
        CASE 
            WHEN ISNULL(ts.TotalLateMinutes, 0) > 30 
            THEN CAST((ts.TotalLateMinutes / 30) * 50000.00 AS DECIMAL(18,2))
            ELSE 0.00 
        END AS Deduction,

        -- Tạm ứng lương
        0.00 AS Advance,

        -- Lương thực lĩnh = Lương cơ bản + Lương OT + Phụ cấp - Khấu trừ - Tạm ứng
        (
            (ISNULL(ts.TotalStandardHours, CASE WHEN e.ContractType = 'full_time' THEN 140.00 ELSE 70.00 END) 
             * COALESCE(ec.HourlyRate, e.HourlyRate, ct.StandardHourlyRate, 25000.00))
            + (ISNULL(ts.TotalOvertimeHours, 0.00) 
               * (COALESCE(ec.HourlyRate, e.HourlyRate, ct.StandardHourlyRate, 25000.00) * 1.5))
            + COALESCE(ec.Allowance, ct.Allowance, CASE WHEN e.ContractType = 'full_time' THEN 1000000.00 ELSE 300000.00 END)
            - (CASE WHEN ISNULL(ts.TotalLateMinutes, 0) > 30 THEN CAST((ts.TotalLateMinutes / 30) * 50000.00 AS DECIMAL(18,2)) ELSE 0.00 END)
        ) AS NetPay,

        'draft',
        SYSDATETIME()
    FROM dbo.Employees e
    LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
    LEFT JOIN dbo.EmployeeContracts ec ON e.EmployeeId = ec.EmployeeId AND ec.Status = 'active'
    OUTER APPLY dbo.tvf_HRM_GetEmployeeMonthlyTimesheet(e.EmployeeId, @PeriodMonth) ts
    WHERE e.Status <> 'resigned'
      AND (@BranchId IS NULL OR e.BranchId = @BranchId);

    -- 4. Cập nhật thống kê quỹ lương vào PayrollPeriods
    UPDATE dbo.PayrollPeriods
    SET TotalEmployees = (SELECT COUNT(*) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId),
        TotalNetPay = ISNULL((SELECT SUM(NetPay) FROM dbo.PayrollSlips WHERE PeriodId = @PeriodId), 0.00),
        Status = 'draft'
    WHERE PeriodId = @PeriodId;

    COMMIT TRANSACTION;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_CalculatePayroll (Nâng cấp).';
GO

-- 2.3 Trigger bảo vệ bảng lương: Chống chỉnh sửa khi kỳ lương đã bị khóa sổ
-- Trigger: dbo.trg_PayrollSlips_PreventUpdateWhenLocked
CREATE OR ALTER TRIGGER dbo.trg_PayrollSlips_PreventUpdateWhenLocked
ON dbo.PayrollSlips
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM dbo.PayrollPeriods p
        INNER JOIN (
            SELECT PeriodId FROM deleted
            UNION
            SELECT PeriodId FROM inserted
        ) modified ON p.PeriodId = modified.PeriodId
        WHERE p.IsLocked = 1
    )
    BEGIN
        RAISERROR(N'Nghiêm cấm chỉnh sửa hoặc xóa phiếu lương: Kỳ tính lương đã được phê duyệt và chính thức khóa sổ kiểm toán.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO
PRINT N'-> Đã tạo Trigger: dbo.trg_PayrollSlips_PreventUpdateWhenLocked.';
GO

-- =======================================================================================
-- PHẦN 3: PHÂN HỆ CA LÀM VIỆC (THÊM CA MẪU & XUẤT MA TRẬN CA TUẦN EXCEL)
-- =======================================================================================

-- 3.1 Stored Procedure: Thêm mới hoặc Cập nhật ca mẫu (Shift Template Upsert)
-- Thủ tục: dbo.sp_HRM_UpsertShiftTemplate
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

    -- Tự động tính số giờ chuẩn nếu người dùng để trống
    IF @StandardHours IS NULL OR @StandardHours <= 0
    BEGIN
        DECLARE @TotalMins INT = DATEDIFF(MINUTE, @StartTime, @EndTime);
        IF @TotalMins <= 0
            SET @TotalMins = @TotalMins + 1440; -- Ca đêm vắt qua ngày (24h * 60m)
        
        SET @TotalMins = @TotalMins - ISNULL(@BreakMinutes, 0);
        SET @StandardHours = CAST(ROUND(@TotalMins / 60.0, 2) AS DECIMAL(4,2));
    END

    -- Kiểm tra nếu là Thêm mới (@TemplateId IS NULL)
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
        -- Cập nhật ca mẫu hiện có
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_UpsertShiftTemplate.';
GO

-- 3.2 Stored Procedure: Xuất ma trận lịch phân ca tuần ra Excel
-- Thủ tục: dbo.sp_HRM_ExportWeeklySchedule
-- Tạo bảng Pivot 7 ngày trong tuần: Thứ 2 đến Chủ nhật, tổng số ca và tổng số giờ kế hoạch
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ExportWeeklySchedule
    @BranchId           INT,
    @StartDate          DATE,           -- Thứ 2 đầu tuần
    @EndDate            DATE,           -- Chủ nhật cuối tuần
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

    -- Ngày cụ thể trong tuần
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

        -- Thứ Hai (@D1)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D1 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Monday_Schedule,

        -- Thứ Ba (@D2)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D2 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Tuesday_Schedule,

        -- Thứ Tư (@D3)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D3 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Wednesday_Schedule,

        -- Thứ Năm (@D4)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D4 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Thursday_Schedule,

        -- Thứ Sáu (@D5)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D5 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Friday_Schedule,

        -- Thứ Bảy (@D6)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D6 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Saturday_Schedule,

        -- Chủ Nhật (@D7)
        ISNULL(MAX(CASE WHEN sa.WorkDate = @D7 THEN st.ShiftName + ' (' + CONVERT(VARCHAR(5), st.StartTime, 108) + '-' + CONVERT(VARCHAR(5), st.EndTime, 108) + ')' END), N'-') AS Sunday_Schedule,

        -- Tổng số ca xếp trong tuần
        COUNT(sa.AssignmentId) AS TotalShiftsScheduled,

        -- Tổng số giờ làm dự kiến
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_ExportWeeklySchedule.';
GO

-- 3.3 Trigger chống xếp trùng hoặc chồng lấn thời gian ca làm việc
-- Trigger: dbo.trg_ShiftAssignments_PreventOverlap
CREATE OR ALTER TRIGGER dbo.trg_ShiftAssignments_PreventOverlap
ON dbo.ShiftAssignments
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1
        FROM inserted i
        INNER JOIN dbo.ShiftTemplates t1 ON i.TemplateId = t1.TemplateId
        INNER JOIN dbo.ShiftAssignments sa ON i.EmployeeId = sa.EmployeeId 
                                           AND i.WorkDate = sa.WorkDate 
                                           AND i.AssignmentId <> sa.AssignmentId
                                           AND sa.Status <> 'cancelled'
        INNER JOIN dbo.ShiftTemplates t2 ON sa.TemplateId = t2.TemplateId
        WHERE i.Status <> 'cancelled'
          AND (
              -- Ca 1 bắt đầu trong khoảng giờ của Ca 2
              (t1.StartTime >= t2.StartTime AND t1.StartTime < t2.EndTime)
              OR
              -- Ca 1 kết thúc trong khoảng giờ của Ca 2
              (t1.EndTime > t2.StartTime AND t1.EndTime <= t2.EndTime)
              OR
              -- Ca 1 bao trùm toàn bộ Ca 2
              (t1.StartTime <= t2.StartTime AND t1.EndTime >= t2.EndTime)
          )
    )
    BEGIN
        RAISERROR(N'Xung đột ca làm việc: Nhân sự này đã có ca làm việc khác bị chồng lấn thời gian trong cùng ngày.', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO
PRINT N'-> Đã tạo Trigger: dbo.trg_ShiftAssignments_PreventOverlap.';
GO

-- =======================================================================================
-- PHẦN 4: HỒ SƠ NHÂN SỰ & PHÂN CẤP THẨM QUYỀN PHÊ DUYỆT (LEVEL 1..5)
-- =======================================================================================

-- 4.1 Stored Procedure: Cập nhật hồ sơ nhân sự toàn diện
-- Thủ tục: dbo.sp_HRM_UpdateEmployeeProfile
-- Cập nhật đồng bộ: Employees, Users (FullName, Phone, Email), và EmployeeContracts
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

    -- 1. Kiểm tra tồn tại nhân viên
    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    IF @UserId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Không tìm thấy nhân sự có EmployeeId = %d.', 16, 1, @EmployeeId);
        RETURN;
    END

    -- 2. Cập nhật bảng Employees
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

    -- 3. Đồng bộ họ tên, điện thoại, email sang bảng Users
    UPDATE dbo.Users
    SET FullName = ISNULL(@FullName, FullName),
        PhoneNumber = ISNULL(@PhoneNumber, PhoneNumber),
        Email = ISNULL(@Email, Email)
    WHERE UserId = @UserId;

    -- 4. Đồng bộ hoặc cập nhật hợp đồng lao động đang hoạt động (EmployeeContracts)
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_UpdateEmployeeProfile.';
GO

-- 4.2 Stored Procedure: Gán và Phân cấp thẩm quyền phê duyệt cho nhân viên (Level 1..5)
-- Thủ tục: dbo.sp_HRM_AssignApprovalAuthority
-- Đảm bảo an toàn:
--   - Người trao quyền phải có cấp >= cấp muốn gán
--   - Tự động đồng bộ bảng Roles & UserRoles
--   - Cập nhật ma trận bảng Approvers & Người duyệt trực tiếp (ParentApproverId)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AssignApprovalAuthority
    @EmployeeId                 INT,
    @ApprovalLevel              TINYINT,        -- 1..5
    @BranchId                   INT             = NULL, -- NULL = Toàn hệ thống
    @ParentApproverEmployeeId   INT             = NULL, -- Quản lý cấp trên trực tiếp
    @WorkflowCode               VARCHAR(50)     = NULL, -- NULL = Áp dụng tất cả quy trình
    @GrantedByUsername          VARCHAR(50),
    @Note                       NVARCHAR(255)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    -- 1. Kiểm tra tính hợp lệ của cấp bậc (1..5)
    IF @ApprovalLevel NOT BETWEEN 1 AND 5
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Cấp độ phê duyệt không hợp lệ: Phải nằm trong khoảng từ Cấp 1 đến Cấp 5.', 16, 1);
        RETURN;
    END

    -- 2. Kiểm tra thẩm quyền của người thực hiện trao quyền
    DECLARE @GrantorLevel TINYINT = 1;
    SELECT TOP 1 @GrantorLevel = dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId)
    FROM dbo.Users u
    INNER JOIN dbo.Employees e ON u.UserId = e.UserId
    WHERE u.Username = @GrantedByUsername;

    -- Chỉ có Admin (Level 5) hoặc cấp trên có Level >= ApprovalLevel mới được trao quyền
    IF @GrantorLevel < 5 AND @GrantorLevel < @ApprovalLevel
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Vi phạm thẩm quyền: Tài khoản %s có thẩm quyền Cấp %d, không thể trao quyền Cấp %d cho nhân sự.', 16, 1, @GrantedByUsername, @GrantorLevel, @ApprovalLevel);
        RETURN;
    END

    -- 3. Kiểm tra tồn tại nhân viên được trao quyền
    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    IF @UserId IS NULL
    BEGIN
        ROLLBACK TRANSACTION;
        RAISERROR(N'Không tìm thấy hồ sơ nhân sự có ID = %d.', 16, 1, @EmployeeId);
        RETURN;
    END

    -- 4. Xác định RoleId tương ứng với ApprovalLevel để đồng bộ UserRoles
    --   Level 5 -> RoleId 1 (Admin)
    --   Level 4 -> RoleId 2 (HRManager)
    --   Level 3 -> RoleId 3 (StoreManager)
    --   Level 2 -> RoleId 6 (ShiftLeader)
    --   Level 1 -> RoleId 5 (Barista)
    DECLARE @TargetRoleId INT = CASE 
        WHEN @ApprovalLevel = 5 THEN 1
        WHEN @ApprovalLevel = 4 THEN 2
        WHEN @ApprovalLevel = 3 THEN 3
        WHEN @ApprovalLevel = 2 THEN 6
        ELSE 5
    END;

    -- Đồng bộ bảng UserRoles
    IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = @TargetRoleId)
    BEGIN
        -- Xóa các vai trò cũ cùng phân cấp vận hành nếu có
        DELETE FROM dbo.UserRoles WHERE UserId = @UserId;
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @TargetRoleId);
    END

    -- 5. Tìm ApproverId của người quản lý cấp trên (nếu có truyền vào)
    DECLARE @ParentApproverId INT = NULL;
    IF @ParentApproverEmployeeId IS NOT NULL
    BEGIN
        SELECT TOP 1 @ParentApproverId = ApproverId 
        FROM dbo.Approvers 
        WHERE EmployeeId = @ParentApproverEmployeeId AND IsActive = 1;

        -- Nếu cấp trên chưa có trong bảng Approvers thì tạo bản ghi cho cấp trên
        IF @ParentApproverId IS NULL
        BEGIN
            DECLARE @ParentLevel TINYINT = dbo.fn_Sys_GetEmployeeHierarchyLevel(@ParentApproverEmployeeId);
            INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, AssignedDate, Note)
            VALUES (@ParentApproverEmployeeId, NULL, @ParentLevel, NULL, NULL, 1, CAST(GETDATE() AS DATE), N'Tự động sinh Approver quản lý');
            SET @ParentApproverId = SCOPE_IDENTITY();
        END
    END

    -- 6. Cập nhật hoặc Thêm mới vào bảng Approvers
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
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_AssignApprovalAuthority.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT TRIỂN KHAI RELEASE 10 THÀNH CÔNG 100%!';
PRINT N'=======================================================================================';
GO
