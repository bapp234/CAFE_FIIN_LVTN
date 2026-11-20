USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- CẬP NHẬT: dbo.sp_HRM_ExportEmployees_Excel
-- MỤC ĐÍCH: Bổ sung tham số @AccountStatus INT = -1 để xuất Excel khớp chính xác
--           tập nhân sự đang hiển thị trên từng màn hình (1: đã có TK/MK, 0: chưa có, -1: tất cả)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ExportEmployees_Excel
    @CurrentUserId   INT           = NULL,
    @CurrentUsername VARCHAR(50)   = NULL,
    @BranchId        INT           = NULL,
    @Position        NVARCHAR(50)  = NULL,
    @Status          VARCHAR(20)   = NULL,
    @SearchText      NVARCHAR(100) = NULL,
    @EmployeeCodes   NVARCHAR(MAX) = NULL,
    @AccountStatus   INT           = -1
AS
BEGIN
    SET NOCOUNT ON;

    IF @Position = N'all' OR @Position = N'' SET @Position = NULL;
    IF @Status = 'all' OR @Status = '' SET @Status = NULL;
    IF @BranchId = 0 SET @BranchId = NULL;
    IF @AccountStatus IS NULL SET @AccountStatus = -1;
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
    LEFT JOIN dbo.Users u ON f.UserId = u.UserId
    WHERE 
        (
            @AccountStatus = -1
            OR (
                @AccountStatus = 1
                AND f.EmployeeStatus NOT IN ('resigned', 'terminated')
                AND f.UserId IS NOT NULL
                AND u.UserId IS NOT NULL
                AND u.Username IS NOT NULL AND LEN(LTRIM(RTRIM(u.Username))) > 0
                AND u.PasswordHash IS NOT NULL AND LEN(LTRIM(RTRIM(u.PasswordHash))) > 0
            )
            OR (
                @AccountStatus = 0
                AND f.EmployeeStatus NOT IN ('resigned', 'terminated')
                AND (
                    f.UserId IS NULL
                    OR u.UserId IS NULL
                    OR u.Username IS NULL OR LEN(LTRIM(RTRIM(u.Username))) = 0
                    OR u.PasswordHash IS NULL OR LEN(LTRIM(RTRIM(u.PasswordHash))) = 0
                )
            )
        )
      AND (@BranchId IS NULL OR f.BranchId = @BranchId)
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

PRINT N'-> Đã cập nhật thành công dbo.sp_HRM_ExportEmployees_Excel với tham số @AccountStatus.';
GO
