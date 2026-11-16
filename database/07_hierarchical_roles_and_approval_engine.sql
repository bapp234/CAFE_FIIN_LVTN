-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ FIIN (COFFEE SHOP MANAGEMENT SYSTEM)
-- BẢN CẬP NHẬT CSDL SỐ 02: BẢNG APPROVERS ĐỘC LẬP & ĐỘNG CƠ PHÊ DUYỆT ĐA CẤP (1-3 CẤP)
-- =======================================================================================
-- Database: CoffeeShopDB
-- Target Engine: Microsoft SQL Server 2019 / 2022 / 2025
-- Thiết kế: Agent A - Software Developer
-- Nguyên lý kiến trúc:
--   1. Separation of Concerns (SoC): Bảng Employees giữ nguyên sạch sẽ, KHÔNG nhét cột duyệt vào nhân sự.
--   2. Bảng Approvers độc lập: Chuyên trách quản lý ma trận cấp duyệt và cây phả hệ duyệt (ParentApproverId).
--   3. Tinh gọn & Tái sử dụng: Sinh các Procedure và Function tiện ích dùng chung (sp_Sys_GenerateDocumentCode,
--      fn_Sys_IsEmployeeActive, fn_GetApproverHierarchyTree...) tái sử dụng cho toàn bộ các module sau này.
-- =======================================================================================

USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- PHẦN 1: TIỆN ÍCH DÙNG CHUNG HỆ THỐNG (SYSTEM UTILITIES & SEQUENCE)
-- =======================================================================================

-- 1.1 Sequence sinh mã chứng từ toàn hệ thống (Dùng chung cho Phiếu duyệt, Hóa đơn, Nhập kho...)
IF NOT EXISTS (SELECT 1 FROM sys.sequences WHERE name = 'Seq_SysDocumentCode')
BEGIN
    CREATE SEQUENCE dbo.Seq_SysDocumentCode
        AS BIGINT
        START WITH 1
        INCREMENT BY 1;
    PRINT N'-> Đã tạo Sequence dùng chung: Seq_SysDocumentCode.';
END
GO

-- 1.2 Stored Procedure tiện ích dùng chung: Sinh mã văn bản / chứng từ chuẩn hóa
-- Cú pháp sinh: [PREFIX]-[YYYYMM]-[0001] (ví dụ: REQ-202611-0001, INV-202611-0002, ORD-202611-0099)
-- Tái sử dụng trực tiếp cho tất cả các Stored Procedure của mọi phân hệ (HRM, Kho, Bán hàng, Phê duyệt)
CREATE OR ALTER PROCEDURE dbo.sp_Sys_GenerateDocumentCode
    @Prefix VARCHAR(10),
    @GeneratedCode VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @SeqVal BIGINT = NEXT VALUE FOR dbo.Seq_SysDocumentCode;
    DECLARE @YearMonth VARCHAR(6) = FORMAT(GETDATE(), 'yyyyMM');
    SET @GeneratedCode = @Prefix + '-' + @YearMonth + '-' + RIGHT('0000' + CAST(@SeqVal AS VARCHAR(10)), 4);
END;
GO
PRINT N'-> Đã tạo Stored Procedure tiện ích dùng chung: dbo.sp_Sys_GenerateDocumentCode.';
GO

-- 1.3 Function tiện ích dùng chung: Kiểm tra trạng thái hoạt động của nhân viên
-- Kiểm tra nhanh xem nhân sự có đang active và tài khoản người dùng có hiệu lực hay không
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
        INNER JOIN dbo.Users u ON e.UserId = u.UserId
        WHERE e.EmployeeId = @EmployeeId
          AND e.Status = 'active'
          AND u.IsActive = 1
    )
    BEGIN
        SET @IsActive = 1;
    END

    RETURN @IsActive;
END;
GO
PRINT N'-> Đã tạo Scalar Function dùng chung: dbo.fn_Sys_IsEmployeeActive.';
GO

-- =======================================================================================
-- PHẦN 2: CHUẨN HÓA BẢNG VAI TRÒ (ROLES) VỚI CÂY PHẢ HỆ PARENT_ROLE_ID
-- =======================================================================================

-- 2.1 Bổ sung ParentRoleId vào Roles (nếu chưa có) để hiển thị TreeView phân quyền
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Roles') AND name = 'ParentRoleId'
)
BEGIN
    ALTER TABLE dbo.Roles 
    ADD ParentRoleId INT NULL;

    ALTER TABLE dbo.Roles
    ADD CONSTRAINT FK_Roles_ParentRole 
    FOREIGN KEY (ParentRoleId) REFERENCES dbo.Roles(RoleId);

    PRINT N'-> Đã thêm cột ParentRoleId vào bảng Roles.';
END
GO

-- 2.2 Chuẩn hóa 7 vai trò chuẩn chuỗi cà phê F&B
-- [Admin]
--   ├── [HRManager]
--   ├── [Accountant]
--   └── [StoreManager]
--         └── [ShiftLeader]
--               ├── [Cashier]
--               └── [Barista]

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId = 1)
    UPDATE dbo.Roles SET RoleName = 'Admin', Description = N'Quản trị viên toàn hệ thống / Ban Giám đốc', ParentRoleId = NULL WHERE RoleId = 1;

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId = 2)
    UPDATE dbo.Roles SET RoleName = 'HRManager', Description = N'Chuyên viên Quản trị Nhân sự & Tiền lương chuỗi', ParentRoleId = 1 WHERE RoleId = 2;

IF EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleId = 3)
    UPDATE dbo.Roles SET RoleName = 'StoreManager', Description = N'Quản lý Cửa hàng Chi nhánh (Cửa hàng trưởng)', ParentRoleId = 1 WHERE RoleId = 3;

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'ShiftLeader')
    INSERT INTO dbo.Roles (RoleName, Description, ParentRoleId) VALUES ('ShiftLeader', N'Trưởng ca pha chế / Giám sát vận hành ca làm việc', 3);
ELSE
    UPDATE dbo.Roles SET Description = N'Trưởng ca pha chế / Giám sát vận hành ca làm việc', ParentRoleId = 3 WHERE RoleName = 'ShiftLeader';

IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = 'Accountant')
    INSERT INTO dbo.Roles (RoleName, Description, ParentRoleId) VALUES ('Accountant', N'Kế toán trưởng / Quản lý dòng tiền & Kiểm soát kho', 1);
ELSE
    UPDATE dbo.Roles SET Description = N'Kế toán trưởng / Quản lý dòng tiền & Kiểm soát kho', ParentRoleId = 1 WHERE RoleName = 'Accountant';

DECLARE @ShiftLeaderRoleId INT = (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'ShiftLeader');
UPDATE dbo.Roles SET Description = N'Thu ngân bán hàng POS tại cửa hàng', ParentRoleId = @ShiftLeaderRoleId WHERE RoleName = 'Cashier';
UPDATE dbo.Roles SET Description = N'Pha chế quầy bar & Phục vụ khách hàng', ParentRoleId = @ShiftLeaderRoleId WHERE RoleName = 'Barista';

PRINT N'-> Đã chuẩn hóa ma trận 7 Vai trò theo cây phả hệ.';
GO

-- =======================================================================================
-- PHẦN 3: BẢNG APPROVERS (CHUYÊN TRÁCH CẤP DUYỆT & CÂY PHẢ HỆ DUYỆT)
-- =======================================================================================
-- Bảng này lưu danh sách nhân sự được trao quyền duyệt, xác định rõ:
--   - Duyệt cấp mấy (ApprovalLevel: 1, 2 hoặc 3)
--   - Phạm vi chi nhánh nào (BranchId: NULL = Toàn chuỗi)
--   - Cấp trên trực tiếp trong luồng duyệt là ai (ParentApproverId: Cấp 1 -> Cấp 2 -> Cấp 3 -> NULL)
--   - Loại quy trình được duyệt (WorkflowCode: NULL = Tất cả loại đơn)

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Approvers')
BEGIN
    CREATE TABLE dbo.Approvers (
        ApproverId INT IDENTITY(1,1) PRIMARY KEY,
        EmployeeId INT NOT NULL REFERENCES dbo.Employees(EmployeeId),
        BranchId INT NULL REFERENCES dbo.Branches(BranchId),
        ApprovalLevel TINYINT NOT NULL CHECK (ApprovalLevel BETWEEN 1 AND 3),
        ParentApproverId INT NULL REFERENCES dbo.Approvers(ApproverId),
        WorkflowCode VARCHAR(50) NULL, -- Khóa ngoại mềm với ApprovalDefinitions
        IsActive BIT NOT NULL DEFAULT 1,
        AssignedDate DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        Note NVARCHAR(255) NULL
    );
    PRINT N'-> Đã tạo bảng độc lập dbo.Approvers (Cấp duyệt & Cây phả hệ phê duyệt).';
END
GO

-- =======================================================================================
-- PHẦN 4: ĐỘNG CƠ PHÊ DUYỆT ĐA CẤP (GENERIC APPROVAL ENGINE: 1 ĐẾN 3 CẤP)
-- =======================================================================================

-- 4.1 Bảng ApprovalDefinitions: Định nghĩa loại quy trình và số cấp duyệt (1..3 cấp)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApprovalDefinitions')
BEGIN
    CREATE TABLE dbo.ApprovalDefinitions (
        WorkflowCode VARCHAR(50) NOT NULL PRIMARY KEY,
        WorkflowName NVARCHAR(100) NOT NULL,
        TotalLevels TINYINT NOT NULL CHECK (TotalLevels BETWEEN 1 AND 3),
        Level1_Title NVARCHAR(50) NOT NULL DEFAULT N'Duyệt Cấp 1 (Trưởng ca)',
        Level2_Title NVARCHAR(50) NULL DEFAULT N'Duyệt Cấp 2 (Cửa hàng trưởng)',
        Level3_Title NVARCHAR(50) NULL DEFAULT N'Duyệt Cấp 3 (Văn phòng tổng)',
        Description NVARCHAR(255) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
    PRINT N'-> Đã tạo bảng dbo.ApprovalDefinitions (Cấu hình quy trình 1..3 cấp).';
END
GO

-- 4.2 Bảng ApprovalRequests: Lưu từng phiếu yêu cầu phê duyệt
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApprovalRequests')
BEGIN
    CREATE TABLE dbo.ApprovalRequests (
        RequestId BIGINT IDENTITY(1,1) PRIMARY KEY,
        RequestCode VARCHAR(30) NOT NULL UNIQUE,
        WorkflowCode VARCHAR(50) NOT NULL REFERENCES dbo.ApprovalDefinitions(WorkflowCode),
        RequesterId INT NOT NULL REFERENCES dbo.Employees(EmployeeId),
        BranchId INT NOT NULL REFERENCES dbo.Branches(BranchId),
        ReferenceTable VARCHAR(50) NULL,
        ReferenceId VARCHAR(50) NULL,
        Title NVARCHAR(200) NOT NULL,
        Reason NVARCHAR(500) NOT NULL,
        PayloadJson NVARCHAR(MAX) NULL,
        TotalLevels TINYINT NOT NULL CHECK (TotalLevels BETWEEN 1 AND 3),
        CurrentLevel TINYINT NOT NULL DEFAULT 1 CHECK (CurrentLevel BETWEEN 1 AND 3),
        Status VARCHAR(20) NOT NULL DEFAULT 'pending' 
            CHECK (Status IN ('pending', 'in_progress', 'approved', 'rejected', 'cancelled')),
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CompletedAt DATETIME2 NULL
    );
    PRINT N'-> Đã tạo bảng dbo.ApprovalRequests (Phiếu yêu cầu phê duyệt).';
END
GO

-- 4.3 Bảng ApprovalSteps: Lịch sử từng bước phê duyệt (1..3 bước)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ApprovalSteps')
BEGIN
    CREATE TABLE dbo.ApprovalSteps (
        StepId BIGINT IDENTITY(1,1) PRIMARY KEY,
        RequestId BIGINT NOT NULL REFERENCES dbo.ApprovalRequests(RequestId) ON DELETE CASCADE,
        StepLevel TINYINT NOT NULL CHECK (StepLevel BETWEEN 1 AND 3),
        ApproverId INT NULL REFERENCES dbo.Approvers(ApproverId),
        ApproverEmployeeId INT NULL REFERENCES dbo.Employees(EmployeeId),
        Decision VARCHAR(20) NOT NULL DEFAULT 'waiting' 
            CHECK (Decision IN ('waiting', 'pending', 'approved', 'rejected')),
        Comment NVARCHAR(500) NULL,
        DecidedAt DATETIME2 NULL,
        CONSTRAINT UQ_ApprovalSteps_Request_Level UNIQUE (RequestId, StepLevel)
    );
    PRINT N'-> Đã tạo bảng dbo.ApprovalSteps (Lịch sử từng cấp duyệt).';
END
GO

-- =======================================================================================
-- PHẦN 5: CÁC FUNCTION (FN) ĐỆ QUY & THẨM ĐỊNH QUYỀN TRÊN BẢNG APPROVERS
-- =======================================================================================

-- 5.1 FN: Lấy cây phả hệ cấp trên của một Approver qua CTE đệ quy
CREATE OR ALTER FUNCTION dbo.fn_GetApproverHierarchyTree
(
    @StartApproverId INT
)
RETURNS TABLE
AS
RETURN
(
    WITH ApproverTree AS (
        -- Anchor member: Cấp duyệt khởi đầu
        SELECT 
            a.ApproverId,
            a.EmployeeId,
            a.BranchId,
            a.ApprovalLevel,
            a.ParentApproverId,
            1 AS DistanceLevel
        FROM dbo.Approvers a
        WHERE a.ApproverId = @StartApproverId

        UNION ALL

        -- Recursive member: Duyệt ngược lên cấp trên (ParentApproverId)
        SELECT 
            parent.ApproverId,
            parent.EmployeeId,
            parent.BranchId,
            parent.ApprovalLevel,
            parent.ParentApproverId,
            t.DistanceLevel + 1 AS DistanceLevel
        FROM dbo.Approvers parent
        INNER JOIN ApproverTree t ON parent.ApproverId = t.ParentApproverId
    )
    SELECT ApproverId, EmployeeId, BranchId, ApprovalLevel, ParentApproverId, DistanceLevel 
    FROM ApproverTree
);
GO
PRINT N'-> Đã tạo Inline Function dbo.fn_GetApproverHierarchyTree.';
GO

-- 5.2 FN: Thẩm định xem một Nhân sự có quyền phê duyệt bước hiện tại hay không (Dựa trên bảng Approvers)
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

    -- 1. Lấy thông tin phiếu yêu cầu và bước hiện tại
    SELECT 
        @RequesterId = RequesterId,
        @BranchId = BranchId,
        @CurrentLevel = CurrentLevel,
        @WorkflowCode = WorkflowCode,
        @RequestStatus = Status
    FROM dbo.ApprovalRequests
    WHERE RequestId = @RequestId;

    -- Phiếu không ở trạng thái chờ duyệt thì không cho duyệt
    IF @RequestStatus NOT IN ('pending', 'in_progress')
        RETURN 0;

    -- Nguyên tắc Separation of Duties: Tuyệt đối không cho tự duyệt đơn của mình
    IF @RequesterId = @EmployeeId
        RETURN 0;

    -- Kiểm tra nhân sự có đang active không (Dùng hàm dùng chung)
    IF dbo.fn_Sys_IsEmployeeActive(@EmployeeId) = 0
        RETURN 0;

    -- 2. Thẩm định qua bảng Approvers:
    -- Nhân sự có quyền nếu tồn tại một bản ghi trong Approvers thỏa mãn:
    --   - Đúng EmployeeId và IsActive = 1
    --   - Đúng cấp duyệt cần duyệt (ApprovalLevel = CurrentLevel)
    --   - Chi nhánh khớp với phiếu yêu cầu (HOẶC BranchId IS NULL: thẩm quyền toàn chuỗi)
    --   - Loại quy trình khớp với phiếu yêu cầu (HOẶC WorkflowCode IS NULL: duyệt mọi loại quy trình)
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
    END

    -- 3. Trường hợp ngoại lệ đặc biệt: Tài khoản có vai trò Admin (RoleId = 1) luôn có toàn quyền can thiệp
    IF @CanApprove = 0
    BEGIN
        DECLARE @UserId INT = (SELECT UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId);
        IF EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = 1)
        BEGIN
            SET @CanApprove = 1;
        END
    END

    RETURN @CanApprove;
END;
GO
PRINT N'-> Đã tạo Scalar Function dbo.fn_CanEmployeeApproveStep.';
GO

-- =======================================================================================
-- PHẦN 6: CÁC TRIGGER (TRG) BẢO VỆ TÍNH TOÀN VẸN DỮ LIỆU
-- =======================================================================================

-- 6.1 TRIGGER: Chống vòng lặp vô hạn (Circular Loop) trong bảng Approvers
CREATE OR ALTER TRIGGER dbo.trg_Approvers_PreventCircularHierarchy
ON dbo.Approvers
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra 1: Không được tự làm cấp trên của chính mình
    IF EXISTS (SELECT 1 FROM inserted WHERE ApproverId = ParentApproverId)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, N'Lỗi CSDL: Một cấp duyệt không thể tự làm cấp trên của chính mình (Self-reference violation).', 1;
        RETURN;
    END

    -- Kiểm tra 2: Chống vòng lặp gián tiếp (A -> B -> A) qua Recursive CTE
    IF UPDATE(ParentApproverId)
    BEGIN
        ;WITH LoopCheckCTE AS (
            SELECT 
                i.ApproverId AS StartNode,
                i.ParentApproverId AS NextNode,
                1 AS Depth
            FROM inserted i
            WHERE i.ParentApproverId IS NOT NULL

            UNION ALL

            SELECT 
                lc.StartNode,
                ap.ParentApproverId AS NextNode,
                lc.Depth + 1
            FROM dbo.Approvers ap
            INNER JOIN LoopCheckCTE lc ON ap.ApproverId = lc.NextNode
            WHERE ap.ParentApproverId IS NOT NULL AND lc.Depth < 10
        )
        IF EXISTS (SELECT 1 FROM LoopCheckCTE WHERE StartNode = NextNode)
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50002, N'Lỗi CSDL: Phát hiện chu trình vòng lặp trong cây phả hệ cấp duyệt (Circular Approval Hierarchy). Thao tác bị hủy bỏ.', 1;
            RETURN;
        END
    END
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_Approvers_PreventCircularHierarchy.';
GO

-- 6.2 TRIGGER: Bảo vệ phiếu yêu cầu - Không cho phép chỉnh sửa phiếu đã hoàn tất
CREATE OR ALTER TRIGGER dbo.trg_ApprovalRequests_PreventIllegalUpdates
ON dbo.ApprovalRequests
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu phiếu ban đầu đã là approved, rejected hoặc cancelled mà cố tình sửa các trường cốt lõi
    IF EXISTS (
        SELECT 1 
        FROM deleted d
        INNER JOIN inserted i ON d.RequestId = i.RequestId
        WHERE d.Status IN ('approved', 'rejected', 'cancelled')
          AND (
              d.Status != i.Status
              OR d.RequesterId != i.RequesterId
              OR d.WorkflowCode != i.WorkflowCode
              OR d.TotalLevels != i.TotalLevels
              OR d.Reason != i.Reason
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50003, N'Lỗi CSDL: Phiếu yêu cầu đã đóng (Approved/Rejected/Cancelled). Không được phép chỉnh sửa dữ liệu.', 1;
        RETURN;
    END
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_ApprovalRequests_PreventIllegalUpdates.';
GO

-- 6.3 TRIGGER: Đảm bảo quy tắc duyệt tuần tự nghiêm ngặt (Sequential Approval)
CREATE OR ALTER TRIGGER dbo.trg_ApprovalSteps_EnforceSequentialApproval
ON dbo.ApprovalSteps
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra: Cấp N được quyết định chỉ khi Cấp N-1 đã approved
    IF EXISTS (
        SELECT 1 
        FROM inserted i
        WHERE i.StepLevel > 1 
          AND i.Decision IN ('approved', 'rejected')
          AND EXISTS (
              SELECT 1 
              FROM dbo.ApprovalSteps prevStep
              WHERE prevStep.RequestId = i.RequestId 
                AND prevStep.StepLevel = i.StepLevel - 1
                AND prevStep.Decision != 'approved'
          )
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50004, N'Lỗi CSDL: Vi phạm quy tắc duyệt tuần tự. Cấp duyệt trước đó chưa được thông qua.', 1;
        RETURN;
    END
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_ApprovalSteps_EnforceSequentialApproval.';
GO

-- =======================================================================================
-- PHẦN 7: STORED PROCEDURES TINH GỌN (ACID TRANSACTION): NỘP ĐƠN & PHÊ DUYỆT
-- =======================================================================================

-- 7.1 SP: Nộp phiếu yêu cầu phê duyệt mới (Sử dụng proc tiện ích sinh mã)
CREATE OR ALTER PROCEDURE dbo.sp_Approval_SubmitRequest
    @WorkflowCode VARCHAR(50),
    @RequesterId INT,
    @Title NVARCHAR(200),
    @Reason NVARCHAR(500),
    @ReferenceTable VARCHAR(50) = NULL,
    @ReferenceId VARCHAR(50) = NULL,
    @PayloadJson NVARCHAR(MAX) = NULL,
    @NewRequestId BIGINT OUTPUT,
    @NewRequestCode VARCHAR(30) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;
    BEGIN TRY
        -- 1. Thẩm định quy trình
        DECLARE @TotalLevels TINYINT;
        DECLARE @IsActive BIT;

        SELECT 
            @TotalLevels = TotalLevels,
            @IsActive = IsActive
        FROM dbo.ApprovalDefinitions
        WHERE WorkflowCode = @WorkflowCode;

        IF @TotalLevels IS NULL OR @IsActive = 0
            THROW 51001, N'Quy trình phê duyệt không tồn tại hoặc đang bị tạm dừng.', 1;

        -- 2. Thẩm định nhân viên nộp đơn
        IF dbo.fn_Sys_IsEmployeeActive(@RequesterId) = 0
            THROW 51002, N'Nhân viên nộp yêu cầu không tồn tại, đã thôi việc hoặc tài khoản bị khóa.', 1;

        DECLARE @BranchId INT = (SELECT BranchId FROM dbo.Employees WHERE EmployeeId = @RequesterId);

        -- 3. Gọi Stored Procedure tiện ích dùng chung để sinh mã: REQ-YYYYMM-XXXX
        EXEC dbo.sp_Sys_GenerateDocumentCode 
            @Prefix = 'REQ', 
            @GeneratedCode = @NewRequestCode OUTPUT;

        -- 4. Tạo bản ghi phiếu yêu cầu
        INSERT INTO dbo.ApprovalRequests (
            RequestCode, WorkflowCode, RequesterId, BranchId,
            ReferenceTable, ReferenceId, Title, Reason, PayloadJson,
            TotalLevels, CurrentLevel, Status
        )
        VALUES (
            @NewRequestCode, @WorkflowCode, @RequesterId, @BranchId,
            @ReferenceTable, @ReferenceId, @Title, @Reason, @PayloadJson,
            @TotalLevels, 1, 'pending'
        );

        SET @NewRequestId = SCOPE_IDENTITY();

        -- 5. Khởi tạo các cấp duyệt: Bước 1 sẵn sàng 'pending', các bước sau là 'waiting'
        INSERT INTO dbo.ApprovalSteps (RequestId, StepLevel, Decision)
        VALUES (@NewRequestId, 1, 'pending');

        IF @TotalLevels >= 2
            INSERT INTO dbo.ApprovalSteps (RequestId, StepLevel, Decision)
            VALUES (@NewRequestId, 2, 'waiting');

        IF @TotalLevels = 3
            INSERT INTO dbo.ApprovalSteps (RequestId, StepLevel, Decision)
            VALUES (@NewRequestId, 3, 'waiting');

        COMMIT TRANSACTION;

        -- Trả về dữ liệu chi tiết phiếu vừa nộp
        SELECT 
            ar.RequestId,
            ar.RequestCode,
            ar.WorkflowCode,
            ad.WorkflowName,
            ar.Title,
            ar.Reason,
            ar.TotalLevels,
            ar.CurrentLevel,
            ar.Status,
            ar.CreatedAt
        FROM dbo.ApprovalRequests ar
        INNER JOIN dbo.ApprovalDefinitions ad ON ar.WorkflowCode = ad.WorkflowCode
        WHERE ar.RequestId = @NewRequestId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
PRINT N'-> Đã tạo Stored Procedure tinh gọn: dbo.sp_Approval_SubmitRequest.';
GO

-- 7.2 SP: Xử lý phê duyệt từng bước (Duyệt hoặc Từ chối)
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
            THROW 51003, N'Quyết định không hợp lệ. Chỉ chấp nhận "approved" hoặc "rejected".', 1;

        -- 2. Thẩm định quyền nhân sự qua Function độc lập
        IF dbo.fn_CanEmployeeApproveStep(@ApproverEmployeeId, @RequestId) = 0
            THROW 51004, N'Bạn không có quyền duyệt phiếu này (Không thuộc danh sách cấp duyệt, sai chi nhánh, hoặc tự duyệt đơn của mình).', 1;

        -- 3. Lấy trạng thái hiện tại
        DECLARE @CurrentLevel TINYINT;
        DECLARE @TotalLevels TINYINT;
        DECLARE @BranchId INT;
        DECLARE @WorkflowCode VARCHAR(50);

        SELECT 
            @CurrentLevel = CurrentLevel,
            @TotalLevels = TotalLevels,
            @BranchId = BranchId,
            @WorkflowCode = WorkflowCode
        FROM dbo.ApprovalRequests
        WHERE RequestId = @RequestId;

        -- Lấy ApproverId tương ứng của nhân sự này trong bảng Approvers để lưu vết
        DECLARE @ApproverId INT;
        SELECT TOP 1 @ApproverId = ApproverId
        FROM dbo.Approvers
        WHERE EmployeeId = @ApproverEmployeeId
          AND ApprovalLevel = @CurrentLevel
          AND IsActive = 1
          AND (BranchId IS NULL OR BranchId = @BranchId)
          AND (WorkflowCode IS NULL OR WorkflowCode = @WorkflowCode);

        -- 4. Xử lý trường hợp TỪ CHỐI (REJECTED): Dừng toàn bộ quy trình ngay lập tức
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

            UPDATE dbo.ApprovalRequests
            SET 
                Status = 'rejected',
                CompletedAt = SYSDATETIME()
            WHERE RequestId = @RequestId;
        END

        -- 5. Xử lý trường hợp ĐỒNG Ý (APPROVED)
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

            -- Nếu chưa phải bước cuối: Chuyển sang cấp tiếp theo
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
            -- Đã duyệt bước cuối cùng: Hoàn tất 100%
            BEGIN
                UPDATE dbo.ApprovalRequests
                SET 
                    Status = 'approved',
                    CompletedAt = SYSDATETIME()
                WHERE RequestId = @RequestId;
            END
        END

        COMMIT TRANSACTION;

        -- Trả về tiến độ và kết quả sau khi xử lý
        SELECT 
            ar.RequestId,
            ar.RequestCode,
            ar.WorkflowCode,
            ar.TotalLevels,
            ar.CurrentLevel,
            ar.Status AS RequestStatus,
            ast.StepLevel,
            ast.Decision AS StepDecision,
            ast.ApproverEmployeeId,
            ast.Comment,
            ast.DecidedAt
        FROM dbo.ApprovalRequests ar
        INNER JOIN dbo.ApprovalSteps ast 
            ON ar.RequestId = ast.RequestId AND ast.StepLevel = @CurrentLevel
        WHERE ar.RequestId = @RequestId;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
PRINT N'-> Đã tạo Stored Procedure tinh gọn: dbo.sp_Approval_ProcessStep.';
GO

-- =======================================================================================
-- PHẦN 8: VIEW HÀNG ĐỢI DUYỆT (APPROVAL DASHBOARD QUEUE)
-- =======================================================================================

CREATE OR ALTER VIEW dbo.v_ApprovalPendingQueue
AS
SELECT 
    ar.RequestId,
    ar.RequestCode,
    ar.WorkflowCode,
    ad.WorkflowName,
    ar.BranchId,
    b.BranchCode,
    b.BranchName,
    ar.RequesterId,
    req.EmployeeCode AS RequesterCode,
    u.FullName AS RequesterName,
    req.Position AS RequesterPosition,
    ar.Title,
    ar.Reason,
    ar.TotalLevels,
    ar.CurrentLevel,
    ar.Status AS RequestStatus,
    ar.CreatedAt,
    DATEDIFF(HOUR, ar.CreatedAt, SYSDATETIME()) AS WaitingHours
FROM dbo.ApprovalRequests ar
INNER JOIN dbo.ApprovalDefinitions ad ON ar.WorkflowCode = ad.WorkflowCode
INNER JOIN dbo.Branches b ON ar.BranchId = b.BranchId
INNER JOIN dbo.Employees req ON ar.RequesterId = req.EmployeeId
INNER JOIN dbo.Users u ON req.UserId = u.UserId
WHERE ar.Status IN ('pending', 'in_progress');
GO
PRINT N'-> Đã tạo View dbo.v_ApprovalPendingQueue (Hàng đợi chờ duyệt).';
GO

-- =======================================================================================
-- PHẦN 9: NẠP DỮ LIỆU CẤU HÌNH QUY TRÌNH & THIẾT LẬP CẤP DUYỆT (APPROVERS)
-- =======================================================================================

-- 9.1 Nạp danh mục 5 quy trình chuẩn (1 cấp, 2 cấp, 3 cấp)
MERGE dbo.ApprovalDefinitions AS target
USING (
    VALUES 
    ('LEAVE_1DAY', N'Đơn xin nghỉ phép ngắn hạn (≤ 1 ngày)', 1, N'Trưởng ca duyệt', NULL, NULL, N'Trưởng ca trực tiếp thẩm định và phê duyệt', 1),
    ('SHIFT_SWAP', N'Đơn xin đổi ca làm việc', 2, N'Trưởng ca xác nhận', N'Cửa hàng trưởng chốt lịch', NULL, N'Cấp 1: Trưởng ca -> Cấp 2: Quản lý chi nhánh chốt lịch', 1),
    ('INVENTORY_WASTE', N'Phiếu đề xuất hủy nguyên liệu hỏng / Hao hụt quầy', 2, N'Trưởng ca lập biên bản', N'Cửa hàng trưởng thẩm định', NULL, N'Cấp 1: Trưởng ca -> Cấp 2: Cửa hàng trưởng', 1),
    ('SALARY_ADVANCE', N'Đơn xin tạm ứng lương giữa kỳ', 3, N'Cửa hàng trưởng xác nhận', N'HRM đối soát công', N'Kế toán trưởng duyệt chi', N'Cấp 1: Quản lý -> Cấp 2: HRM -> Cấp 3: Kế toán', 1),
    ('PAYROLL_PERIOD_LOCK', N'Phê duyệt bảng lương và mở khóa chi trả', 3, N'Cửa hàng trưởng chốt giờ', N'HRM tính lương', N'Ban Giám đốc duyệt chi', N'Cấp 1: Cửa hàng trưởng -> Cấp 2: HRM -> Cấp 3: Ban Giám đốc', 1)
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

PRINT N'-> Đã nạp danh mục 5 Quy trình Phê duyệt chuẩn.';

-- 9.2 Thiết lập Ma trận Cấp duyệt trong bảng Approvers (kèm cây phả hệ ParentApproverId)
-- Cấu trúc phân cấp:
--   Cấp 3: NV003 (Lê Thanh Tùng - Quản lý điều hành) duyệt Cấp 3 toàn chuỗi (Parent = NULL)
--   Cấp 2: NV001 (Đặng Quốc Anh - Cửa hàng trưởng CN1) duyệt Cấp 2 CN1 (Parent = Cấp 3 NV003)
--   Cấp 1: NV002 (Nguyễn Thị Hương - Trưởng ca CN1) duyệt Cấp 1 CN1 (Parent = Cấp 2 NV001)
--   Cấp 2: NV007 (Bùi Mai Linh - Cửa hàng trưởng CN4) duyệt Cấp 2 CN4 (Parent = Cấp 3 NV003)
--   Cấp 1: NV008 (Vũ Anh Khoa - Trưởng ca CN4) duyệt Cấp 1 CN4 (Parent = Cấp 2 NV007)

-- Xóa dữ liệu seed cũ của Approvers (nếu có) để nạp mới chuẩn xác
DELETE FROM dbo.Approvers;
DBCC CHECKIDENT ('dbo.Approvers', RESEED, 0);

-- Bước 1: Nạp Cấp 3 (Đỉnh của cây phả hệ, ParentApproverId = NULL)
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (3, NULL, 3, NULL, NULL, 1, N'Giám đốc điều hành / Quản lý cấp cao duyệt Cấp 3 toàn chuỗi');

DECLARE @App3_Id INT = SCOPE_IDENTITY();

-- Bước 2: Nạp Cấp 2 của các chi nhánh (trỏ lên Cấp 3 qua ParentApproverId)
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (1, 1, 2, @App3_Id, NULL, 1, N'Cửa hàng trưởng CN-Q1 duyệt Cấp 2');

DECLARE @App2_CN1_Id INT = SCOPE_IDENTITY();

INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (7, 4, 2, @App3_Id, NULL, 1, N'Cửa hàng trưởng CN-Bình Thạnh duyệt Cấp 2');

DECLARE @App2_CN4_Id INT = SCOPE_IDENTITY();

-- Bước 3: Nạp Cấp 1 của các chi nhánh (trỏ lên Cấp 2 của chi nhánh tương ứng qua ParentApproverId)
INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (2, 1, 1, @App2_CN1_Id, NULL, 1, N'Trưởng ca CN-Q1 duyệt Cấp 1');

INSERT INTO dbo.Approvers (EmployeeId, BranchId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, Note)
VALUES (8, 4, 1, @App2_CN4_Id, NULL, 1, N'Trưởng ca CN-Bình Thạnh duyệt Cấp 1');

PRINT N'-> Đã thiết lập xong Ma trận Cấp duyệt và Cây phả hệ duyệt (ParentApproverId) trong bảng Approvers.';

-- 9.3 Cập nhật vai trò đầy đủ trong UserRoles cho 12 nhân sự hiện hữu
MERGE dbo.UserRoles AS target
USING (
    VALUES 
    (1, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'StoreManager')), -- NV001 -> StoreManager
    (2, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'ShiftLeader')),  -- NV002 -> ShiftLeader
    (3, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Admin')),        -- NV003 -> Admin / Điều hành
    (4, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Cashier')),      -- NV004 -> Cashier
    (5, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista')),      -- NV005 -> Barista
    (6, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista')),      -- NV006 -> Barista
    (7, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'StoreManager')), -- NV007 -> StoreManager
    (8, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'ShiftLeader')),  -- NV008 -> ShiftLeader
    (9, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista')),      -- NV009 -> Barista
    (10, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista')),     -- NV010 -> Barista
    (11, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista')),     -- NV011 -> Barista
    (12, (SELECT RoleId FROM dbo.Roles WHERE RoleName = 'Barista'))      -- NV012 -> Barista
) AS source (UserId, RoleId)
ON target.UserId = source.UserId
WHEN MATCHED THEN
    UPDATE SET target.RoleId = source.RoleId
WHEN NOT MATCHED THEN
    INSERT (UserId, RoleId) VALUES (source.UserId, source.RoleId);

PRINT N'-> Đã cập nhật xong UserRoles cho 12 tài khoản nhân sự.';
GO

-- =======================================================================================
-- KIỂM THỬ XÁC NHẬN (VERIFICATION QUERY)
-- =======================================================================================
PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT CẬP NHẬT: BẢNG APPROVERS ĐỘC LẬP & THỦ TỤC DÙNG CHUNG';
PRINT N'=======================================================================================';
GO

-- 1. Xem danh sách ma trận phê duyệt và cây phả hệ
SELECT 
    ap.ApproverId,
    ap.EmployeeId,
    e.EmployeeCode,
    u.FullName AS ApproverName,
    ap.BranchId,
    ISNULL(b.BranchCode, 'ALL') AS BranchCode,
    ISNULL(b.BranchName, N'Toàn chuỗi (Hội sở)') AS BranchName,
    ap.ApprovalLevel,
    ap.ParentApproverId,
    parentUser.FullName AS ParentApproverName,
    ap.Note
FROM dbo.Approvers ap
INNER JOIN dbo.Employees e ON ap.EmployeeId = e.EmployeeId
INNER JOIN dbo.Users u ON e.UserId = u.UserId
LEFT JOIN dbo.Branches b ON ap.BranchId = b.BranchId
LEFT JOIN dbo.Approvers parentAp ON ap.ParentApproverId = parentAp.ApproverId
LEFT JOIN dbo.Employees parentEmp ON parentAp.EmployeeId = parentEmp.EmployeeId
LEFT JOIN dbo.Users parentUser ON parentEmp.UserId = parentUser.UserId
ORDER BY ap.ApprovalLevel DESC, ap.ApproverId;

-- 2. Xem danh sách quy trình phê duyệt
SELECT WorkflowCode, WorkflowName, TotalLevels, Level1_Title, Level2_Title, Level3_Title, Description
FROM dbo.ApprovalDefinitions;
GO
