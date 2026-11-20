USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 29_create_sp_HRM_ShiftAssignments_CRUD.sql
-- MỤC ĐÍCH: Đọc, Lưu (Upsert) và Hủy phân ca tuần trực tiếp trên bảng
--           dbo.ShiftAssignments để dữ liệu không bị mất khi F5.
-- ============================================================================

-- 1. LẤY DANH SÁCH PHÂN CA TUẦN
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetWeekShiftAssignments
    @BranchId  INT  = NULL,
    @StartDate DATE,
    @EndDate   DATE
AS
BEGIN
    SET NOCOUNT ON;

    IF @BranchId IS NOT NULL AND @BranchId <= 0 SET @BranchId = NULL;

    SELECT
        sa.AssignmentId                         AS Id,
        sa.EmployeeId                           AS EmployeeId,
        e.EmployeeCode                          AS EmployeeCode,
        ISNULL(e.FullName, e.BankAccountName)   AS EmployeeName,
        sa.BranchId                             AS BranchId,
        CONVERT(VARCHAR(10), sa.WorkDate, 23)   AS [Date],
        sa.TemplateId                           AS ShiftId,
        st.ShiftCode                            AS ShiftCode,
        st.ShiftName                            AS ShiftName,
        CONVERT(VARCHAR(5), st.StartTime, 108)  AS StartTime,
        CONVERT(VARCHAR(5), st.EndTime, 108)    AS EndTime,
        ISNULL(sa.RegisteredBy, 'manager')      AS RegisteredBy,
        ISNULL(sa.Status, 'scheduled')          AS Status,
        sa.Note                                 AS Note
    FROM dbo.ShiftAssignments sa
    INNER JOIN dbo.Employees e ON e.EmployeeId = sa.EmployeeId
    INNER JOIN dbo.ShiftTemplates st ON st.TemplateId = sa.TemplateId
    WHERE sa.WorkDate >= @StartDate
      AND sa.WorkDate <= @EndDate
      AND ISNULL(sa.Status, 'scheduled') <> 'cancelled'
      AND (@BranchId IS NULL OR sa.BranchId = @BranchId)
    ORDER BY sa.WorkDate ASC, sa.EmployeeId ASC;
END;
GO

-- 2. LƯU / CẬP NHẬT PHÂN CA CHO NHÂN VIÊN THEO NGÀY (UPSERT)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_SaveShiftAssignment
    @EmployeeId   INT,
    @WorkDate     DATE,
    @ShiftCode    VARCHAR(30)   = NULL,
    @TemplateId   INT           = NULL,
    @BranchId     INT           = NULL,
    @RegisteredBy VARCHAR(30)   = 'manager',
    @Status       VARCHAR(20)   = 'scheduled',
    @Note         NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TemplateId IS NULL OR @TemplateId <= 0
    BEGIN
        SELECT TOP 1 @TemplateId = TemplateId
        FROM dbo.ShiftTemplates
        WHERE ShiftCode = @ShiftCode;
    END

    IF @TemplateId IS NULL
    BEGIN
        THROW 50011, N'Không tìm thấy mẫu ca làm việc tương ứng trong hệ thống.', 1;
    END

    IF @BranchId IS NULL OR @BranchId <= 0
    BEGIN
        SELECT @BranchId = BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;
    END

    IF @BranchId IS NULL SET @BranchId = 1;

    -- Kiểm tra tuần đã khóa chưa
    DECLARE @Year INT = DATEPART(YEAR, @WorkDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @WorkDate);
    IF EXISTS (
        SELECT 1
        FROM dbo.ShiftScheduleWeeks
        WHERE BranchId = @BranchId
          AND [Year] = @Year
          AND WeekNumber = @WeekNumber
          AND IsLocked = 1
    )
    BEGIN
        THROW 50010, N'Lịch phân ca tuần này đã bị chốt khóa, không thể điều chỉnh.', 1;
    END

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @TargetId INT;
        SELECT TOP 1 @TargetId = AssignmentId
        FROM dbo.ShiftAssignments
        WHERE EmployeeId = @EmployeeId
          AND WorkDate = @WorkDate
          AND ISNULL(Status, 'scheduled') <> 'cancelled';

        IF @TargetId IS NOT NULL
        BEGIN
            UPDATE dbo.ShiftAssignments
            SET TemplateId   = @TemplateId,
                BranchId     = @BranchId,
                RegisteredBy = ISNULL(@RegisteredBy, 'manager'),
                Status       = ISNULL(@Status, 'scheduled'),
                Note         = @Note
            WHERE AssignmentId = @TargetId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.ShiftAssignments (
                EmployeeId, TemplateId, BranchId, WorkDate, RegisteredBy, Status, Note, CreatedAt
            )
            VALUES (
                @EmployeeId, @TemplateId, @BranchId, @WorkDate,
                ISNULL(@RegisteredBy, 'manager'),
                ISNULL(@Status, 'scheduled'),
                @Note,
                SYSDATETIME()
            );
            SET @TargetId = SCOPE_IDENTITY();
        END

        COMMIT TRANSACTION;

        SELECT
            sa.AssignmentId                         AS Id,
            sa.EmployeeId                           AS EmployeeId,
            e.EmployeeCode                          AS EmployeeCode,
            ISNULL(e.FullName, e.BankAccountName)   AS EmployeeName,
            sa.BranchId                             AS BranchId,
            CONVERT(VARCHAR(10), sa.WorkDate, 23)   AS [Date],
            sa.TemplateId                           AS ShiftId,
            st.ShiftCode                            AS ShiftCode,
            st.ShiftName                            AS ShiftName,
            CONVERT(VARCHAR(5), st.StartTime, 108)  AS StartTime,
            CONVERT(VARCHAR(5), st.EndTime, 108)    AS EndTime,
            ISNULL(sa.RegisteredBy, 'manager')      AS RegisteredBy,
            ISNULL(sa.Status, 'scheduled')          AS Status,
            sa.Note                                 AS Note
        FROM dbo.ShiftAssignments sa
        INNER JOIN dbo.Employees e ON e.EmployeeId = sa.EmployeeId
        INNER JOIN dbo.ShiftTemplates st ON st.TemplateId = sa.TemplateId
        WHERE sa.AssignmentId = @TargetId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 3. HỦY / XÓA CA LÀM VIỆC (THEO ASSIGNMENT ID HOẶC EMPLOYEE + WORKDATE)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_RemoveShiftAssignment
    @AssignmentId INT  = NULL,
    @EmployeeId   INT  = NULL,
    @WorkDate     DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @BranchId INT;
    DECLARE @TargetDate DATE;

    IF @AssignmentId IS NOT NULL AND @AssignmentId > 0
    BEGIN
        SELECT @BranchId = BranchId, @TargetDate = WorkDate
        FROM dbo.ShiftAssignments
        WHERE AssignmentId = @AssignmentId;
    END
    ELSE IF @EmployeeId IS NOT NULL AND @WorkDate IS NOT NULL
    BEGIN
        SELECT TOP 1 @AssignmentId = AssignmentId, @BranchId = BranchId, @TargetDate = WorkDate
        FROM dbo.ShiftAssignments
        WHERE EmployeeId = @EmployeeId
          AND WorkDate = @WorkDate
          AND ISNULL(Status, 'scheduled') <> 'cancelled';
    END

    IF @AssignmentId IS NULL OR @TargetDate IS NULL
    BEGIN
        SELECT 0 AS Removed;
        RETURN;
    END

    DECLARE @Year INT = DATEPART(YEAR, @TargetDate);
    DECLARE @WeekNumber INT = DATEPART(ISO_WEEK, @TargetDate);
    IF EXISTS (
        SELECT 1
        FROM dbo.ShiftScheduleWeeks
        WHERE BranchId = @BranchId
          AND [Year] = @Year
          AND WeekNumber = @WeekNumber
          AND IsLocked = 1
    )
    BEGIN
        THROW 50010, N'Lịch phân ca tuần này đã bị chốt khóa, không thể hủy ca.', 1;
    END

    DELETE FROM dbo.ShiftAssignments WHERE AssignmentId = @AssignmentId;
    SELECT 1 AS Removed;
END;
GO

PRINT N'-> Đã tạo thành công 3 SP đọc/lưu/hủy phân ca dbo.ShiftAssignments.';
GO
