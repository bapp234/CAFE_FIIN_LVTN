USE [CoffeeShopDB];
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- =======================================================================================
-- Bổ sung BankName, BankAccountNumber, BankAccountName vào dbo.sp_HRM_GetEmployeesByHierarchy
-- để các màn hình Danh sách lương nhân viên / Tạm ứng lấy đúng thông tin ngân hàng từ DB
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
            e.BankName,
            e.BankAccountNumber,
            e.BankAccountName,
            f.HireDate,
            LEFT(LTRIM(f.FullName), 1) AS AvatarInitial,
            COUNT(*) OVER() AS TotalCount
        FROM dbo.fn_vtblEmployeeList_ByDate_Full(DEFAULT, '-1', ISNULL(@CurrentUserId, -1)) f
        LEFT JOIN dbo.Employees e ON e.EmployeeId = f.EmployeeId
        WHERE
            (@BranchId IS NULL OR f.BranchId = @BranchId)
            AND (@Status IS NULL OR f.EmployeeStatus = @Status)
            AND (
                @SearchText IS NULL
                OR f.EmployeeCode LIKE '%' + @SearchText + '%'
                OR f.FullName LIKE N'%' + @SearchText + '%'
                OR f.PhoneNumber LIKE '%' + @SearchText + '%'
                OR f.CitizenId LIKE '%' + @SearchText + '%'
                OR e.BankName LIKE N'%' + @SearchText + '%'
                OR e.BankAccountNumber LIKE '%' + @SearchText + '%'
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
        BankName,
        BankAccountNumber,
        BankAccountName,
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

PRINT N'-> Đã bổ sung BankName, BankAccountNumber, BankAccountName vào dbo.sp_HRM_GetEmployeesByHierarchy.';
GO
