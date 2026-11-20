-- =======================================================================================
-- TỆP MÃ NGUỒN: 23_refactor_approval_levels_and_workflows.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   1. Tái cấu trúc chuẩn xác: "CẤP" LÀ CẤP PHÊ DUYỆT (APPROVAL LEVEL) TRONG QUY TRÌNH DUYỆT ĐƠN TỪ.
--   2. Quy trình duyệt tuần tự: Cấp 1 duyệt xong -> chuyển lên Cấp duyệt cao hơn -> Cấp cao nhất duyệt xong mới xác nhận đơn.
--   3. Cấp duyệt KHÔNG PHẢI là Admin: Người duyệt Cấp 1, Cấp 2, Cấp 3 chỉ phê duyệt đơn từ, không phải IT Admin.
--   4. Cấp duyệt KHÔNG gán cứng cho bất kỳ chức danh nào: Bất kỳ ai được phân công đều có thể duyệt Cấp 1, 2, 3.
--   5. Dọn dẹp các bảng phân quyền chung không liên quan (Permissions, LevelPermissions, EmployeeHierarchy).
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 23: TÁI CẤU TRÚC CƠ CHẾ CẤP PHÊ DUYỆT ĐƠN TỪ TUẦN TỰ';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 1: DỌN DẸP CÁC BẢNG VÀ THỦ TỤC THỪA (NGOÀI PHẠM VI CẤP DUYỆT ĐƠN TỪ)
-- =======================================================================================
IF OBJECT_ID('dbo.LevelPermissions', 'U') IS NOT NULL DROP TABLE dbo.LevelPermissions;
IF OBJECT_ID('dbo.Permissions', 'U') IS NOT NULL DROP TABLE dbo.Permissions;
IF OBJECT_ID('dbo.EmployeeHierarchy', 'U') IS NOT NULL DROP TABLE dbo.EmployeeHierarchy;
IF OBJECT_ID('dbo.HierarchyLevels', 'U') IS NOT NULL DROP TABLE dbo.HierarchyLevels;

IF OBJECT_ID('dbo.sp_Sys_AssignEmployeeLevel', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Sys_AssignEmployeeLevel;
IF OBJECT_ID('dbo.sp_Sys_SetLevelPermission', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Sys_SetLevelPermission;
IF OBJECT_ID('dbo.sp_Sys_GetHierarchyMatrix', 'P') IS NOT NULL DROP PROCEDURE dbo.sp_Sys_GetHierarchyMatrix;
IF OBJECT_ID('dbo.fn_Sys_HasPermission', 'FN') IS NOT NULL DROP FUNCTION dbo.fn_Sys_HasPermission;
GO
PRINT N'-> Đã dọn dẹp các bảng và hàm phân quyền chung không thuộc luồng Cấp phê duyệt.';
GO

-- =======================================================================================
-- PHẦN 2: BẢNG DANH MỤC CẤP PHÊ DUYỆT CÓ SẴN (dbo.ApprovalLevels)
-- Thể hiện rõ các tầng nấc duyệt đơn từ: Cấp 1, Cấp 2, Cấp 3... (Không gắn với Admin hay Chức danh)
-- =======================================================================================
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApprovalLevels')
BEGIN
    CREATE TABLE dbo.ApprovalLevels (
        LevelNumber TINYINT NOT NULL,
        LevelCode VARCHAR(20) NOT NULL,
        LevelName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ApprovalLevels_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_ApprovalLevels_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_ApprovalLevels PRIMARY KEY CLUSTERED (LevelNumber),
        CONSTRAINT UQ_ApprovalLevels_LevelCode UNIQUE (LevelCode)
    );
    PRINT N'-> Đã tạo bảng danh mục Cấp duyệt: dbo.ApprovalLevels.';
END
ELSE
BEGIN
    PRINT N'-> Bảng dbo.ApprovalLevels đã tồn tại.';
END;
GO

-- Nạp sẵn 5 Cấp duyệt chuẩn trong hệ thống
MERGE dbo.ApprovalLevels AS target
USING (
    VALUES
        (1, 'APPROVE_L1', N'Cấp duyệt 1 (Tiếp nhận & Thẩm tra sơ bộ)', N'Bước duyệt đầu tiên đối với đơn từ/yêu cầu nộp lên từ nhân viên bên dưới.'),
        (2, 'APPROVE_L2', N'Cấp duyệt 2 (Kiểm duyệt cấp trung)', N'Bước duyệt tiếp theo sau khi Cấp 1 đã đồng ý thông qua.'),
        (3, 'APPROVE_L3', N'Cấp duyệt 3 (Phê duyệt cấp cao / Xác nhận hoàn tất)', N'Bước duyệt của cấp quản lý cao hơn để xác nhận chính thức đơn từ.'),
        (4, 'APPROVE_L4', N'Cấp duyệt 4 (Duyệt thẩm quyền mở rộng)', N'Dành cho các đơn từ vượt hạn mức đặc biệt hoặc quy trình 4 cấp.'),
        (5, 'APPROVE_L5', N'Cấp duyệt 5 (Phê duyệt tối cao)', N'Cấp thẩm định tối cao của Ban Quản trị chuỗi đối với các đề xuất đặc biệt.')
) AS source (LevelNumber, LevelCode, LevelName, Description)
ON target.LevelNumber = source.LevelNumber
WHEN MATCHED THEN
    UPDATE SET 
        target.LevelCode = source.LevelCode,
        target.LevelName = source.LevelName,
        target.Description = source.Description,
        target.IsActive = 1
WHEN NOT MATCHED THEN
    INSERT (LevelNumber, LevelCode, LevelName, Description, IsActive)
    VALUES (source.LevelNumber, source.LevelCode, source.LevelName, source.Description, 1);
GO
PRINT N'-> Đã nạp 5 Cấp phê duyệt chuẩn vào dbo.ApprovalLevels.';
GO

-- =======================================================================================
-- PHẦN 3: BẢNG ĐỊNH NGHĨA QUY TRÌNH DUYỆT ĐƠN TỪ (dbo.ApprovalDefinitions)
-- Chuẩn hóa: Loại bỏ các chức danh gán cứng cũ, chỉ ghi nhận số cấp duyệt tuần tự.
-- =======================================================================================
MERGE dbo.ApprovalDefinitions AS target
USING (
    VALUES
        ('LEAVE_1DAY', N'Đơn xin nghỉ phép ngắn hạn (≤ 1 ngày)', 1, 
            N'Cấp duyệt 1 (Kiểm tra lịch & Duyệt)', NULL, NULL, 
            N'Quy trình 1 cấp: Người có Cấp duyệt 1 thẩm định và phê duyệt trực tiếp.', 1),

        ('SHIFT_SWAP', N'Đơn xin đổi ca làm việc', 2, 
            N'Cấp duyệt 1 (Xác nhận tương thích ca)', N'Cấp duyệt 2 (Chốt điều chuyển lịch)', NULL, 
            N'Quy trình 2 cấp: Cấp 1 duyệt xong chuyển lên Cấp 2 chốt lịch mới hoàn tất.', 1),

        ('SALARY_ADVANCE', N'Đơn xin tạm ứng lương giữa kỳ', 2, 
            N'Cấp duyệt 1 (Xác nhận công thực tế)', N'Cấp duyệt 2 (Duyệt hạn mức chi tạm ứng)', NULL, 
            N'Quy trình 2 cấp: Cấp 1 duyệt xong phải chờ Cấp 2 duyệt chi mới xác nhận đơn.', 1),

        ('INVENTORY_WASTE', N'Phiếu đề xuất hủy nguyên liệu hỏng / Hao hụt quầy', 2, 
            N'Cấp duyệt 1 (Lập biên bản xác nhận)', N'Cấp duyệt 2 (Thẩm định giá trị & Duyệt trừ kho)', NULL, 
            N'Quy trình 2 cấp: Cấp 1 lập & duyệt xong chuyển Cấp 2 thẩm định trừ kho.', 1),

        ('PAYROLL_PERIOD_LOCK', N'Phê duyệt bảng lương và mở khóa chi trả', 3, 
            N'Cấp duyệt 1 (Chốt bảng công chi nhánh)', N'Cấp duyệt 2 (Kiểm soát tổng quỹ lương)', N'Cấp duyệt 3 (Lệnh duyệt chi lương)', 
            N'Quy trình 3 cấp tuần tự: Cấp 1 duyệt -> Cấp 2 kiểm tra -> Cấp 3 duyệt chi.', 1)
) AS source (WorkflowCode, WorkflowName, TotalLevels, Level1_Title, Level2_Title, Level3_Title, Description, IsActive)
ON target.WorkflowCode = source.WorkflowCode
WHEN MATCHED THEN
    UPDATE SET 
        target.WorkflowName = source.WorkflowName,
        target.TotalLevels = source.TotalLevels,
        target.Level1_Title = source.Level1_Title,
        target.Level2_Title = source.Level2_Title,
        target.Level3_Title = source.Level3_Title,
        target.Description = source.Description,
        target.IsActive = source.IsActive
WHEN NOT MATCHED THEN
    INSERT (WorkflowCode, WorkflowName, TotalLevels, Level1_Title, Level2_Title, Level3_Title, Description, IsActive)
    VALUES (source.WorkflowCode, source.WorkflowName, source.TotalLevels, source.Level1_Title, source.Level2_Title, source.Level3_Title, source.Description, source.IsActive);
GO
PRINT N'-> Đã chuẩn hóa danh mục Quy trình duyệt trong dbo.ApprovalDefinitions (Không còn gán cứng chức danh).';
GO

-- =======================================================================================
-- PHẦN 4: BẢNG MA TRẬN NGƯỜI DUYỆT (dbo.Approvers) & CÁC HÀM TIỆN ÍCH THẨM ĐỊNH QUYỀN DUYỆT
-- Phân bổ: Ai duyệt Cấp mấy, tại Chi nhánh nào, Cấp trên trong luồng duyệt là ai.
-- HOÀN TOÀN TÁCH RỜI CHỨC DANH: Bất kỳ nhân sự nào cũng có thể được giao Cấp 1, Cấp 2...
-- =======================================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys 
    WHERE parent_object_id = OBJECT_ID('dbo.Approvers') AND name = 'FK_Approvers_ApprovalLevels'
)
BEGIN
    ALTER TABLE dbo.Approvers
    ADD CONSTRAINT FK_Approvers_ApprovalLevels FOREIGN KEY (ApprovalLevel) REFERENCES dbo.ApprovalLevels(LevelNumber);
    PRINT N'-> Đã gắn khóa ngoại dbo.Approvers(ApprovalLevel) -> dbo.ApprovalLevels(LevelNumber).';
END;
GO

-- 4.1 Hàm kiểm tra trạng thái hoạt động của nhân viên
CREATE OR ALTER FUNCTION dbo.fn_Sys_IsEmployeeActive
(
    @EmployeeId INT
)
RETURNS BIT
AS
BEGIN
    DECLARE @IsActive BIT = 0;

    IF EXISTS (
        SELECT 1 
        FROM dbo.Employees e
        LEFT JOIN dbo.Users u ON e.UserId = u.UserId
        WHERE e.EmployeeId = @EmployeeId
          AND e.Status = 'active'
          AND (e.UserId IS NULL OR u.IsActive = 1)
    )
    BEGIN
        SET @IsActive = 1;
    END;

    RETURN @IsActive;
END;
GO
PRINT N'-> Đã tạo Scalar Function: dbo.fn_Sys_IsEmployeeActive.';
GO

-- 4.2 Hàm kiểm tra thẩm quyền duyệt của nhân viên tại bước hiện tại
CREATE OR ALTER FUNCTION dbo.fn_CanEmployeeApproveStep
(
    @EmployeeId INT,
    @RequestId BIGINT
)
RETURNS BIT
AS
BEGIN
    DECLARE @CanApprove BIT = 0;
    DECLARE @RequesterId INT;
    DECLARE @BranchId INT;
    DECLARE @CurrentLevel TINYINT;
    DECLARE @WorkflowCode VARCHAR(50);
    DECLARE @RequestStatus VARCHAR(20);

    SELECT 
        @RequesterId = RequesterId,
        @BranchId = BranchId,
        @CurrentLevel = CurrentLevel,
        @WorkflowCode = WorkflowCode,
        @RequestStatus = Status
    FROM dbo.ApprovalRequests
    WHERE RequestId = @RequestId;

    -- Đơn không ở trạng thái chờ duyệt thì không cho duyệt
    IF @RequestStatus NOT IN ('pending', 'in_progress')
        RETURN 0;

    -- Nguyên tắc Separation of Duties: Không cho tự duyệt đơn của mình
    IF @RequesterId = @EmployeeId
        RETURN 0;

    -- Kiểm tra nhân sự có đang active không
    IF dbo.fn_Sys_IsEmployeeActive(@EmployeeId) = 0
        RETURN 0;

    -- Thẩm định qua bảng Approvers: đúng Cấp duyệt hiện tại và chi nhánh
    IF EXISTS (
        SELECT 1 
        FROM dbo.Approvers ap
        WHERE ap.EmployeeId = @EmployeeId
          AND ap.IsActive = 1
          AND ap.ApprovalLevel = @CurrentLevel
          AND (ap.BranchId IS NULL OR ap.BranchId = @BranchId)
          AND (ap.WorkflowCode IS NULL OR ap.WorkflowCode = @WorkflowCode)
    )
    BEGIN
        SET @CanApprove = 1;
    END;

    RETURN @CanApprove;
END;
GO
PRINT N'-> Đã tạo Scalar Function: dbo.fn_CanEmployeeApproveStep.';
GO

-- =======================================================================================
-- PHẦN 5: CHUẨN HÓA THỦ TỤC XỬ LÝ DUYỆT TUẦN TỰ: dbo.sp_Approval_ProcessStep
-- Cốt lõi: Người có Cấp 1 duyệt xong PHẢI CHỜ người có Cấp duyệt cao hơn duyệt mới xác nhận đơn!
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_Approval_ProcessStep
    @RequestId BIGINT,
    @ApproverEmployeeId INT,
    @Decision VARCHAR(20),       -- 'approved' hoặc 'rejected'
    @Comment NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Kiểm tra quyết định hợp lệ
        IF @Decision NOT IN ('approved', 'rejected')
        BEGIN
            THROW 51003, N'Quyết định không hợp lệ. Chỉ chấp nhận "approved" (Đồng ý) hoặc "rejected" (Từ chối).', 1;
        END;

        -- 2. Kiểm tra tồn tại yêu cầu
        IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalRequests WHERE RequestId = @RequestId)
        BEGIN
            THROW 51001, N'Không tìm thấy phiếu yêu cầu phê duyệt.', 1;
        END;

        -- 3. Lấy thông tin trạng thái hiện tại của đơn
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

        -- Không cho phép duyệt lại đơn đã đóng
        IF @CurrentStatus IN ('approved', 'rejected', 'cancelled')
        BEGIN
            THROW 51002, N'Đơn từ / yêu cầu này đã được xử lý hoàn tất hoặc đã bị hủy bỏ trước đó.', 1;
        END;

        -- Chống tự duyệt đơn của chính mình
        IF @ApproverEmployeeId = @RequesterId
        BEGIN
            THROW 51005, N'Quy định bảo mật: Người nộp đơn không được phép tự phê duyệt đơn của chính mình.', 1;
        END;

        -- 4. Thẩm định xem nhân sự này có được phân bổ thẩm quyền duyệt tại Cấp hiện tại hay không
        DECLARE @ApproverId INT = NULL;
        SELECT TOP 1 @ApproverId = ap.ApproverId
        FROM dbo.Approvers ap
        WHERE ap.EmployeeId = @ApproverEmployeeId
          AND ap.ApprovalLevel = @CurrentLevel
          AND ap.IsActive = 1
          AND (ap.BranchId IS NULL OR ap.BranchId = @BranchId)
          AND (ap.WorkflowCode IS NULL OR ap.WorkflowCode = @WorkflowCode);

        IF @ApproverId IS NULL
        BEGIN
            THROW 51004, N'Bạn không có thẩm quyền duyệt ở cấp độ hiện tại của đơn này (Không thuộc cấp duyệt đang chờ hoặc sai chi nhánh).', 1;
        END;

        -- ===============================================================================
        -- 5. XỬ LÝ TRƯỜNG HỢP: TỪ CHỐI (REJECTED)
        -- Nếu bất kỳ cấp nào từ chối, đơn từ bị BÁC BỎ NGAY LẬP TỨC và DỪNG TOÀN BỘ LUỒNG DUYỆT.
        -- ===============================================================================
        IF @Decision = 'rejected'
        BEGIN
            -- Cập nhật bước hiện tại
            UPDATE dbo.ApprovalSteps
            SET 
                Decision = 'rejected',
                ApproverId = @ApproverId,
                ApproverEmployeeId = @ApproverEmployeeId,
                Comment = ISNULL(@Comment, N'Từ chối yêu cầu'),
                DecidedAt = SYSDATETIME()
            WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel;

            -- Hủy các bước sau (nếu có)
            UPDATE dbo.ApprovalSteps
            SET Decision = 'cancelled'
            WHERE RequestId = @RequestId AND StepLevel > @CurrentLevel;

            -- Đóng đơn ở trạng thái Bị từ chối
            UPDATE dbo.ApprovalRequests
            SET 
                Status = 'rejected',
                CompletedAt = SYSDATETIME()
            WHERE RequestId = @RequestId;
        END

        -- ===============================================================================
        -- 6. XỬ LÝ TRƯỜNG HỢP: ĐỒNG Ý (APPROVED)
        -- Tuần tự: Nếu chưa phải cấp cuối -> Chờ người có cấp duyệt cao hơn duyệt tiếp.
        --           Nếu là cấp duyệt cuối cùng -> XÁC NHẬN HOÀN TẤT ĐƠN TỪ!
        -- ===============================================================================
        ELSE IF @Decision = 'approved'
        BEGIN
            -- Ghi nhận bước hiện tại đã duyệt thành công
            UPDATE dbo.ApprovalSteps
            SET 
                Decision = 'approved',
                ApproverId = @ApproverId,
                ApproverEmployeeId = @ApproverEmployeeId,
                Comment = @Comment,
                DecidedAt = SYSDATETIME()
            WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel;

            -- KIỂM TRA: Nếu còn cấp duyệt cao hơn (CurrentLevel < TotalLevels)
            -- Đơn PHẢI CHỜ người có Cấp duyệt cao hơn duyệt tiếp!
            IF @CurrentLevel < @TotalLevels
            BEGIN
                -- Mở khóa bước duyệt tiếp theo: Chuyển từ 'waiting' sang 'pending'
                UPDATE dbo.ApprovalSteps
                SET Decision = 'pending'
                WHERE RequestId = @RequestId AND StepLevel = @CurrentLevel + 1;

                -- Nâng trạng thái đơn: Chuyển sang Cấp tiếp theo, trạng thái 'in_progress'
                UPDATE dbo.ApprovalRequests
                SET 
                    CurrentLevel = @CurrentLevel + 1,
                    Status = 'in_progress'
                WHERE RequestId = @RequestId;
            END
            ELSE
            -- ĐÂY LÀ CẤP DUYỆT CAO NHẤT (CẤP CUỐI CÙNG): CHÍNH THỨC XÁC NHẬN ĐƠN TỪ THÀNH CÔNG!
            BEGIN
                UPDATE dbo.ApprovalRequests
                SET 
                    Status = 'approved',
                    CompletedAt = SYSDATETIME()
                WHERE RequestId = @RequestId;
            END;
        END;

        COMMIT TRANSACTION;

        -- Trả về trạng thái chi tiết của phiếu sau khi duyệt
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
PRINT N'-> Đã nâng cấp Stored Procedure duyệt tuần tự: dbo.sp_Approval_ProcessStep.';
GO

-- =======================================================================================
-- PHẦN 6: THỦ TỤC PHÂN BỔ NHÂN SỰ VÀO CẤP DUYỆT (dbo.sp_Approval_SetApprover)
-- Phân bổ: Ai làm người duyệt Cấp mấy, tại Chi nhánh nào, Cấp trên trong luồng duyệt là ai.
-- KHÔNG RÀNG BUỘC CHỨC DANH NÀO!
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_Approval_SetApprover
    @EmployeeId INT,
    @ApprovalLevel TINYINT,          -- 1, 2, 3...
    @BranchId INT = NULL,            -- NULL = Toàn chuỗi
    @ParentApproverId INT = NULL,    -- Cấp trên trực tiếp trong luồng duyệt (Cấp 1 trỏ lên Cấp 2...)
    @WorkflowCode VARCHAR(50) = NULL,-- NULL = Duyệt mọi loại đơn từ
    @Note NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM dbo.ApprovalLevels WHERE LevelNumber = @ApprovalLevel AND IsActive = 1)
    BEGIN
        THROW 50031, N'Cấp phê duyệt không hợp lệ trong hệ thống.', 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
    BEGIN
        THROW 50032, N'Không tìm thấy nhân viên được chỉ định.', 1;
    END;

    -- Kiểm tra cấp trên hợp lệ (Cấp 1 phải trỏ lên Cấp duyệt cao hơn)
    IF @ParentApproverId IS NOT NULL
    BEGIN
        DECLARE @ParentLevel TINYINT;
        SELECT @ParentLevel = ApprovalLevel FROM dbo.Approvers WHERE ApproverId = @ParentApproverId;
        IF @ParentLevel <= @ApprovalLevel
        BEGIN
            THROW 50033, N'Người duyệt cấp trên (ParentApprover) phải có Cấp duyệt lớn hơn cấp hiện tại.', 1;
        END;
    END;

    -- Thêm hoặc cập nhật phân bổ người duyệt
    INSERT INTO dbo.Approvers (
        EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, AssignedDate, Note
    )
    VALUES (
        @EmployeeId, @BranchId, @ApprovalLevel, @ParentApproverId, @WorkflowCode, 1, CAST(SYSDATETIME() AS DATE), @Note
    );

    DECLARE @NewApproverId INT = SCOPE_IDENTITY();

    SELECT 
        ap.ApproverId,
        ap.EmployeeId,
        e.EmployeeCode,
        e.FullName,
        e.Position,
        ap.ApprovalLevel,
        al.LevelName,
        ap.BranchId,
        ap.ParentApproverId,
        ap.WorkflowCode,
        ap.IsActive
    FROM dbo.Approvers ap
    INNER JOIN dbo.Employees e ON ap.EmployeeId = e.EmployeeId
    INNER JOIN dbo.ApprovalLevels al ON ap.ApprovalLevel = al.LevelNumber
    WHERE ap.ApproverId = @NewApproverId;
END;
GO
PRINT N'-> Đã tạo Stored Procedure: dbo.sp_Approval_SetApprover.';
GO

-- =======================================================================================
-- PHẦN 7: NẠP DỮ LIỆU MẪU CẤP DUYỆT (APPROVERS) CHO CÁC CHI NHÁNH
-- Cấp 1 (Duyệt bước 1) -> Cấp 2 (Duyệt bước 2) -> Cấp 3 (Duyệt bước 3)
-- =======================================================================================
PRINT N'Bắt đầu thiết lập cây phả hệ Người duyệt tuần tự (Approvers)...';

-- Xóa dữ liệu seed cũ của Approvers (nếu có)
DELETE FROM dbo.Approvers;
DBCC CHECKIDENT ('dbo.Approvers', RESEED, 0);

-- 1. Thiết lập Cấp 3 (Đỉnh của luồng duyệt: Phê duyệt tối cao/toàn chuỗi)
-- Ví dụ: Gán nhân sự NV002 (Lê Thanh Tùng) làm Người duyệt Cấp 3 toàn chuỗi
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (2, NULL, 3, NULL, NULL, 1, N'Người duyệt Cấp 3 - Toàn chuỗi');
DECLARE @L3_ApproverId INT = SCOPE_IDENTITY();

-- 2. Thiết lập Cấp 2 cho từng chi nhánh (Trỏ lên Cấp 3)
-- Chi nhánh 1 (Q1 - Đinh Tiên Hoàng): Gán NV019 (Trần Bảo Vinh) làm Cấp 2
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (19, 1, 2, @L3_ApproverId, NULL, 1, N'Người duyệt Cấp 2 - Chi nhánh Q1');
DECLARE @L2_Branch1 INT = SCOPE_IDENTITY();

-- Chi nhánh 2 (Hồ Con Rùa): Gán NV048 (Nguyễn Văn Tuấn) làm Cấp 2
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (48, 2, 2, @L3_ApproverId, NULL, 1, N'Người duyệt Cấp 2 - Chi nhánh Hồ Con Rùa');
DECLARE @L2_Branch2 INT = SCOPE_IDENTITY();

-- 3. Thiết lập Cấp 1 cho từng chi nhánh (Trỏ lên Cấp 2 tương ứng)
-- Tại Chi nhánh Q1: Gán NV021 (Phạm Hải Dương) làm Cấp 1
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (21, 1, 1, @L2_Branch1, NULL, 1, N'Người duyệt Cấp 1 - Chi nhánh Q1');

-- Tại Chi nhánh Q1: Gán thêm NV022 (Nguyễn Thị Mai) làm Cấp 1
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (22, 1, 1, @L2_Branch1, NULL, 1, N'Người duyệt Cấp 1 (dự phòng) - Chi nhánh Q1');

-- Tại Chi nhánh Hồ Con Rùa: Gán NV050 (Đặng Văn Hùng) làm Cấp 1
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (50, 2, 1, @L2_Branch2, NULL, 1, N'Người duyệt Cấp 1 - Chi nhánh Hồ Con Rùa');

GO
PRINT N'-> Đã thiết lập xong Cây phả hệ Người duyệt theo Cấp trong dbo.Approvers.';
GO

-- =======================================================================================
-- PHẦN 8: KIỂM TRA VÀ THỰC THI THỬ NGHIỆM LUỒNG DUYỆT TUẦN TỰ
-- =======================================================================================
PRINT N'=======================================================================================';
PRINT N'DANH SÁCH CÁC CẤP PHÊ DUYỆT ĐÃ THIẾT LẬP:';
SELECT LevelNumber, LevelCode, LevelName, Description FROM dbo.ApprovalLevels ORDER BY LevelNumber;

PRINT N'=======================================================================================';
PRINT N'CÂY PHẢ HỆ NGƯỜI DUYỆT TUẦN TỰ (CẤP 1 -> CẤP 2 -> CẤP 3):';
SELECT 
    ap.ApproverId,
    e.EmployeeCode,
    e.FullName,
    e.Position,
    b.BranchName,
    ap.ApprovalLevel AS [CapDuyet],
    al.LevelName AS [TenCapDuyet],
    parentE.FullName AS [CapTrenTrucTiep],
    parentAp.ApprovalLevel AS [CapDuyetCuaCapTren]
FROM dbo.Approvers ap
INNER JOIN dbo.Employees e ON ap.EmployeeId = e.EmployeeId
INNER JOIN dbo.ApprovalLevels al ON ap.ApprovalLevel = al.LevelNumber
LEFT JOIN dbo.Branches b ON ap.BranchId = b.BranchId
LEFT JOIN dbo.Approvers parentAp ON ap.ParentApproverId = parentAp.ApproverId
LEFT JOIN dbo.Employees parentE ON parentAp.EmployeeId = parentE.EmployeeId
ORDER BY ap.BranchId, ap.ApprovalLevel ASC;

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT TRIỂN KHAI 23: CƠ CHẾ CẤP PHÊ DUYỆT TUẦN TỰ ĐÃ CHUẨN XÁC 100%!';
PRINT N'=======================================================================================';
GO
