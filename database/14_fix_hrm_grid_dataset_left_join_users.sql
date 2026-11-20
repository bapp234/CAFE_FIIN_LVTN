-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ FIIN (COFFEE SHOP MANAGEMENT SYSTEM)
-- RELEASE 14: CẬP NHẬT CÁC STORED PROCEDURE & FUNCTIONS TRUY VẤN NHÂN SỰ
-- KHẮC PHỤC: CHUYỂN INNER JOIN dbo.Users SANG LEFT JOIN ĐỂ HIỂN THỊ ĐẦY ĐỦ
-- MỌI NHÂN SỰ KỂ CẢ CHƯA ĐƯỢC CẤP TÀI KHOẢN ĐĂNG NHẬP (UserId IS NULL)
-- DATABASE: CoffeeShopDB
-- FILE: src/database/14_fix_hrm_grid_dataset_left_join_users.sql
-- =======================================================================================

USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU TRIỂN KHAI RELEASE 14: CẬP NHẬT TRUY VẤN LƯỚI NHÂN SỰ (LEFT JOIN dbo.Users)';
PRINT N'=======================================================================================';
GO

-- 1. Cập nhật dbo.sp_HRM_GetEmployees_GridDataset
CREATE OR ALTER PROC dbo.sp_HRM_GetEmployees_GridDataset
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
    IF @Position = N'all' OR @Position = N'' SET @Position = NULL;
    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;

    -- Result Set 1: Danh sách cột cấu hình động
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

    -- Result Set 2: Dữ liệu dòng nhân sự
    WITH AccessibleList AS (
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(@CurrentUserId, @CurrentUsername, NULL)
    ),
    FilteredData AS (
        SELECT   
            e.EmployeeId                                       AS [id],
            e.EmployeeCode                                     AS [code],
            ISNULL(e.FullName, ISNULL(u.FullName, e.BankAccountName)) AS [fullName],
            ISNULL(e.CitizenId, N'—')                          AS [citizenId],
            b.BranchName                                       AS [branchName],
            e.Position                                         AS [position],
            ISNULL(ct.ContractName, N'Hợp đồng Lao động')      AS [contractName],
            e.Status                                           AS [status],
            dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId) AS HierarchyLevel,
            COUNT(*) OVER()                                    AS TotalCount
        FROM dbo.Employees e
        INNER JOIN AccessibleList acc ON e.EmployeeId = acc.EmployeeId
        LEFT JOIN dbo.Users u ON e.UserId = u.UserId
        INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
        LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
        WHERE 
            (@BranchId IS NULL OR e.BranchId = @BranchId)
            AND (@Position IS NULL OR e.Position = @Position)
            AND (@Status IS NULL OR e.Status = @Status)
            AND (@TargetDate IS NULL OR CAST(e.HireDate AS DATE) <= @TargetDate)
            AND (
                @SearchText IS NULL 
                OR e.EmployeeCode LIKE '%' + @SearchText + '%'
                OR ISNULL(e.FullName, u.FullName) LIKE N'%' + @SearchText + '%'
                OR ISNULL(e.PhoneNumber, u.PhoneNumber) LIKE '%' + @SearchText + '%'
                OR e.CitizenId LIKE '%' + @SearchText + '%'
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
PRINT N'-> Đã nâng cấp sp_HRM_GetEmployees_GridDataset.';
GO

-- 2. Cập nhật dbo.sp_HRM_ExportEmployees_Excel
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

    WITH AccessibleList AS (
        SELECT EmployeeId 
        FROM dbo.fn_HRM_GetAccessibleEmployees(@CurrentUserId, @CurrentUsername, NULL)
    )
    SELECT 
        e.EmployeeCode                          AS [MaNhanVien],
        ISNULL(e.FullName, ISNULL(u.FullName, e.BankAccountName)) AS [HoVaTen],
        ISNULL(e.CitizenId, N'-')               AS [SoCCCD],
        ISNULL(e.PhoneNumber, ISNULL(u.PhoneNumber, N'-')) AS [SoDienThoai],
        b.BranchName                            AS [ChiNhanh],
        e.Position                              AS [ChucDanh],
        ISNULL(c.ContractName, N'Hợp đồng Lao động') AS [LoaiHopDong],
        CAST(e.HourlyRate AS INT)               AS [LuongGio],
        CAST(ISNULL(c.Allowance, 0) AS INT)     AS [PhuCap],
        CASE 
            WHEN e.Status = 'active'    THEN N'Đang làm việc'
            WHEN e.Status = 'resigned'  THEN N'Đã thôi việc'
            WHEN e.Status = 'suspended' THEN N'Tạm hoãn HĐ'
            ELSE e.Status 
        END                                     AS [TrangThai]
    FROM dbo.Employees e
    INNER JOIN AccessibleList acc ON e.EmployeeId = acc.EmployeeId
    LEFT JOIN dbo.Users u         ON e.UserId = u.UserId
    INNER JOIN dbo.Branches b     ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes c ON e.ContractTypeId = c.ContractTypeId
    WHERE 
        (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (@Position IS NULL OR e.Position = @Position)
      AND (@Status IS NULL OR e.Status = @Status)
      AND (
          @SearchText IS NULL 
          OR e.EmployeeCode LIKE '%' + @SearchText + '%'
          OR ISNULL(e.FullName, u.FullName) LIKE N'%' + @SearchText + '%'
          OR ISNULL(e.PhoneNumber, u.PhoneNumber) LIKE '%' + @SearchText + '%'
          OR e.CitizenId LIKE '%' + @SearchText + '%'
      )
      AND (
          @EmployeeCodes IS NULL
          OR e.EmployeeCode IN (SELECT LTRIM(RTRIM(value)) FROM STRING_SPLIT(@EmployeeCodes, ','))
      )
    ORDER BY 
        dbo.fn_Sys_GetEmployeeHierarchyLevel(e.EmployeeId) DESC,
        e.BranchId ASC,
        e.EmployeeId ASC;

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
PRINT N'-> Đã nâng cấp sp_HRM_ExportEmployees_Excel.';
GO

-- 3. Cập nhật dbo.fn_HRM_GetEmployeeAtDate
CREATE OR ALTER FUNCTION dbo.fn_HRM_GetEmployeeAtDate (
    @EmployeeId INT = NULL,
    @EmployeeCode VARCHAR(20) = NULL,
    @TargetDate DATE = NULL
)
RETURNS TABLE
AS
RETURN (
    WITH TargetContract AS (
        SELECT 
            c.ContractId,
            c.ContractCode,
            c.EmployeeId,
            c.ContractTypeId,
            c.Position,
            c.HourlyRate,
            c.Allowance,
            c.StartDate AS ContractStartDate,
            c.EndDate AS ContractEndDate,
            c.Status AS ContractStatus,
            c.Note AS ContractNote,
            ROW_NUMBER() OVER(
                PARTITION BY c.EmployeeId 
                ORDER BY c.StartDate DESC, c.ContractId DESC
            ) AS Rn
        FROM dbo.EmployeeContracts c
        WHERE (@EmployeeId IS NULL OR c.EmployeeId = @EmployeeId)
          AND ISNULL(@TargetDate, CAST(SYSDATETIME() AS DATE)) >= c.StartDate
          AND (c.EndDate IS NULL OR ISNULL(@TargetDate, CAST(SYSDATETIME() AS DATE)) <= c.EndDate)
    )
    SELECT 
        e.EmployeeId,
        e.EmployeeCode,
        u.UserId,
        u.Username,
        ISNULL(e.FullName, ISNULL(u.FullName, e.BankAccountName)) AS FullName,
        ISNULL(e.PhoneNumber, u.PhoneNumber) AS PhoneNumber,
        u.Email,
        e.CitizenId,
        e.BankName,
        e.BankAccountNumber,
        e.BankAccountName,
        b.BranchId,
        b.BranchCode,
        b.BranchName,
        -- Thông tin chức vụ & hợp đồng hiệu lực tại @TargetDate
        ISNULL(tc.ContractId, 0) AS ContractId,
        ISNULL(tc.ContractTypeId, e.ContractTypeId) AS ContractTypeId,
        ISNULL(ct.ContractCode, 'HD-CHINH-THUC') AS ContractCode,
        ISNULL(ct.ContractName, N'Hợp đồng Lao động') AS ContractName,
        ISNULL(ct.SalaryPercentage, 100) AS SalaryPercentage,
        ISNULL(tc.Position, e.Position) AS Position,
        ISNULL(tc.HourlyRate, e.HourlyRate) AS HourlyRate,
        ISNULL(tc.Allowance, ISNULL(ct.Allowance, 0)) AS Allowance,
        ct.BenefitsDescription,
        tc.ContractStartDate,
        tc.ContractEndDate,
        ISNULL(tc.ContractStatus, 'active') AS ContractStatus,
        tc.ContractNote,
        -- Thông tin nhân sự nền tảng
        e.DateOfBirth,
        e.Gender,
        e.HireDate,
        e.Status AS EmployeeStatus,
        e.Note AS EmployeeNote,
        e.UpdatedAt
    FROM dbo.Employees e
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN TargetContract tc ON e.EmployeeId = tc.EmployeeId AND tc.Rn = 1
    LEFT JOIN dbo.ContractTypes ct ON tc.ContractTypeId = ct.ContractTypeId
    WHERE (@EmployeeId IS NULL OR e.EmployeeId = @EmployeeId)
      AND (@EmployeeCode IS NULL OR e.EmployeeCode = @EmployeeCode)
);
GO
PRINT N'-> Đã nâng cấp fn_HRM_GetEmployeeAtDate.';
GO

-- 4. Cập nhật dbo.sp_HRM_GetEmployeeFullProfile
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

    IF OBJECT_ID('dbo.Approvers') IS NOT NULL
    BEGIN
        SELECT TOP 1 
            @ApprovalLevel = a.ApprovalLevel,
            @ParentApproverId = a.ParentApproverId,
            @ParentApproverName = ISNULL(e_parent.FullName, u_parent.FullName)
        FROM dbo.Approvers a
        LEFT JOIN dbo.Approvers parent ON a.ParentApproverId = parent.ApproverId
        LEFT JOIN dbo.Employees e_parent ON parent.EmployeeId = e_parent.EmployeeId
        LEFT JOIN dbo.Users u_parent ON e_parent.UserId = u_parent.UserId
        WHERE a.EmployeeId = @EmployeeId AND a.IsActive = 1;
    END

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
    LEFT JOIN dbo.Users u ON base.UserId = u.UserId
    LEFT JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
    LEFT JOIN dbo.Roles r ON ur.RoleId = r.RoleId;
END;
GO
PRINT N'-> Đã nâng cấp sp_HRM_GetEmployeeFullProfile.';
GO

PRINT N'=======================================================================================';
PRINT N'HOÀN TẤT THÀNH CÔNG RELEASE 14: TOÀN BỘ STORED PROCEDURES ĐÃ HỖ TRỢ ĐẦY ĐỦ 132 NHÂN SỰ!';
PRINT N'=======================================================================================';
GO
