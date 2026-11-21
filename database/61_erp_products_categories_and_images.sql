USE [CoffeeShopDB];
GO

-- 1. Cho phép Products.CategoryId NULL để hỗ trợ gỡ sản phẩm khỏi danh mục trước khi gắn danh mục khác
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.Products') AND name = 'CategoryId' AND is_nullable = 0
)
BEGIN
    ALTER TABLE dbo.Products ALTER COLUMN CategoryId INT NULL;
END
GO

-- 2. Đảm bảo 4 danh mục chuẩn tồn tại
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = N'Cà phê')
    INSERT INTO dbo.Categories (CategoryName, DisplayOrder, IsActive) VALUES (N'Cà phê', 1, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = N'Trà trái cây')
    INSERT INTO dbo.Categories (CategoryName, DisplayOrder, IsActive) VALUES (N'Trà trái cây', 2, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = N'Trà đậm vị')
    INSERT INTO dbo.Categories (CategoryName, DisplayOrder, IsActive) VALUES (N'Trà đậm vị', 3, 1);
IF NOT EXISTS (SELECT 1 FROM dbo.Categories WHERE CategoryName = N'Bánh ngọt')
    INSERT INTO dbo.Categories (CategoryName, DisplayOrder, IsActive) VALUES (N'Bánh ngọt', 4, 1);
GO

-- 3. Nạp & cập nhật ImageUrl (/mon/...) cho toàn bộ ảnh trong public/mon/
DECLARE @CatCoffee INT = (SELECT TOP 1 CategoryId FROM dbo.Categories WHERE CategoryName = N'Cà phê');
DECLARE @CatFruit  INT = (SELECT TOP 1 CategoryId FROM dbo.Categories WHERE CategoryName = N'Trà trái cây');
DECLARE @CatTea    INT = (SELECT TOP 1 CategoryId FROM dbo.Categories WHERE CategoryName = N'Trà đậm vị');
DECLARE @CatCake   INT = (SELECT TOP 1 CategoryId FROM dbo.Categories WHERE CategoryName = N'Bánh ngọt');

DECLARE @Seed TABLE (Code VARCHAR(20), Name NVARCHAR(150), CatId INT, Img NVARCHAR(255), Price DECIMAL(18,2));
INSERT INTO @Seed (Code, Name, CatId, Img, Price) VALUES
('MON01', N'Phin Đen Đá', @CatCoffee, N'/mon/01 Phin Đen Đá.png', 29000),
('MON02', N'Phin Sữa Đá Sả Sài Gòn', @CatCoffee, N'/mon/02 Phin Sữa Đá Sả Sài Gòn.png', 35000),
('MON03', N'Bạc Xỉu Sài Gòn Xưa', @CatCoffee, N'/mon/03 Bạc Xỉu Sài Gòn Xưa.png', 35000),
('MON04', N'Vợt Kho CF-PHIN-02', @CatCoffee, N'/mon/04 Vợt Kho CF-PHIN-02.png', 32000),
('MON05', N'Vợt Kho CF-PHIN-04', @CatCoffee, N'/mon/05 Vợt Kho CF-PHIN-04.png', 32000),
('MON06', N'CF-SPEC-01', @CatCoffee, N'/mon/06 CF-SPEC-01.png', 39000),
('MON07', N'CF-SPEC-04', @CatCoffee, N'/mon/07 CF-SPEC-04.png', 39000),
('MON08', N'Cà Phê Muối trong Siêu Đất', @CatCoffee, N'/mon/08 Cà Phê Muối trong Siêu Đất.png', 42000),
('MON09', N'Cà Phê Muối Phin Xưa', @CatCoffee, N'/mon/09 Cà Phê Muối Phin Xưa.png', 39000),
('MON10', N'Cà Phê Trứng Đánh Bông', @CatCoffee, N'/mon/10 Cà Phê Trứng Đánh Bông.png', 45000),
('MON11', N'Cà Phê Cốt Dừa', @CatCoffee, N'/mon/11 Cà Phê Cốt Dừa.png', 45000),
('MON12', N'Cà Phê Bơ Tây Nguyên', @CatCoffee, N'/mon/12 Cà Phê Bơ Tây Nguyên.png', 45000),
('MON13', N'Phin Hạnh Nhân', @CatCoffee, N'/mon/13 Phin Hạnh Nhân.png', 42000),
('MON14', N'Phin Kem Sữa Macchiato', @CatCoffee, N'/mon/14 Phin Kem Sữa Macchiato.png', 42000),
('MON15', N'Sữa Chua Cà Phê', @CatCoffee, N'/mon/15 Sữa Chua Cà Phê.png', 42000),
('MON16', N'Cà Phê Sữa Đá Xay', @CatCoffee, N'/mon/16 Cà Phê Sữa Đá Xay.png', 49000),
('MON17', N'Trà Sen Vàng Củ Năng', @CatFruit, N'/mon/17 Trà Sen Vàng Cú Năng.png', 45000),
('MON18', N'Trà Thạch Đào', @CatFruit, N'/mon/18 Trà Thạch Đào.png', 45000),
('MON19', N'Trà Vải Hạt Chia', @CatFruit, N'/mon/19 Trà Vải Hạt Chia.png', 45000),
('MON20', N'Trà Oolong Nhãn Nhục', @CatFruit, N'/mon/20 Trà Oolong Nhãn Nhục.png', 45000),
('MON21', N'Trà Mãng Cầu Xiêm', @CatFruit, N'/mon/21 Trà Măng Cầu Xiêm.png', 49000),
('MON22', N'Trà Dâu Tằm Đà Lạt', @CatFruit, N'/mon/22 Trà Dâu Tằm Đà Lạt.png', 49000),
('MON23', N'Trà Ổi Hồng Xí Muội', @CatFruit, N'/mon/23 Trà Ổi Hồng Hồng Xí Muội.png', 45000),
('MON24', N'Trà Cam Sả Quế Mật Ong', @CatFruit, N'/mon/24 Trà Cam Sả Quế Mật Ong.png', 45000),
('MON25', N'Trà Chanh Dây Hạt Đác', @CatFruit, N'/mon/25 Trà Chanh Dây Hạt Đác.png', 45000),
('MON26', N'Trà Sữa Truyền Thống Fiin', @CatTea, N'/mon/26 Trà Sữa Truyền Thống Fiin.png', 39000),
('MON27', N'Trà Sữa Trân Châu Đường Đen', @CatTea, N'/mon/27 Trà Sữa Trân Châu Đường Đen.png', 45000),
('MON28', N'Trà Sữa Oolong Rang', @CatTea, N'/mon/28 Trà Sữa Oolong Rang.png', 45000),
('MON29', N'Trà Sữa Thái Xanh', @CatTea, N'/mon/29 Trà Sữa Thái Xanh.png', 39000),
('MON30', N'Trà Sữa Thái Đỏ', @CatTea, N'/mon/30 Trà Sữa Thái Đỏ.png', 39000),
('MON31', N'Trà Sữa Thái Môn', @CatTea, N'/mon/31 Trà Sữa Thái Môn.png', 42000),
('MON32', N'Trà Sữa Khoai Môn Nghiền', @CatTea, N'/mon/32 Trà Sữa Khoai Môn Nghiền.png', 45000),
('MON33', N'Trà Sữa Gạo Rang Hàn Quốc', @CatTea, N'/mon/33 Trà Sữa Gạo Rang Hàn Quốc.png', 45000),
('MON34', N'Trà Sữa Bá Tước Kem Cheese', @CatTea, N'/mon/34 Trà Sữa Bá Tước Kem Cheese.png', 49000),
('MON35', N'Trà Sữa Socola Bạc Hà', @CatTea, N'/mon/35 Trà Sữa Socola Bạc Hà.png', 45000),
('MON36', N'Bánh Flan Cà Phê', @CatCake, N'/mon/36 Bánh Flan Cà Phê.png', 29000),
('MON37', N'Bánh Bò Thốt Nốt Nướng', @CatCake, N'/mon/37 Bánh Bò Thốt Nốt Nướng.png', 32000),
('MON38', N'Bánh Da Lợn Lá Dứa Đậu Xanh', @CatCake, N'/mon/38 Bánh Da Lợn Lá Dứa Đậu Xanh.png', 29000),
('MON39', N'Bánh Bông Lan Trứng Muối', @CatCake, N'/mon/39 Bánh Bông Lan Trứng Muối.png', 39000),
('MON40', N'Bánh Đậu Xanh Nướng Hội An', @CatCake, N'/mon/40 Bánh Đậu Xanh Nướng Hội An.png', 32000),
('MON41', N'Bánh Pía Sầu Riêng Đậu Xanh', @CatCake, N'/mon/41 Bánh Pía Sầu Riêng Đậu Xanh.png', 35000);

MERGE dbo.Products AS tgt
USING @Seed AS src ON tgt.ProductCode = src.Code
WHEN MATCHED THEN
    UPDATE SET tgt.ImageUrl = src.Img
WHEN NOT MATCHED THEN
    INSERT (CategoryId, ProductCode, ProductName, ImageUrl, IsActive)
    VALUES (src.CatId, src.Code, src.Name, src.Img, 1);

INSERT INTO dbo.ProductVariants (ProductId, SizeName, BasePrice, IsActive)
SELECT p.ProductId, N'M', s.Price, 1
FROM dbo.Products p
JOIN @Seed s ON s.Code = p.ProductCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.ProductVariants pv WHERE pv.ProductId = p.ProductId);
GO

-- 4. Stored Procedures cho ERP -> Thực đơn & Loại món
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetProductList
    @Search     NVARCHAR(100) = NULL,
    @CategoryId INT           = NULL,
    @IsActive   BIT           = NULL,
    @SortOrder  VARCHAR(10)   = 'newest',
    @Offset     INT           = 0,
    @FetchCount INT           = 50
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        p.ProductId,
        p.ProductCode,
        p.ProductName,
        p.CategoryId,
        ISNULL(c.CategoryName, N'Chưa phân loại') AS CategoryName,
        p.ImageUrl,
        ISNULL((SELECT MIN(pv.BasePrice) FROM dbo.ProductVariants pv WHERE pv.ProductId = p.ProductId AND pv.IsActive = 1), 0) AS BasePrice,
        p.IsActive
    FROM dbo.Products p
    LEFT JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
    WHERE (@Search IS NULL OR p.ProductCode LIKE '%' + @Search + '%' OR p.ProductName LIKE N'%' + @Search + N'%')
      AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
      AND (@IsActive IS NULL OR p.IsActive = @IsActive)
    ORDER BY
        CASE WHEN @SortOrder = 'oldest' THEN p.ProductId END ASC,
        CASE WHEN @SortOrder <> 'oldest' THEN p.ProductId END DESC
    OFFSET @Offset ROWS FETCH NEXT @FetchCount ROWS ONLY;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveProduct
    @ProductId   INT = NULL,
    @ProductCode VARCHAR(20),
    @ProductName NVARCHAR(150),
    @CategoryId  INT = NULL,
    @BasePrice   DECIMAL(18,2),
    @IsActive    BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    IF @ProductId IS NULL OR @ProductId <= 0
    BEGIN
        INSERT INTO dbo.Products (CategoryId, ProductCode, ProductName, IsActive)
        VALUES (@CategoryId, @ProductCode, @ProductName, @IsActive);
        SET @ProductId = SCOPE_IDENTITY();

        INSERT INTO dbo.ProductVariants (ProductId, SizeName, BasePrice, IsActive)
        VALUES (@ProductId, N'M', @BasePrice, 1);
    END
    ELSE
    BEGIN
        -- Không cho phép sửa ImageUrl
        UPDATE dbo.Products
        SET ProductCode = @ProductCode,
            ProductName = @ProductName,
            CategoryId  = @CategoryId,
            IsActive    = @IsActive
        WHERE ProductId = @ProductId;

        IF EXISTS (SELECT 1 FROM dbo.ProductVariants WHERE ProductId = @ProductId)
            UPDATE dbo.ProductVariants SET BasePrice = @BasePrice WHERE VariantId = (SELECT TOP 1 VariantId FROM dbo.ProductVariants WHERE ProductId = @ProductId ORDER BY VariantId ASC);
        ELSE
            INSERT INTO dbo.ProductVariants (ProductId, SizeName, BasePrice, IsActive) VALUES (@ProductId, N'M', @BasePrice, 1);
    END

    COMMIT TRAN;
    SELECT @ProductId AS ProductId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_DeleteProduct
    @ProductId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.CartItems ci JOIN dbo.ProductVariants pv ON pv.VariantId = ci.VariantId WHERE pv.ProductId = @ProductId)
       OR EXISTS (SELECT 1 FROM dbo.OrderItems oi JOIN dbo.ProductVariants pv ON pv.VariantId = oi.VariantId WHERE pv.ProductId = @ProductId)
    BEGIN
        RAISERROR(N'Món đã phát sinh đơn hàng hoặc giỏ hàng, chỉ được tắt Đang bán chứ không được xóa.', 16, 1);
        RETURN;
    END

    DELETE FROM dbo.ProductVariants WHERE ProductId = @ProductId;
    DELETE FROM dbo.Products WHERE ProductId = @ProductId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetCategoryList
    @Search   NVARCHAR(100) = NULL,
    @IsActive BIT           = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        c.CategoryId,
        c.CategoryName,
        c.DisplayOrder,
        (SELECT COUNT(*) FROM dbo.Products p WHERE p.CategoryId = c.CategoryId) AS ProductCount,
        c.IsActive
    FROM dbo.Categories c
    WHERE (@Search IS NULL OR c.CategoryName LIKE N'%' + @Search + N'%')
      AND (@IsActive IS NULL OR c.IsActive = @IsActive)
    ORDER BY c.DisplayOrder ASC, c.CategoryId ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveCategory
    @CategoryId   INT = NULL,
    @CategoryName NVARCHAR(100),
    @DisplayOrder INT = 0,
    @IsActive     BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @CategoryId IS NULL OR @CategoryId <= 0
    BEGIN
        INSERT INTO dbo.Categories (CategoryName, DisplayOrder, IsActive)
        VALUES (@CategoryName, @DisplayOrder, @IsActive);
        SELECT SCOPE_IDENTITY() AS CategoryId;
    END
    ELSE
    BEGIN
        UPDATE dbo.Categories
        SET CategoryName = @CategoryName,
            DisplayOrder = @DisplayOrder,
            IsActive     = @IsActive
        WHERE CategoryId = @CategoryId;
        SELECT @CategoryId AS CategoryId;
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_DeleteCategory
    @CategoryId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.Products WHERE CategoryId = @CategoryId)
    BEGIN
        RAISERROR(N'Danh mục vẫn còn sản phẩm. Vui lòng gỡ hết sản phẩm ra trước khi xóa danh mục.', 16, 1);
        RETURN;
    END
    DELETE FROM dbo.Categories WHERE CategoryId = @CategoryId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetProductsForCategoryModal
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.ProductId, p.ProductCode, p.ProductName, p.CategoryId, c.CategoryName
    FROM dbo.Products p
    LEFT JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
    ORDER BY p.ProductId ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_AssignProductToCategory
    @CategoryId INT,
    @ProductId  INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CurrentCat INT;
    SELECT @CurrentCat = CategoryId FROM dbo.Products WHERE ProductId = @ProductId;

    IF @CurrentCat IS NOT NULL AND @CurrentCat <> @CategoryId
    BEGIN
        RAISERROR(N'Sản phẩm đang nằm ở danh mục khác. Vui lòng gỡ ra trước khi thêm vào danh mục này.', 16, 1);
        RETURN;
    END

    UPDATE dbo.Products SET CategoryId = @CategoryId WHERE ProductId = @ProductId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_RemoveProductFromCategory
    @ProductId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Products SET CategoryId = NULL WHERE ProductId = @ProductId;
END;
GO
