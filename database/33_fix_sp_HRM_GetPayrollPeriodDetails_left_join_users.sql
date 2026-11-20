USE [CoffeeShopDB];
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetPayrollPeriodDetails
    @PeriodMonth     VARCHAR(7),
    @BranchId        INT           = NULL,
    @Status          VARCHAR(20)   = NULL,
    @Search          NVARCHAR(100) = NULL,
    @CurrentUsername VARCHAR(50)   = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @HasHierarchyFilter BIT = 0;
    DECLARE @AllowedEmployees TABLE (EmployeeId INT PRIMARY KEY);

    IF @CurrentUsername IS NOT NULL AND LTRIM(RTRIM(@CurrentUsername)) <> ''
    BEGIN
        INSERT INTO @AllowedEmployees (EmployeeId)
        SELECT EmployeeId
        FROM dbo.fn_HRM_GetAccessibleEmployees(NULL, @CurrentUsername, NULL);

        SET @HasHierarchyFilter = 1;
    END

    DECLARE @PeriodId INT;
    SELECT TOP 1 @PeriodId = PeriodId
    FROM dbo.PayrollPeriods
    WHERE PeriodMonth = @PeriodMonth
      AND (@BranchId IS NULL OR BranchId = @BranchId OR BranchId IS NULL)
    ORDER BY BranchId DESC;

    SELECT
        p.PeriodId,
        p.PeriodMonth,
        p.BranchId,
        b.BranchName,
        p.Status,
        p.IsLocked,
        p.TotalEmployees,
        p.TotalNetPay,
        p.ApprovedBy,
        p.ApprovedAt,
        p.CreatedAt
    FROM dbo.PayrollPeriods p
    LEFT JOIN dbo.Branches b ON p.BranchId = b.BranchId
    WHERE p.PeriodId = @PeriodId;

    SELECT
        s.SlipId,
        s.PeriodId,
        s.EmployeeId,
        e.EmployeeCode,
        COALESCE(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName, e.EmployeeCode) AS FullName,
        ISNULL(e.Position, N'Nhân viên') AS Position,
        b.BranchCode,
        b.BranchName,
        ct.ContractCode,
        ct.ContractName,
        s.HourlyRate,
        s.StandardHours,
        s.OvertimeHours,
        s.BasePay,
        s.OvertimePay,
        s.Allowance,
        s.Deduction,
        s.Advance,
        s.NetPay,
        s.Status,
        s.Status AS SlipStatus,
        e.BankName,
        e.BankAccountNumber,
        e.BankAccountName,
        s.CreatedAt
    FROM dbo.PayrollSlips s
    INNER JOIN dbo.Employees e ON s.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON e.ContractTypeId = ct.ContractTypeId
    WHERE s.PeriodId = @PeriodId
      AND (@BranchId IS NULL OR e.BranchId = @BranchId)
      AND (@Status IS NULL OR @Status = 'all' OR s.Status = @Status)
      AND (@HasHierarchyFilter = 0 OR s.EmployeeId IN (SELECT EmployeeId FROM @AllowedEmployees))
      AND (
          @Search IS NULL OR LTRIM(RTRIM(@Search)) = '' OR
          e.EmployeeCode LIKE '%' + @Search + '%' OR
          COALESCE(e.FullName, u.FullName, N'') LIKE N'%' + @Search + N'%' OR
          e.Position LIKE N'%' + @Search + N'%'
      )
    ORDER BY b.BranchCode, e.EmployeeCode;
END
GO
