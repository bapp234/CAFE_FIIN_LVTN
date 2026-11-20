USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- RELEASE 39: XUẤT WORD HỢP ĐỒNG (.DOCX) & XUẤT/NHẬP EXCEL HỢP ĐỒNG
-- ============================================================================

-- 1. Stored Procedure: Lấy đầy đủ thông tin Hợp đồng + Nhân sự để đổ vào file Word (.docx) mẫu
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetContractWordDetail
    @ContractId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        ec.ContractId,
        ec.ContractCode,
        ec.EmployeeId,
        e.EmployeeCode,
        ISNULL(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName) AS FullName,
        ISNULL(e.CitizenId, N'Chưa cập nhật') AS CitizenId,
        e.DateOfBirth,
        ISNULL(e.Gender, 'other') AS Gender,
        ISNULL(NULLIF(LTRIM(RTRIM(e.PhoneNumber)), ''), u.PhoneNumber) AS PhoneNumber,
        u.Email,
        ISNULL(b.BranchName, N'Hệ thống Cà Phê Fiin') AS BranchName,
        ISNULL(b.Address, N'TP. Hồ Chí Minh') AS BranchAddress,
        ct.ContractCode AS ContractTypeCode,
        ct.ContractName,
        ISNULL(ct.BenefitsDescription, N'Theo quy định hiện hành của Công ty Cà Phê Fiin.') AS BenefitsDescription,
        ec.Position,
        ec.HourlyRate,
        ec.Allowance,
        ec.StartDate,
        ec.EndDate,
        ec.SignDate,
        ec.Status,
        ec.Note
    FROM dbo.EmployeeContracts ec
    INNER JOIN dbo.Employees e ON ec.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON ec.ContractTypeId = ct.ContractTypeId
    WHERE ec.ContractId = @ContractId;
END;
GO

-- 2. Stored Procedure: Trả về DataSet gồm Dữ liệu Hợp đồng + Bảng ExportConfig cho PExcelExportEngine
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetContractsExportDataSet
    @TabMode        VARCHAR(20)   = 'current',
    @BranchId       INT           = NULL,
    @EmployeeId     INT           = NULL,
    @ContractTypeId INT           = NULL,
    @Status         VARCHAR(20)   = NULL,
    @ExpiringDays   INT           = 30,
    @Search         NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), N'');
    IF @ExpiringDays IS NULL OR @ExpiringDays < 1 SET @ExpiringDays = 30;

    -- Result Set 0: Dữ liệu Hợp đồng (tên cột khớp với Header Template Excel)
    SELECT
        ec.ContractCode AS [Mã HĐ],
        e.EmployeeCode AS [Mã NV],
        ISNULL(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName) AS [Họ và tên],
        ec.Position AS [Chức vụ],
        ISNULL(b.BranchName, N'—') AS [Chi nhánh],
        ct.ContractName AS [Loại hợp đồng],
        ec.HourlyRate AS [Lương giờ],
        ec.Allowance AS [Phụ cấp],
        CONVERT(VARCHAR(10), ec.StartDate, 103) AS [Hiệu lực từ],
        CASE WHEN ec.EndDate IS NOT NULL THEN CONVERT(VARCHAR(10), ec.EndDate, 103) ELSE N'Không xác định' END AS [Đến ngày],
        CASE ec.Status
            WHEN 'active' THEN N'Đang hiệu lực'
            WHEN 'pending' THEN N'Chờ duyệt'
            WHEN 'expired' THEN N'Hết hạn'
            WHEN 'terminated' THEN N'Đã thanh lý'
            WHEN 'rejected' THEN N'Từ chối'
            ELSE ec.Status
        END AS [Trạng thái],
        ISNULL(ec.Note, N'') AS [Ghi chú]
    FROM dbo.EmployeeContracts ec
    INNER JOIN dbo.Employees e ON ec.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON ec.ContractTypeId = ct.ContractTypeId
    WHERE (@BranchId IS NULL OR @BranchId <= 0 OR e.BranchId = @BranchId)
      AND (@EmployeeId IS NULL OR @EmployeeId <= 0 OR ec.EmployeeId = @EmployeeId)
      AND (@ContractTypeId IS NULL OR @ContractTypeId <= 0 OR ec.ContractTypeId = @ContractTypeId)
      AND (@Status IS NULL OR @Status = 'all' OR ec.Status = @Status)
      AND (
          @Search IS NULL
          OR ec.ContractCode LIKE N'%' + @Search + N'%'
          OR e.EmployeeCode LIKE N'%' + @Search + N'%'
          OR ISNULL(e.FullName, u.FullName) LIKE N'%' + @Search + N'%'
          OR ec.Position LIKE N'%' + @Search + N'%'
      )
      AND (
          (@TabMode = 'current' AND ec.Status IN ('pending', 'active'))
          OR (@TabMode = 'expiring' AND ec.Status = 'active' AND ec.EndDate IS NOT NULL AND ec.EndDate <= DATEADD(DAY, @ExpiringDays, @Today))
          OR (@TabMode = 'history')
      )
    ORDER BY ec.CreatedAt DESC, ec.ContractId DESC;

    -- Result Set 1: Cấu hình cho PExcelExportEngine (AutoMapColumn=1, WithOrderNumber)
    SELECT
        '0' AS TableIndex,
        0 AS SheetIndex,
        'AutoMapColumn=1;WithOrderNumber=1' AS ParseType,
        'A5' AS Position,
        1 AS WithHeader,
        CAST(1 AS BIT) AS WithBestFit;
END;
GO

PRINT N'-> Đã triển khai hoàn tất Release 39 (Word & Excel Hợp đồng).';
GO
