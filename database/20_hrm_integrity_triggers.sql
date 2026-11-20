-- =======================================================================================
-- TỆP MÃ NGUỒN: 20_hrm_integrity_triggers.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   Thiết lập 3 Triggers bảo vệ toàn vẹn dữ liệu cho phân hệ HRM:
--   1. dbo.trg_Approvers_PreventCircularHierarchy (Chống vòng lặp duyệt Approver)
--   2. dbo.trg_Employees_SyncUserRole (Đồng bộ vai trò Role khi thay đổi chức vụ)
--   3. dbo.trg_Employees_AutoUpdateTimestamp (Tự động cập nhật UpdatedAt = SYSDATETIME())
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 20: TẠO CÁC TRIGGER BẢO VỆ TOÀN VẸN DỮ LIỆU HRM';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- 1. TRIGGER: dbo.trg_Approvers_PreventCircularHierarchy
-- Chống vòng lặp vô hạn (Circular Loop) trong bảng phân cấp người duyệt Approvers
-- =======================================================================================
CREATE OR ALTER TRIGGER dbo.trg_Approvers_PreventCircularHierarchy
ON dbo.Approvers
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- Kiểm tra 1: Không được tự làm cấp trên của chính mình (Self-reference violation)
    IF EXISTS (SELECT 1 FROM inserted WHERE ApproverId = ParentApproverId)
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, N'Lỗi CSDL: Một cấp duyệt không thể tự làm cấp trên của chính mình (Self-reference violation).', 1;
        RETURN;
    END;

    -- Kiểm tra 2: Chống vòng lặp gián tiếp (A -> B -> A) qua Recursive CTE
    IF UPDATE(ParentApproverId)
    BEGIN
        DECLARE @HasLoop BIT = 0;

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
        SELECT @HasLoop = CASE WHEN EXISTS (SELECT 1 FROM LoopCheckCTE WHERE StartNode = NextNode) THEN 1 ELSE 0 END;

        IF @HasLoop = 1
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 50002, N'Lỗi CSDL: Phát hiện chu trình vòng lặp trong cây phả hệ cấp duyệt (Circular Approval Hierarchy). Thao tác bị hủy bỏ.', 1;
            RETURN;
        END;
    END;
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_Approvers_PreventCircularHierarchy.';
GO

-- =======================================================================================
-- 2. TRIGGER: dbo.trg_Employees_SyncUserRole
-- Khi chức danh (Position) của nhân sự thay đổi, tự động chuẩn hóa UserRoles tương ứng
-- =======================================================================================
CREATE OR ALTER TRIGGER dbo.trg_Employees_SyncUserRole
ON dbo.Employees
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF UPDATE(Position)
    BEGIN
        MERGE dbo.UserRoles AS target
        USING (
            SELECT DISTINCT
                i.UserId,
                CASE 
                    WHEN i.Position LIKE N'%Quản lý Cửa hàng%' OR i.Position LIKE N'%Cửa hàng trưởng%' THEN 3 -- StoreManager
                    WHEN i.Position LIKE N'%Trưởng ca%' THEN 6 -- ShiftLeader
                    WHEN i.Position LIKE N'%Thu ngân%' THEN 4 -- Cashier
                    WHEN i.Position LIKE N'%Nhân sự%' OR i.Position LIKE N'%HRM%' THEN 2 -- HRManager
                    WHEN i.Position LIKE N'%Kế toán%' THEN 7 -- Accountant
                    WHEN i.Position LIKE N'%Giám đốc%' OR i.Position LIKE N'%Admin%' THEN 1 -- Admin
                    ELSE 5 -- Barista
                END AS NewRoleId
            FROM inserted i
            WHERE i.UserId IS NOT NULL
        ) AS source
        ON target.UserId = source.UserId
        WHEN MATCHED AND target.RoleId != source.NewRoleId AND source.NewRoleId != 1 THEN
            UPDATE SET target.RoleId = source.NewRoleId
        WHEN NOT MATCHED THEN
            INSERT (UserId, RoleId) VALUES (source.UserId, source.NewRoleId);
    END;
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_Employees_SyncUserRole.';
GO

-- =======================================================================================
-- 3. TRIGGER: dbo.trg_Employees_AutoUpdateTimestamp
-- Tự động cập nhật cột thời gian UpdatedAt khi bản ghi nhân sự thay đổi
-- =======================================================================================
CREATE OR ALTER TRIGGER dbo.trg_Employees_AutoUpdateTimestamp
ON dbo.Employees
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT UPDATE(UpdatedAt)
    BEGIN
        UPDATE e
        SET UpdatedAt = SYSDATETIME()
        FROM dbo.Employees e
        INNER JOIN inserted i ON e.EmployeeId = i.EmployeeId;
    END;
END;
GO
PRINT N'-> Đã tạo Trigger dbo.trg_Employees_AutoUpdateTimestamp.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG TỆP 20: TOÀN BỘ 3 TRIGGERS ĐÃ ĐƯỢC KÍCH HOẠT VÀ BẢO VỆ DỮ LIỆU!';
PRINT N'=======================================================================================';
GO
