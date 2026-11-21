-- 56_fix_revenue_and_customer_orders_accounting.sql
-- Chuẩn hóa điều kiện ghi nhận Doanh thu và Số đơn: chỉ ghi nhận khi đơn ĐÃ HOÀN TẤT & ĐÃ THANH TOÁN (OrderStatus = 'Completed' AND PaymentStatus = 'Paid')

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

-- 1. Báo cáo Doanh thu tháng (sp_ERP_GetRevenueReport)
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetRevenueReport
    @Year INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @Year = ISNULL(@Year, YEAR(SYSDATETIME()));

    SELECT
        MONTH(CreatedAt) AS [Month],
        COUNT(*) AS OrderCount,
        ISNULL(SUM(SubTotal), 0) AS GrossRevenue,
        ISNULL(SUM(DiscountAmount), 0) AS DiscountTotal,
        ISNULL(SUM(TotalAmount), 0) AS NetRevenue
    FROM dbo.Orders
    WHERE OrderStatus = 'Completed' AND PaymentStatus = 'Paid' AND YEAR(CreatedAt) = @Year
    GROUP BY MONTH(CreatedAt)
    ORDER BY [Month];
END;
GO

-- 2. Báo cáo Doanh thu theo món (sp_ERP_GetProductRevenueReport)
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetProductRevenueReport
    @Year INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @Year = ISNULL(@Year, YEAR(SYSDATETIME()));

    SELECT TOP 50
        p.ProductCode,
        p.ProductName,
        ISNULL(c.CategoryName, N'Chưa phân loại') AS CategoryName,
        ISNULL(SUM(oi.Quantity), 0) AS TotalQty,
        ISNULL(SUM(oi.TotalPrice), 0) AS TotalRevenue
    FROM dbo.OrderItems oi
    JOIN dbo.Orders o ON o.OrderId = oi.OrderId
    JOIN dbo.ProductVariants pv ON pv.VariantId = oi.VariantId
    JOIN dbo.Products p ON p.ProductId = pv.ProductId
    LEFT JOIN dbo.Categories c ON c.CategoryId = p.CategoryId
    WHERE o.OrderStatus = 'Completed' AND o.PaymentStatus = 'Paid' AND YEAR(o.CreatedAt) = @Year
    GROUP BY p.ProductCode, p.ProductName, c.CategoryName
    ORDER BY TotalRevenue DESC;
END;
GO

-- 3. Tổng quan Dashboard ERP (sp_ERP_GetDashboardSummary)
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetDashboardSummary
    @BranchId INT = NULL,
    @Year     INT = NULL,
    @Month    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @Year  = ISNULL(@Year, YEAR(SYSDATETIME()));
    SET @Month = ISNULL(@Month, MONTH(SYSDATETIME()));

    -- 1. KPI Tổng quan ERP
    SELECT
        CAST(0 AS DECIMAL(18,2)) AS TotalInventoryValue,
        (SELECT COUNT(*) FROM dbo.Ingredients WHERE IsActive = 1 AND CurrentStock > 0 AND CurrentStock <= ReorderLevel) AS LowStockCount,
        (SELECT COUNT(*) FROM dbo.Ingredients WHERE IsActive = 1 AND CurrentStock <= 0) AS OutOfStockCount,
        (SELECT COUNT(*) FROM dbo.Ingredients WHERE IsActive = 1) AS TotalSkuCount,
        CAST(0 AS DECIMAL(18,2)) AS MonthlyPurchaseTotal,
        0 AS PendingPoCount,
        CAST(0 AS DECIMAL(18,2)) AS TotalSupplierDebt,
        ISNULL((
            SELECT SUM(TotalAmount)
            FROM dbo.Orders
            WHERE OrderStatus = 'Completed'
              AND PaymentStatus = 'Paid'
              AND YEAR(CreatedAt) = @Year
              AND MONTH(CreatedAt) = @Month
        ), 0) AS MonthlyGrossRevenue;

    -- 2. Danh sách nguyên vật liệu sắp hết / hết hàng
    SELECT TOP 20
        IngredientId AS Id,
        IngredientCode AS Code,
        IngredientName AS Name,
        Unit,
        CurrentStock,
        ReorderLevel AS MinStock,
        CASE WHEN CurrentStock <= 0 THEN 'out_of_stock' ELSE 'low_stock' END AS [Status]
    FROM dbo.Ingredients
    WHERE IsActive = 1 AND CurrentStock <= ReorderLevel
    ORDER BY CurrentStock ASC;

    -- 3. Doanh thu theo tháng trong năm @Year (chỉ tính đơn Completed & Paid)
    SELECT
        CONCAT(N'T', MONTH(CreatedAt), '/', YEAR(CreatedAt)) AS [Month],
        ISNULL(SUM(TotalAmount), 0) AS Revenue,
        CAST(0 AS DECIMAL(18,2)) AS Cogs,
        ISNULL(SUM(TotalAmount), 0) AS GrossProfit,
        COUNT(*) AS OrderCount
    FROM dbo.Orders
    WHERE OrderStatus = 'Completed'
      AND PaymentStatus = 'Paid'
      AND YEAR(CreatedAt) = @Year
    GROUP BY YEAR(CreatedAt), MONTH(CreatedAt)
    ORDER BY MONTH(CreatedAt);
END;
GO

-- 4. Khi đặt món mới (sp_CUST_PlaceOrder): KHÔNG cộng TotalOrders ngay khi vừa đặt
-- TotalOrders và TotalSpent chỉ được cộng khi đơn chuyển sang 'Completed'
CREATE OR ALTER PROCEDURE dbo.sp_CUST_PlaceOrder
    @UserId            INT,
    @OrderType         VARCHAR(20) = 'OnlineDelivery',
    @CustomerVoucherId INT         = NULL,
    @BranchId          INT         = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);
    IF @CustomerId IS NULL OR NOT EXISTS (SELECT 1 FROM dbo.CartItems WHERE CustomerId = @CustomerId)
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Giỏ hàng đang trống.', 16, 1);
        RETURN;
    END

    DECLARE @SubTotal DECIMAL(18,2) = (
        SELECT ISNULL(SUM(pv.BasePrice * ci.Quantity), 0)
        FROM dbo.CartItems ci
        JOIN dbo.ProductVariants pv ON pv.VariantId = ci.VariantId
        WHERE ci.CustomerId = @CustomerId
    );

    DECLARE @Discount DECIMAL(18,2) = 0;
    DECLARE @VoucherId INT = NULL;
    IF @CustomerVoucherId IS NOT NULL
    BEGIN
        SELECT @VoucherId = cv.VoucherId
        FROM dbo.CustomerVouchers cv
        WHERE cv.CustomerVoucherId = @CustomerVoucherId AND cv.CustomerId = @CustomerId AND cv.[Status] = 'Available';

        IF @VoucherId IS NOT NULL
            SET @Discount = dbo.fn_CUST_CalculateVoucherDiscount(@VoucherId, @SubTotal);
    END

    DECLARE @ShipFee DECIMAL(18,2) = 0;
    IF @OrderType = 'OnlineDelivery'
    BEGIN
        SELECT TOP 1
            @ShipFee = CASE WHEN @SubTotal >= FreeShipMinOrder THEN 0 ELSE BaseShippingFee END
        FROM dbo.BranchDeliverySettings
        WHERE (@BranchId IS NULL OR BranchId = @BranchId) AND IsDeliveryEnabled = 1;
        IF @ShipFee IS NULL SET @ShipFee = 15000;
    END

    DECLARE @Total DECIMAL(18,2) = CASE WHEN @SubTotal - @Discount + @ShipFee < 0 THEN 0 ELSE @SubTotal - @Discount + @ShipFee END;
    DECLARE @OrderCode VARCHAR(30) = 'ORD-' + FORMAT(SYSDATETIME(), 'yyMMddHHmmss');

    INSERT INTO dbo.Orders (OrderCode, OrderType, CustomerId, OrderStatus, PaymentStatus, SubTotal, DiscountAmount, ShippingFee, TotalAmount)
    VALUES (@OrderCode, @OrderType, @CustomerId, 'Pending', 'Unpaid', @SubTotal, @Discount, @ShipFee, @Total);

    DECLARE @OrderId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.OrderItems (OrderId, VariantId, ProductName, SizeName, UnitPrice, Quantity, TotalPrice, Notes)
    SELECT @OrderId, ci.VariantId, p.ProductName, pv.SizeName, pv.BasePrice, ci.Quantity, pv.BasePrice * ci.Quantity, ci.Notes
    FROM dbo.CartItems ci
    JOIN dbo.ProductVariants pv ON pv.VariantId = ci.VariantId
    JOIN dbo.Products p ON p.ProductId = pv.ProductId
    WHERE ci.CustomerId = @CustomerId;

    IF @VoucherId IS NOT NULL AND @Discount > 0
    BEGIN
        UPDATE dbo.CustomerVouchers SET [Status] = 'Used', UsedAt = SYSDATETIME(), UsedOrderId = @OrderId
        WHERE CustomerVoucherId = @CustomerVoucherId;
        UPDATE dbo.Vouchers SET UsedCount = UsedCount + 1 WHERE VoucherId = @VoucherId;
    END

    DELETE FROM dbo.CartItems WHERE CustomerId = @CustomerId;

    -- KHÔNG cộng TotalOrders ở đây! Chỉ cộng khi đơn hoàn thành.
    COMMIT TRAN;
    SELECT @OrderId AS OrderId, @OrderCode AS OrderCode, @Total AS TotalAmount;
END;
GO

-- 5. Khi đơn Hoàn tất (sp_ERP_SimulatePosAdvanceStatus): Cộng TotalOrders, TotalSpent và Điểm Fiin
CREATE OR ALTER PROCEDURE dbo.sp_ERP_SimulatePosAdvanceStatus
    @OrderId    INT,
    @NextStatus VARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    DECLARE @CustomerId INT, @Total DECIMAL(18,2), @CurStatus VARCHAR(30);
    SELECT @CustomerId = CustomerId, @Total = TotalAmount, @CurStatus = OrderStatus
    FROM dbo.Orders WHERE OrderId = @OrderId;

    IF @CurStatus IS NULL OR @CurStatus = 'Cancelled'
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Đơn hàng không tồn tại hoặc đã hủy.', 16, 1);
        RETURN;
    END

    UPDATE dbo.Orders
    SET OrderStatus = @NextStatus,
        PaymentStatus = CASE WHEN @NextStatus = 'Completed' THEN 'Paid' ELSE PaymentStatus END,
        UpdatedAt = SYSDATETIME()
    WHERE OrderId = @OrderId;

    -- Khi bắt đầu Làm món (Processing): trừ kho theo công thức BOM (nếu có)
    IF @NextStatus = 'Processing' AND NOT EXISTS (SELECT 1 FROM dbo.InventoryTransactions WHERE ReferenceOrderId = @OrderId AND TransactionType = 'OrderDeduct')
    BEGIN
        DECLARE @Branch1Id INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 0 ORDER BY BranchId ASC);
        INSERT INTO dbo.InventoryTransactions (BranchId, IngredientId, TransactionType, Quantity, BalanceAfter, ReferenceOrderId, Notes)
        SELECT
            @Branch1Id,
            pr.IngredientId,
            'OrderDeduct',
            -(pr.Quantity * oi.Quantity),
            ISNULL((SELECT CurrentStock FROM dbo.BranchInventory bi WHERE bi.BranchId = @Branch1Id AND bi.IngredientId = pr.IngredientId), 0) - (pr.Quantity * oi.Quantity),
            @OrderId,
            N'Trừ kho tự động theo đơn ' + CAST(@OrderId AS NVARCHAR)
        FROM dbo.OrderItems oi
        JOIN dbo.ProductRecipes pr ON pr.VariantId = oi.VariantId
        WHERE oi.OrderId = @OrderId;
    END

    -- Khi Hoàn tất (Completed): cộng TotalOrders, TotalSpent & Điểm Fiin cho khách (chỉ cộng 1 lần)
    IF @NextStatus = 'Completed' AND @CustomerId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.CustomerPointTransactions WHERE ReferenceOrderId = @OrderId AND TransactionType = 'Earn')
    BEGIN
        DECLARE @Earned INT = ISNULL(dbo.fn_CRM_CalculateFiinPoints(@Total, CAST(SYSDATETIME() AS DATE)), 0);

        DECLARE @CurPts INT;
        SELECT @CurPts = LoyaltyPoints FROM dbo.Customers WITH (UPDLOCK, ROWLOCK) WHERE CustomerId = @CustomerId;

        UPDATE dbo.Customers
        SET TotalOrders = TotalOrders + 1,
            TotalSpent = TotalSpent + @Total,
            LoyaltyPoints = LoyaltyPoints + @Earned,
            UpdatedAt = SYSDATETIME()
        WHERE CustomerId = @CustomerId;

        IF @Earned > 0
        BEGIN
            INSERT INTO dbo.CustomerPointTransactions (CustomerId, ReferenceOrderId, TransactionType, Points, BalanceAfter, [Description])
            VALUES (@CustomerId, @OrderId, 'Earn', @Earned, @CurPts + @Earned, N'Tích Điểm Fiin từ đơn hàng #' + CAST(@OrderId AS NVARCHAR));
        END
    END

    COMMIT TRAN;
END;
GO

-- 6. Đồng bộ lại TotalOrders cho khách hàng hiện có theo số đơn Completed thật sự
UPDATE c
SET c.TotalOrders = ISNULL((SELECT COUNT(*) FROM dbo.Orders o WHERE o.CustomerId = c.CustomerId AND o.OrderStatus = 'Completed'), 0)
FROM dbo.Customers c;
GO
