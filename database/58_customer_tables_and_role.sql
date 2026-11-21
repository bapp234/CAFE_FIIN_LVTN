USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 58: NHÓM BẢNG KHÁCH HÀNG (ROLE CUSTOMER + MỞ RỘNG CUSTOMERS + ĐỊA CHỈ + ĐIỂM + VOUCHER + GIỎ HÀNG)
-- Chạy an toàn nhiều lần (Idempotent) trên CoffeeShopDB
-- =======================================================================================

-- 1. Thêm Role 'Customer' vào bảng Roles
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE RoleName = N'Customer')
BEGIN
    INSERT INTO dbo.Roles (RoleName, Description)
    VALUES (N'Customer', N'Khách hàng thành viên đặt hàng trên Website / Ứng dụng');
    PRINT N'-> Đã thêm Role Customer.';
END
GO

-- 2. Cập nhật SP gán quyền nhân sự để loại trừ Role 'Customer'
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetEmployeeRolesForModal
    @EmployeeId INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @UserId INT;
    SELECT @UserId = UserId FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

    SELECT
        r.RoleId,
        r.RoleName,
        r.Description,
        r.ParentRoleId,
        CASE
            WHEN ur.RoleId IS NOT NULL THEN CAST(1 AS BIT)
            ELSE CAST(0 AS BIT)
        END AS IsAssigned
    FROM dbo.Roles r
    LEFT JOIN dbo.UserRoles ur ON r.RoleId = ur.RoleId AND ur.UserId = @UserId
    WHERE r.RoleName <> N'Customer'
    ORDER BY r.RoleId ASC;
END;
GO
PRINT N'-> Đã cập nhật sp_HRM_GetEmployeeRolesForModal (loại trừ Customer).';
GO

-- 3. Mở rộng bảng Customers (Hồ sơ thành viên & Tích điểm)
IF COL_LENGTH('dbo.Customers', 'MembershipTier') IS NULL
BEGIN
    ALTER TABLE dbo.Customers ADD
        MembershipTier VARCHAR(20) NOT NULL CONSTRAINT DF_Customers_MembershipTier DEFAULT 'Standard',
        LoyaltyPoints INT NOT NULL CONSTRAINT DF_Customers_LoyaltyPoints DEFAULT 0,
        TotalOrders INT NOT NULL CONSTRAINT DF_Customers_TotalOrders DEFAULT 0,
        TotalSpent DECIMAL(18,2) NOT NULL CONSTRAINT DF_Customers_TotalSpent DEFAULT 0,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(10) NULL,
        Notes NVARCHAR(255) NULL,
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customers_UpdatedAt DEFAULT SYSDATETIME();

    EXEC(N'ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_MembershipTier
        CHECK (MembershipTier IN (''Standard'', ''Silver'', ''Gold'', ''VIP''));');
    EXEC(N'ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_LoyaltyPoints
        CHECK (LoyaltyPoints >= 0);');
    EXEC(N'ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_TotalOrders
        CHECK (TotalOrders >= 0);');
    EXEC(N'ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_TotalSpent
        CHECK (TotalSpent >= 0);');

    PRINT N'-> Đã mở rộng các cột thành viên cho bảng Customers.';
END
GO

-- 4. Tạo bảng Sổ địa chỉ giao hàng của Khách hàng (CustomerAddresses)
IF OBJECT_ID('dbo.CustomerAddresses', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerAddresses (
        AddressId INT IDENTITY(1,1) NOT NULL,
        CustomerId INT NOT NULL,
        Label NVARCHAR(50) NULL,
        ReceiverName NVARCHAR(100) NOT NULL,
        ReceiverPhone VARCHAR(20) NOT NULL,
        FullAddress NVARCHAR(255) NOT NULL,
        IsDefault BIT NOT NULL CONSTRAINT DF_CustomerAddresses_IsDefault DEFAULT 0,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerAddresses_CreatedAt DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerAddresses_UpdatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_CustomerAddresses PRIMARY KEY CLUSTERED (AddressId),
        CONSTRAINT FK_CustomerAddresses_Customers FOREIGN KEY (CustomerId)
            REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE
    );

    CREATE INDEX IX_CustomerAddresses_CustomerId ON dbo.CustomerAddresses(CustomerId);
    PRINT N'-> Đã tạo bảng CustomerAddresses.';
END
GO

-- 5. Tạo bảng Lịch sử giao dịch điểm tích lũy (CustomerPointTransactions)
IF OBJECT_ID('dbo.CustomerPointTransactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerPointTransactions (
        PointTxId INT IDENTITY(1,1) NOT NULL,
        CustomerId INT NOT NULL,
        ReferenceOrderId INT NULL,
        TransactionType VARCHAR(20) NOT NULL,
        Points INT NOT NULL,
        BalanceAfter INT NOT NULL,
        Description NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerPointTransactions_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_CustomerPointTransactions PRIMARY KEY CLUSTERED (PointTxId),
        CONSTRAINT CK_CustomerPointTransactions_Type CHECK (TransactionType IN ('Earn', 'Redeem', 'Adjust', 'Expire')),
        CONSTRAINT CK_CustomerPointTransactions_Balance CHECK (BalanceAfter >= 0),
        CONSTRAINT FK_CustomerPointTransactions_Customers FOREIGN KEY (CustomerId)
            REFERENCES dbo.Customers(CustomerId),
        CONSTRAINT FK_CustomerPointTransactions_Orders FOREIGN KEY (ReferenceOrderId)
            REFERENCES dbo.Orders(OrderId)
    );

    CREATE INDEX IX_CustomerPointTransactions_CustomerId ON dbo.CustomerPointTransactions(CustomerId, CreatedAt DESC);
    PRINT N'-> Đã tạo bảng CustomerPointTransactions.';
END
GO

-- 6. Tạo bảng Danh mục Mã giảm giá / Voucher (Vouchers)
IF OBJECT_ID('dbo.Vouchers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Vouchers (
        VoucherId INT IDENTITY(1,1) NOT NULL,
        VoucherCode VARCHAR(30) NOT NULL,
        VoucherName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500) NULL,
        DiscountType VARCHAR(20) NOT NULL,
        DiscountValue DECIMAL(18,2) NOT NULL,
        MaxDiscountAmount DECIMAL(18,2) NULL,
        MinOrderAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Vouchers_MinOrderAmount DEFAULT 0,
        PointsCost INT NOT NULL CONSTRAINT DF_Vouchers_PointsCost DEFAULT 0,
        UsageLimit INT NULL,
        UsedCount INT NOT NULL CONSTRAINT DF_Vouchers_UsedCount DEFAULT 0,
        StartAt DATETIME2(0) NOT NULL,
        EndAt DATETIME2(0) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Vouchers_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Vouchers_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Vouchers PRIMARY KEY CLUSTERED (VoucherId),
        CONSTRAINT UQ_Vouchers_VoucherCode UNIQUE (VoucherCode),
        CONSTRAINT CK_Vouchers_DiscountType CHECK (DiscountType IN ('Percent', 'FixedAmount')),
        CONSTRAINT CK_Vouchers_DiscountValue CHECK (DiscountValue > 0),
        CONSTRAINT CK_Vouchers_MinOrderAmount CHECK (MinOrderAmount >= 0),
        CONSTRAINT CK_Vouchers_PointsCost CHECK (PointsCost >= 0),
        CONSTRAINT CK_Vouchers_UsedCount CHECK (UsedCount >= 0)
    );

    PRINT N'-> Đã tạo bảng Vouchers.';
END
GO

-- 7. Tạo bảng Ví Voucher của Khách hàng (CustomerVouchers)
IF OBJECT_ID('dbo.CustomerVouchers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CustomerVouchers (
        CustomerVoucherId INT IDENTITY(1,1) NOT NULL,
        CustomerId INT NOT NULL,
        VoucherId INT NOT NULL,
        Status VARCHAR(20) NOT NULL CONSTRAINT DF_CustomerVouchers_Status DEFAULT 'Available',
        RedeemedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CustomerVouchers_RedeemedAt DEFAULT SYSDATETIME(),
        UsedAt DATETIME2(0) NULL,
        UsedOrderId INT NULL,
        CONSTRAINT PK_CustomerVouchers PRIMARY KEY CLUSTERED (CustomerVoucherId),
        CONSTRAINT CK_CustomerVouchers_Status CHECK (Status IN ('Available', 'Used', 'Expired')),
        CONSTRAINT FK_CustomerVouchers_Customers FOREIGN KEY (CustomerId)
            REFERENCES dbo.Customers(CustomerId),
        CONSTRAINT FK_CustomerVouchers_Vouchers FOREIGN KEY (VoucherId)
            REFERENCES dbo.Vouchers(VoucherId),
        CONSTRAINT FK_CustomerVouchers_Orders FOREIGN KEY (UsedOrderId)
            REFERENCES dbo.Orders(OrderId)
    );

    CREATE INDEX IX_CustomerVouchers_CustomerId ON dbo.CustomerVouchers(CustomerId, Status);
    PRINT N'-> Đã tạo bảng CustomerVouchers.';
END
GO

-- 8. Tạo bảng Giỏ hàng lưu DB (CartItems & CartItemToppings)
IF OBJECT_ID('dbo.CartItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CartItems (
        CartItemId INT IDENTITY(1,1) NOT NULL,
        CustomerId INT NOT NULL,
        BranchId INT NULL,
        VariantId INT NOT NULL,
        Quantity INT NOT NULL CONSTRAINT DF_CartItems_Quantity DEFAULT 1,
        Notes NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CartItems_CreatedAt DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_CartItems_UpdatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_CartItems PRIMARY KEY CLUSTERED (CartItemId),
        CONSTRAINT CK_CartItems_Quantity CHECK (Quantity > 0),
        CONSTRAINT FK_CartItems_Customers FOREIGN KEY (CustomerId)
            REFERENCES dbo.Customers(CustomerId) ON DELETE CASCADE,
        CONSTRAINT FK_CartItems_Branches FOREIGN KEY (BranchId)
            REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_CartItems_ProductVariants FOREIGN KEY (VariantId)
            REFERENCES dbo.ProductVariants(VariantId)
    );

    CREATE INDEX IX_CartItems_CustomerId ON dbo.CartItems(CustomerId);
    PRINT N'-> Đã tạo bảng CartItems.';
END
GO

IF OBJECT_ID('dbo.CartItemToppings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.CartItemToppings (
        CartItemToppingId INT IDENTITY(1,1) NOT NULL,
        CartItemId INT NOT NULL,
        ToppingId INT NOT NULL,
        Quantity INT NOT NULL CONSTRAINT DF_CartItemToppings_Quantity DEFAULT 1,
        CONSTRAINT PK_CartItemToppings PRIMARY KEY CLUSTERED (CartItemToppingId),
        CONSTRAINT CK_CartItemToppings_Quantity CHECK (Quantity > 0),
        CONSTRAINT FK_CartItemToppings_CartItems FOREIGN KEY (CartItemId)
            REFERENCES dbo.CartItems(CartItemId) ON DELETE CASCADE,
        CONSTRAINT FK_CartItemToppings_Toppings FOREIGN KEY (ToppingId)
            REFERENCES dbo.Toppings(ToppingId)
    );

    CREATE INDEX IX_CartItemToppings_CartItemId ON dbo.CartItemToppings(CartItemId);
    PRINT N'-> Đã tạo bảng CartItemToppings.';
END
GO
