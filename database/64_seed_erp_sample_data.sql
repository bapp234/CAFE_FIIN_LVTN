USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 64: SEED DỮ LIỆU MẪU CHO ERP (KHO TỔNG, CHI NHÁNH, NCC, PO, ĐỊNH KỲ, BOM, GIAO HÀNG)
-- Chạy an toàn nhiều lần (Idempotent)
-- =======================================================================================

DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);
DECLARE @Branch1Id INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 0 ORDER BY BranchId ASC);

-- 1. Nguyên liệu & Bao bì
IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'NVL-CF-ROB')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('NVL-CF-ROB', N'Cà phê Robusta Buôn Ma Thuột', N'Nguyên liệu', N'Kg', 120, 20, 185000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'NVL-CF-ARA')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('NVL-CF-ARA', N'Cà phê Arabica Cầu Đất', N'Nguyên liệu', N'Kg', 65, 15, 280000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'NVL-SUA-DAC')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('NVL-SUA-DAC', N'Sữa đặc có đường Ngôi Sao', N'Nguyên liệu', N'Lon', 200, 30, 24000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'NVL-TRA-OOL')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('NVL-TRA-OOL', N'Trà Oolong Rang Lâm Đồng', N'Nguyên liệu', N'Kg', 45, 10, 320000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'BB-LY-M')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('BB-LY-M', N'Ly nhựa PP Size M (Lốc 50)', N'Bao bì', N'Lốc', 350, 50, 28000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Ingredients WHERE IngredientCode = 'BB-LY-L')
    INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
    VALUES ('BB-LY-L', N'Ly nhựa PP Size L (Lốc 50)', N'Bao bì', N'Lốc', 280, 50, 32000, 1);
GO

DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);
DECLARE @Branch1Id INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 0 ORDER BY BranchId ASC);

-- 2. Đồng bộ tồn kho vào BranchInventory (Kho Tổng & Chi nhánh)
INSERT INTO dbo.BranchInventory (BranchId, IngredientId, CurrentStock, ReorderLevel, AverageCost)
SELECT @CentralId, i.IngredientId, i.CurrentStock, i.ReorderLevel, i.AverageCost
FROM dbo.Ingredients i
WHERE @CentralId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM dbo.BranchInventory bi WHERE bi.BranchId = @CentralId AND bi.IngredientId = i.IngredientId);

IF @Branch1Id IS NOT NULL
BEGIN
    INSERT INTO dbo.BranchInventory (BranchId, IngredientId, CurrentStock, ReorderLevel, AverageCost)
    SELECT @Branch1Id, i.IngredientId, CAST(i.CurrentStock * 0.2 AS DECIMAL(12,3)), i.ReorderLevel, i.AverageCost
    FROM dbo.Ingredients i
    WHERE NOT EXISTS (SELECT 1 FROM dbo.BranchInventory bi WHERE bi.BranchId = @Branch1Id AND bi.IngredientId = i.IngredientId);
END

-- 3. Nhà cung cấp mẫu
IF NOT EXISTS (SELECT 1 FROM dbo.Suppliers WHERE SupplierCode = 'NCC-BANME')
    INSERT INTO dbo.Suppliers (SupplierCode, SupplierName, CategoryGroup, ContactPerson, Phone, Email, [Address], CurrentDebt, IsActive)
    VALUES ('NCC-BANME', N'Nông sản Cà phê Ban Mê', N'Nguyên liệu', N'Nguyễn Văn Hùng', '0909123456', 'banme@coffee.vn', N'TP. Buôn Ma Thuột, Đắk Lắk', 12500000, 1);

IF NOT EXISTS (SELECT 1 FROM dbo.Suppliers WHERE SupplierCode = 'NCC-BAOBI')
    INSERT INTO dbo.Suppliers (SupplierCode, SupplierName, CategoryGroup, ContactPerson, Phone, Email, [Address], CurrentDebt, IsActive)
    VALUES ('NCC-BAOBI', N'Bao Bì Sài Gòn Xanh', N'Bao bì', N'Trần Thị Mai', '0918222333', 'baobi@sgx.vn', N'Quận Bình Tân, TP.HCM', 0, 1);

-- 4. Phiếu nhập hàng (PO) mẫu
DECLARE @Sup1 INT = (SELECT TOP 1 SupplierId FROM dbo.Suppliers WHERE SupplierCode = 'NCC-BANME');
DECLARE @Sup2 INT = (SELECT TOP 1 SupplierId FROM dbo.Suppliers WHERE SupplierCode = 'NCC-BAOBI');

IF @CentralId IS NOT NULL AND @Sup1 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE PoCode = 'PO-261101')
    INSERT INTO dbo.PurchaseOrders (PoCode, SupplierId, BranchId, [Status], PaymentStatus, TotalAmount, PaidAmount, Notes, ReceivedAt)
    VALUES ('PO-261101', @Sup1, @CentralId, 'Received', 'Partial', 22500000, 10000000, N'Nhập lô Robusta & Arabica tháng 11', SYSDATETIME());

IF @CentralId IS NOT NULL AND @Sup2 IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE PoCode = 'PO-261102')
    INSERT INTO dbo.PurchaseOrders (PoCode, SupplierId, BranchId, [Status], PaymentStatus, TotalAmount, PaidAmount, Notes, ReceivedAt)
    VALUES ('PO-261102', @Sup2, @CentralId, 'Received', 'Paid', 9800000, 9800000, N'Nhập ly nhựa PP size M & L', SYSDATETIME());

-- 5. Phiếu điều chuyển / Xin thêm mẫu & Thiết lập định kỳ
DECLARE @IngCoffee INT = (SELECT TOP 1 IngredientId FROM dbo.Ingredients WHERE IngredientCode = 'NVL-CF-ROB');
DECLARE @IngCup    INT = (SELECT TOP 1 IngredientId FROM dbo.Ingredients WHERE IngredientCode = 'BB-LY-M');

IF @CentralId IS NOT NULL AND @Branch1Id IS NOT NULL AND @IngCoffee IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.StockTransfers WHERE TransferCode = 'REQ-261101')
    BEGIN
        INSERT INTO dbo.StockTransfers (TransferCode, FromBranchId, ToBranchId, TransferType, [Status], Notes)
        VALUES ('REQ-261101', @CentralId, @Branch1Id, 'ExtraRequest', 'Requested', N'Chi nhánh bán chạy cuối tuần, xin thêm 10Kg Robusta');
        DECLARE @Tid INT = SCOPE_IDENTITY();
        INSERT INTO dbo.StockTransferItems (TransferId, IngredientId, RequestedQty) VALUES (@Tid, @IngCoffee, 10);
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.PeriodicSupplyRules WHERE BranchId = @Branch1Id AND IngredientId = @IngCoffee)
        INSERT INTO dbo.PeriodicSupplyRules (BranchId, IngredientId, SupplyCycle, DefaultQty, NextSupplyDate, IsActive)
        VALUES (@Branch1Id, @IngCoffee, 'Weekly', 15, DATEADD(DAY, 7, CAST(SYSDATETIME() AS DATE)), 1);

    IF @IngCup IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.PeriodicSupplyRules WHERE BranchId = @Branch1Id AND IngredientId = @IngCup)
        INSERT INTO dbo.PeriodicSupplyRules (BranchId, IngredientId, SupplyCycle, DefaultQty, NextSupplyDate, IsActive)
        VALUES (@Branch1Id, @IngCup, 'Weekly', 20, DATEADD(DAY, 7, CAST(SYSDATETIME() AS DATE)), 1);
END

-- 6. Cấu hình giao hàng & Phí ship mặc định cho các chi nhánh
INSERT INTO dbo.BranchDeliverySettings (BranchId, IsDeliveryEnabled, MaxRadiusKm, BaseShippingFee, FeePerKm, FreeShipMinOrder, SupportedAreas)
SELECT b.BranchId, 1, 5, 15000, 5000, 150000, N'Quận 1, Quận 3, Quận Bình Thạnh, Quận Phú Nhuận'
FROM dbo.Branches b
WHERE b.IsCentralWarehouse = 0
  AND NOT EXISTS (SELECT 1 FROM dbo.BranchDeliverySettings d WHERE d.BranchId = b.BranchId);

-- 7. Công thức món (BOM) mẫu cho món đầu tiên
DECLARE @Var1 INT = (SELECT TOP 1 VariantId FROM dbo.ProductVariants ORDER BY VariantId ASC);
IF @Var1 IS NOT NULL AND @IngCoffee IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.ProductRecipes WHERE VariantId = @Var1 AND IngredientId = @IngCoffee)
    INSERT INTO dbo.ProductRecipes (VariantId, IngredientId, Quantity) VALUES (@Var1, @IngCoffee, 0.025);
GO
