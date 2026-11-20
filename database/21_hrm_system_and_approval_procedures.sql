-- =======================================================================================
-- TỆP MÃ NGUỒN: 21_hrm_system_and_approval_procedures.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   Hoàn tất toàn bộ các thủ tục còn lại trong danh mục kiến trúc CSDL:
--   1. dbo.sp_Sys_GenerateDocumentCode (Tự động sinh mã chứng từ chuẩn hóa)
--   2. dbo.sp_HRM_GetEmployeeProfile (Truy vấn tóm tắt hồ sơ nhân sự nhanh)
--   3. dbo.sp_HRM_AssignApprovalAuthority (Phân quyền hoặc ủy quyền hạn duyệt)
--   4. dbo.sp_HRM_GetApprovalTree (Truy vấn cây phân cấp duyệt trực tiếp & gián tiếp)
--   5. dbo.sp_HRM_SetApprover (Thiết lập người duyệt trực tiếp cho nhân viên)
--   6. dbo.sp_HRM_GetSettings (Đọc cấu hình tham số HRM hệ thống)
--   7. dbo.sp_HRM_SaveSettings (Lưu tham số cấu hình HRM hệ thống)
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 21: CÁC THỦ TỤC HỆ THỐNG, CẤU HÌNH & PHÊ DUYỆT WORKFLOW';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- 1. THỦ TỤC: dbo.sp_Sys_GenerateDocumentCode
-- Tự động sinh mã tài liệu, chứng từ chuẩn hóa theo Sequence và NămTháng
-- =======================================================================================
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
PRINT N'-> Đã tạo dbo.sp_Sys_GenerateDocumentCode.';
GO

-- =======================================================================================
-- 2. THỦ TỤC: dbo.sp_HRM_GetEmployeeProfile
-- Xem nhanh hồ sơ nhân sự cơ bản
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Basic
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeProfile
    @EmployeeId     INT         = NULL,
    @EmployeeCode   VARCHAR(20) = NULL,
    @TargetDate     DATE        = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @FilterParam NVARCHAR(100) = '-1';
    IF @EmployeeId IS NOT NULL 
        SET @FilterParam = CAST(@EmployeeId AS NVARCHAR(50));
    ELSE IF @EmployeeCode IS NOT NULL 
        SET @FilterParam = @EmployeeCode;

    SELECT TOP 1 *
    FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@TargetDate, @FilterParam, -1);
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_GetEmployeeProfile.';
GO

-- =======================================================================================
-- 3. THỦ TỤC: dbo.sp_HRM_AssignApprovalAuthority
-- Gán và phân cấp thẩm quyền phê duyệt cho nhân sự (Level 1..5)
-- =======================================================================================
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

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Kiểm tra tính hợp lệ của cấp bậc (1..5)
        IF @ApprovalLevel NOT BETWEEN 1 AND 5
        BEGIN
            THROW 50001, N'Cấp độ phê duyệt không hợp lệ: Phải nằm trong khoảng từ Cấp 1 đến Cấp 5.', 1;
        END

        -- 2. Kiểm tra tồn tại nhân viên
        IF NOT EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @EmployeeId)
        BEGIN
            THROW 50002, N'Không tìm thấy hồ sơ nhân sự chỉ định.', 1;
        END

        DECLARE @UserId INT;
        SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

        -- 3. Xác định RoleId tương ứng để đồng bộ UserRoles
        DECLARE @TargetRoleId INT = CASE 
            WHEN @ApprovalLevel = 5 THEN 1 -- Admin
            WHEN @ApprovalLevel = 4 THEN 2 -- HRManager
            WHEN @ApprovalLevel = 3 THEN 3 -- StoreManager
            WHEN @ApprovalLevel = 2 THEN 6 -- ShiftLeader
            ELSE 5                         -- Barista
        END;

        IF @UserId IS NOT NULL
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = @UserId)
            BEGIN
                UPDATE dbo.UserRoles SET RoleId = @TargetRoleId WHERE UserId = @UserId;
            END
            ELSE
            BEGIN
                INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @TargetRoleId);
            END
        END

        -- 4. Tìm ParentApproverId từ ParentApproverEmployeeId nếu có
        DECLARE @ParentApproverId INT = NULL;
        IF @ParentApproverEmployeeId IS NOT NULL
        BEGIN
            SELECT TOP 1 @ParentApproverId = ApproverId 
            FROM dbo.Approvers 
            WHERE EmployeeId = @ParentApproverEmployeeId AND IsActive = 1
            ORDER BY ApprovalLevel DESC;
        END

        -- 5. Cập nhật hoặc thêm mới trong bảng Approvers
        IF EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @EmployeeId)
        BEGIN
            UPDATE dbo.Approvers
            SET 
                ApprovalLevel    = @ApprovalLevel,
                BranchId         = @BranchId,
                ParentApproverId = ISNULL(@ParentApproverId, ParentApproverId),
                WorkflowCode     = ISNULL(@WorkflowCode, WorkflowCode),
                IsActive         = 1,
                Note             = ISNULL(@Note, Note)
            WHERE EmployeeId = @EmployeeId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Approvers (
                EmployeeId, ApprovalLevel, BranchId, ParentApproverId, WorkflowCode, IsActive, Note, AssignedDate
            )
            VALUES (
                @EmployeeId, @ApprovalLevel, @BranchId, @ParentApproverId, @WorkflowCode, 1, @Note, CAST(GETDATE() AS DATE)
            );
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_AssignApprovalAuthority.';
GO

-- =======================================================================================
-- 4. THỦ TỤC: dbo.sp_HRM_GetApprovalTree
-- Truy vấn cây phân cấp duyệt trực tiếp & gián tiếp của một nhân sự
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetApprovalTree
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    ;WITH ApprovalTreeCTE AS (
        -- Bước neo: Lấy cấp duyệt của chính nhân sự
        SELECT 
            a.ApproverId,
            a.EmployeeId,
            e.EmployeeCode,
            e.FullName,
            e.Position,
            a.ApprovalLevel,
            a.ParentApproverId,
            1 AS TreeLevel
        FROM dbo.Approvers a
        INNER JOIN dbo.Employees e ON a.EmployeeId = e.EmployeeId
        WHERE a.EmployeeId = @EmployeeId AND a.IsActive = 1

        UNION ALL

        -- Đệ quy: Lấy cấp duyệt cha
        SELECT 
            parent_a.ApproverId,
            parent_a.EmployeeId,
            parent_e.EmployeeCode,
            parent_e.FullName,
            parent_e.Position,
            parent_a.ApprovalLevel,
            parent_a.ParentApproverId,
            cte.TreeLevel + 1
        FROM dbo.Approvers parent_a
        INNER JOIN ApprovalTreeCTE cte ON cte.ParentApproverId = parent_a.ApproverId
        INNER JOIN dbo.Employees parent_e ON parent_a.EmployeeId = parent_e.EmployeeId
        WHERE parent_a.IsActive = 1 AND cte.TreeLevel < 10
    )
    SELECT * 
    FROM ApprovalTreeCTE
    ORDER BY ApprovalLevel ASC;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_GetApprovalTree.';
GO

-- =======================================================================================
-- 5. THỦ TỤC: dbo.sp_HRM_SetApprover
-- Thiết lập quản lý duyệt trực tiếp cho nhân viên
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_SetApprover
    @EmployeeId                 INT,
    @ParentApproverEmployeeId   INT,
    @ApprovalLevel              TINYINT = 1,
    @WorkflowCode               VARCHAR(50) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @ParentApproverId INT = NULL;
        IF @ParentApproverEmployeeId IS NOT NULL
        BEGIN
            SELECT TOP 1 @ParentApproverId = ApproverId
            FROM dbo.Approvers
            WHERE EmployeeId = @ParentApproverEmployeeId AND IsActive = 1;

            IF @ParentApproverId IS NULL
            BEGIN
                -- Tạo Approver cho cấp trên nếu chưa có
                INSERT INTO dbo.Approvers (EmployeeId, ApprovalLevel, IsActive, AssignedDate)
                VALUES (@ParentApproverEmployeeId, 2, 1, CAST(GETDATE() AS DATE));
                SET @ParentApproverId = SCOPE_IDENTITY();
            END
        END

        IF EXISTS (SELECT 1 FROM dbo.Approvers WHERE EmployeeId = @EmployeeId)
        BEGIN
            UPDATE dbo.Approvers
            SET 
                ParentApproverId = @ParentApproverId,
                ApprovalLevel    = ISNULL(@ApprovalLevel, ApprovalLevel),
                WorkflowCode     = ISNULL(@WorkflowCode, WorkflowCode),
                IsActive         = 1
            WHERE EmployeeId = @EmployeeId;
        END
        ELSE
        BEGIN
            INSERT INTO dbo.Approvers (
                EmployeeId, ApprovalLevel, ParentApproverId, WorkflowCode, IsActive, AssignedDate
            )
            VALUES (
                @EmployeeId, ISNULL(@ApprovalLevel, 1), @ParentApproverId, @WorkflowCode, 1, CAST(GETDATE() AS DATE)
            );
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_SetApprover.';
GO

-- =======================================================================================
-- 6. THỦ TỤC: dbo.sp_HRM_GetSettings & dbo.sp_HRM_SaveSettings
-- Đọc & Lưu cấu hình tham số hệ thống HRM
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetSettings
AS
BEGIN
    SET NOCOUNT ON;
    SELECT SettingKey, SettingValue, Description, UpdatedAt, UpdatedBy 
    FROM dbo.HrmSettings 
    ORDER BY SettingKey;
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_GetSettings.';
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_SaveSettings
    @SettingKey     VARCHAR(50),
    @SettingValue   NVARCHAR(MAX),
    @Description    NVARCHAR(255) = NULL,
    @UpdatedBy      NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;

    MERGE dbo.HrmSettings AS target
    USING (SELECT @SettingKey AS SettingKey) AS source
    ON target.SettingKey = source.SettingKey
    WHEN MATCHED THEN
        UPDATE SET 
            SettingValue = @SettingValue,
            Description  = ISNULL(@Description, target.Description),
            UpdatedAt    = SYSDATETIME(),
            UpdatedBy    = @UpdatedBy
    WHEN NOT MATCHED THEN
        INSERT (SettingKey, SettingValue, Description, UpdatedAt, UpdatedBy)
        VALUES (@SettingKey, @SettingValue, @Description, SYSDATETIME(), @UpdatedBy);
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_SaveSettings.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG TỆP 21: 100% CÁC THỦ TỤC CÒN LẠI ĐÃ ĐƯỢC THIẾT LẬP!';
PRINT N'=======================================================================================';
GO
