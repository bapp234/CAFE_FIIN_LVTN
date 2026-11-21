-- 55_add_sp_CUST_UpdateCartItemQuantity.sql
-- Thêm Stored Procedure cập nhật số lượng món trong giỏ hàng khách hàng
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_UpdateCartItemQuantity
    @UserId     INT,
    @CartItemId INT,
    @Quantity   INT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CustomerId INT = (SELECT TOP 1 CustomerId FROM dbo.Customers WHERE UserId = @UserId);
    IF @CustomerId IS NULL RETURN;

    IF @Quantity <= 0
    BEGIN
        DELETE FROM dbo.CartItems WHERE CartItemId = @CartItemId AND CustomerId = @CustomerId;
    END
    ELSE
    BEGIN
        UPDATE dbo.CartItems
        SET Quantity = @Quantity, UpdatedAt = SYSDATETIME()
        WHERE CartItemId = @CartItemId AND CustomerId = @CustomerId;
    END
END;
GO
