-- =======================================================================================
-- TỆP MÃ NGUỒN: 17_create_sp_HRM_GetEmployees_Simple.sql
-- DỰ ÁN: LUẬN VĂN TỐT NGHIỆP - HỆ THỐNG QUẢN LÝ CHUỖI CÀ PHÊ SÀI GÒN VINTAGE
-- MỤC ĐÍCH:
--   1. Xóa thủ tục cũ: dbo.sp_HRM_GetEmployees_WithAccount
--   2. Tạo mới Stored Procedure: dbo.sp_HRM_GetEmployees_Simple
--      -> Lấy thông tin cơ bản tinh gọn của nhân viên, tích hợp bộ công tắc 3 chế độ:
--         • @AccountStatus =  1: Lấy nhân viên ĐÃ CÓ tài khoản & mật khẩu rõ ràng (LOẠI nhân viên đã nghỉ việc).
--         • @AccountStatus =  0: Lấy nhân viên CHƯA CÓ tài khoản/mật khẩu rõ ràng (LOẠI nhân viên đã nghỉ việc).
--         • @AccountStatus = -1: Lấy TẤT CẢ nhân viên toàn hệ thống (không lọc tài khoản, bao gồm cả đã nghỉ việc).
-- ĐẶC TẢ THAM SỐ:
--   @AccountStatus INT           = -1  : Công tắc tài khoản (1: Có TK/MK, 0: Chưa có TK/MK, -1: Lấy hết).
--   @ViewDate      DATE          = NULL: Mốc thời gian chặn trên (ToDate, mặc định ngày hiện tại).
--   @BranchId      INT           = NULL: Lọc theo chi nhánh (NULL hoặc <= 0 để lấy tất cả).
--   @SearchText    NVARCHAR(100) = NULL: Tìm kiếm theo mã NV, họ tên, SĐT, Username.
--   @LoginID       INT           = -1  : ID tài khoản đăng nhập (UserId), -1 để bỏ qua phân quyền.
-- =======================================================================================

USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Xóa thủ tục cũ
IF OBJECT_ID('dbo.sp_HRM_GetEmployees_WithAccount', 'P') IS NOT NULL
BEGIN
    DROP PROCEDURE dbo.sp_HRM_GetEmployees_WithAccount;
    PRINT N'-> Đã xóa thủ tục cũ: dbo.sp_HRM_GetEmployees_WithAccount.';
END;
GO

-- 2. Tạo mới thủ tục đa năng dbo.sp_HRM_GetEmployees_Simple
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployees_Simple
    @AccountStatus INT           = -1,
    @ViewDate      DATE          = NULL,
    @BranchId      INT           = NULL,
    @SearchText    NVARCHAR(100) = NULL,
    @LoginID       INT           = -1
AS
BEGIN
    SET NOCOUNT ON;

    -- 2.1 Chuẩn hóa tham số đầu vào
    IF @BranchId <= 0 SET @BranchId = NULL;
    SET @SearchText = NULLIF(LTRIM(RTRIM(@SearchText)), N'');
    IF @AccountStatus IS NULL SET @AccountStatus = -1;

    -- 2.2 Đổ dữ liệu từ Function nền tảng vào bảng tạm #TempEmployees
    SELECT *
    INTO #TempEmployees
    FROM dbo.fn_vtblEmployeeList_ByDate_Basic(@ViewDate, '-1', @LoginID);

    -- 2.3 Truy vấn dữ liệu tinh gọn theo công tắc @AccountStatus (1, 0, -1)
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
        -- Đánh giá trạng thái tài khoản mật khẩu rõ ràng
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
        ISNULL(u.MustChangePassword, CAST(0 AS BIT)) AS MustChangePassword
    FROM #TempEmployees t
    LEFT JOIN dbo.Users u ON t.UserId = u.UserId
    WHERE 
        -- Bộ lọc công tắc tài khoản & trạng thái làm việc:
        (
            -- Chế độ -1: Lấy lên hết (không xét tài khoản, bao gồm cả nhân viên đã nghỉ việc)
            (@AccountStatus = -1)

            -- Chế độ 1: Đã có tài khoản & mật khẩu rõ ràng, và LOẠI nhân viên đã nghỉ việc
            OR (
                @AccountStatus = 1
                AND t.EmployeeStatus NOT IN ('resigned', 'terminated')
                AND t.UserId IS NOT NULL
                AND u.UserId IS NOT NULL
                AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0
            )

            -- Chế độ 0: Chưa có tài khoản hoặc chưa có mật khẩu rõ ràng, và LOẠI nhân viên đã nghỉ việc
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
        -- Lọc theo chi nhánh
        AND (@BranchId IS NULL OR t.BranchId = @BranchId)
        -- Tìm kiếm từ khóa
        AND (
            @SearchText IS NULL 
            OR t.EmployeeCode LIKE '%' + @SearchText + '%'
            OR t.FullName LIKE N'%' + @SearchText + '%'
            OR t.PhoneNumber LIKE '%' + @SearchText + '%'
            OR u.Username LIKE '%' + @SearchText + '%'
        )
    ORDER BY t.BranchId, t.EmployeeId;

    -- Dọn dẹp bảng tạm
    IF OBJECT_ID('tempdb..#TempEmployees') IS NOT NULL
        DROP TABLE #TempEmployees;
END;
GO
PRINT N'-> Đã tạo mới Stored Procedure: dbo.sp_HRM_GetEmployees_Simple.';
GO
