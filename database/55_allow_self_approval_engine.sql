USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- CHO PHÉP NGƯỜI TẠO ĐƠN TỰ DUYỆT NẾU CHÍNH HỌ LÀ NGƯỜI CÓ THẨM QUYỀN DUYỆT ĐƠN
-- ============================================================================
CREATE OR ALTER FUNCTION dbo.fn_CanEmployeeApproveStep
(
    @EmployeeId INT,
    @RequestId  BIGINT
)
RETURNS BIT
AS
BEGIN
    DECLARE @CanApprove BIT = 0;
    DECLARE @BranchId INT;
    DECLARE @CurrentLevel TINYINT;
    DECLARE @WorkflowCode VARCHAR(50);
    DECLARE @RequestStatus VARCHAR(20);

    SELECT
        @BranchId = BranchId,
        @CurrentLevel = CurrentLevel,
        @WorkflowCode = WorkflowCode,
        @RequestStatus = Status
    FROM dbo.ApprovalRequests
    WHERE RequestId = @RequestId;

    IF @RequestStatus NOT IN ('pending', 'in_progress')
        RETURN 0;

    IF dbo.fn_Sys_IsEmployeeActive(@EmployeeId) = 0
        RETURN 0;

    -- Cho phép tự duyệt nếu chính người tạo đơn thuộc danh sách Approvers hợp lệ
    IF EXISTS (
        SELECT 1
        FROM dbo.Approvers ap
        WHERE ap.EmployeeId = @EmployeeId
          AND ap.IsActive = 1
          AND ap.ApprovalLevel >= @CurrentLevel
          AND (ap.BranchId IS NULL OR ap.BranchId = @BranchId)
          AND (ap.WorkflowCode IS NULL OR ap.WorkflowCode = @WorkflowCode)
    )
    BEGIN
        SET @CanApprove = 1;
    END;

    RETURN @CanApprove;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_Approval_ProcessStep
    @RequestId          BIGINT,
    @ApproverEmployeeId INT,
    @Decision           VARCHAR(20),       -- 'approved' hoặc 'rejected'
    @Comment            NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        IF @Decision NOT IN ('approved', 'rejected')
        BEGIN
            THROW 51003, N'Quyết định không hợp lệ. Chỉ chấp nhận "approved" (Đồng ý) hoặc "rejected" (Từ chối).', 1;
        END;

        IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalRequests WHERE RequestId = @RequestId)
        BEGIN
            THROW 51001, N'Không tìm thấy phiếu yêu cầu phê duyệt.', 1;
        END;

        DECLARE @CurrentLevel TINYINT;
        DECLARE @TotalLevels TINYINT;
        DECLARE @BranchId INT;
        DECLARE @WorkflowCode VARCHAR(50);
        DECLARE @RequesterId INT;
        DECLARE @CurrentStatus VARCHAR(20);

        SELECT
            @CurrentLevel = CurrentLevel,
            @TotalLevels = TotalLevels,
            @BranchId = BranchId,
            @WorkflowCode = WorkflowCode,
            @RequesterId = RequesterId,
            @CurrentStatus = Status
        FROM dbo.ApprovalRequests
        WHERE RequestId = @RequestId;

        IF @CurrentStatus IN ('approved', 'rejected', 'cancelled')
        BEGIN
            THROW 51002, N'Đơn từ / yêu cầu này đã được xử lý hoàn tất hoặc đã bị hủy bỏ trước đó.', 1;
        END;

        -- Cho phép tự duyệt nếu người tạo đơn đồng thời là người có thẩm quyền duyệt hợp lệ
        DECLARE @ApproverId INT = NULL;
        SELECT TOP 1 @ApproverId = ap.ApproverId
        FROM dbo.Approvers ap
        WHERE ap.EmployeeId = @ApproverEmployeeId
          AND ap.ApprovalLevel >= @CurrentLevel
          AND ap.IsActive = 1
          AND (ap.BranchId IS NULL OR ap.BranchId = @BranchId)
          AND (ap.WorkflowCode IS NULL OR ap.WorkflowCode = @WorkflowCode)
        ORDER BY CASE WHEN ap.ApprovalLevel = @CurrentLevel THEN 0 ELSE 1 END, ap.ApprovalLevel ASC;

        IF @ApproverId IS NULL
        BEGIN
            THROW 51004, N'Bạn không có thẩm quyền duyệt ở cấp độ hiện tại của đơn này (Không thuộc cấp duyệt đang chờ hoặc sai chi nhánh).', 1;
        END;

        IF @Decision = 'rejected'
        BEGIN
            UPDATE dbo.ApprovalSteps
            SET
                Decision = 'rejected',
                ApproverId = @ApproverId,
                ApproverEmployeeId = @ApproverEmployeeId,
                Comment = ISNULL(@Comment, N'Từ chối yêu cầu'),
                DecidedAt = SYSDATETIME()
            WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel;

            UPDATE dbo.ApprovalSteps
            SET Decision = 'cancelled'
            WHERE RequestId = @RequestId AND StepLevel > @CurrentLevel;

            UPDATE dbo.ApprovalRequests
            SET
                Status = 'rejected',
                CompletedAt = SYSDATETIME()
            WHERE RequestId = @RequestId;
        END
        ELSE IF @Decision = 'approved'
        BEGIN
            UPDATE dbo.ApprovalSteps
            SET
                Decision = 'approved',
                ApproverId = @ApproverId,
                ApproverEmployeeId = @ApproverEmployeeId,
                Comment = @Comment,
                DecidedAt = SYSDATETIME()
            WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel;

            IF @CurrentLevel < @TotalLevels
            BEGIN
                UPDATE dbo.ApprovalSteps
                SET Decision = 'pending'
                WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel + 1;

                UPDATE dbo.ApprovalRequests
                SET
                    CurrentLevel = @CurrentLevel + 1,
                    Status = 'in_progress'
                WHERE RequestId = @RequestId;
            END
            ELSE
            BEGIN
                UPDATE dbo.ApprovalRequests
                SET
                    Status = 'approved',
                    CompletedAt = SYSDATETIME()
                WHERE RequestId = @RequestId;
            END;
        END;

        COMMIT TRANSACTION;

        SELECT
            ar.RequestId,
            ar.RequestCode,
            ar.WorkflowCode,
            ad.WorkflowName,
            ar.RequesterId,
            ar.TotalLevels,
            ar.CurrentLevel,
            ar.Status,
            CASE
                WHEN ar.Status = 'approved' THEN N'Đã hoàn tất duyệt tất cả các cấp - Đơn đã được xác nhận!'
                WHEN ar.Status = 'rejected' THEN N'Đơn đã bị từ chối phê duyệt.'
                ELSE N'Cấp ' + CAST(ar.CurrentLevel - 1 AS NVARCHAR) + N' đã duyệt xong -> Đang chờ Cấp ' + CAST(ar.CurrentLevel AS NVARCHAR) + N' phê duyệt.'
            END AS WorkflowMessage,
            ar.CompletedAt
        FROM dbo.ApprovalRequests ar
        INNER JOIN dbo.ApprovalDefinitions ad ON ar.WorkflowCode = ad.WorkflowCode
        WHERE ar.RequestId = @RequestId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
