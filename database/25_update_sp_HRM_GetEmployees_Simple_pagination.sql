USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- CẬP NHẬT: dbo.sp_HRM_GetEmployees_Simple
-- BỔ SUNG PHÂN TRANG @PageIndex, @PageSize (MẶC ĐỊNH 50 BẢN GHI ĐẦU TIÊN)
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployees_Simple
    @AccountStatus INT           = -1,
    @ViewDate      DATE          = NULL,
    @BranchId      INT           = NULL,
    @SearchText    NVARCHAR(100) = NULL,
    @LoginID       INT           = -1,
    @PageIndex     INT           = 1,
    @PageSize      INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- Chuẩn hóa tham số đầu vào
    IF @BranchId <= 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @AccountStatus IS NULL SET @AccountStatus = -1;
    IF @PageIndex IS NULL OR @PageIndex < 1 SET @PageIndex = 1;

    -- Đổ dữ liệu từ Function nền tảng vào bảng tạm #TempEmployees
    SELECT *
    INTO #TempEmployees
    FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@ViewDate, '-1', @LoginID);

    -- Phân trang linh hoạt: Nếu @PageSize > 0 thì dùng OFFSET / FETCH NEXT 50 dòng, nếu @PageSize <= 0 thì lấy toàn bộ
    IF @PageSize > 0
    BEGIN
        SELECT 
            t.EmployeeId,
            t.EmployeeCode,
            t.FullName,
            t.PhoneNumber,
            ISNULL(u.Email, t.Email) AS Email,
            t.Position,
            t.BranchId,
            t.BranchName,
            t.EmployeeStatus,
            t.HireDate,
            t.HourlyRate,
            CASE 
                WHEN t.UserId IS NOT NULL 
                 AND u.UserId IS NOT NULL 
                 AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                 AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0 
                THEN CAST(1 AS BIT) 
                ELSE CAST(0 AS BIT) 
            END AS HasAccount,
            t.UserId,
            u.Username,
            t.RoleName,
            t.HierarchyLevel,
            ISNULL(u.IsActive, CAST(0 AS BIT)) AS IsUserActive,
            ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
            COUNT(*) OVER() AS TotalCount
        FROM #TempEmployees t
        LEFT JOIN dbo.Users u ON t.UserId = u.UserId
        WHERE 
            (
                (@AccountStatus = -1)
                OR (
                    @AccountStatus = 1
                    AND t.EmployeeStatus NOT IN ('resigned', 'terminated')
                    AND t.UserId IS NOT NULL
                    AND u.UserId IS NOT NULL
                    AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                    AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0
                )
                OR (
                    @AccountStatus = 0
                    AND t.EmployeeStatus NOT IN ('resigned', 'terminated')
                    AND (
                        t.UserId IS NULL
                        OR u.UserId IS NULL
                        OR u.Username IS NULL OR LEN(LTRIM(RTRIM(u.Username))) = 0
                        OR u.PasswordHash IS NULL OR LEN(LTRIM(RTRIM(u.PasswordHash))) = 0
                    )
                )
            )
            AND (@BranchId IS NULL OR t.BranchId = @BranchId)
            AND (
                @SearchText IS NULL 
                OR t.EmployeeCode LIKE '%' + @SearchText + '%'
                OR t.FullName LIKE N'%' + @SearchText + '%'
                OR t.PhoneNumber LIKE '%' + @SearchText + '%'
                OR u.Username LIKE '%' + @SearchText + '%'
            )
        ORDER BY t.BranchId, t.EmployeeId
        OFFSET (@PageIndex - 1) * @PageSize ROWS
        FETCH NEXT @PageSize ROWS ONLY;
    END
    ELSE
    BEGIN
        SELECT 
            t.EmployeeId,
            t.EmployeeCode,
            t.FullName,
            t.PhoneNumber,
            ISNULL(u.Email, t.Email) AS Email,
            t.Position,
            t.BranchId,
            t.BranchName,
            t.EmployeeStatus,
            t.HireDate,
            t.HourlyRate,
            CASE 
                WHEN t.UserId IS NOT NULL 
                 AND u.UserId IS NOT NULL 
                 AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                 AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0 
                THEN CAST(1 AS BIT) 
                ELSE CAST(0 AS BIT) 
            END AS HasAccount,
            t.UserId,
            u.Username,
            t.RoleName,
            t.HierarchyLevel,
            ISNULL(u.IsActive, CAST(0 AS BIT)) AS IsUserActive,
            ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword,
            COUNT(*) OVER() AS TotalCount
        FROM #TempEmployees t
        LEFT JOIN dbo.Users u ON t.UserId = u.UserId
        WHERE 
            (
                (@AccountStatus = -1)
                OR (
                    @AccountStatus = 1
                    AND t.EmployeeStatus NOT IN ('resigned', 'terminated')
                    AND t.UserId IS NOT NULL
                    AND u.UserId IS NOT NULL
                    AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                    AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0
                )
                OR (
                    @AccountStatus = 0
                    AND t.EmployeeStatus NOT IN ('resigned', 'terminated')
                    AND (
                        t.UserId IS NULL
                        OR u.UserId IS NULL
                        OR u.Username IS NULL OR LEN(LTRIM(RTRIM(u.Username))) = 0
                        OR u.PasswordHash IS NULL OR LEN(LTRIM(RTRIM(u.PasswordHash))) = 0
                    )
                )
            )
            AND (@BranchId IS NULL OR t.BranchId = @BranchId)
            AND (
                @SearchText IS NULL 
                OR t.EmployeeCode LIKE '%' + @SearchText + '%'
                OR t.FullName LIKE N'%' + @SearchText + '%'
                OR t.PhoneNumber LIKE '%' + @SearchText + '%'
                OR u.Username LIKE '%' + @SearchText + '%'
            )
        ORDER BY t.BranchId, t.EmployeeId;
    END

    IF OBJECT_ID('tempdb..#TempEmployees') IS NOT NULL
        DROP TABLE #TempEmployees;
END;
GO
PRINT N'-> Đã cập nhật thành công dbo.sp_HRM_GetEmployees_Simple với phân trang 50 dòng mặc định.';
GO
