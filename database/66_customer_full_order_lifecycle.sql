USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 66: VÒNG ĐỜI ĐẶT MÓN - GIỎ HÀNG - VOUCHER - ĐIỂM FIIN - THEO DÕI / HỦY / TRẢ MÓN
-- =======================================================================================

-- 1. Menu công khai cho Website chính
CREATE OR ALTER PROCEDURE dbo.sp_PUBLIC_GetMenu
AS
BEGIN
    SET NOCOUNT ON;

    SELECT CategoryId, CategoryName, DisplayOrder
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

-- 2. Giỏ hàng khách hàng (dbo.CartItems)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetCart
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);

    SELECT
        ci.CartItemId,
        ci.VariantId,
        p.ProductId,
        p.ProductName,
        p.ImageUrl,
        pv.SizeName,
        pv.BasePrice AS UnitPrice,
        ci.Quantity,
        (pv.BasePrice * ci.Quantity) AS LineTotal,
        ci.Notes
    FROM dbo.CartItems ci
    JOIN dbo.ProductVariants pv ON pv.VariantId = ci.VariantId
    JOIN dbo.Products p ON p.ProductId = pv.ProductId
    WHERE ci.CustomerId = @CustomerId
    ORDER BY ci.CartItemId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_AddToCart
    @UserId    INT,
    @VariantId INT,
    @Quantity  INT = 1,
    @Notes     NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);
    IF @CustomerId IS NULL RETURN;

    IF EXISTS (SELECT 1 FROM dbo.CartItems WHERE CustomerId = @CustomerId AND VariantId = @VariantId AND ISNULL(Notes, N'') = ISNULL(@Notes, N''))
    BEGIN
        UPDATE dbo.CartItems
        SET Quantity = Quantity + @Quantity, UpdatedAt = SYSDATETIME()
        WHERE CustomerId = @CustomerId AND VariantId = @VariantId AND ISNULL(Notes, N'') = ISNULL(@Notes, N'');
    END
    ELSE
    BEGIN
        INSERT INTO dbo.CartItems (CustomerId, VariantId, Quantity, Notes)
        VALUES (@CustomerId, @VariantId, @Quantity, @Notes);
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_RemoveCartItem
    @UserId     INT,
    @CartItemId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);
    DELETE FROM dbo.CartItems WHERE CartItemId = @CartItemId AND CustomerId = @CustomerId;
END;
GO

-- 3. Ví Voucher & Đổi Điểm Fiin lấy Voucher
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetVoucherWallet
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);

    -- Voucher đã có trong ví
    SELECT
        cv.CustomerVoucherId,
        cv.VoucherId,
        v.VoucherCode,
        v.VoucherName,
        v.DiscountType,
        v.DiscountValue,
        v.MaxDiscountAmount,
        v.MinOrderAmount,
        cv.[Status],
        v.EndAt
    FROM dbo.CustomerVouchers cv
    JOIN dbo.Vouchers v ON v.VoucherId = cv.VoucherId
    WHERE cv.CustomerId = @CustomerId AND cv.[Status] = 'Available' AND v.EndAt >= SYSDATETIME()
    ORDER BY cv.CustomerVoucherId DESC;

    -- Voucher đang phát hành có thể đổi bằng Điểm Fiin
    SELECT
        VoucherId,
        VoucherCode,
        VoucherName,
        DiscountType,
        DiscountValue,
        MaxDiscountAmount,
        MinOrderAmount,
        PointsCost,
        EndAt
    FROM dbo.Vouchers
    WHERE IsActive = 1 AND SYSDATETIME() BETWEEN StartAt AND EndAt
      AND (UsageLimit IS NULL OR UsedCount < UsageLimit)
    ORDER BY PointsCost ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_RedeemVoucher
    @UserId    INT,
    @VoucherId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    DECLARE @CustomerId INT, @CurPoints INT, @PointsCost INT, @VoucherName NVARCHAR(150);
    SELECT @CustomerId = CustomerId, @CurPoints = LoyaltyPoints
    FROM dbo.Customers WITH (UPDLOCK, ROWLOCK)
    WHERE UserId = @UserId;

    SELECT @PointsCost = PointsCost, @VoucherName = VoucherName
    FROM dbo.Vouchers
    WHERE VoucherId = @VoucherId AND IsActive = 1 AND SYSDATETIME() BETWEEN StartAt AND EndAt;

    IF @CustomerId IS NULL OR @PointsCost IS NULL
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Voucher không hợp lệ hoặc đã hết hạn.', 16, 1);
        RETURN;
    END

    IF @CurPoints < @PointsCost
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Điểm Fiin không đủ để đổi Voucher này.', 16, 1);
        RETURN;
    END

    DECLARE @NewBalance INT = @CurPoints - @PointsCost;
    UPDATE dbo.Customers SET LoyaltyPoints = @NewBalance, UpdatedAt = SYSDATETIME() WHERE CustomerId = @CustomerId;

    IF @PointsCost > 0
    BEGIN
        INSERT INTO dbo.CustomerPointTransactions (CustomerId, TransactionType, Points, BalanceAfter, [Description])
        VALUES (@CustomerId, 'Redeem', -@PointsCost, @NewBalance, N'Đổi Voucher: ' + @VoucherName);
    END

    INSERT INTO dbo.CustomerVouchers (CustomerId, VoucherId, [Status])
    VALUES (@CustomerId, @VoucherId, 'Available');

    COMMIT TRAN;
    SELECT @NewBalance AS LoyaltyPoints;
END;
GO

-- 4. Đặt đơn hàng từ giỏ hàng (lưu Orders, OrderItems, áp Voucher, tính phí ship)
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

    UPDATE dbo.Customers SET TotalOrders = TotalOrders + 1, UpdatedAt = SYSDATETIME() WHERE CustomerId = @CustomerId;

    COMMIT TRAN;
    SELECT @OrderId AS OrderId, @OrderCode AS OrderCode, @Total AS TotalAmount;
END;
GO

-- 5. Khách hàng xem lịch sử & theo dõi đơn hàng
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetMyOrders
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);

    SELECT
        o.OrderId,
        o.OrderCode,
        o.OrderType,
        o.OrderStatus,
        o.PaymentStatus,
        o.SubTotal,
        o.DiscountAmount,
        o.ShippingFee,
        o.TotalAmount,
        o.CancelReason,
        o.CreatedAt,
        STUFF((
            SELECT N', ' + oi.ProductName + N' (' + oi.SizeName + N' x' + CAST(oi.Quantity AS NVARCHAR) + N')'
            FROM dbo.OrderItems oi
            WHERE oi.OrderId = o.OrderId
            FOR XML PATH(''), TYPE
        ).value('.', 'NVARCHAR(MAX)'), 1, 2, N'') AS ItemsSummary
    FROM dbo.Orders o
    WHERE o.CustomerId = @CustomerId
    ORDER BY o.OrderId DESC;
END;
GO

-- 6. Khách hủy đơn (ở bước Lên món) hoặc Trả món (sau khi đã Làm món -> đẩy sang ERP Duyệt trả món)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_CancelOrReturnOrder
    @UserId  INT,
    @OrderId INT,
    @Reason  NVARCHAR(255) = N'Khách hàng yêu cầu hủy/trả'
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;

    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);
    DECLARE @CurStatus VARCHAR(30);
    SELECT @CurStatus = OrderStatus FROM dbo.Orders WHERE OrderId = @OrderId AND CustomerId = @CustomerId;

    IF @CurStatus IS NULL OR @CurStatus IN ('Completed', 'Cancelled')
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Đơn hàng không thể hủy hoặc trả ở trạng thái hiện tại.', 16, 1);
        RETURN;
    END

    UPDATE dbo.Orders
    SET OrderStatus = 'Cancelled', CancelReason = @Reason, UpdatedAt = SYSDATETIME()
    WHERE OrderId = @OrderId;

    -- Hoàn lại voucher nếu có dùng
    UPDATE dbo.CustomerVouchers
    SET [Status] = 'Available', UsedAt = NULL, UsedOrderId = NULL
    WHERE UsedOrderId = @OrderId;

    -- Nếu đã qua bước Làm món (Processing trở đi) -> đẩy sang ERP InventoryDisposalReviews
    IF @CurStatus IN ('Processing', 'Ready', 'Delivering')
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM dbo.InventoryDisposalReviews WHERE OrderId = @OrderId)
            INSERT INTO dbo.InventoryDisposalReviews (OrderId, ReviewStatus, SituationType, ManagerDecisionNotes)
            VALUES (@OrderId, 'PendingManagerReview', 'CustomerReturn', @Reason);
    END

    COMMIT TRAN;
END;
GO

-- 7. Giả lập POS chuyển trạng thái đơn (Lên món -> Làm món -> Giao món -> Hoàn tất & Cộng Điểm Fiin)
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

    -- Khi Hoàn tất (Completed): cộng TotalSpent & Điểm Fiin cho khách
    IF @NextStatus = 'Completed' AND @CustomerId IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM dbo.CustomerPointTransactions WHERE ReferenceOrderId = @OrderId AND TransactionType = 'Earn')
    BEGIN
        DECLARE @Earned INT = ISNULL(dbo.fn_CRM_CalculateFiinPoints(@Total, CAST(SYSDATETIME() AS DATE)), 0);
        DECLARE @CurPts INT;
        SELECT @CurPts = LoyaltyPoints FROM dbo.Customers WITH (UPDLOCK, ROWLOCK) WHERE CustomerId = @CustomerId;

        UPDATE dbo.Customers
        SET TotalSpent = TotalSpent + @Total,
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
