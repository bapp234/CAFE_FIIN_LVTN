USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_PUBLIC_GetMenu
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CategoryId,
        ParentCategoryId,
        CategoryName,
        DisplayOrder,
        DisplayOrder AS SortOrder
    FROM dbo.Categories
    WHERE IsActive = 1
    ORDER BY DisplayOrder ASC, CategoryId ASC;

    SELECT
        p.ProductId,
        p.CategoryId,
        ISNULL(c.CategoryName, N'Khác') AS CategoryName,
        p.ProductCode,
        p.ProductName,
        p.[Description],
        p.ImageUrl,
        ISNULL((SELECT MIN(pv.BasePrice) FROM dbo.ProductVariants pv WHERE pv.ProductId = p.ProductId AND pv.IsActive = 1), 0) AS BasePrice
    FROM dbo.Products p
    LEFT JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
    WHERE p.IsActive = 1
    ORDER BY p.ProductId ASC;

    SELECT VariantId, ProductId, SizeName, BasePrice
    FROM dbo.ProductVariants
    WHERE IsActive = 1
    ORDER BY ProductId ASC, BasePrice ASC;

    SELECT ToppingId, ToppingName, Price
    FROM dbo.Toppings
    WHERE IsActive = 1
    ORDER BY ToppingId ASC;
END;
GO
PRINT N'-> Đã cập nhật dbo.sp_PUBLIC_GetMenu trả về đầy đủ danh mục từ dbo.Categories.';
GO
