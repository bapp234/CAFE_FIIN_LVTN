USE [CoffeeShopDB];
GO

-- 1. Xóa các món & danh mục trùng do lần seed MON01..MON41 tạo ra
DELETE pv
FROM dbo.ProductVariants pv
JOIN dbo.Products p ON p.ProductId = pv.ProductId
WHERE p.ProductCode LIKE 'MON%';

DELETE FROM dbo.Products WHERE ProductCode LIKE 'MON%';

DELETE FROM dbo.Categories
WHERE CategoryName IN (N'Cà phê', N'Trà trái cây', N'Trà đậm vị', N'Bánh ngọt')
  AND NOT EXISTS (SELECT 1 FROM dbo.Products p WHERE p.CategoryId = dbo.Categories.CategoryId);
GO

-- 2. Cập nhật ImageUrl (/mon/...) cho đúng 37 món gốc
UPDATE dbo.Products SET ImageUrl = N'/mon/01 Phin Đen Đá.png' WHERE ProductCode = 'CF-PHIN-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/02 Phin Sữa Đá Sả Sài Gòn.png' WHERE ProductCode = 'CF-PHIN-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/03 Bạc Xỉu Sài Gòn Xưa.png' WHERE ProductCode = 'CF-PHIN-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/04 Vợt Kho CF-PHIN-02.png' WHERE ProductCode = 'CF-PHIN-04';

UPDATE dbo.Products SET ImageUrl = N'/mon/09 Cà Phê Muối Phin Xưa.png' WHERE ProductCode = 'CF-SPEC-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/10 Cà Phê Trứng Đánh Bông.png' WHERE ProductCode = 'CF-SPEC-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/11 Cà Phê Cốt Dừa.png' WHERE ProductCode = 'CF-SPEC-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/12 Cà Phê Bơ Tây Nguyên.png' WHERE ProductCode = 'CF-SPEC-04';

UPDATE dbo.Products SET ImageUrl = N'/mon/13 Phin Hạnh Nhân.png' WHERE ProductCode = 'CF-CREA-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/14 Phin Kem Sữa Macchiato.png' WHERE ProductCode = 'CF-CREA-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/15 Sữa Chua Cà Phê.png' WHERE ProductCode = 'CF-CREA-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/16 Cà Phê Sữa Đá Xay.png' WHERE ProductCode = 'CF-CREA-04';

UPDATE dbo.Products SET ImageUrl = N'/mon/17 Trà Sen Vàng Cú Năng.png' WHERE ProductCode = 'TEA-FR-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/18 Trà Thạch Đào.png' WHERE ProductCode = 'TEA-FR-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/19 Trà Vải Hạt Chia.png' WHERE ProductCode = 'TEA-FR-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/20 Trà Oolong Nhãn Nhục.png' WHERE ProductCode = 'TEA-FR-04';
UPDATE dbo.Products SET ImageUrl = N'/mon/21 Trà Măng Cầu Xiêm.png' WHERE ProductCode = 'TEA-FR-05';
UPDATE dbo.Products SET ImageUrl = N'/mon/22 Trà Dâu Tằm Đà Lạt.png' WHERE ProductCode = 'TEA-FR-06';
UPDATE dbo.Products SET ImageUrl = N'/mon/23 Trà Ổi Hồng Hồng Xí Muội.png' WHERE ProductCode = 'TEA-FR-07';
UPDATE dbo.Products SET ImageUrl = N'/mon/24 Trà Cam Sả Quế Mật Ong.png' WHERE ProductCode = 'TEA-FR-08';
UPDATE dbo.Products SET ImageUrl = N'/mon/25 Trà Chanh Dây Hạt Đác.png' WHERE ProductCode = 'TEA-FR-09';

UPDATE dbo.Products SET ImageUrl = N'/mon/26 Trà Sữa Truyền Thống Fiin.png' WHERE ProductCode = 'TEA-MK-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/27 Trà Sữa Trân Châu Đường Đen.png' WHERE ProductCode = 'TEA-MK-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/28 Trà Sữa Oolong Rang.png' WHERE ProductCode = 'TEA-MK-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/29 Trà Sữa Thái Xanh.png' WHERE ProductCode = 'TEA-MK-04';
UPDATE dbo.Products SET ImageUrl = N'/mon/30 Trà Sữa Thái Đỏ.png' WHERE ProductCode = 'TEA-MK-05';
UPDATE dbo.Products SET ImageUrl = N'/mon/31 Trà Sữa Thái Môn.png' WHERE ProductCode = 'TEA-MK-06';
UPDATE dbo.Products SET ImageUrl = N'/mon/33 Trà Sữa Gạo Rang Hàn Quốc.png' WHERE ProductCode = 'TEA-MK-07';
UPDATE dbo.Products SET ImageUrl = N'/mon/34 Trà Sữa Bá Tước Kem Cheese.png' WHERE ProductCode = 'TEA-MK-08';
UPDATE dbo.Products SET ImageUrl = N'/mon/35 Trà Sữa Socola Bạc Hà.png' WHERE ProductCode = 'TEA-MK-09';

UPDATE dbo.Products SET ImageUrl = N'/mon/36 Bánh Flan Cà Phê.png' WHERE ProductCode = 'CAKE-VN-01';
UPDATE dbo.Products SET ImageUrl = N'/mon/37 Bánh Bò Thốt Nốt Nướng.png' WHERE ProductCode = 'CAKE-VN-02';
UPDATE dbo.Products SET ImageUrl = N'/mon/38 Bánh Da Lợn Lá Dứa Đậu Xanh.png' WHERE ProductCode = 'CAKE-VN-03';
UPDATE dbo.Products SET ImageUrl = N'/mon/39 Bánh Bông Lan Trứng Muối.png' WHERE ProductCode = 'CAKE-VN-05';
UPDATE dbo.Products SET ImageUrl = N'/mon/40 Bánh Đậu Xanh Nướng Hội An.png' WHERE ProductCode = 'CAKE-VN-06';
UPDATE dbo.Products SET ImageUrl = N'/mon/41 Bánh Pía Sầu Riêng Đậu Xanh.png' WHERE ProductCode = 'CAKE-VN-07';
GO

-- 3. Cập nhật sp_ERP_GetProductList trả thêm SizeName từ ProductVariants
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
        pv.VariantId,
        p.ProductCode,
        p.ProductName,
        p.CategoryId,
        ISNULL(c.CategoryName, N'Chưa phân loại') AS CategoryName,
        p.ImageUrl,
        ISNULL(pv.SizeName, N'M') AS SizeName,
        ISNULL(pv.BasePrice, 0) AS BasePrice,
        p.IsActive
    FROM dbo.Products p
    LEFT JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
    OUTER APPLY (
        SELECT TOP 1 VariantId, SizeName, BasePrice
        FROM dbo.ProductVariants
        WHERE ProductId = p.ProductId AND IsActive = 1
        ORDER BY BasePrice ASC
    ) pv
    WHERE (@Search IS NULL OR p.ProductCode LIKE '%' + @Search + '%' OR p.ProductName LIKE N'%' + @Search + N'%')
      AND (@CategoryId IS NULL OR p.CategoryId = @CategoryId)
      AND (@IsActive IS NULL OR p.IsActive = @IsActive)
    ORDER BY
        CASE WHEN @SortOrder = 'oldest' THEN p.ProductId END ASC,
        CASE WHEN @SortOrder <> 'oldest' THEN p.ProductId END DESC
    OFFSET @Offset ROWS FETCH NEXT @FetchCount ROWS ONLY;
END;
GO
