-- =======================================================================================
-- TỆP MÃ NGUỒN: 18_refactor_hrm_employee_read_procedures.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH: 
--   Chuẩn hóa và nâng cấp toàn bộ nhóm 6 Stored Procedures đọc & truy vấn nhân sự
--   kế thừa trực tiếp từ tầng dữ liệu nền tảng (dbo.fn_vtblEmployeeList_ByDate_Basic / Full).
--
-- DANH SÁCH ĐỐI TƯỢNG:
--   0. Cập nhật bổ sung cột CitizenId, ContractName cho dbo.fn_vtblEmployeeList_ByDate_Basic
--   1. dbo.sp_HRM_GetEmployees_GridDataset (Phân trang OFFSET...FETCH, tìm kiếm, lọc)
--   2. dbo.sp_HRM_GetEmployeesByHierarchy (Lấy cấp dưới theo quyền tài khoản đăng nhập)
--   3. dbo.sp_HRM_GetEmployeeFullProfile (Lấy chi tiết 5 nhóm hồ sơ Accordion của 1 nhân sự)
--   4. dbo.sp_HRM_GetEmployees_Filter (Lọc danh sách nhân viên đa tiêu chí)
--   5. dbo.sp_HRM_GetEmployees_FilterOptions (Cung cấp 4 danh mục combobox bộ lọc)
--   6. dbo.sp_HRM_ExportEmployees_Excel (Xuất dữ liệu 43 cột nhân sự + #ExportConfig)
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI 18: CHUẨN HÓA CÁC THỦ TỤC TRUY VẤN NHÂN SỰ THEO HÀM NỀN TẢNG';
PRINT N'=======================================================================================';
GO

-- =======================================================================================
-- 0. NÂNG CẤP NHẸ dbo.fn_vtblEmployeeList_ByDate_Basic (Bổ sung CitizenId & ContractName)
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_vtblEmployeeList_ByDate_Basic
(
    @ViewDate    DATE            = NULL,
    @EmployeeID  NVARCHAR(4000)  = '-1',
    @LoginID     INT             = -1
)
RETURNS TABLE
AS
RETURN
(
    WITH DateParam AS (
        SELECT ISNULL(@ViewDate, CAST(SYSDATETIME() AS DATE)) AS TargetDate
    ),
    CallerScope AS (
        SELECT 
            u.UserId,
            caller_emp.EmployeeId AS CallerEmployeeId,
            caller_emp.BranchId AS CallerBranchId,
            ISNULL(max_r.HierarchyLevel, 
                CASE 
                    WHEN caller_emp.Position LIKE N'%Giám đốc%' OR caller_emp.Position LIKE N'%Admin%' THEN 5
                    WHEN caller_emp.Position LIKE N'%Nhân sự%' OR caller_emp.Position LIKE N'%HRM%' OR caller_emp.Position LIKE N'%Kế toán%' THEN 4
                    WHEN caller_emp.Position LIKE N'%Quản lý Cửa hàng%' OR caller_emp.Position LIKE N'%Cửa hàng trưởng%' THEN 3
                    WHEN caller_emp.Position LIKE N'%Trưởng ca%' THEN 2
                    ELSE 1
                END
            ) AS CallerLevel
        FROM dbo.Users u
        LEFT JOIN dbo.Employees caller_emp ON u.UserId = caller_emp.UserId
        OUTER APPLY (
            SELECT MAX(
                CASE 
                    WHEN r.RoleName = 'Admin' OR r.RoleId = 1 THEN 5
                    WHEN r.RoleName IN ('HRManager', 'Accountant') OR r.RoleId IN (2, 7) THEN 4
                    WHEN r.RoleName = 'StoreManager' OR r.RoleId = 3 THEN 3
                    WHEN r.RoleName = 'ShiftLeader' OR r.RoleId = 6 THEN 2
                    ELSE 1
                END
            ) AS HierarchyLevel
            FROM dbo.UserRoles ur
            INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            WHERE ur.UserId = u.UserId
        ) max_r
        WHERE u.UserId = @LoginID
    )
    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        ISNULL(e.FullName, ISNULL(u.FullName, e.BankAccountName)) AS FullName,
        ISNULL(e.PhoneNumber, u.PhoneNumber) AS PhoneNumber,
        u.Email,
        e.CitizenId,
        ISNULL(tc.Position, e.Position) AS Position,
        b.BranchId,
        b.BranchName,
        ISNULL(ct.ContractName, N'Hợp đồng Lao động') AS ContractName,
        e.Status AS EmployeeStatus,
        e.HireDate,
        ISNULL(tc.HourlyRate, ISNULL(e.HourlyRate, ct.StandardHourlyRate)) AS HourlyRate,
        CASE WHEN u.UserId IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS HasAccount,
        u.UserId,
        u.Username,
        r.RoleName,
        e_level.HierarchyLevel
    FROM dbo.Employees e
    CROSS JOIN DateParam dp
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN CallerScope cs ON 1 = 1 AND @LoginID > 0

    -- Role của nhân viên
    OUTER APPLY (
        SELECT TOP 1 r_inner.RoleName
        FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r_inner ON ur.RoleId = r_inner.RoleId
        WHERE ur.UserId = u.UserId
        ORDER BY r_inner.RoleId ASC
    ) r

    -- Tính HierarchyLevel của nhân viên
    OUTER APPLY (
        SELECT ISNULL(
            (
                SELECT MAX(
                    CASE 
                        WHEN r_sub.RoleName = 'Admin' OR r_sub.RoleId = 1 THEN 5
                        WHEN r_sub.RoleName IN ('HRManager', 'Accountant') OR r_sub.RoleId IN (2, 7) THEN 4
                        WHEN r_sub.RoleName = 'StoreManager' OR r_sub.RoleId = 3 THEN 3
                        WHEN r_sub.RoleName = 'ShiftLeader' OR r_sub.RoleId = 6 THEN 2
                        ELSE 1
                    END
                )
                FROM dbo.UserRoles ur_sub
                INNER JOIN dbo.Roles r_sub ON ur_sub.RoleId = r_sub.RoleId
                WHERE ur_sub.UserId = e.UserId
            ),
            CASE 
                WHEN e.Position LIKE N'%Giám đốc%' OR e.Position LIKE N'%Admin%' THEN 5
                WHEN e.Position LIKE N'%Nhân sự%' OR e.Position LIKE N'%HRM%' OR e.Position LIKE N'%Kế toán%' THEN 4
                WHEN e.Position LIKE N'%Quản lý Cửa hàng%' OR e.Position LIKE N'%Cửa hàng trưởng%' THEN 3
                WHEN e.Position LIKE N'%Trưởng ca%' THEN 2
                ELSE 1
            END
        ) AS HierarchyLevel
    ) e_level

    -- Hợp đồng temporal mới nhất tính từ trước cho đến @TargetDate
    OUTER APPLY (
        SELECT TOP 1
            c.Position,
            c.HourlyRate,
            c.ContractTypeId
        FROM dbo.EmployeeContracts c
        WHERE c.EmployeeId = e.EmployeeId
          AND c.StartDate <= dp.TargetDate
        ORDER BY c.StartDate DESC, c.ContractId DESC
    ) tc

    -- Chuẩn hóa ContractTypeId
    CROSS APPLY (
        SELECT ISNULL(tc.ContractTypeId, 
            ISNULL(e.ContractTypeId, 
                CASE 
                    WHEN e.ContractType = 'full_time' THEN 3 
                    WHEN e.ContractType = 'part_time' THEN 4 
                    ELSE 3 
                END
            )
        ) AS ContractTypeId
    ) resolved_ct

    LEFT JOIN dbo.ContractTypes ct ON resolved_ct.ContractTypeId = ct.ContractTypeId

    WHERE 
        -- 1. Lấy tất cả nhân sự gia nhập từ trước (quá khứ) cho đến ngày nhập @ViewDate
        (e.HireDate <= dp.TargetDate)

        -- 2. Lọc theo @EmployeeID
        AND (
            @EmployeeID IS NULL 
            OR @EmployeeID = '-1' 
            OR @EmployeeID = 'ALL'
            OR EXISTS (
                SELECT 1 
                FROM STRING_SPLIT(@EmployeeID, ',') s 
                WHERE LTRIM(RTRIM(s.value)) IN (CAST(e.EmployeeId AS NVARCHAR(50)), e.EmployeeCode)
            )
        )
        -- 3. Phân quyền truy cập theo @LoginID
        AND (
            @LoginID IS NULL 
            OR @LoginID = -1
            OR cs.CallerLevel >= 5
            OR (cs.CallerLevel = 4 AND e_level.HierarchyLevel <= 4)
            OR (cs.CallerLevel = 3 AND (e.BranchId = cs.CallerBranchId OR cs.CallerBranchId IS NULL))
            OR (cs.CallerLevel = 2 AND (e.BranchId = cs.CallerBranchId OR cs.CallerBranchId IS NULL) AND e_level.HierarchyLevel <= 2)
            OR (cs.CallerLevel <= 1 AND (e.UserId = @LoginID OR e.EmployeeId = cs.CallerEmployeeId))
        )
);
GO
PRINT N'-> Đã hoàn thiện dbo.fn_vtblEmployeeList_ByDate_Basic (bổ sung CitizenId, ContractName).';
GO

-- =======================================================================================
-- 1. THỦ TỤC: dbo.sp_HRM_GetEmployees_GridDataset
-- Nạp cấu hình cột (Result Set 1) và dữ liệu lưới nhân sự phân trang (Result Set 2)
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Basic
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployees_GridDataset
    @CurrentUserId      INT           = NULL,
    @CurrentUsername    VARCHAR(50)   = NULL,
    @BranchId           INT           = NULL,
    @Position           NVARCHAR(50)  = NULL,
    @Status             VARCHAR(20)   = NULL,
    @TargetDate         DATE          = NULL,
    @SearchText         NVARCHAR(100) = NULL,
    @PageIndex          INT           = 1,
    @PageSize           INT           = 50
AS 
BEGIN 
    SET NOCOUNT ON;

    -- Chuẩn hóa tham số
    IF @Position = N'all' OR @Position = N'' SET @Position = NULL;
    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;

    -- Tự động giải quyết UserId từ Username nếu chưa truyền
    IF @CurrentUserId IS NULL AND @CurrentUsername IS NOT NULL
    BEGIN
        SELECT @CurrentUserId = UserId FROM dbo.Users WHERE Username = @CurrentUsername;
    END

    -- Result Set 1: Danh sách cột cấu hình động cho Grid Table
    SELECT 
        keyCol   AS [key],
        label    AS [label],
        colType  AS [type],       
        align    AS [align], 
        width    AS [width],
        sortable AS [sortable],
        mono     AS [mono]
    FROM (
        VALUES 
            (1, 'code',         N'MÃ NHÂN VIÊN',       'code', 'center', '7.5rem', 1, 1),
            (2, 'fullName',     N'TÊN NHÂN VIÊN',      'text', 'left',   '14rem',  1, 0),
            (3, 'citizenId',    N'SỐ CCCD',            'text', 'center', '9.5rem', 0, 1),
            (4, 'branchName',   N'CHI NHÁNH',          'pill', 'left',   '11rem',  0, 0),
            (5, 'position',     N'CHỨC DANH / VỊ TRÍ', 'text', 'left',   '12rem',  0, 0),
            (6, 'contractName', N'HỢP ĐỒNG LAO ĐỘNG',  'text', 'left',   '14rem',  0, 0)
    ) AS Cols(stt, keyCol, label, colType, align, width, sortable, mono)
    ORDER BY stt;

    -- Result Set 2: Dữ liệu dòng nhân sự phân trang từ hàm nền tảng Basic
    WITH FilteredData AS (
        SELECT   
            b.EmployeeId                                       AS [id],
            b.EmployeeCode                                     AS [code],
            b.FullName                                         AS [fullName],
            ISNULL(b.CitizenId, N'—')                          AS [citizenId],
            b.BranchName                                       AS [branchName],
            b.Position                                         AS [position],
            ISNULL(b.ContractName, N'Hợp đồng Lao động')       AS [contractName],
            b.EmployeeStatus                                   AS [status],
            b.HierarchyLevel                                   AS HierarchyLevel,
            COUNT(*) OVER()                                    AS TotalCount
        FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@TargetDate, '-1', ISNULL(@CurrentUserId, -1)) b
        WHERE 
            (@BranchId IS NULL OR b.BranchId = @BranchId)
            AND (@Position IS NULL OR b.Position = @Position)
            AND (@Status IS NULL OR b.EmployeeStatus = @Status)
            AND (
                @SearchText IS NULL 
                OR b.EmployeeCode LIKE '%' + @SearchText + '%'
                OR b.FullName LIKE N'%' + @SearchText + '%'
                OR b.PhoneNumber LIKE '%' + @SearchText + '%'
                OR b.CitizenId LIKE '%' + @SearchText + '%'
            )
    )
    SELECT 
        id,
        code,
        fullName,
        citizenId,
        branchName,
        position,
        contractName,
        status,
        TotalCount
    FROM FilteredData
    ORDER BY 
        HierarchyLevel DESC,
        id ASC
    OFFSET (@PageIndex - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_GetEmployees_GridDataset.';
GO

-- =======================================================================================
-- 2. THỦ TỤC: dbo.sp_HRM_GetEmployeesByHierarchy
-- Lấy danh sách nhân sự cấp dưới theo phân quyền tài khoản (phục vụ lazy combobox & cây phả hệ)
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Full
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeesByHierarchy
    @CurrentUserId      INT           = NULL,
    @CurrentUsername    VARCHAR(50)   = NULL,
    @CurrentEmployeeId  INT           = NULL,
    @BranchId           INT           = NULL,
    @Status             VARCHAR(20)   = NULL,
    @SearchText         NVARCHAR(100) = NULL,
    @PageIndex          INT           = 1,
    @PageSize           INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;

    IF @CurrentUserId IS NULL AND @CurrentUsername IS NOT NULL
    BEGIN
        SELECT @CurrentUserId = UserId FROM dbo.Users WHERE Username = @CurrentUsername;
    END;

    ;WITH FilteredHierarchy AS (
        SELECT 
            f.EmployeeId,
            f.EmployeeCode,
            f.FullName,
            f.Position,
            f.BranchId,
            f.BranchCode,
            f.BranchName,
            f.EmployeeStatus AS [Status],
            f.HierarchyLevel,
            f.RoleName,
            f.RoleDescription,
            f.PhoneNumber,
            f.Email,
            f.CitizenId,
            f.HireDate,
            LEFT(LTRIM(f.FullName), 1) AS AvatarInitial,
            COUNT(*) OVER() AS TotalCount
        FROM dbo.fn_vtblEmployeeList_ByDate_Full(DEFAULT, '-1', ISNULL(@CurrentUserId, -1)) f
        WHERE 
            (@BranchId IS NULL OR f.BranchId = @BranchId)
            AND (@Status IS NULL OR f.EmployeeStatus = @Status)
            AND (
                @SearchText IS NULL 
                OR f.EmployeeCode LIKE '%' + @SearchText + '%'
                OR f.FullName LIKE N'%' + @SearchText + '%'
                OR f.PhoneNumber LIKE '%' + @SearchText + '%'
                OR f.CitizenId LIKE '%' + @SearchText + '%'
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
        [Status],
        HierarchyLevel,
        RoleName,
        RoleDescription,
        PhoneNumber,
        Email,
        CitizenId,
        HireDate,
        AvatarInitial,
        TotalCount
    FROM FilteredHierarchy
    ORDER BY 
        HierarchyLevel DESC,
        BranchId ASC,
        EmployeeId ASC
    OFFSET (@PageIndex - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_GetEmployeesByHierarchy.';
GO

-- =======================================================================================
-- 3. THỦ TỤC: dbo.sp_HRM_GetEmployeeFullProfile
-- Lấy toàn bộ 5 nhóm hồ sơ chi tiết (Accordion) của một nhân viên cụ thể
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Full
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeFullProfile
    @EmployeeId     INT         = NULL,
    @EmployeeCode   VARCHAR(20) = NULL,
    @TargetDate     DATE        = NULL
AS
BEGIN
    SET NOCOUNT ON;

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

    -- 2. Trích xuất thông tin cấp duyệt (Approver) & Quy trình được phép duyệt (JSON)
    DECLARE @ApprovalLevel TINYINT = NULL;
    DECLARE @ParentApproverId INT = NULL;
    DECLARE @ParentApproverName NVARCHAR(100) = NULL;
    DECLARE @ParentApproverCode VARCHAR(20) = NULL;
    DECLARE @AllowedWorkflowsJson NVARCHAR(MAX) = '[]';

    IF OBJECT_ID('dbo.Approvers') IS NOT NULL
    BEGIN
        SELECT TOP 1 
            @ApprovalLevel = a.ApprovalLevel,
            @ParentApproverId = a.ParentApproverId,
            @ParentApproverName = ISNULL(e_parent.FullName, u_parent.FullName),
            @ParentApproverCode = e_parent.EmployeeCode
        FROM dbo.Approvers a
        LEFT JOIN dbo.Approvers parent ON a.ParentApproverId = parent.ApproverId
        LEFT JOIN dbo.Employees e_parent ON parent.EmployeeId = e_parent.EmployeeId
        LEFT JOIN dbo.Users u_parent ON e_parent.UserId = u_parent.UserId
        WHERE a.EmployeeId = @EmployeeId AND a.IsActive = 1;
    END

    -- Sinh danh sách workflow được duyệt dạng JSON
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

    -- 3. Trả về toàn bộ hồ sơ từ hàm nền tảng Full
    SELECT TOP 1
        -- 1. Định danh & Lý lịch
        f.EmployeeId,
        f.EmployeeCode,
        f.FullName,
        f.PhoneNumber,
        f.Email,
        f.DateOfBirth,
        f.Gender,
        f.CitizenId,
        f.EmployeeStatus AS [Status],
        f.HireDate,
        f.EmployeeNote AS Note,

        -- 2. Tài khoản Ngân hàng
        f.BankName,
        f.BankAccountNumber,
        f.BankAccountName,

        -- Chi nhánh công tác
        f.BranchId,
        f.BranchCode,
        f.BranchName,
        f.Position,

        -- 3. Hợp đồng lao động & Đãi ngộ
        f.ContractTypeId,
        f.ContractCode,
        f.ContractName,
        f.HourlyRate,
        f.Allowance,
        f.BenefitsDescription,

        -- 4. Phân cấp thẩm quyền & Quy trình phê duyệt
        f.UserId,
        f.Username,
        f.RoleId,
        f.RoleName,
        f.HierarchyLevel,
        @ApprovalLevel AS ApprovalLevel,
        @ParentApproverName AS DirectManagerName,
        @ParentApproverCode AS DirectManagerCode,
        ISNULL(@AllowedWorkflowsJson, '[]') AS AllowedWorkflowsJson
    FROM dbo.fn_vtblEmployeeList_ByDate_Full(@TargetDate, CAST(@EmployeeId AS NVARCHAR(50)), -1) f;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_GetEmployeeFullProfile.';
GO

-- =======================================================================================
-- 4. THỦ TỤC: dbo.sp_HRM_GetEmployees_Filter
-- Lọc danh sách nhân viên đa tiêu chí kết hợp phân trang
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Basic
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployees_Filter
    @BranchId           INT           = NULL,
    @Position           NVARCHAR(50)  = NULL,
    @Status             VARCHAR(20)   = NULL,
    @SearchText         NVARCHAR(100) = NULL,
    @ViewDate           DATE          = NULL,
    @CurrentUserId      INT           = NULL,
    @PageIndex          INT           = 1,
    @PageSize           INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    IF @Position = N'all' OR @Position = N'' SET @Position = NULL;
    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;

    WITH Filtered AS (
        SELECT 
            b.EmployeeId,
            b.EmployeeCode,
            b.FullName,
            b.PhoneNumber,
            b.Email,
            b.CitizenId,
            b.Position,
            b.BranchId,
            b.BranchName,
            b.ContractName,
            b.EmployeeStatus,
            b.HireDate,
            b.HourlyRate,
            b.HasAccount,
            b.UserId,
            b.Username,
            b.RoleName,
            b.HierarchyLevel,
            COUNT(*) OVER() AS TotalCount
        FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@ViewDate, '-1', ISNULL(@CurrentUserId, -1)) b
        WHERE 
            (@BranchId IS NULL OR b.BranchId = @BranchId)
            AND (@Position IS NULL OR b.Position = @Position)
            AND (@Status IS NULL OR b.EmployeeStatus = @Status)
            AND (
                @SearchText IS NULL 
                OR b.EmployeeCode LIKE '%' + @SearchText + '%'
                OR b.FullName LIKE N'%' + @SearchText + '%'
                OR b.PhoneNumber LIKE '%' + @SearchText + '%'
                OR b.CitizenId LIKE '%' + @SearchText + '%'
            )
    )
    SELECT *
    FROM Filtered
    ORDER BY HierarchyLevel DESC, EmployeeId ASC
    OFFSET (@PageIndex - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_GetEmployees_Filter.';
GO

-- =======================================================================================
-- 5. THỦ TỤC: dbo.sp_HRM_GetEmployees_FilterOptions
-- Cung cấp 4 danh mục dữ liệu cho các combobox bộ lọc (Branches, Positions, Statuses, ContractTypes)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployees_FilterOptions
AS
BEGIN
    SET NOCOUNT ON;

    -- Result Set 1: Danh sách chi nhánh
    SELECT 'all' AS [Value], N'Tất cả chi nhánh' AS [Label]
    UNION ALL
    SELECT CAST(BranchId AS VARCHAR(10)) AS [Value], BranchName AS [Label]
    FROM dbo.Branches
    WHERE IsActive = 1
    ORDER BY [Value];

    -- Result Set 2: Danh sách chức vụ thực tế
    SELECT 'all' AS [Value], N'Tất cả chức danh' AS [Label]
    UNION ALL
    SELECT DISTINCT Position AS [Value], Position AS [Label]
    FROM dbo.Employees
    WHERE Position IS NOT NULL AND LTRIM(RTRIM(Position)) <> ''
    ORDER BY [Value];

    -- Result Set 3: Danh sách trạng thái làm việc
    SELECT [Value], [Label]
    FROM (
        VALUES 
            ('all',       N'Tất cả trạng thái'),
            ('active',    N'Đang làm việc'),
            ('probation', N'Thử việc / Học việc'),
            ('suspended', N'Tạm hoãn hợp đồng'),
            ('resigned',  N'Đã thôi việc')
    ) AS St(Value, Label);

    -- Result Set 4: Danh mục loại hợp đồng
    SELECT 'all' AS [Value], N'Tất cả loại hợp đồng' AS [Label]
    UNION ALL
    SELECT CAST(ContractTypeId AS VARCHAR(10)) AS [Value], ContractName AS [Label]
    FROM dbo.ContractTypes
    WHERE IsActive = 1
    ORDER BY [Value];
END;
GO
PRINT N'-> Đã tạo dbo.sp_HRM_GetEmployees_FilterOptions.';
GO

-- =======================================================================================
-- 6. THỦ TỤC: dbo.sp_HRM_ExportEmployees_Excel
-- Trích xuất danh sách nhân viên 43 cột nghiệp vụ ra DataSet phục vụ xuất Excel
-- Kế thừa: dbo.fn_vtblEmployeeList_ByDate_Full
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ExportEmployees_Excel
    @CurrentUserId   INT           = NULL,
    @CurrentUsername VARCHAR(50)   = NULL,
    @BranchId        INT           = NULL,
    @Position        NVARCHAR(50)  = NULL,
    @Status          VARCHAR(20)   = NULL,
    @SearchText      NVARCHAR(100) = NULL,
    @EmployeeCodes   NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Position = N'all' OR @Position = N'' SET @Position = NULL;
    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    SET @EmployeeCodes = NULLIF(LTRIM(RTRIM(@EmployeeCodes)), N'');

    IF @CurrentUserId IS NULL AND @CurrentUsername IS NOT NULL
    BEGIN
        SELECT @CurrentUserId = UserId FROM dbo.Users WHERE Username = @CurrentUsername;
    END

    -- Result Set 1: Danh sách nhân viên định dạng xuất Excel
    SELECT 
        f.EmployeeCode                          AS [MaNhanVien],
        f.FullName                              AS [HoVaTen],
        ISNULL(f.CitizenId, N'-')               AS [SoCCCD],
        ISNULL(f.PhoneNumber, N'-')             AS [SoDienThoai],
        ISNULL(f.Email, N'-')                   AS [Email],
        f.BranchName                            AS [ChiNhanh],
        f.Position                              AS [ChucDanh],
        ISNULL(f.ContractName, N'Hợp đồng Lao động') AS [LoaiHopDong],
        CAST(f.HourlyRate AS INT)               AS [LuongGio],
        CAST(ISNULL(f.Allowance, 0) AS INT)     AS [PhuCap],
        CASE 
            WHEN f.EmployeeStatus = 'active'    THEN N'Đang làm việc'
            WHEN f.EmployeeStatus = 'resigned'  THEN N'Đã thôi việc'
            WHEN f.EmployeeStatus = 'suspended' THEN N'Tạm hoãn HĐ'
            WHEN f.EmployeeStatus = 'probation' THEN N'Thử việc'
            ELSE f.EmployeeStatus 
        END                                     AS [TrangThai],
        CONVERT(VARCHAR(10), f.HireDate, 103)   AS [NgayVaoLam],
        ISNULL(f.BankName, N'-')                AS [NganHang],
        ISNULL(f.BankAccountNumber, N'-')       AS [SoTaiKhoanNganHang],
        ISNULL(f.Username, N'Chưa có')          AS [TaiKhoanHeThong],
        ISNULL(f.RoleName, N'-')                AS [VaiTroHeThong]
    FROM dbo.fn_vtblEmployeeList_ByDate_Full(DEFAULT, '-1', ISNULL(@CurrentUserId, -1)) f
    WHERE 
        (@BranchId IS NULL OR f.BranchId = @BranchId)
      AND (@Position IS NULL OR f.Position = @Position)
      AND (@Status IS NULL OR f.EmployeeStatus = @Status)
      AND (
          @SearchText IS NULL 
          OR f.EmployeeCode LIKE '%' + @SearchText + '%'
          OR f.FullName LIKE N'%' + @SearchText + '%'
          OR f.PhoneNumber LIKE '%' + @SearchText + '%'
          OR f.CitizenId LIKE '%' + @SearchText + '%'
      )
      AND (
          @EmployeeCodes IS NULL
          OR f.EmployeeCode IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@EmployeeCodes, ','))
      )
    ORDER BY 
        f.HierarchyLevel DESC,
        f.BranchId ASC,
        f.EmployeeId ASC;

    -- Result Set 2: Cấu hình bảng dữ liệu xuất ra Excel (#ExportConfig)
    CREATE TABLE #ExportConfig (
        ORD          INT IDENTITY PRIMARY KEY,
        TableIndex   VARCHAR(MAX),
        SheetIndex   INT,
        ParseType    NVARCHAR(MAX),
        Position     NVARCHAR(MAX),
        WithHeader   INT,
        WithBestFit  BIT
    );

    INSERT INTO #ExportConfig (TableIndex, SheetIndex, ParseType, Position, WithHeader, WithBestFit)
    VALUES (
        '0', 
        0, 
        N'Table|AutoMapColumn=1|WithOrderNumber=1-1', 
        'A5', 
        1, 
        1
    );

    SELECT * FROM #ExportConfig ORDER BY ORD;
    DROP TABLE #ExportConfig;
END;
GO
PRINT N'-> Đã nâng cấp dbo.sp_HRM_ExportEmployees_Excel.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG TỆP 18: TOÀN BỘ 6 THỦ TỤC ĐỌC ĐÃ ĐƯỢC CHUẨN HÓA VÀ HOẠT ĐỘNG THÔNG SUỐT!';
PRINT N'=======================================================================================';
GO
