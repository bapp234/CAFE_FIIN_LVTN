USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- CHUẨN HÓA HỆ THỐNG CẤP DUYỆT CÒN 3 CẤP (CẤP 1, CẤP 2, CẤP 3) - BỎ MÔ TẢ DÀI
-- ============================================================================
UPDATE dbo.ApprovalLevels
SET LevelName = CASE LevelNumber
    WHEN 1 THEN N'Cấp 1'
    WHEN 2 THEN N'Cấp 2'
    WHEN 3 THEN N'Cấp 3'
    ELSE LevelName
END,
    IsActive = CASE WHEN LevelNumber IN (1, 2, 3) THEN 1 ELSE 0 END;

UPDATE dbo.Approvers
SET ApprovalLevel = 3
WHERE ApprovalLevel > 3;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_UpdateEmployeeApprovalLevel
    @EmployeeId    INT,
    @BranchId      INT           = NULL,
    @ApprovalLevel TINYINT,
    @AssignedBy    INT           = NULL,
    @Note          NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        RAISERROR(N'Không tìm thấy hồ sơ nhân viên trong hệ thống.', 16, 1);
        RETURN;
    END;

    IF @ApprovalLevel > 3 SET @ApprovalLevel = 3;

    IF (@BranchId IS NULL OR @BranchId <= 0)
    BEGIN
        SELECT @BranchId = BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;
    END;

    BEGIN TRANSACTION;

    IF (@ApprovalLevel <= 0)
    BEGIN
        UPDATE dbo.Approvers
        SET IsActive = 0,
            Note = ISNULL(@Note, N'Đã hủy cấp duyệt từ giao diện bảng')
        WHERE EmployeeId = @EmployeeId;
    END
    ELSE
    BEGIN
        IF EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @EmployeeId)
        BEGIN
            UPDATE dbo.Approvers
            SET ApprovalLevel = @ApprovalLevel,
                BranchId = @BranchId,
                IsActive = 1,
                AssignedDate = CAST(GETDATE() AS DATE),
                Note = ISNULL(@Note, N'Cập nhật cấp duyệt từ giao diện bảng')
            WHERE EmployeeId = @EmployeeId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, IsActive, AssignedDate, Note)
            VALUES (@EmployeeId, @BranchId, @ApprovalLevel, 1, CAST(GETDATE() AS DATE), ISNULL(@Note, N'Thiết lập cấp duyệt mới'));
        END;
    END;

    COMMIT TRANSACTION;

    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        CASE WHEN @ApprovalLevel <= 0 THEN 0 ELSE ISNULL(app.ApprovalLevel, 0) END AS ApprovalLevel,
        CASE WHEN @ApprovalLevel <= 0 THEN N'Không có quyền duyệt' ELSE ISNULL(al.LevelName, N'Cấp ' + CAST(app.ApprovalLevel AS NVARCHAR(5))) END AS ApprovalLevelName
    FROM dbo.Employees e
    LEFT JOIN dbo.Approvers app ON e.EmployeeId = app.EmployeeId AND app.IsActive = 1
    LEFT JOIN dbo.ApprovalLevels al ON app.ApprovalLevel = al.LevelNumber
    WHERE e.EmployeeId = @EmployeeId;
END;
GO
PRINT N'-> Đã chuẩn hóa còn 3 cấp duyệt (Cấp 1, Cấp 2, Cấp 3).';
GO
