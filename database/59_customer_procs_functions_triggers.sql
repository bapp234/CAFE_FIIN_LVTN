USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 59: NHÓM FUNCTIONS, TRIGGERS & STORED PROCEDURES CHO KHÁCH HÀNG
-- Kiến trúc phân tách trách nhiệm:
--   1. Functions (fn_/tvf_): Tính toán & truy xuất dữ liệu tái sử dụng
--   2. Triggers (trg_): Tự động đồng bộ trạng thái, timestamp, mặc định, điểm & lượt dùng
--   3. Stored Procedures (sp_): Điều phối Transaction, đổ bảng tạm #Temp từ TVF và CUD gọn nhẹ
-- =======================================================================================

-- =======================================================================================
-- PHẦN 1: SCALAR & TABLE-VALUED FUNCTIONS
-- =======================================================================================

CREATE OR ALTER FUNCTION dbo.fn_CUST_ResolveMembershipTier
(
    @TotalSpent DECIMAL(18, 2)
)
RETURNS VARCHAR(20)
AS
BEGIN
    DECLARE @Spent DECIMAL(18, 2) = ISNULL(@TotalSpent, 0);

    IF @Spent >= 15000000 RETURN 'VIP';
    IF @Spent >= 5000000  RETURN 'Gold';
    IF @Spent >= 1000000  RETURN 'Silver';
    RETURN 'Standard';
END;
GO

CREATE OR ALTER FUNCTION dbo.fn_CUST_CalculateVoucherDiscount
(
    @VoucherId INT,
    @SubTotal  DECIMAL(18, 2)
)
RETURNS DECIMAL(18, 2)
AS
BEGIN
    DECLARE @DiscountType VARCHAR(20);
    DECLARE @DiscountValue DECIMAL(18, 2);
    DECLARE @MaxDiscount DECIMAL(18, 2);
    DECLARE @MinOrder DECIMAL(18, 2);
    DECLARE @Amount DECIMAL(18, 2) = 0;

    SELECT
        @DiscountType = DiscountType,
        @DiscountValue = DiscountValue,
        @MaxDiscount = MaxDiscountAmount,
        @MinOrder = MinOrderAmount
    FROM dbo.Vouchers
    WHERE VoucherId = @VoucherId
      AND IsActive = 1
      AND SYSDATETIME() BETWEEN StartAt AND EndAt
      AND (UsageLimit IS NULL OR UsedCount < UsageLimit);

    IF @DiscountType IS NULL OR ISNULL(@SubTotal, 0) < ISNULL(@MinOrder, 0)
        RETURN 0;

    IF @DiscountType = 'FixedAmount'
        SET @Amount = @DiscountValue;
    ELSE IF @DiscountType = 'Percent'
    BEGIN
        SET @Amount = ROUND(@SubTotal * (@DiscountValue / 100.0), 0);
        IF @MaxDiscount IS NOT NULL AND @Amount > @MaxDiscount
            SET @Amount = @MaxDiscount;
    END

    IF @Amount > @SubTotal SET @Amount = @SubTotal;
    IF @Amount < 0 SET @Amount = 0;

    RETURN @Amount;
END;
GO

CREATE OR ALTER FUNCTION dbo.tvf_CUST_GetCartDetails
(
    @CustomerId INT
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        ci.CartItemId,
        ci.CustomerId,
        ci.BranchId,
        b.BranchName,
        ci.VariantId,
        p.ProductId,
        p.ProductCode,
        p.ProductName,
        p.ImageUrl,
        pv.SizeName,
        pv.BasePrice AS UnitPrice,
        ci.Quantity,
        ci.Notes,
        ISNULL((
            SELECT SUM(t.Price * cit.Quantity)
            FROM dbo.CartItemToppings cit
            INNER JOIN dbo.Toppings t ON cit.ToppingId = t.ToppingId
            WHERE cit.CartItemId = ci.CartItemId
        ), 0) AS ToppingUnitTotal,
        (pv.BasePrice + ISNULL((
            SELECT SUM(t.Price * cit.Quantity)
            FROM dbo.CartItemToppings cit
            INNER JOIN dbo.Toppings t ON cit.ToppingId = t.ToppingId
            WHERE cit.CartItemId = ci.CartItemId
        ), 0)) * ci.Quantity AS LineTotal,
        ci.UpdatedAt
    FROM dbo.CartItems ci
    INNER JOIN dbo.ProductVariants pv ON ci.VariantId = pv.VariantId
    INNER JOIN dbo.Products p ON pv.ProductId = p.ProductId
    LEFT JOIN dbo.Branches b ON ci.BranchId = b.BranchId
    WHERE ci.CustomerId = @CustomerId
);
GO

CREATE OR ALTER FUNCTION dbo.tvf_CUST_GetEligibleVouchers
(
    @CustomerId INT,
    @SubTotal   DECIMAL(18, 2)
)
RETURNS TABLE
AS
RETURN
(
    SELECT
        cv.CustomerVoucherId,
        v.VoucherId,
        v.VoucherCode,
        v.VoucherName,
        v.Description,
        v.DiscountType,
        v.DiscountValue,
        v.MaxDiscountAmount,
        v.MinOrderAmount,
        v.EndAt,
        cv.Status AS WalletStatus,
        dbo.fn_CUST_CalculateVoucherDiscount(v.VoucherId, @SubTotal) AS EstimatedDiscount
    FROM dbo.CustomerVouchers cv
    INNER JOIN dbo.Vouchers v ON cv.VoucherId = v.VoucherId
    WHERE cv.CustomerId = @CustomerId
      AND cv.Status = 'Available'
      AND v.IsActive = 1
      AND SYSDATETIME() BETWEEN v.StartAt AND v.EndAt
      AND (v.UsageLimit IS NULL OR v.UsedCount < v.UsageLimit)
);
GO

PRINT N'-> Đã tạo các Functions cho nhóm Khách hàng.';
GO

-- =======================================================================================
-- PHẦN 2: TRIGGERS (TỰ ĐỘNG ĐỒNG BỘ KHI THÊM / SỬA / XÓA)
-- =======================================================================================

CREATE OR ALTER TRIGGER dbo.trg_Customers_AutoSyncTierAndTimestamp
ON dbo.Customers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    UPDATE c
    SET
        MembershipTier = dbo.fn_CUST_ResolveMembershipTier(i.TotalSpent),
        UpdatedAt = SYSDATETIME()
    FROM dbo.Customers c
    INNER JOIN inserted i ON c.CustomerId = i.CustomerId;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_CustomerAddresses_MaintainDefault
ON dbo.CustomerAddresses
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- 1. Nếu vừa thêm/sửa địa chỉ có IsDefault = 1 -> tắt IsDefault các địa chỉ khác của cùng CustomerId
    IF EXISTS (SELECT 1 FROM inserted WHERE IsDefault = 1)
    BEGIN
        UPDATE ca
        SET IsDefault = 0,
            UpdatedAt = SYSDATETIME()
        FROM dbo.CustomerAddresses ca
        INNER JOIN inserted i ON ca.CustomerId = i.CustomerId
        WHERE i.IsDefault = 1
          AND ca.AddressId <> i.AddressId
          AND ca.IsDefault = 1;
    END

    -- 2. Nếu vừa xóa địa chỉ mặc định -> tự động gán địa chỉ mới nhất còn lại làm mặc định
    IF EXISTS (SELECT 1 FROM deleted WHERE IsDefault = 1)
    BEGIN
        ;WITH AffectedCustomers AS (
            SELECT DISTINCT CustomerId FROM deleted WHERE IsDefault = 1
        ),
        NextDefault AS (
            SELECT
                ca.CustomerId,
                ca.AddressId,
                ROW_NUMBER() OVER (PARTITION BY ca.CustomerId ORDER BY ca.UpdatedAt DESC, ca.AddressId DESC) AS rn
            FROM dbo.CustomerAddresses ca
            INNER JOIN AffectedCustomers ac ON ca.CustomerId = ac.CustomerId
            WHERE NOT EXISTS (
                SELECT 1 FROM dbo.CustomerAddresses x
                WHERE x.CustomerId = ca.CustomerId AND x.IsDefault = 1
            )
        )
        UPDATE ca
        SET IsDefault = 1,
            UpdatedAt = SYSDATETIME()
        FROM dbo.CustomerAddresses ca
        INNER JOIN NextDefault nd ON ca.AddressId = nd.AddressId
        WHERE nd.rn = 1;
    END

    -- 3. Đồng bộ DefaultAddress sang bảng Customers
    ;WITH TargetCustomers AS (
        SELECT CustomerId FROM inserted
        UNION
        SELECT CustomerId FROM deleted
    )
    UPDATE c
    SET DefaultAddress = (
            SELECT TOP 1 ca.FullAddress
            FROM dbo.CustomerAddresses ca
            WHERE ca.CustomerId = c.CustomerId
            ORDER BY ca.IsDefault DESC, ca.UpdatedAt DESC, ca.AddressId DESC
        ),
        UpdatedAt = SYSDATETIME()
    FROM dbo.Customers c
    INNER JOIN TargetCustomers tc ON c.CustomerId = tc.CustomerId;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_CustomerPointTransactions_SyncBalance
ON dbo.CustomerPointTransactions
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    -- Tự động đồng bộ LoyaltyPoints trên Customers theo giao dịch mới nhất vừa insert
    ;WITH LatestTx AS (
        SELECT
            i.CustomerId,
            i.BalanceAfter,
            ROW_NUMBER() OVER (PARTITION BY i.CustomerId ORDER BY i.PointTxId DESC) AS rn
        FROM inserted i
    )
    UPDATE c
    SET LoyaltyPoints = lt.BalanceAfter,
        UpdatedAt = SYSDATETIME()
    FROM dbo.Customers c
    INNER JOIN LatestTx lt ON c.CustomerId = lt.CustomerId
    WHERE lt.rn = 1;
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_CustomerVouchers_SyncVoucherUsage
ON dbo.CustomerVouchers
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF TRIGGER_NESTLEVEL() > 1 RETURN;

    ;WITH NewlyUsed AS (
        SELECT i.VoucherId, COUNT(*) AS UsedDelta
        FROM inserted i
        LEFT JOIN deleted d ON i.CustomerVoucherId = d.CustomerVoucherId
        WHERE i.Status = 'Used'
          AND ISNULL(d.Status, '') <> 'Used'
        GROUP BY i.VoucherId
    )
    UPDATE v
    SET UsedCount = v.UsedCount + nu.UsedDelta
    FROM dbo.Vouchers v
    INNER JOIN NewlyUsed nu ON v.VoucherId = nu.VoucherId;

    IF EXISTS (
        SELECT 1
        FROM dbo.Vouchers v
        INNER JOIN inserted i ON v.VoucherId = i.VoucherId
        WHERE v.UsageLimit IS NOT NULL AND v.UsedCount > v.UsageLimit
    )
    BEGIN
        RAISERROR(N'Voucher đã vượt quá giới hạn lượt sử dụng.', 16, 1);
        ROLLBACK TRANSACTION;
    END
END;
GO

CREATE OR ALTER TRIGGER dbo.trg_CartItemToppings_TouchCartItem
ON dbo.CartItemToppings
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE ci
    SET UpdatedAt = SYSDATETIME()
    FROM dbo.CartItems ci
    WHERE ci.CartItemId IN (
        SELECT CartItemId FROM inserted
        UNION
        SELECT CartItemId FROM deleted
    );
END;
GO

PRINT N'-> Đã tạo các Triggers cho nhóm Khách hàng.';
GO

-- =======================================================================================
-- PHẦN 3: STORED PROCEDURES (GỌI TVF / ĐỔ BẢNG TẠM #TEMP / TRANSACTION CUD)
-- =======================================================================================

-- 3.1. Đăng ký tài khoản Khách hàng mới
CREATE OR ALTER PROCEDURE dbo.sp_CUST_Register
    @Username       VARCHAR(50),
    @PasswordHash   VARCHAR(255),
    @PasswordSalt   VARCHAR(255) = NULL,
    @FullName       NVARCHAR(100),
    @PhoneNumber    VARCHAR(20)  = NULL,
    @Email          VARCHAR(100) = NULL,
    @DefaultAddress NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF EXISTS (SELECT 1 FROM dbo.Users WHERE Username = @Username)
    BEGIN
        RAISERROR(N'Tên đăng nhập đã tồn tại.', 16, 1);
        RETURN;
    END

    IF @Email IS NOT NULL AND LTRIM(RTRIM(@Email)) <> ''
       AND EXISTS (SELECT 1 FROM dbo.Users WHERE Email = @Email)
    BEGIN
        RAISERROR(N'Email này đã được sử dụng.', 16, 1);
        RETURN;
    END

    DECLARE @CustomerRoleId INT = (SELECT TOP 1 RoleId FROM dbo.Roles WHERE RoleName = N'Customer');
    IF @CustomerRoleId IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy vai trò Customer trong hệ thống.', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO dbo.Users (Username, PasswordHash, PasswordSalt, FullName, PhoneNumber, Email, IsActive, MustChangePassword)
    VALUES (@Username, @PasswordHash, @PasswordSalt, @FullName, @PhoneNumber, @Email, 1, 0);

    DECLARE @NewUserId INT = SCOPE_IDENTITY();

    INSERT INTO dbo.UserRoles (UserId, RoleId)
    VALUES (@NewUserId, @CustomerRoleId);

    INSERT INTO dbo.Customers (UserId, DefaultAddress)
    VALUES (@NewUserId, @DefaultAddress);

    DECLARE @NewCustomerId INT = SCOPE_IDENTITY();

    IF @DefaultAddress IS NOT NULL AND LTRIM(RTRIM(@DefaultAddress)) <> ''
    BEGIN
        INSERT INTO dbo.CustomerAddresses (CustomerId, Label, ReceiverName, ReceiverPhone, FullAddress, IsDefault)
        VALUES (@NewCustomerId, N'Mặc định', @FullName, ISNULL(@PhoneNumber, ''), @DefaultAddress, 1);
    END

    COMMIT TRANSACTION;

    SELECT @NewUserId AS UserId, @NewCustomerId AS CustomerId;
END;
GO

-- 3.2. Lấy & Cập nhật hồ sơ Khách hàng
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetProfile
    @UserId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        c.CustomerId,
        c.UserId,
        u.Username,
        u.FullName,
        u.PhoneNumber,
        u.Email,
        c.DefaultAddress,
        c.MembershipTier,
        c.LoyaltyPoints,
        c.TotalOrders,
        c.TotalSpent,
        c.DateOfBirth,
        c.Gender,
        c.CreatedAt,
        c.UpdatedAt
    FROM dbo.Customers c
    INNER JOIN dbo.Users u ON c.UserId = u.UserId
    WHERE c.UserId = @UserId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_UpdateProfile
    @UserId      INT,
    @FullName    NVARCHAR(100),
    @PhoneNumber VARCHAR(20) = NULL,
    @Email       VARCHAR(100) = NULL,
    @DateOfBirth DATE = NULL,
    @Gender      NVARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRANSACTION;

    UPDATE dbo.Users
    SET FullName = @FullName,
        PhoneNumber = @PhoneNumber,
        Email = @Email
    WHERE UserId = @UserId;

    UPDATE dbo.Customers
    SET DateOfBirth = @DateOfBirth,
        Gender = @Gender
    WHERE UserId = @UserId;

    COMMIT TRANSACTION;

    EXEC dbo.sp_CUST_GetProfile @UserId = @UserId;
END;
GO

-- 3.3. Quản lý sổ địa chỉ (Trigger trg_CustomerAddresses_MaintainDefault tự lo IsDefault & DefaultAddress)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetAddresses
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT AddressId, CustomerId, Label, ReceiverName, ReceiverPhone, FullAddress, IsDefault, CreatedAt, UpdatedAt
    FROM dbo.CustomerAddresses
    WHERE CustomerId = @CustomerId
    ORDER BY IsDefault DESC, UpdatedAt DESC, AddressId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_SaveAddress
    @AddressId     INT = NULL,
    @CustomerId    INT,
    @Label         NVARCHAR(50) = NULL,
    @ReceiverName  NVARCHAR(100),
    @ReceiverPhone VARCHAR(20),
    @FullAddress   NVARCHAR(255),
    @IsDefault     BIT = 0
AS
BEGIN
    SET NOCOUNT ON;

    -- Nếu là địa chỉ đầu tiên của khách -> mặc định bật IsDefault = 1
    IF NOT EXISTS (SELECT 1 FROM dbo.CustomerAddresses WHERE CustomerId = @CustomerId)
        SET @IsDefault = 1;

    IF @AddressId IS NULL OR @AddressId <= 0
    BEGIN
        INSERT INTO dbo.CustomerAddresses (CustomerId, Label, ReceiverName, ReceiverPhone, FullAddress, IsDefault)
        VALUES (@CustomerId, @Label, @ReceiverName, @ReceiverPhone, @FullAddress, @IsDefault);

        SET @AddressId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.CustomerAddresses
        SET Label = @Label,
            ReceiverName = @ReceiverName,
            ReceiverPhone = @ReceiverPhone,
            FullAddress = @FullAddress,
            IsDefault = @IsDefault,
            UpdatedAt = SYSDATETIME()
        WHERE AddressId = @AddressId AND CustomerId = @CustomerId;
    END

    SELECT @AddressId AS AddressId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_DeleteAddress
    @AddressId  INT,
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.CustomerAddresses
    WHERE AddressId = @AddressId AND CustomerId = @CustomerId;
END;
GO

-- 3.4. Lấy giỏ hàng (Gọi TVF tvf_CUST_GetCartDetails đổ vào bảng tạm #CartLines)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetCart
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #CartLines (
        CartItemId       INT PRIMARY KEY,
        CustomerId       INT,
        BranchId         INT NULL,
        BranchName       NVARCHAR(150) NULL,
        VariantId        INT,
        ProductId        INT,
        ProductCode      VARCHAR(20),
        ProductName      NVARCHAR(150),
        ImageUrl         NVARCHAR(255) NULL,
        SizeName         NVARCHAR(20),
        UnitPrice        DECIMAL(18, 2),
        Quantity         INT,
        Notes            NVARCHAR(255) NULL,
        ToppingUnitTotal DECIMAL(18, 2),
        LineTotal        DECIMAL(18, 2),
        UpdatedAt        DATETIME2(0)
    );

    INSERT INTO #CartLines
    SELECT * FROM dbo.tvf_CUST_GetCartDetails(@CustomerId);

    -- Result set 1: Danh sách món trong giỏ
    SELECT * FROM #CartLines ORDER BY UpdatedAt DESC, CartItemId DESC;

    -- Result set 2: Danh sách topping đi kèm từng dòng giỏ hàng
    SELECT
        cit.CartItemToppingId,
        cit.CartItemId,
        cit.ToppingId,
        t.ToppingName,
        t.Price AS UnitPrice,
        cit.Quantity,
        (t.Price * cit.Quantity) AS TotalPrice
    FROM dbo.CartItemToppings cit
    INNER JOIN #CartLines cl ON cit.CartItemId = cl.CartItemId
    INNER JOIN dbo.Toppings t ON cit.ToppingId = t.ToppingId;

    -- Result set 3: Tổng hợp giỏ hàng
    SELECT
        ISNULL(SUM(Quantity), 0) AS TotalItems,
        ISNULL(SUM(LineTotal), 0) AS SubTotal
    FROM #CartLines;

    DROP TABLE #CartLines;
END;
GO

-- 3.5. Thêm món vào giỏ hàng (nhận danh sách ToppingId cách nhau bởi dấu phẩy)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_AddToCart
    @CustomerId INT,
    @BranchId   INT = NULL,
    @VariantId  INT,
    @Quantity   INT = 1,
    @Notes      NVARCHAR(255) = NULL,
    @ToppingIds VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @Quantity <= 0
    BEGIN
        RAISERROR(N'Số lượng món phải lớn hơn 0.', 16, 1);
        RETURN;
    END

    IF NOT EXISTS (SELECT 1 FROM dbo.ProductVariants WHERE VariantId = @VariantId AND IsActive = 1)
    BEGIN
        RAISERROR(N'Sản phẩm hoặc kích cỡ không tồn tại / đã ngừng bán.', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    INSERT INTO dbo.CartItems (CustomerId, BranchId, VariantId, Quantity, Notes)
    VALUES (@CustomerId, @BranchId, @VariantId, @Quantity, @Notes);

    DECLARE @NewCartItemId INT = SCOPE_IDENTITY();

    IF @ToppingIds IS NOT NULL AND LTRIM(RTRIM(@ToppingIds)) <> ''
    BEGIN
        INSERT INTO dbo.CartItemToppings (CartItemId, ToppingId, Quantity)
        SELECT DISTINCT
            @NewCartItemId,
            TRY_CAST(LTRIM(RTRIM(value)) AS INT),
            1
        FROM STRING_SPLIT(@ToppingIds, ',')
        WHERE TRY_CAST(LTRIM(RTRIM(value)) AS INT) IS NOT NULL
          AND EXISTS (
              SELECT 1 FROM dbo.Toppings t
              WHERE t.ToppingId = TRY_CAST(LTRIM(RTRIM(value)) AS INT) AND t.IsActive = 1
          );
    END

    COMMIT TRANSACTION;

    SELECT @NewCartItemId AS CartItemId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_UpdateCartItem
    @CartItemId INT,
    @CustomerId INT,
    @Quantity   INT,
    @Notes      NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    IF @Quantity <= 0
    BEGIN
        DELETE FROM dbo.CartItems WHERE CartItemId = @CartItemId AND CustomerId = @CustomerId;
        RETURN;
    END

    UPDATE dbo.CartItems
    SET Quantity = @Quantity,
        Notes = @Notes,
        UpdatedAt = SYSDATETIME()
    WHERE CartItemId = @CartItemId AND CustomerId = @CustomerId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_ClearCart
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM dbo.CartItems WHERE CustomerId = @CustomerId;
END;
GO

-- 3.6. Lấy danh sách Voucher khả dụng & Đổi điểm lấy Voucher (Trigger tự đồng bộ LoyaltyPoints)
CREATE OR ALTER PROCEDURE dbo.sp_CUST_GetAvailableVouchers
    @CustomerId INT,
    @SubTotal   DECIMAL(18, 2) = 0
AS
BEGIN
    SET NOCOUNT ON;

    -- Đổ vào bảng tạm #Eligible từ TVF để sắp xếp theo mức giảm thực tế cao nhất
    SELECT *
    INTO #Eligible
    FROM dbo.tvf_CUST_GetEligibleVouchers(@CustomerId, @SubTotal);

    SELECT *
    FROM #Eligible
    ORDER BY EstimatedDiscount DESC, EndAt ASC;

    DROP TABLE #Eligible;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_CUST_RedeemVoucher
    @CustomerId INT,
    @VoucherId  INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @PointsCost INT;
    DECLARE @VoucherName NVARCHAR(150);
    DECLARE @CurrentPoints INT;

    SELECT @PointsCost = PointsCost, @VoucherName = VoucherName
    FROM dbo.Vouchers
    WHERE VoucherId = @VoucherId
      AND IsActive = 1
      AND SYSDATETIME() BETWEEN StartAt AND EndAt
      AND (UsageLimit IS NULL OR UsedCount < UsageLimit);

    IF @VoucherName IS NULL
    BEGIN
        RAISERROR(N'Voucher không tồn tại hoặc đã hết hạn / hết lượt.', 16, 1);
        RETURN;
    END

    SELECT @CurrentPoints = LoyaltyPoints FROM dbo.Customers WHERE CustomerId = @CustomerId;
    IF @CurrentPoints IS NULL
    BEGIN
        RAISERROR(N'Không tìm thấy hồ sơ khách hàng.', 16, 1);
        RETURN;
    END

    IF @CurrentPoints < @PointsCost
    BEGIN
        RAISERROR(N'Điểm tích lũy không đủ để đổi voucher này.', 16, 1);
        RETURN;
    END

    BEGIN TRANSACTION;

    IF @PointsCost > 0
    BEGIN
        -- Trigger trg_CustomerPointTransactions_SyncBalance sẽ tự cập nhật Customers.LoyaltyPoints
        INSERT INTO dbo.CustomerPointTransactions (CustomerId, TransactionType, Points, BalanceAfter, Description)
        VALUES (@CustomerId, 'Redeem', -@PointsCost, @CurrentPoints - @PointsCost, N'Đổi voucher: ' + @VoucherName);
    END

    INSERT INTO dbo.CustomerVouchers (CustomerId, VoucherId, Status)
    VALUES (@CustomerId, @VoucherId, 'Available');

    DECLARE @NewCustomerVoucherId INT = SCOPE_IDENTITY();

    COMMIT TRANSACTION;

    SELECT @NewCustomerVoucherId AS CustomerVoucherId;
END;
GO

PRINT N'-> Đã tạo các Stored Procedures cho nhóm Khách hàng.';
GO
