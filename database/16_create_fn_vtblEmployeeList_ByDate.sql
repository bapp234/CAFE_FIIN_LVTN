-- =======================================================================================
-- TỆP MÃ NGUỒN: 16_create_fn_vtblEmployeeList_ByDate.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   1. Tạo Inline Table-Valued Function: dbo.fn_vtblEmployeeList_ByDate_Full
--      -> Lấy toàn bộ 100% thông tin nhân sự (hồ sơ, ngân hàng, hợp đồng temporal, tài khoản, cấp duyệt).
--   2. Tạo Inline Table-Valued Function: dbo.fn_vtblEmployeeList_ByDate_Basic
--      -> Lấy thông tin cơ bản tinh gọn, hỗ trợ hiển thị Grid và Tab "Tài khoản chưa thiết lập".
-- ĐẶC TẢ THAM SỐ CHUNG CHO CẢ 2 HÀM:
--   @ViewDate    DATE            = NULL: Mốc thời gian chặn trên (ToDate). Lấy TẤT CẢ nhân viên
--                                        gia nhập từ trước (quá khứ) cho đến ngày nhập này (khoảng [-∞, @ViewDate]).
--                                        Nếu NULL, mặc định lấy đến ngày hiện tại.
--   @EmployeeID  NVARCHAR(4000)  = '-1': Lọc theo ID/Code ('-1', 'ALL', NULL để lấy hết, hoặc '1,2,NV001').
--   @LoginID     INT             = -1  : ID tài khoản đang đăng nhập (dbo.Users.UserId), -1 để bỏ qua phân quyền.
-- =======================================================================================

USE CoffeeShopDB;
GO

-- =======================================================================================
-- PHẦN 1: INLINE FUNCTION LẤY TOÀN BỘ 100% THÔNG TIN NHÂN SỰ
-- =======================================================================================
CREATE OR ALTER FUNCTION dbo.fn_vtblEmployeeList_ByDate_Full
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
        -- [NHÓM 1: THÔNG TIN LÝ LỊCH & ĐỊNH DANH NHÂN SỰ]
        e.EmployeeId,
        e.EmployeeCode,
        ISNULL(e.FullName, ISNULL(u.FullName, e.BankAccountName)) AS FullName,
        ISNULL(e.PhoneNumber, u.PhoneNumber) AS PhoneNumber,
        u.Email,
        e.CitizenId,
        e.DateOfBirth,
        e.Gender,
        e.HireDate,
        e.Status AS EmployeeStatus,
        e.Note AS EmployeeNote,
        e.UpdatedAt AS EmployeeUpdatedAt,

        -- [NHÓM 2: CHI NHÁNH LÀM VIỆC]
        b.BranchId,
        b.BranchCode,
        b.BranchName,
        b.Address AS BranchAddress,
        b.PhoneNumber AS BranchPhoneNumber,

        -- [NHÓM 3: TÀI KHOẢN NGƯỜI DÙNG & PHÂN QUYỀN VAI TRÒ]
        u.UserId,
        u.Username,
        CASE WHEN u.UserId IS NOT NULL THEN CAST(1 AS BIT) ELSE CAST(0 AS BIT) END AS HasAccount,
        ISNULL(u.IsActive, CAST(0 AS BIT)) AS IsUserActive,
        ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
        u.CreatedAt AS UserCreatedAt,
        r.RoleId,
        r.RoleName,
        r.RoleDescription,
        e_level.HierarchyLevel,

        -- [NHÓM 4: HỢP ĐỒNG LAO ĐỘNG & CHẾ ĐỘ ĐÃI NGỘ TÍNH ĐẾN @ViewDate]
        ISNULL(tc.ContractId, 0) AS ContractId,
        ISNULL(tc.ContractCode, ct.ContractCode) AS ContractCode,
        ISNULL(ct.ContractName, N'Hợp đồng Lao động') AS ContractName,
        resolved_ct.ContractTypeId,
        ISNULL(tc.Position, e.Position) AS Position,
        ISNULL(tc.HourlyRate, ISNULL(e.HourlyRate, ct.StandardHourlyRate)) AS HourlyRate,
        ISNULL(tc.Allowance, ISNULL(ct.Allowance, 0)) AS Allowance,
        ISNULL(ct.SalaryPercentage, 100.00) AS SalaryPercentage,
        ct.BenefitsDescription,
        tc.ContractStartDate,
        tc.ContractEndDate,
        tc.ContractSignDate,
        ISNULL(tc.ContractStatus, 'active') AS ContractStatus,
        tc.ContractNote,

        -- [NHÓM 5: TÀI KHOẢN NGÂN HÀNG CHI TRẢ LƯƠNG]
        e.BankName,
        e.BankAccountNumber,
        e.BankAccountName,

        -- [NHÓM 6: CẤP DUYỆT & QUẢN LÝ DUYỆT TRỰC TIẾP]
        app.ApproverId,
        app.ApprovalLevel,
        app.ParentApproverId,
        app.ParentApproverName,
        app.ApproverWorkflowCode,
        ISNULL(app.IsApproverActive, CAST(0 AS BIT)) AS IsApproverActive

    FROM dbo.Employees e
    CROSS JOIN DateParam dp
    INNER JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId

    -- Phân quyền người gọi @LoginID
    LEFT JOIN CallerScope cs ON 1 = 1 AND @LoginID > 0

    -- Phân cấp vai trò người dùng
    OUTER APPLY (
        SELECT TOP 1 
            r_inner.RoleId, 
            r_inner.RoleName, 
            r_inner.Description AS RoleDescription
        FROM dbo.UserRoles ur
        INNER JOIN dbo.Roles r_inner ON ur.RoleId = r_inner.RoleId
        WHERE ur.UserId = u.UserId
        ORDER BY r_inner.RoleId ASC
    ) r

    -- Tính toán HierarchyLevel của nhân viên
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
            c.ContractId,
            c.ContractCode,
            c.ContractTypeId,
            c.Position,
            c.HourlyRate,
            c.Allowance,
            c.StartDate AS ContractStartDate,
            c.EndDate AS ContractEndDate,
            c.SignDate AS ContractSignDate,
            c.Status AS ContractStatus,
            c.Note AS ContractNote
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

    -- Thông tin cấp duyệt
    OUTER APPLY (
        SELECT TOP 1 
            a.ApproverId,
            a.ApprovalLevel,
            a.ParentApproverId,
            parent_e.FullName AS ParentApproverName,
            a.WorkflowCode AS ApproverWorkflowCode,
            a.IsActive AS IsApproverActive
        FROM dbo.Approvers a
        LEFT JOIN dbo.Approvers parent_a ON a.ParentApproverId = parent_a.ApproverId
        LEFT JOIN dbo.Employees parent_e ON parent_a.EmployeeId = parent_e.EmployeeId
        WHERE a.EmployeeId = e.EmployeeId
        ORDER BY a.IsActive DESC, a.ApproverId DESC
    ) app

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
PRINT N'-> Đã tạo Inline Function: dbo.fn_vtblEmployeeList_ByDate_Full.';
GO

-- =======================================================================================
-- PHẦN 2: INLINE FUNCTION LẤY THÔNG TIN CƠ BẢN TINH GỌN (BASIC)
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
        ISNULL(tc.Position, e.Position) AS Position,
        b.BranchId,
        b.BranchName,
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
PRINT N'-> Đã tạo Inline Function: dbo.fn_vtblEmployeeList_ByDate_Basic.';
GO
