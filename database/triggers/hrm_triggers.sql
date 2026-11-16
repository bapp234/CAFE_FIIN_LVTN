-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- Các Trigger bảo vệ toàn vẹn dữ liệu: MODULE HRM
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/triggers/hrm_triggers.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

-- 1. Trigger chống sửa hoặc xóa phiếu lương khi kỳ lương đã được phê duyệt & khóa
CREATE OR ALTER TRIGGER dbo.trg_PayrollSlips_PreventModifyWhenLocked
ON dbo.PayrollSlips
AFTER UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra nếu có bất kỳ dòng nào thuộc kỳ lương đã bị khóa
    IF EXISTS (
        SELECT 1 
        FROM deleted d
        INNER JOIN dbo.PayrollPeriods p ON d.PeriodId = p.PeriodId
        WHERE p.IsLocked = 1
    )
    BEGIN
        RAISERROR(N'Kỳ lương này đã được phê duyệt và khóa bảo mật. Tuyệt đối không được phép chỉnh sửa hoặc xóa phiếu lương!', 16, 1);
        ROLLBACK TRANSACTION;
        RETURN;
    END
END;
GO

PRINT N'-> Đã tạo trigger trg_PayrollSlips_PreventModifyWhenLocked.';
GO

-- 2. Trigger tự động cập nhật UpdatedAt cho hồ sơ nhân viên
CREATE OR ALTER TRIGGER dbo.trg_Employees_AutoUpdateTimestamp
ON dbo.Employees
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Tránh vòng lặp trigger đệ quy
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE e
    SET UpdatedAt = SYSDATETIME()
    FROM dbo.Employees e
    INNER JOIN inserted i ON e.EmployeeId = i.EmployeeId;
END;
GO

PRINT N'-> Đã tạo trigger trg_Employees_AutoUpdateTimestamp.';
GO

-- 3. Trigger kiểm soát tính toàn vẹn dữ liệu Chấm công
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
PRINT N'-> Đã tạo trigger trg_Attendances_AutoCalculateAndAudit.';
GO

-- 4. Trigger chống xếp trùng hoặc chồng lấn thời gian ca làm việc
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
              (t1.StartTime >= t2.StartTime AND t1.StartTime < t2.EndTime)
              OR
              (t1.EndTime > t2.StartTime AND t1.EndTime <= t2.EndTime)
              OR
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
PRINT N'-> Đã tạo trigger trg_ShiftAssignments_PreventOverlap.';
GO

PRINT N'>>> HOÀN TẤT TẠO TRIGGERS CHO MODULE HRM THÀNH CÔNG! <<<';
GO
