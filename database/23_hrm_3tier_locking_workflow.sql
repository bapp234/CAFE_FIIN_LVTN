-- =======================================================================================
-- TỆP MÃ NGUỒN: 23_hrm_3tier_locking_workflow.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   Thiết lập Nghiệp vụ 3 Cấp Khóa Tuần Tự (3-Tier Locking Mechanism):
--     Cấp 1: Khóa Ca Làm (Shift Schedule Lock)
--     Cấp 2: Khóa Bảng Công (Attendance Timesheet Lock) & Mở khóa bảo mật bằng mật khẩu IT
--     Cấp 3: Khóa Sổ Lương (Payroll Period Lock)
--
-- TÍCH HỢP:
--   Kế thừa kiến trúc phân cấp độc lập RBAC (Release 06: HierarchyLevels & Permissions).
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 23: NGHIỆP VỤ 3 CẤP KHÓA (CA LÀM -> BẢNG CÔNG -> SỔ LƯƠNG)';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- 1. BẢNG DỮ LIỆU CẤP 1: QUẢN LÝ KHÓA LỊCH CA TUẦN (dbo.ShiftScheduleWeeks)
-- =======================================================================================
IF OBJECT_ID('dbo.ShiftScheduleWeeks', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ShiftScheduleWeeks (
        WeekId          INT IDENTITY(1,1) PRIMARY KEY,
        BranchId        INT NOT NULL CONSTRAINT FK_ShiftScheduleWeeks_Branches REFERENCES dbo.Branches(BranchId),
        [Year]          INT NOT NULL,
        WeekNumber      INT NOT NULL, -- 1..53
        StartDate       DATE NOT NULL,
        EndDate         DATE NOT NULL,
        IsLocked        BIT NOT NULL DEFAULT 0,
        LockedBy        VARCHAR(50) NULL,
        LockedAt        DATETIME2(0) NULL,
        CreatedAt       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_ShiftScheduleWeeks_Branch_Year_Week UNIQUE (BranchId, [Year], WeekNumber)
    );
    PRINT N'-> Đã tạo bảng dbo.ShiftScheduleWeeks.';
END;
GO

-- =======================================================================================
-- 2. BẢNG DỮ LIỆU CẤP 2: QUẢN LÝ KHÓA KỲ CÔNG THÁNG (dbo.AttendancePeriods)
-- =======================================================================================
IF OBJECT_ID('dbo.AttendancePeriods', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendancePeriods (
        PeriodId        INT IDENTITY(1,1) PRIMARY KEY,
        BranchId        INT NOT NULL CONSTRAINT FK_AttendancePeriods_Branches REFERENCES dbo.Branches(BranchId),
        PeriodMonth     VARCHAR(7) NOT NULL, -- Định dạng YYYY-MM (Ví dụ: 2026-11)
        IsLocked        BIT NOT NULL DEFAULT 0,
        LockedBy        VARCHAR(50) NULL,
        LockedAt        DATETIME2(0) NULL,
        UnlockedBy      VARCHAR(50) NULL,
        UnlockedAt      DATETIME2(0) NULL,
        UnlockReason    NVARCHAR(500) NULL,
        CreatedAt       DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_AttendancePeriods_Branch_Month UNIQUE (BranchId, PeriodMonth)
    );
    PRINT N'-> Đã tạo bảng dbo.AttendancePeriods.';
END;
GO

-- =======================================================================================
-- 3. BẢNG VẾT KIỂM TOÁN MỞ KHÓA CÔNG (dbo.AttendanceUnlockLogs)
-- Lưu vết mỗi lần nhập mật khẩu IT để mở khóa công khẩn cấp (Audit Trail)
-- =======================================================================================
IF OBJECT_ID('dbo.AttendanceUnlockLogs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.AttendanceUnlockLogs (
        LogId           INT IDENTITY(1,1) PRIMARY KEY,
        PeriodId        INT NOT NULL CONSTRAINT FK_AttendanceUnlockLogs_Periods REFERENCES dbo.AttendancePeriods(PeriodId),
        BranchId        INT NOT NULL,
        PeriodMonth     VARCHAR(7) NOT NULL,
        UnlockedBy      VARCHAR(50) NOT NULL,
        UnlockedAt      DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
        UnlockReason    NVARCHAR(500) NOT NULL,
        ClientIp        VARCHAR(50) NULL
    );
    PRINT N'-> Đã tạo bảng dbo.AttendanceUnlockLogs.';
END;
GO

-- =======================================================================================
-- 4. THIẾT LẬP MẬT KHẨU MỞ KHÓA DƯỚI CSDL CHO IT (dbo.HrmSettings)
-- =======================================================================================
MERGE dbo.HrmSettings AS target
USING (SELECT 'ATTENDANCE_UNLOCK_PASSWORD' AS SettingKey) AS source
ON target.SettingKey = source.SettingKey
WHEN MATCHED THEN
    UPDATE SET 
        SettingValue = 'FiinUnlock@2026',
        Description  = N'Mật khẩu thẩm quyền IT dùng để mở khóa kỳ công đã chốt (Break-glass Override)',
        UpdatedAt    = SYSDATETIME(),
        UpdatedBy    = 'IT_Admin'
WHEN NOT MATCHED THEN
    INSERT (SettingKey, SettingValue, Description, UpdatedAt, UpdatedBy)
    VALUES ('ATTENDANCE_UNLOCK_PASSWORD', 'FiinUnlock@2026', N'Mật khẩu thẩm quyền IT dùng để mở khóa kỳ công đã chốt (Break-glass Override)', SYSDATETIME(), 'IT_Admin');
GO
PRINT N'-> Đã cấu hình mật khẩu mở khóa IT trong dbo.HrmSettings.';
GO

-- =======================================================================================
-- 5. ĐĂNG KÝ PERMISSIONS MỚI VÀO HỆ THỐNG PHÂN QUYỀN RBAC (dbo.Permissions)
-- =======================================================================================
MERGE dbo.Permissions AS target
USING (
    VALUES 
        ('SHIFT.SCHEDULE.LOCK',      N'Chốt & Khóa lịch phân ca tuần',           'ATTENDANCE'),
        ('ATTENDANCE.TIMESHEET.LOCK',   N'Chốt & Khóa bảng công tháng',             'ATTENDANCE'),
        ('ATTENDANCE.TIMESHEET.UNLOCK', N'Mở khóa bảng công tháng (Yêu cầu mật khẩu IT)', 'ATTENDANCE')
) AS source (PermissionCode, PermissionName, Module)
ON target.PermissionCode = source.PermissionCode
WHEN NOT MATCHED THEN
    INSERT (PermissionCode, PermissionName, Module, IsActive)
    VALUES (source.PermissionCode, source.PermissionName, source.Module, 1);
GO

-- Phân bổ quyền cho Cấp bậc (LevelPermissions):
--   Cấp 3 (Quản lý CH): Có quyền khóa ca tuần (SHIFT.SCHEDULE.LOCK)
--   Cấp 4 (Khối chuyên môn/HRM): Có quyền khóa ca, khóa công, mở khóa công
--   Cấp 5 (Ban Lãnh đạo tối cao): Sở hữu toàn bộ các quyền khóa & mở khóa
INSERT INTO dbo.LevelPermissions (LevelId, PermissionId, AssignedAt)
SELECT lvl.LevelId, p.PermissionId, SYSDATETIME()
FROM dbo.HierarchyLevels lvl
CROSS JOIN dbo.Permissions p
WHERE (
    (lvl.LevelNumber = 3 AND p.PermissionCode = 'SHIFT.SCHEDULE.LOCK')
    OR (lvl.LevelNumber >= 4 AND p.PermissionCode IN ('SHIFT.SCHEDULE.LOCK', 'ATTENDANCE.TIMESHEET.LOCK', 'ATTENDANCE.TIMESHEET.UNLOCK'))
)
AND NOT EXISTS (
    SELECT 1 FROM dbo.LevelPermissions lp 
    WHERE lp.LevelId = lvl.LevelId AND lp.PermissionId = p.PermissionId
);
GO
PRINT N'-> Đã đăng ký và phân bổ các quyền khóa/mở khóa cho Cấp bậc.';
GO

-- =======================================================================================
-- 6. TRIGGER BẢO VỆ CẤP 1: CHẶN CHỈNH SỬA CA KHI TUẦN ĐÃ KHÓA
-- =======================================================================================
CREATE OR ALTER TRIGGER dbo.trg_ShiftAssignments_PreventModifyWhenLocked
ON dbo.ShiftAssignments
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra bản ghi bị tác động (inserted hoặc deleted)
    IF EXISTS (
        SELECT 1 
        FROM (
            SELECT BranchId, WorkDate FROM inserted
            UNION
            SELECT BranchId, WorkDate FROM deleted
        ) op
        INNER JOIN dbo.ShiftScheduleWeeks w 
            ON op.BranchId = w.BranchId 
           AND op.WorkDate BETWEEN w.StartDate AND w.EndDate
        WHERE w.IsLocked = 1
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50020, N'Lỗi vi phạm toàn vẹn: Tuần làm việc này đã bị KHÓA LỊCH CA (Shift Schedule Locked). Không thể thêm, sửa hoặc xóa ca làm việc.', 1;
        RETURN;
    END;
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_ShiftAssignments_PreventModifyWhenLocked.';
GO

-- =======================================================================================
-- 7. TRIGGER BẢO VỆ CẤP 2: CHẶN CHỈNH SỬA CHẤM CÔNG KHI KỲ CÔNG ĐÃ KHÓA
-- =======================================================================================
CREATE OR ALTER TRIGGER dbo.trg_Attendances_PreventModifyWhenLocked
ON dbo.Attendances
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (
        SELECT 1 
        FROM (
            SELECT a.WorkDate, e.BranchId 
            FROM inserted a
            INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
            UNION
            SELECT a.WorkDate, e.BranchId 
            FROM deleted a
            INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
        ) op
        INNER JOIN dbo.AttendancePeriods p 
            ON op.BranchId = p.BranchId 
           AND FORMAT(op.WorkDate, 'yyyy-MM') = p.PeriodMonth
        WHERE p.IsLocked = 1
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50021, N'Lỗi vi phạm toàn vẹn: Bảng công tháng này đã bị KHÓA CÔNG (Attendance Locked). Mọi thao tác ghi nhận hoặc điều chỉnh giờ công bị từ chối.', 1;
        RETURN;
    END;
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_Attendances_PreventModifyWhenLocked.';
GO

-- =======================================================================================
-- 8. THỦ TỤC ĐIỀU PHỐI CẤP 1: KHÓA & MỞ KHÓA LỊCH CA TUẦN
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockShiftSchedule
    @BranchId       INT,
    @Year           INT,
    @WeekNumber     INT,
    @StartDate      DATE,
    @EndDate        DATE,
    @LockedBy       VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        MERGE dbo.ShiftScheduleWeeks AS target
        USING (SELECT @BranchId AS BranchId, @Year AS [Year], @WeekNumber AS WeekNumber) AS source
        ON target.BranchId = source.BranchId AND target.[Year] = source.[Year] AND target.WeekNumber = source.WeekNumber
        WHEN MATCHED THEN
            UPDATE SET 
                IsLocked  = 1,
                LockedBy  = @LockedBy,
                LockedAt  = SYSDATETIME(),
                StartDate = @StartDate,
                EndDate   = @EndDate
        WHEN NOT MATCHED THEN
            INSERT (BranchId, [Year], WeekNumber, StartDate, EndDate, IsLocked, LockedBy, LockedAt)
            VALUES (@BranchId, @Year, @WeekNumber, @StartDate, @EndDate, 1, @LockedBy, SYSDATETIME());

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_LockShiftSchedule.';
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockShiftSchedule
    @BranchId       INT,
    @Year           INT,
    @WeekNumber     INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Kiểm tra: Nếu kỳ công tháng của tuần này đã bị KHÓA CÔNG thì không cho mở khóa ca
        DECLARE @StartDate DATE;
        SELECT @StartDate = StartDate FROM dbo.ShiftScheduleWeeks 
        WHERE BranchId = @BranchId AND [Year] = @Year AND WeekNumber = @WeekNumber;

        IF @StartDate IS NOT NULL
        BEGIN
            DECLARE @PeriodMonth VARCHAR(7) = FORMAT(@StartDate, 'yyyy-MM');
            IF EXISTS (SELECT 1 FROM dbo.AttendancePeriods WHERE BranchId = @BranchId AND PeriodMonth = @PeriodMonth AND IsLocked = 1)
            BEGIN
                THROW 50022, N'Không thể mở khóa ca làm: Bảng công tháng này đã bị khóa sổ. Phải mở khóa công trước khi mở khóa lịch ca.', 1;
            END;
        END

        UPDATE dbo.ShiftScheduleWeeks
        SET IsLocked = 0, LockedBy = NULL, LockedAt = NULL
        WHERE BranchId = @BranchId AND [Year] = @Year AND WeekNumber = @WeekNumber;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_UnlockShiftSchedule.';
GO

-- =======================================================================================
-- 9. THỦ TỤC ĐIỀU PHỐI CẤP 2: LẤY TRẠNG THÁI, KHÓA VÀ MỞ KHÓA BẢNG CÔNG THÁNG
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetAttendancePeriodStatus
    @BranchId       INT = NULL,
    @PeriodMonth    VARCHAR(7) -- 'YYYY-MM'
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu @BranchId là NULL hoặc 0, lấy chi nhánh 1 làm đại diện hoặc kiểm tra tổng thể
    DECLARE @TargetBranchId INT = ISNULL(NULLIF(@BranchId, 0), 1);

    SELECT TOP 1
        PeriodId,
        BranchId,
        PeriodMonth,
        IsLocked,
        LockedBy,
        LockedAt,
        UnlockedBy,
        UnlockedAt,
        UnlockReason
    FROM dbo.AttendancePeriods
    WHERE BranchId = @TargetBranchId AND PeriodMonth = @PeriodMonth;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_GetAttendancePeriodStatus.';
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockAttendancePeriod
    @BranchId       INT,
    @PeriodMonth    VARCHAR(7), -- 'YYYY-MM'
    @LockedBy       VARCHAR(50)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @BranchId = 0 SET @BranchId = 1;

        -- 1. Chốt kỳ công
        MERGE dbo.AttendancePeriods AS target
        USING (SELECT @BranchId AS BranchId, @PeriodMonth AS PeriodMonth) AS source
        ON target.BranchId = source.BranchId AND target.PeriodMonth = source.PeriodMonth
        WHEN MATCHED THEN
            UPDATE SET 
                IsLocked     = 1,
                LockedBy     = @LockedBy,
                LockedAt     = SYSDATETIME(),
                UnlockedBy   = NULL,
                UnlockedAt   = NULL,
                UnlockReason = NULL
        WHEN NOT MATCHED THEN
            INSERT (BranchId, PeriodMonth, IsLocked, LockedBy, LockedAt)
            VALUES (@BranchId, @PeriodMonth, 1, @LockedBy, SYSDATETIME());

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_LockAttendancePeriod.';
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockAttendancePeriod
    @BranchId           INT,
    @PeriodMonth        VARCHAR(7),
    @UnlockPassword     NVARCHAR(100),
    @UnlockReason       NVARCHAR(500),
    @UnlockedBy         VARCHAR(50),
    @ClientIp           VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF @BranchId = 0 SET @BranchId = 1;

        -- 1. Kiểm tra nguyên tắc thác nước: Nếu Lương tháng này đã khóa thì TUYỆT ĐỐI CẤM mở khóa công
        IF EXISTS (
            SELECT 1 FROM dbo.PayrollPeriods 
            WHERE (BranchId = @BranchId OR BranchId IS NULL) 
              AND PeriodMonth = @PeriodMonth 
              AND IsLocked = 1
        )
        BEGIN
            THROW 50025, N'Vi phạm nguyên tắc dòng thác: Bảng lương tháng này đã bị KHÓA SỔ. Bạn bắt buộc phải yêu cầu Ban Giám đốc mở khóa bảng lương trước khi mở khóa bảng công.', 1;
        END

        -- 2. Kiểm tra mật khẩu ủy quyền IT lưu trong dbo.HrmSettings
        DECLARE @SavedPassword NVARCHAR(MAX);
        SELECT @SavedPassword = SettingValue 
        FROM dbo.HrmSettings 
        WHERE SettingKey = 'ATTENDANCE_UNLOCK_PASSWORD';

        IF @SavedPassword IS NULL OR @SavedPassword <> @UnlockPassword
        BEGIN
            THROW 50026, N'Mật khẩu thẩm quyền IT không chính xác. Thao tác mở khóa bảng công bị từ chối.', 1;
        END

        -- 3. Kiểm tra lý do mở khóa
        IF @UnlockReason IS NULL OR LEN(LTRIM(RTRIM(@UnlockReason))) < 5
        BEGIN
            THROW 50027, N'Lý do mở khóa không hợp lệ: Vui lòng nhập tối thiểu 5 ký tự giải trình phục vụ kiểm toán.', 1;
        END

        -- 4. Cập nhật mở khóa bảng công
        DECLARE @PeriodId INT;
        SELECT @PeriodId = PeriodId FROM dbo.AttendancePeriods WHERE BranchId = @BranchId AND PeriodMonth = @PeriodMonth;

        IF @PeriodId IS NOT NULL
        BEGIN
            UPDATE dbo.AttendancePeriods
            SET 
                IsLocked     = 0,
                UnlockedBy   = @UnlockedBy,
                UnlockedAt   = SYSDATETIME(),
                UnlockReason = @UnlockReason
            WHERE PeriodId = @PeriodId;

            -- 5. Ghi vết kiểm toán (Audit Log)
            INSERT INTO dbo.AttendanceUnlockLogs (PeriodId, BranchId, PeriodMonth, UnlockedBy, UnlockedAt, UnlockReason, ClientIp)
            VALUES (@PeriodId, @BranchId, @PeriodMonth, @UnlockedBy, SYSDATETIME(), @UnlockReason, @ClientIp);
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_UnlockAttendancePeriod.';
GO

-- =======================================================================================
-- 10. THỦ TỤC ĐIỀU PHỐI CẤP 3: KHÓA VÀ MỞ KHÓA SỔ LƯƠNG
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_LockPayrollPeriod
    @PeriodId       INT,
    @ApproverName   NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.PayrollPeriods WHERE PeriodId = @PeriodId)
        BEGIN
            THROW 50030, N'Không tìm thấy kỳ lương cần phê duyệt.', 1;
        END

        DECLARE @BranchId INT, @PeriodMonth VARCHAR(7);
        SELECT @BranchId = BranchId, @PeriodMonth = PeriodMonth FROM dbo.PayrollPeriods WHERE PeriodId = @PeriodId;

        -- Kiểm tra nguyên tắc thác nước: Bảng công tháng này PHẢI ĐƯỢC KHÓA CÔNG trước
        IF @BranchId IS NOT NULL AND @PeriodMonth IS NOT NULL
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM dbo.AttendancePeriods 
                WHERE BranchId = @BranchId AND PeriodMonth = @PeriodMonth AND IsLocked = 1
            )
            BEGIN
                THROW 50031, N'Vi phạm nguyên tắc dòng thác: Bảng công của tháng này CHƯA ĐƯỢC CHỐT KHÓA. Phải hoàn tất chốt bảng công trước khi khóa sổ lương.', 1;
            END;
        END

        -- Chuyển trạng thái phiếu lương sang 'approved'
        UPDATE dbo.PayrollSlips
        SET Status = 'approved'
        WHERE PeriodId = @PeriodId;

        -- Khóa chính thức kỳ lương
        UPDATE dbo.PayrollPeriods
        SET 
            Status     = 'approved',
            IsLocked   = 1,
            ApprovedBy = @ApproverName,
            ApprovedAt = SYSDATETIME()
        WHERE PeriodId = @PeriodId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_LockPayrollPeriod.';
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_UnlockPayrollPeriod
    @PeriodId       INT,
    @UnlockedBy     VARCHAR(50),
    @Reason         NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        IF NOT EXISTS (SELECT 1 FROM dbo.PayrollPeriods WHERE PeriodId = @PeriodId)
        BEGIN
            THROW 50032, N'Không tìm thấy kỳ lương chỉ định.', 1;
        END

        -- Mở khóa sổ lương về trạng thái draft để cho phép tính toán lại
        UPDATE dbo.PayrollPeriods
        SET 
            IsLocked   = 0,
            Status     = 'draft',
            ApprovedBy = NULL,
            ApprovedAt = NULL
        WHERE PeriodId = @PeriodId;

        UPDATE dbo.PayrollSlips
        SET Status = 'draft'
        WHERE PeriodId = @PeriodId;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_UnlockPayrollPeriod.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG TỆP 23: HỆ THỐNG 3 CẤP KHÓA & MỞ KHÓA BẢO MẬT ĐÃ HOẠT ĐỘNG!';
PRINT N'=======================================================================================';
GO
