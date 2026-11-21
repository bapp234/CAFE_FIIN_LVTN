USE [CoffeeShopDB];
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetOrderHistory
    @Search      NVARCHAR(100) = NULL,
    @OrderStatus VARCHAR(30)   = NULL,
    @SortOrder   VARCHAR(10)   = 'newest',
    @Offset      INT           = 0,
    @FetchCount  INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        o.OrderId,
        o.OrderCode,
        ISNULL(u.FullName, N'Khách lẻ') AS CustomerName,
        u.PhoneNumber,
        o.OrderStatus,
        o.PaymentStatus,
        o.TotalAmount,
        o.CancelReason,
        o.CreatedAt
    FROM dbo.Orders o
    LEFT JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
    LEFT JOIN dbo.Users u ON u.UserId = c.UserId
    WHERE o.OrderStatus IN ('Completed', 'Cancelled')
      AND (@Search IS NULL OR o.OrderCode LIKE '%' + @Search + '%' OR u.FullName LIKE N'%' + @Search + N'%' OR u.PhoneNumber LIKE '%' + @Search + '%')
      AND (@OrderStatus IS NULL OR o.OrderStatus = @OrderStatus)
    ORDER BY
        CASE WHEN @SortOrder = 'oldest' THEN o.CreatedAt END ASC,
        CASE WHEN @SortOrder <> 'oldest' THEN o.CreatedAt END DESC,
        o.OrderId DESC
    OFFSET @Offset ROWS FETCH NEXT @FetchCount ROWS ONLY;
END;
GO
