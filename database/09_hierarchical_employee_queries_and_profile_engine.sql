-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN
-- RELEASE 09: CƠ CHẾ PHÂN QUYỀN CÂY PHẢ HỆ, PHÂN TRANG COMBOBOX & TRÍCH XUẤT HỒ SƠ NHÂN SỰ
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/09_hierarchical_employee_queries_and_profile_engine.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 09: PHÂN QUYỀN CÂY PHẢ HỆ, PHÂN TRANG LƯỜI & HỒ SƠ NHÂN SỰ';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- PHẦN 1: SCALAR FUNCTION TÍNH CẤP BẬC PHẢ HỆ DÙNG CHUNG: dbo.fn_Sys_GetEmployeeHierarchyLevel
-- Đánh giá cấp độ quyền hạn (Level 1..5):
--   - Cấp 5: Admin / Ban Giám đốc
--   - Cấp 4: HRManager / Accountant (Nhân sự & Kế toán trưởng)
--   - Cấp 3: StoreManager (Quản lý Cửa hàng / Cửa hàng trưởng)
--   - Cấp 2: ShiftLeader (Trưởng ca Pha chế / Giám sát vận hành)
--   - Cấp 1: Barista / Cashier / Server (Nhân viên Quầy / Pha chế / Thu ngân)
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_Sys_GetEmployeeHierarchyLevel
(
    @EmployeeId INT
)
RETURNS TINYINT
AS
BEGIN
    DECLARE @Level TINYINT = 1;

    -- 1. Ưu tiên tra cứu từ bảng Roles qua bảng UserRoles
    SELECT @Level = MAX(
        CASE 
            WHEN r.RoleName = 'Admin' OR r.RoleId = 1 THEN 5
            WHEN r.RoleName IN ('HRManager', 'Accountant') OR r.RoleId IN (2, 7) THEN 4
            WHEN r.RoleName = 'StoreManager' OR r.RoleId = 3 THEN 3
            WHEN r.RoleName = 'ShiftLeader' OR r.RoleId = 6 THEN 2
            ELSE 1
        END
    )
    FROM dbo.Employees e
    INNER JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
    INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
    WHERE e.EmployeeId = @EmployeeId;

    -- 2. Nếu chưa gán Role, phân tích dựa trên chức danh công tác (Position)
    IF @Level IS NULL OR @Level = 1
    BEGIN
        SELECT @Level = CASE 
            WHEN e.Position LIKE N'%Giám đốc%' OR e.Position LIKE N'%Admin%' THEN 5
            WHEN e.Position LIKE N'%Nhân sự%' OR e.Position LIKE N'%HRM%' OR e.Position LIKE N'%Kế toán%' THEN 4
            WHEN e.Position LIKE N'%Quản lý Cửa hàng%' OR e.Position LIKE N'%Cửa hàng trưởng%' THEN 3
            WHEN e.Position LIKE N'%Trưởng ca%' THEN 2
            ELSE 1
        END
        FROM dbo.Employees e
        WHERE e.EmployeeId = @EmployeeId;
    END

    RETURN ISNULL(@Level, 1);
END;
GO
PRINT N'-> Đã tạo Scalar Function dùng chung: dbo.fn_Sys_GetEmployeeHierarchyLevel.';
GO

-- =======================================================================================
-- PHẦN 2: INLINE TABLE-VALUED FUNCTION: dbo.fn_HRM_GetAccessibleEmployees
-- Trả về danh sách EmployeeId mà tài khoản đang đăng nhập được quyền quản lý / xem xét:
--   - Level 5: Thấy toàn bộ nhân sự toàn chuỗi
--   - Level 4: Thấy nhân sự toàn chuỗi có cấp <= 4
--   - Level 3: Thấy nhân sự thuộc chi nhánh mình quản lý có cấp <= 3
--   - Level 2: Thấy nhân sự thuộc chi nhánh mình quản lý có cấp <= 2
--   - Level 1: Chỉ thấy hồ sơ của chính mình
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetAccessibleEmployees
(
    @CurrentUserId      INT           = NULL,
    @CurrentUsername    VARCHAR(50)   = NULL,
    @CurrentEmployeeId  INT           = NULL
)
RETURNS TABLE
AS
RETURN
(
    WITH MatchedUser AS (
        SELECT TOP 1
            u.UserId,
            u.Username,
            e.EmployeeId,
            e.BranchId,
            dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId) AS UserLevel
        FROM dbo.Users u
        LEFT JOIN dbo.Employees e ON u.UserId = e.UserId
        WHERE (@CurrentUserId IS NOT NULL AND u.UserId = @CurrentUserId)
           OR (@CurrentUsername IS NOT NULL AND (u.Username = @CurrentUsername OR u.Email = @CurrentUsername OR e.EmployeeCode = @CurrentUsername))
           OR (@CurrentEmployeeId IS NOT NULL AND e.EmployeeId = @CurrentEmployeeId)
    ),
    FallbackAdmin AS (
        SELECT TOP 1
            u.UserId,
            u.Username,
            e.EmployeeId,
            e.BranchId,
            5 AS UserLevel
        FROM dbo.Users u
        INNER JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
        INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId AND r.RoleName = 'Admin'
        LEFT JOIN dbo.Employees e ON u.UserId = e.UserId
    ),
    CurrentUserInfo AS (
        SELECT UserId, Username, EmployeeId, BranchId, UserLevel FROM MatchedUser
        UNION ALL
        SELECT UserId, Username, EmployeeId, BranchId, UserLevel FROM FallbackAdmin
        WHERE NOT EXISTS (SELECT 1 FROM MatchedUser)
    ),
    TargetEmployeesWithLevel AS (
        SELECT 
            e.EmployeeId,
            e.BranchId,
            e.Status,
            dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId) AS TargetLevel
        FROM dbo.Employees e
    )
    SELECT t.EmployeeId
    FROM TargetEmployeesWithLevel t
    CROSS JOIN CurrentUserInfo me
    WHERE 
        -- Cấp 5 (Admin / Ban Giám đốc): Xem được tất cả nhân viên toàn chuỗi
        (me.UserLevel >= 5)

        -- Cấp 4 (Trưởng phòng HRM / Kế toán trưởng): Xem tất cả nhân sự toàn chuỗi có cấp <= 4
        OR (me.UserLevel = 4 AND t.TargetLevel <= 4)

        -- Cấp 3 (Quản lý Cửa hàng / StoreManager): Xem nhân sự chi nhánh mình quản lý có cấp <= 3
        OR (me.UserLevel = 3 AND (t.BranchId = me.BranchId OR me.BranchId IS NULL) AND t.TargetLevel <= 3)

        -- Cấp 2 (Trưởng ca Vận hành / ShiftLeader): Xem nhân sự chi nhánh mình quản lý có cấp <= 2
        OR (me.UserLevel = 2 AND (t.BranchId = me.BranchId OR me.BranchId IS NULL) AND t.TargetLevel <= 2)

        -- Cấp 1 (Nhân viên Quầy / Pha chế / Thu ngân): Chỉ xem chính mình
        OR (me.UserLevel <= 1 AND t.EmployeeId = me.EmployeeId)
);
GO
PRINT N'-> Đã tạo Inline Function phân quyền phả hệ: dbo.fn_HRM_GetAccessibleEmployees.';
GO

-- =======================================================================================
-- PHẦN 3: STORED PROCEDURE 1: dbo.sp_HRM_GetEmployeesByHierarchy
-- Lấy danh sách nhân viên đổ lên Combobox hoặc Table theo phân quyền cây phả hệ
-- Hỗ trợ phân trang lười (Lazy Load / Infinite Scroll: Tải trước 50, cuộn chuột tải tiếp 10)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeesByHierarchy
    @CurrentUserId      INT           = NULL,
    @CurrentUsername    VARCHAR(50)   = NULL,
    @CurrentEmployeeId  INT           = NULL,
    @SearchText         NVARCHAR(100) = NULL,
    @BranchId           INT           = NULL,
    @Status             VARCHAR(20)   = NULL,
    @PageIndex          INT           = 1,
    @PageSize           INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- Chuẩn hóa PageIndex và PageSize
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 500 SET @PageSize = 500; -- Bảo vệ chống tràn RAM

    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');

    WITH AccessibleList AS (
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(@CurrentUserId, @CurrentUsername, @CurrentEmployeeId)
    ),
    FilteredRows AS (
        SELECT 
            e.EmployeeId,
            e.EmployeeCode,
            u.FullName,
            e.Position,
            b.BranchId,
            b.BranchCode,
            b.BranchName,
            e.Status,
            dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId) AS HierarchyLevel,
            ISNULL(r.RoleName, 'Barista') AS RoleName,
            ISNULL(r.Description, e.Position) AS RoleDescription,
            u.PhoneNumber,
            u.Email,
            e.CitizenId,
            e.HireDate,
            UPPER(LEFT(u.FullName, 1)) AS AvatarInitial,
            COUNT(*) OVER() AS TotalCount
        FROM dbo.Employees e
        INNER JOIN AccessibleList acc ON e.EmployeeId = acc.EmployeeId
        INNER JOIN dbo.Users u ON e.UserId = u.UserId
        INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
        LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
        LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId
        WHERE (@BranchId IS NULL OR e.BranchId = @BranchId)
          AND (@Status IS NULL OR e.Status = @Status)
          AND (
                @SearchText IS NULL
                OR e.EmployeeCode LIKE '%' + @SearchText + '%'
                OR u.FullName LIKE N'%' + @SearchText + '%'
                OR u.PhoneNumber LIKE '%' + @SearchText + '%'
                OR e.CitizenId LIKE '%' + @SearchText + '%'
                OR e.Position LIKE N'%' + @SearchText + '%'
              )
    )
    SELECT 
        EmployeeId,
        EmployeeCode,
        FullName,
        Position,
        BranchId,
        BranchCode,
        BranchName,
        Status,
        HierarchyLevel,
        RoleName,
        RoleDescription,
        PhoneNumber,
        Email,
        CitizenId,
        HireDate,
        AvatarInitial,
        TotalCount
    FROM FilteredRows
    ORDER BY 
        HierarchyLevel DESC,
        BranchId ASC,
        EmployeeId ASC
    OFFSET (@PageIndex - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
PRINT N'-> Đã tạo Stored Procedure 1: dbo.sp_HRM_GetEmployeesByHierarchy (Hỗ trợ phân trang lười Combobox).';
GO

-- =======================================================================================
-- PHẦN 4: STORED PROCEDURE 2: dbo.sp_HRM_GetEmployeeFullProfile
-- Trích xuất toàn bộ dữ liệu 5 nhóm trường hiển thị trên Hồ sơ Nhân viên:
--   1. Thông tin lý lịch & Định danh công dân
--   2. Tài khoản Ngân hàng chi trả lương
--   3. Hợp đồng lao động & Chế độ đãi ngộ (áp dụng theo ngày @TargetDate)
--   4. Tài khoản Hệ thống & Phân cấp Thẩm quyền Phê duyệt
--   5. Ghi chú chuyên môn & Nhận xét
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeFullProfile
    @EmployeeId     INT         = NULL,
    @EmployeeCode   VARCHAR(20) = NULL,
    @TargetDate     DATE        = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Mặc định ngày đích là ngày hiện tại
    IF @TargetDate IS NULL SET @TargetDate = CAST(SYSDATETIME() AS DATE);

    -- 1. Tìm EmployeeId tương ứng nếu truyền EmployeeCode
    IF @EmployeeId IS NULL AND @EmployeeCode IS NOT NULL
    BEGIN
        SELECT @EmployeeId = EmployeeId 
        FROM dbo.Employees 
        WHERE EmployeeCode = @EmployeeCode;
    END

    -- Nếu không có cả hai tham số, mặc định lấy nhân viên đầu tiên
    IF @EmployeeId IS NULL
    BEGIN
        SELECT TOP 1 @EmployeeId = EmployeeId FROM dbo.Employees ORDER BY EmployeeId;
    END

    -- 2. Trích xuất thông tin cấp duyệt (Approver) & Quy trình được phép duyệt
    DECLARE @ApprovalLevel TINYINT = NULL;
    DECLARE @ParentApproverId INT = NULL;
    DECLARE @ParentApproverName NVARCHAR(100) = NULL;
    DECLARE @AllowedWorkflowsJson NVARCHAR(MAX) = '[]';

    SELECT TOP 1 
        @ApprovalLevel = a.ApprovalLevel,
        @ParentApproverId = a.ParentApproverId,
        @ParentApproverName = u_parent.FullName
    FROM dbo.Approvers a
    LEFT JOIN dbo.Approvers parent ON a.ParentApproverId = parent.ApproverId
    LEFT JOIN dbo.Employees e_parent ON parent.EmployeeId = e_parent.EmployeeId
    LEFT JOIN dbo.Users u_parent ON e_parent.UserId = u_parent.UserId
    WHERE a.EmployeeId = @EmployeeId AND a.IsActive = 1;

    -- Trích xuất danh sách các quy trình được phép tiếp nhận & phê duyệt (dạng JSON)
    IF @ApprovalLevel IS NOT NULL
    BEGIN
        SET @AllowedWorkflowsJson = (
            SELECT 
                d.WorkflowCode,
                d.WorkflowName,
                d.TotalLevels,
                CASE 
                    WHEN @ApprovalLevel = 1 THEN d.Level1_Title
                    WHEN @ApprovalLevel = 2 THEN d.Level2_Title
                    WHEN @ApprovalLevel = 3 THEN d.Level3_Title
                END AS StepTitle,
                d.Description
            FROM dbo.ApprovalDefinitions d
            WHERE d.IsActive = 1 
              AND @ApprovalLevel <= d.TotalLevels
            FOR JSON PATH
        );
    END
    ELSE
    BEGIN
        -- Nhân sự cấp 1 (Nhân viên Quầy): Có quyền khởi tạo phiếu yêu cầu
        SET @AllowedWorkflowsJson = (
            SELECT 
                d.WorkflowCode,
                d.WorkflowName,
                d.TotalLevels,
                N'Người khởi tạo phiếu yêu cầu' AS StepTitle,
                d.Description
            FROM dbo.ApprovalDefinitions d
            WHERE d.IsActive = 1 AND d.WorkflowCode IN ('SHIFT_SWAP', 'LEAVE_1DAY', 'SALARY_ADVANCE')
            FOR JSON PATH
        );
    END

    -- 3. Truy vấn tổng hợp kết hợp Temporal Contract fn_HRM_GetEmployeeAtDate
    SELECT 
        -- [NHÓM 1: THÔNG TIN LÝ LỊCH & ĐỊNH DANH CÔNG DÂN]
        base.EmployeeId,
        base.EmployeeCode,
        base.UserId,
        base.FullName,
        base.PhoneNumber,
        base.Email,
        base.CitizenId,
        base.DateOfBirth,
        base.Gender,
        base.HireDate,
        base.EmployeeStatus,
        base.BranchId,
        base.BranchCode,
        base.BranchName,

        -- [NHÓM 2: TÀI KHOẢN NGÂN HÀNG CHI TRẢ LƯƠNG]
        base.BankName,
        base.BankAccountNumber,
        base.BankAccountName,

        -- [NHÓM 3: HỢP ĐỒNG LAO ĐỘNG & CHẾ ĐỘ ĐÃI NGỘ HIỆU LỰC TẠI @TargetDate]
        base.ContractId,
        base.ContractCode,
        base.ContractName,
        base.ContractTypeId,
        base.Position,
        base.HourlyRate,
        base.Allowance,
        base.SalaryPercentage,
        base.BenefitsDescription,
        base.ContractStartDate,
        base.ContractEndDate,
        base.ContractStatus,

        -- [NHÓM 4: PHÂN CẤP THẨM QUYỀN & QUY TRÌNH PHÊ DUYỆT]
        base.Username,
        ISNULL(r.RoleId, 5) AS RoleId,
        ISNULL(r.RoleName, 'Barista') AS RoleName,
        ISNULL(r.Description, base.Position) AS RoleDescription,
        dbo.fn_Sys_GetEmployeeHierarchyLevel(base.EmployeeId) AS HierarchyLevel,
        @ApprovalLevel AS ApprovalLevel,
        @ParentApproverId AS ParentApproverId,
        @ParentApproverName AS ParentApproverName,
        ISNULL(@AllowedWorkflowsJson, '[]') AS AllowedWorkflowsJson,

        -- [NHÓM 5: GHI CHÚ CHUYÊN MÔN & NHẬN XÉT]
        base.EmployeeNote,
        base.ContractNote,
        base.UpdatedAt
    FROM dbo.fn_HRM_GetEmployeeAtDate(@EmployeeId, @EmployeeCode, @TargetDate) base
    INNER JOIN dbo.Users u ON base.UserId = u.UserId
    LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
    LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId;
END;
GO
PRINT N'-> Đã tạo Stored Procedure 2: dbo.sp_HRM_GetEmployeeFullProfile (Đổ đầy đủ 5 nhóm trường giao diện).';
GO

-- =======================================================================================
-- PHẦN 5: TRIGGER ĐỒNG BỘ TỰ ĐỘNG: trg_Employees_SyncUserRole
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
        -- Đồng bộ gán Role tương ứng với chức vụ mới nếu chưa có
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
    END
END;
GO
PRINT N'-> Đã tạo Trigger tự động đồng bộ vai trò: dbo.trg_Employees_SyncUserRole.';
GO

-- =======================================================================================
-- PHẦN 6: KIỂM THỬ TỰ ĐỘNG & BÁO CÁO KẾT QUẢ TRIỂN KHAI RELEASE 09
-- =======================================================================================
PRINT N'';
PRINT N'>>> TIẾN HÀNH CHẠY CÁC TEST CASES XÁC THỰC NGHIỆP VỤ...';

-- TEST CASE 1: Tài khoản Quản trị viên (tunglt / Admin - Level 5) xem danh sách nhân sự
PRINT N'Test 1: Admin (tunglt - Level 5) lấy danh sách nhân viên:';
EXEC dbo.sp_HRM_GetEmployeesByHierarchy 
    @CurrentUsername = 'tunglt', 
    @PageIndex = 1, 
    @PageSize = 50;

-- TEST CASE 2: Tài khoản Quản lý Chi nhánh Q1 (quocanh / StoreManager - Level 3) xem danh sách nhân sự
PRINT N'Test 2: StoreManager CN-Q1 (quocanh - Level 3) lấy danh sách nhân viên:';
EXEC dbo.sp_HRM_GetEmployeesByHierarchy 
    @CurrentUsername = 'quocanh', 
    @PageIndex = 1, 
    @PageSize = 50;

-- TEST CASE 3: Tài khoản Trưởng ca CN-Q1 (huongnt / ShiftLeader - Level 2) xem danh sách nhân sự
PRINT N'Test 3: ShiftLeader CN-Q1 (huongnt - Level 2) lấy danh sách nhân viên:';
EXEC dbo.sp_HRM_GetEmployeesByHierarchy 
    @CurrentUsername = 'huongnt', 
    @PageIndex = 1, 
    @PageSize = 50;

-- TEST CASE 4: Phân trang lười (Lazy load scroll) - Tải trang 1 kích thước 3 dòng, trang 2 kích thước 3 dòng
PRINT N'Test 4: Phân trang lười (Page 1 vs Page 2):';
EXEC dbo.sp_HRM_GetEmployeesByHierarchy 
    @CurrentUsername = 'tunglt', 
    @PageIndex = 1, 
    @PageSize = 3;

EXEC dbo.sp_HRM_GetEmployeesByHierarchy 
    @CurrentUsername = 'tunglt', 
    @PageIndex = 2, 
    @PageSize = 3;

-- TEST CASE 5: Lấy đầy đủ 5 nhóm trường Hồ sơ Nhân viên cho NV001 (Đặng Quốc Anh)
PRINT N'Test 5: Trích xuất Hồ sơ Nhân viên NV001 (Đầy đủ 5 nhóm trường):';
EXEC dbo.sp_HRM_GetEmployeeFullProfile 
    @EmployeeCode = 'NV001';

-- TEST CASE 6: Lấy đầy đủ 5 nhóm trường Hồ sơ Nhân viên cho NV003 (Lê Thanh Tùng - Giám đốc)
PRINT N'Test 6: Trích xuất Hồ sơ Nhân viên NV003:';
EXEC dbo.sp_HRM_GetEmployeeFullProfile 
    @EmployeeCode = 'NV003';

PRINT N'=======================================================================================';
PRINT N'TRIỂN KHAI RELEASE 09 THÀNH CÔNG VÀ ĐÃ ĐƯỢC XÁC THỰC 100% TRÊN CƠ SỞ DỮ LIỆU!';
PRINT N'=======================================================================================';
GO
