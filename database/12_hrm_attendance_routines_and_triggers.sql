-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN (COFFEE SHOP MANAGEMENT SYSTEM)
-- RELEASE 12: BỘ HÀM (FUNCTIONS), TRIGGERS TỰ ĐỘNG & STORED PROCEDURE TỔNG HỢP CÔNG THÁNG
-- DATABASE: CoffeeShopDB
-- FILE: src/database/12_hrm_attendance_routines_and_triggers.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 12: FUNCTIONS, TRIGGERS & SP TỔNG HỢP BẢNG CÔNG THÁNG';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 1: FUNCTION BỔ TRỢ PHÂN LOẠI NGÀY LỄ / NGÀY NGHỈ CUỐI TUẦN
-- =======================================================================================

-- 1.1 Inline Table-Valued Function: dbo.fn_HRM_ClassifyDate
-- Nhận vào một ngày DATE, trả về: Loại ngày ('holiday', 'weekend', 'normal'), Tên ngày lễ và Hệ số lương chuẩn
CREATE OR ALTER FUNCTION dbo.fn_HRM_ClassifyDate
(
    @InputDate DATE
)
RETURNS TABLE
AS
RETURN
(
    WITH CheckHoliday AS (
        SELECT TOP 1 
            'holiday' AS DateType,
            N'Ngày lễ Quốc gia' AS DateTypeName,
            HolidayName,
            PayMultiplier
        FROM dbo.Holidays
        WHERE HolidayDate = @InputDate
    )
    SELECT 
        DateType,
        DateTypeName,
        HolidayName,
        PayMultiplier
    FROM CheckHoliday

    UNION ALL

    SELECT 
        CASE 
            WHEN (DATEDIFF(day, '19000107', @InputDate) % 7) = 0 THEN 'weekend' -- Chủ Nhật độc lập với @@DATEFIRST
            ELSE 'normal'
        END AS DateType,
        CASE 
            WHEN (DATEDIFF(day, '19000107', @InputDate) % 7) = 0 THEN N'Ngày nghỉ tuần (Chủ Nhật)'
            ELSE N'Ngày làm việc thông thường'
        END AS DateTypeName,
        NULL AS HolidayName,
        CASE 
            WHEN (DATEDIFF(day, '19000107', @InputDate) % 7) = 0 THEN 2.00
            ELSE 1.50
        END AS PayMultiplier
    WHERE NOT EXISTS (SELECT 1 FROM CheckHoliday)
);
GO
PRINT N'-> Đã tạo Function: dbo.fn_HRM_ClassifyDate.';
GO

-- 1.2 Scalar Function tiện ích: dbo.fn_HRM_GetDateType
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetDateType
(
    @InputDate DATE
)
RETURNS VARCHAR(20)
AS
BEGIN
    DECLARE @Type VARCHAR(20);
    SELECT TOP 1 @Type = DateType FROM dbo.fn_HRM_ClassifyDate(@InputDate);
    RETURN @Type;
END;
GO
PRINT N'-> Đã tạo Function: dbo.fn_HRM_GetDateType.';
GO

-- =======================================================================================
-- PHẦN 2: TRIGGER BẢO VỆ & TỰ ĐỘNG HOÁ DỮ LIỆU
-- =======================================================================================

-- 2.1 Trigger trên EmployeeOvertimes: Tự động tính số giờ & phân loại hệ số làm thêm giờ
CREATE OR ALTER TRIGGER dbo.trg_EmployeeOvertimes_AutoClassifyAndAudit
ON dbo.EmployeeOvertimes
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Chống đệ quy trigger lặp vô tận
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- Kiểm tra logic: EndTime không được trùng StartTime
    IF EXISTS (
        SELECT 1 FROM inserted 
        WHERE StartTime = EndTime
    )
    BEGIN
        RAISERROR(N'Lỗi: Thời điểm kết thúc tăng ca (EndTime) phải khác thời điểm bắt đầu (StartTime).', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    -- Tự động tính Hours và gán OTType, PayMultiplier chuẩn nếu chưa điền hoặc cần chuẩn hoá
    UPDATE eo
    SET 
        -- Tính số giờ: Nếu EndTime < StartTime (ca vắt đêm), cộng 24h (1440 phút)
        eo.[Hours] = CASE 
            WHEN i.EndTime >= i.StartTime THEN 
                CAST(ROUND(DATEDIFF(MINUTE, i.StartTime, i.EndTime) / 60.0, 2) AS DECIMAL(4,2))
            ELSE 
                CAST(ROUND((DATEDIFF(MINUTE, i.StartTime, i.EndTime) + 1440) / 60.0, 2) AS DECIMAL(4,2))
        END,
        -- Tự động phân loại loại ngày theo lịch chuẩn
        eo.OTType = c.DateType,
        eo.PayMultiplier = c.PayMultiplier
    FROM dbo.EmployeeOvertimes eo
    INNER JOIN inserted i ON eo.OvertimeId = i.OvertimeId
    CROSS APPLY dbo.fn_HRM_ClassifyDate(i.WorkDate) c;

END;
GO
PRINT N'-> Đã tạo Trigger: dbo.trg_EmployeeOvertimes_AutoClassifyAndAudit.';
GO

-- 2.2 Trigger trên EmployeeLeaves: Tự động đồng bộ số ngày nghỉ phép vào Quỹ phép năm (EmployeeAnnualLeaves)
CREATE OR ALTER TRIGGER dbo.trg_EmployeeLeaves_SyncAnnualLeave
ON dbo.EmployeeLeaves
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- Tập hợp các cặp (EmployeeId, Year) bị ảnh hưởng bởi thay đổi phép năm (LeaveType = 'annual')
    ;WITH AffectedRecords AS (
        SELECT EmployeeId, YEAR(FromDate) AS [Year]
        FROM inserted
        WHERE LeaveType = 'annual'
        UNION
        SELECT EmployeeId, YEAR(FromDate) AS [Year]
        FROM deleted
        WHERE LeaveType = 'annual'
    )
    -- Đảm bảo mỗi nhân viên bị ảnh hưởng đều có bản ghi quỹ phép năm trong bảng EmployeeAnnualLeaves
    INSERT INTO dbo.EmployeeAnnualLeaves (EmployeeId, [Year], StandardDays, SeniorityDays, CarriedOverDays, UsedDays, Note)
    SELECT 
        ar.EmployeeId,
        ar.[Year],
        12.0 AS StandardDays,
        -- Cứ 5 năm thâm niên cộng 1 ngày phép
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

    -- Tính lại tổng số ngày phép năm đã được duyệt (Approved) thực tế từ bảng EmployeeLeaves
    ;WITH ApprovedLeaveSums AS (
        SELECT 
            el.EmployeeId,
            YEAR(el.FromDate) AS [Year],
            ISNULL(SUM(el.LeaveDays), 0.0) AS TotalUsed
        FROM dbo.EmployeeLeaves el
        WHERE el.LeaveType = 'annual'
          AND el.ApprovalStatus = 'approved'
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
PRINT N'-> Đã tạo Trigger: dbo.trg_EmployeeLeaves_SyncAnnualLeave.';
GO

-- 2.3 Nâng cấp Trigger trên Attendances: Tự tính số giờ công, đi muộn, về sớm và cờ quên chấm công
CREATE OR ALTER TRIGGER dbo.trg_Attendances_AutoCalculateAndAudit
ON dbo.Attendances
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- Kiểm tra logic: CheckOut không được xảy ra trước CheckIn
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

    -- Tự động đánh giá giờ công, phút trễ, phút về sớm và quên quẹt thẻ
    UPDATE att
    SET 
        -- Cập nhật BranchId từ ShiftAssignments hoặc Employees nếu đang trống
        att.BranchId = ISNULL(att.BranchId, ISNULL(sa.BranchId, e.BranchId)),

        -- Kế thừa ca chuẩn nếu có ShiftAssignmentId
        att.ScheduledStartTime = ISNULL(att.ScheduledStartTime, st.StartTime),
        att.ScheduledEndTime   = ISNULL(att.ScheduledEndTime, st.EndTime),

        -- Tính số giờ công thực tế
        att.WorkHours = CASE 
            WHEN i.CheckInTime IS NOT NULL AND i.CheckOutTime IS NOT NULL THEN
                CAST(ROUND(DATEDIFF(MINUTE, i.CheckInTime, i.CheckOutTime) / 60.0, 2) AS DECIMAL(4,2))
            ELSE 0.00
        END,

        -- Tính số phút đi trễ so với giờ ca chuẩn
        att.LateMinutes = CASE 
            WHEN i.CheckInTime IS NOT NULL AND ISNULL(att.ScheduledStartTime, st.StartTime) IS NOT NULL THEN
                CASE 
                    WHEN CAST(i.CheckInTime AS TIME) > ISNULL(att.ScheduledStartTime, st.StartTime) THEN
                        DATEDIFF(MINUTE, ISNULL(att.ScheduledStartTime, st.StartTime), CAST(i.CheckInTime AS TIME))
                    ELSE 0
                END
            ELSE 0
        END,

        -- Tính số phút về sớm so với giờ ca chuẩn
        att.EarlyLeaveMinutes = CASE 
            WHEN i.CheckOutTime IS NOT NULL AND ISNULL(att.ScheduledEndTime, st.EndTime) IS NOT NULL THEN
                CASE 
                    WHEN CAST(i.CheckOutTime AS TIME) < ISNULL(att.ScheduledEndTime, st.EndTime) THEN
                        DATEDIFF(MINUTE, CAST(i.CheckOutTime AS TIME), ISNULL(att.ScheduledEndTime, st.EndTime))
                    ELSE 0
                END
            ELSE 0
        END,

        -- Cờ quên chấm công (quẹt vào mà không quẹt ra khi ngày đã qua, hoặc ngược lại)
        att.IsMissingPunch = CASE 
            WHEN (i.CheckInTime IS NOT NULL AND i.CheckOutTime IS NULL AND i.WorkDate < CAST(SYSDATETIME() AS DATE))
              OR (i.CheckInTime IS NULL AND i.CheckOutTime IS NOT NULL) THEN 1
            ELSE 0
        END,

        -- Tự cập nhật trạng thái chấm công
        att.Status = CASE 
            WHEN i.CheckInTime IS NULL AND i.CheckOutTime IS NULL THEN 'absent'
            WHEN (i.CheckInTime IS NOT NULL AND i.CheckOutTime IS NULL AND i.WorkDate < CAST(SYSDATETIME() AS DATE))
              OR (i.CheckInTime IS NULL AND i.CheckOutTime IS NOT NULL) THEN 'missing_punch'
            WHEN i.CheckInTime IS NOT NULL AND ISNULL(att.ScheduledStartTime, st.StartTime) IS NOT NULL 
                 AND CAST(i.CheckInTime AS TIME) > ISNULL(att.ScheduledStartTime, st.StartTime) THEN 'late'
            WHEN i.CheckOutTime IS NOT NULL AND ISNULL(att.ScheduledEndTime, st.EndTime) IS NOT NULL 
                 AND CAST(i.CheckOutTime AS TIME) < ISNULL(att.ScheduledEndTime, st.EndTime) THEN 'early_leave'
            ELSE 'on_time'
        END,

        -- Ghi nhận thời điểm điều chỉnh nếu là thủ công
        att.AdjustedAt = CASE 
            WHEN i.IsManualAdjusted = 1 AND i.AdjustedAt IS NULL THEN SYSDATETIME()
            ELSE att.AdjustedAt
        END
    FROM dbo.Attendances att
    INNER JOIN inserted i ON att.AttendanceId = i.AttendanceId
    LEFT JOIN dbo.ShiftAssignments sa ON att.ShiftAssignmentId = sa.AssignmentId
    LEFT JOIN dbo.ShiftTemplates st ON sa.TemplateId = st.TemplateId
    LEFT JOIN dbo.Employees e ON att.EmployeeId = e.EmployeeId;

END;
GO
PRINT N'-> Đã nâng cấp Trigger: dbo.trg_Attendances_AutoCalculateAndAudit.';
GO

-- =======================================================================================
-- PHẦN 3: STORED PROCEDURE TỔNG HỢP CÔNG THÁNG (BẢNG CÔNG TỔNG HỢP THEO THÁNG)
-- =======================================================================================

-- Thủ tục: dbo.sp_HRM_GetMonthlyAttendanceSummary
-- Nhận vào: @YearMonth (YYYY-MM), @BranchId, @Search, @CurrentUsername
-- Trả về: Toàn bộ các cột phục vụ Tab 1 Frontend:
--   Mã NV, Họ tên, Vị trí, Chi nhánh, Trạng thái làm việc,
--   Ngày công, Giờ công, Tăng ca (thường, nghỉ, lễ), Tổng giờ công,
--   Nghỉ hưởng lương, Nghỉ không lương, Đi sớm về trễ, Quên chấm công
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetMonthlyAttendanceSummary
    @YearMonth          VARCHAR(7)      = NULL, -- Format 'YYYY-MM', ví dụ '2026-11'
    @BranchId           INT             = NULL, -- NULL = Tất cả chi nhánh
    @Search             NVARCHAR(100)   = NULL, -- Tìm theo Tên hoặc Mã NV
    @CurrentUsername    VARCHAR(50)     = NULL  -- Kiểm soát quyền truy cập cây phả hệ
AS
BEGIN
    SET NOCOUNT ON;

    -- 1. Xác định tháng và năm truy vấn
    IF @YearMonth IS NULL OR LTRIM(RTRIM(@YearMonth)) = ''
        SET @YearMonth = FORMAT(SYSDATETIME(), 'yyyy-MM');

    DECLARE @Year INT = CAST(SUBSTRING(@YearMonth, 1, 4) AS INT);
    DECLARE @Month INT = CAST(SUBSTRING(@YearMonth, 6, 2) AS INT);

    DECLARE @StartDate DATE = DATEFROMPARTS(@Year, @Month, 1);
    DECLARE @EndDate   DATE = EOMONTH(@StartDate);

    -- 2. Lấy danh sách nhân viên được quyền truy cập theo phân cấp phả hệ
    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    -- Chuẩn hoá chuỗi tìm kiếm
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    -- 3. Tổng hợp dữ liệu chấm công từ bảng Attendances trong kỳ tháng
    ;WITH AttSummary AS (
        SELECT 
            att.EmployeeId,
            COUNT(DISTINCT CASE WHEN att.WorkHours > 0 THEN att.WorkDate END) AS WorkDays,
            CAST(ISNULL(SUM(att.WorkHours), 0.00) AS DECIMAL(6,2)) AS WorkHours,
            SUM(CASE WHEN att.LateMinutes > 0 OR att.EarlyLeaveMinutes > 0 THEN 1 ELSE 0 END) AS EarlyLateCount,
            SUM(CASE WHEN att.IsMissingPunch = 1 THEN 1 ELSE 0 END) AS MissingPunchCount
        FROM dbo.Attendances att
        WHERE att.WorkDate >= @StartDate AND att.WorkDate <= @EndDate
        GROUP BY att.EmployeeId
    ),
    -- 4. Tổng hợp dữ liệu làm thêm giờ (OT) từ bảng EmployeeOvertimes trong kỳ tháng (chỉ lấy đã duyệt)
    OtSummary AS (
        SELECT 
            eo.EmployeeId,
            CAST(ISNULL(SUM(CASE WHEN eo.OTType = 'normal' THEN eo.[Hours] ELSE 0.00 END), 0.00) AS DECIMAL(6,2)) AS OtNormalHours,
            CAST(ISNULL(SUM(CASE WHEN eo.OTType = 'weekend' THEN eo.[Hours] ELSE 0.00 END), 0.00) AS DECIMAL(6,2)) AS OtWeekendHours,
            CAST(ISNULL(SUM(CASE WHEN eo.OTType = 'holiday' THEN eo.[Hours] ELSE 0.00 END), 0.00) AS DECIMAL(6,2)) AS OtHolidayHours
        FROM dbo.EmployeeOvertimes eo
        WHERE eo.WorkDate >= @StartDate AND eo.WorkDate <= @EndDate
          AND eo.ApprovalStatus = 'approved'
        GROUP BY eo.EmployeeId
    ),
    -- 5. Tổng hợp ngày nghỉ phép từ bảng EmployeeLeaves trong kỳ tháng (chỉ lấy đã duyệt)
    LeaveSummary AS (
        SELECT 
            el.EmployeeId,
            CAST(ISNULL(SUM(CASE WHEN el.IsPaid = 1 THEN el.LeaveDays ELSE 0.00 END), 0.00) AS DECIMAL(4,2)) AS PaidLeaveDays,
            CAST(ISNULL(SUM(CASE WHEN el.IsPaid = 0 THEN el.LeaveDays ELSE 0.00 END), 0.00) AS DECIMAL(4,2)) AS UnpaidLeaveDays
        FROM dbo.EmployeeLeaves el
        WHERE el.FromDate <= @EndDate AND el.ToDate >= @StartDate
          AND el.ApprovalStatus = 'approved'
        GROUP BY el.EmployeeId
    )
    -- 6. Kết quả trả về trọn vẹn từng nhân viên
    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        e.Position,
        b.BranchId,
        b.BranchName,
        e.Status AS WorkingStatus, -- 'active', 'resigned', 'suspended'
        
        -- Dữ liệu ngày công & giờ công
        ISNULL(att.WorkDays, 0) AS WorkDays,
        ISNULL(att.WorkHours, 0.00) AS WorkHours,

        -- 3 loại Tăng ca (OT)
        ISNULL(ot.OtNormalHours, 0.00) AS OtNormalHours,
        ISNULL(ot.OtWeekendHours, 0.00) AS OtWeekendHours,
        ISNULL(ot.OtHolidayHours, 0.00) AS OtHolidayHours,

        -- Tổng giờ công = Giờ công thường + Giờ tăng ca tất cả loại
        CAST(ISNULL(att.WorkHours, 0.00) + 
             ISNULL(ot.OtNormalHours, 0.00) + 
             ISNULL(ot.OtWeekendHours, 0.00) + 
             ISNULL(ot.OtHolidayHours, 0.00) AS DECIMAL(6,2)) AS TotalWorkHours,

        -- Nghỉ phép
        ISNULL(lv.PaidLeaveDays, 0.00) AS PaidLeaveDays,
        ISNULL(lv.UnpaidLeaveDays, 0.00) AS UnpaidLeaveDays,

        -- Kỷ luật chấm công
        ISNULL(att.EarlyLateCount, 0) AS EarlyLateCount,
        ISNULL(att.MissingPunchCount, 0) AS MissingPunchCount
    FROM dbo.Employees e
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN AttSummary att ON e.EmployeeId = att.EmployeeId
    LEFT JOIN OtSummary ot ON e.EmployeeId = ot.EmployeeId
    LEFT JOIN LeaveSummary lv ON e.EmployeeId = lv.EmployeeId
    WHERE (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (@HasHierarchyFilter = 0 OR EXISTS (SELECT 1 FROM @AllowedEmployees ae WHERE ae.EmployeeId = e.EmployeeId))
      AND (
          @Search IS NULL 
          OR e.FullName LIKE N'%' + @Search + N'%' 
          OR e.EmployeeCode LIKE '%' + @Search + '%'
      )
    ORDER BY b.BranchId ASC, e.EmployeeCode ASC;

END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_HRM_GetMonthlyAttendanceSummary.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG RELEASE 12: FUNCTIONS, TRIGGERS & SP TỔNG HỢP CÔNG THÁNG';
PRINT N'=======================================================================================';
GO
