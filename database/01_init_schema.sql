-- =======================================================================================
-- HỆ THỐNG QUẢN LÝ KINH DOANH QUÁN CÀ PHÊ
-- Kịch bản khởi tạo Cơ sở dữ liệu (Baseline Schema Script)
-- Hệ quản trị CSDL: Microsoft SQL Server 2022 / 2025
-- File: src/database/01_init_schema.sql
-- Mô tả: Tạo toàn bộ cấu trúc bảng, ràng buộc toàn vẹn và chỉ mục (Indexes)
-- =======================================================================================

USE CoffeeShopDB;
GO

-- Tắt thông báo số dòng bị ảnh hưởng để tối ưu hiệu năng script
SET NOCOUNT ON;
GO

-- =======================================================================================
-- PHẦN 1: MODULE XÁC THỰC, PHÂN QUYỀN VÀ NGƯỜI DÙNG (IDENTITY & ACCESS CONTROL)
-- =======================================================================================

-- 1. Bảng Vai trò (Roles)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Roles')
BEGIN
    CREATE TABLE Roles (
        RoleId INT IDENTITY(1,1) NOT NULL,
        RoleName NVARCHAR(50) NOT NULL,
        Description NVARCHAR(255) NULL,
        CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (RoleId),
        CONSTRAINT UQ_Roles_RoleName UNIQUE (RoleName)
    );
END
GO

-- 2. Bảng Tài khoản người dùng (Users)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
BEGIN
    CREATE TABLE Users (
        UserId INT IDENTITY(1,1) NOT NULL,
        Username VARCHAR(50) NOT NULL,
        PasswordHash VARCHAR(255) NOT NULL,
        PasswordSalt VARCHAR(255) NULL,
        FullName NVARCHAR(100) NOT NULL,
        PhoneNumber VARCHAR(20) NULL,
        Email VARCHAR(100) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Users_IsActive DEFAULT 1,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Users_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (UserId),
        CONSTRAINT UQ_Users_Username UNIQUE (Username)
    );
END
GO

-- 3. Bảng Gán vai trò cho tài khoản (UserRoles)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRoles')
BEGIN
    CREATE TABLE UserRoles (
        UserId INT NOT NULL,
        RoleId INT NOT NULL,
        CONSTRAINT PK_UserRoles PRIMARY KEY CLUSTERED (UserId, RoleId),
        CONSTRAINT FK_UserRoles_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_UserRoles_Roles FOREIGN KEY (RoleId) REFERENCES Roles(RoleId) ON DELETE CASCADE
    );
END
GO

-- 4. Bảng Hồ sơ nhân viên (Employees)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Employees')
BEGIN
    CREATE TABLE Employees (
        EmployeeId INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        EmployeeCode VARCHAR(20) NOT NULL,
        Position NVARCHAR(50) NOT NULL,
        HireDate DATE NOT NULL,
        HourlyRate DECIMAL(18,2) NULL,
        CONSTRAINT PK_Employees PRIMARY KEY CLUSTERED (EmployeeId),
        CONSTRAINT UQ_Employees_UserId UNIQUE (UserId),
        CONSTRAINT UQ_Employees_EmployeeCode UNIQUE (EmployeeCode),
        CONSTRAINT FK_Employees_Users FOREIGN KEY (UserId) REFERENCES Users(UserId)
    );
END
GO

-- 5. Bảng Hồ sơ khách hàng (Customers)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Customers')
BEGIN
    CREATE TABLE Customers (
        CustomerId INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        DefaultAddress NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Customers PRIMARY KEY CLUSTERED (CustomerId),
        CONSTRAINT UQ_Customers_UserId UNIQUE (UserId),
        CONSTRAINT FK_Customers_Users FOREIGN KEY (UserId) REFERENCES Users(UserId)
    );
END
GO

-- =======================================================================================
-- PHẦN 2: MODULE THỰC ĐƠN, SẢN PHẨM VÀ ĐỊNH LƯỢNG CÔNG THỨC (CATALOG & BOM)
-- =======================================================================================

-- 6. Bảng Danh mục thực đơn (Categories - Hỗ trợ cây phân cấp qua ParentCategoryId)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Categories')
BEGIN
    CREATE TABLE Categories (
        CategoryId INT IDENTITY(1,1) NOT NULL,
        ParentCategoryId INT NULL,
        CategoryName NVARCHAR(100) NOT NULL,
        DisplayOrder INT NOT NULL CONSTRAINT DF_Categories_DisplayOrder DEFAULT 0,
        IsActive BIT NOT NULL CONSTRAINT DF_Categories_IsActive DEFAULT 1,
        CONSTRAINT PK_Categories PRIMARY KEY CLUSTERED (CategoryId),
        CONSTRAINT FK_Categories_Parent FOREIGN KEY (ParentCategoryId) REFERENCES Categories(CategoryId)
    );
END
GO

-- 7. Bảng Sản phẩm gốc (Products)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Products')
BEGIN
    CREATE TABLE Products (
        ProductId INT IDENTITY(1,1) NOT NULL,
        CategoryId INT NOT NULL,
        ProductCode VARCHAR(20) NOT NULL,
        ProductName NVARCHAR(150) NOT NULL,
        Description NVARCHAR(500) NULL,
        ImageUrl NVARCHAR(255) NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Products_IsActive DEFAULT 1,
        CONSTRAINT PK_Products PRIMARY KEY CLUSTERED (ProductId),
        CONSTRAINT UQ_Products_ProductCode UNIQUE (ProductCode),
        CONSTRAINT FK_Products_Categories FOREIGN KEY (CategoryId) REFERENCES Categories(CategoryId)
    );
END
GO

-- 8. Bảng Biến thể kích cỡ sản phẩm (ProductVariants - Size & Giá bán)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductVariants')
BEGIN
    CREATE TABLE ProductVariants (
        VariantId INT IDENTITY(1,1) NOT NULL,
        ProductId INT NOT NULL,
        SizeName NVARCHAR(20) NOT NULL,
        BasePrice DECIMAL(18,2) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_ProductVariants_IsActive DEFAULT 1,
        CONSTRAINT PK_ProductVariants PRIMARY KEY CLUSTERED (VariantId),
        CONSTRAINT UQ_ProductVariants_Product_Size UNIQUE (ProductId, SizeName),
        CONSTRAINT CK_ProductVariants_BasePrice CHECK (BasePrice >= 0),
        CONSTRAINT FK_ProductVariants_Products FOREIGN KEY (ProductId) REFERENCES Products(ProductId)
    );
END
GO

-- 9. Bảng Topping / Món thêm (Toppings)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Toppings')
BEGIN
    CREATE TABLE Toppings (
        ToppingId INT IDENTITY(1,1) NOT NULL,
        ToppingName NVARCHAR(100) NOT NULL,
        Price DECIMAL(18,2) NOT NULL,
        IsActive BIT NOT NULL CONSTRAINT DF_Toppings_IsActive DEFAULT 1,
        CONSTRAINT PK_Toppings PRIMARY KEY CLUSTERED (ToppingId),
        CONSTRAINT CK_Toppings_Price CHECK (Price >= 0)
    );
END
GO

-- 10. Bảng Nguyên vật liệu kho (Ingredients)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Ingredients')
BEGIN
    CREATE TABLE Ingredients (
        IngredientId INT IDENTITY(1,1) NOT NULL,
        IngredientCode VARCHAR(20) NOT NULL,
        IngredientName NVARCHAR(100) NOT NULL,
        Unit NVARCHAR(20) NOT NULL,
        CurrentStock DECIMAL(12,3) NOT NULL CONSTRAINT DF_Ingredients_CurrentStock DEFAULT 0,
        ReorderLevel DECIMAL(12,3) NOT NULL CONSTRAINT DF_Ingredients_ReorderLevel DEFAULT 0,
        IsActive BIT NOT NULL CONSTRAINT DF_Ingredients_IsActive DEFAULT 1,
        CONSTRAINT PK_Ingredients PRIMARY KEY CLUSTERED (IngredientId),
        CONSTRAINT UQ_Ingredients_IngredientCode UNIQUE (IngredientCode)
    );
END
GO

-- 11. Bảng Công thức định lượng (ProductRecipes - BOM)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ProductRecipes')
BEGIN
    CREATE TABLE ProductRecipes (
        RecipeId INT IDENTITY(1,1) NOT NULL,
        VariantId INT NOT NULL,
        IngredientId INT NOT NULL,
        Quantity DECIMAL(12,3) NOT NULL,
        CONSTRAINT PK_ProductRecipes PRIMARY KEY CLUSTERED (RecipeId),
        CONSTRAINT UQ_ProductRecipes_Variant_Ingredient UNIQUE (VariantId, IngredientId),
        CONSTRAINT CK_ProductRecipes_Quantity CHECK (Quantity > 0),
        CONSTRAINT FK_ProductRecipes_Variants FOREIGN KEY (VariantId) REFERENCES ProductVariants(VariantId),
        CONSTRAINT FK_ProductRecipes_Ingredients FOREIGN KEY (IngredientId) REFERENCES Ingredients(IngredientId)
    );
END
GO

-- =======================================================================================
-- PHẦN 3: MODULE CA LÀM VIỆC VÀ CHẤM CÔNG (SHIFTS & ATTENDANCE)
-- =======================================================================================

-- 12. Bảng Ca làm việc của Thu ngân tại POS (Shifts)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Shifts')
BEGIN
    CREATE TABLE Shifts (
        ShiftId INT IDENTITY(1,1) NOT NULL,
        CashierId INT NOT NULL,
        StartTime DATETIME2(0) NOT NULL CONSTRAINT DF_Shifts_StartTime DEFAULT SYSDATETIME(),
        EndTime DATETIME2(0) NULL,
        StartingCash DECIMAL(18,2) NOT NULL CONSTRAINT DF_Shifts_StartingCash DEFAULT 0,
        EndingCash DECIMAL(18,2) NULL,
        TotalCashSales DECIMAL(18,2) NULL,
        Difference DECIMAL(18,2) NULL,
        ShiftStatus VARCHAR(20) NOT NULL CONSTRAINT DF_Shifts_Status DEFAULT 'Open',
        Notes NVARCHAR(255) NULL,
        CONSTRAINT PK_Shifts PRIMARY KEY CLUSTERED (ShiftId),
        CONSTRAINT CK_Shifts_Status CHECK (ShiftStatus IN ('Open', 'Closed')),
        CONSTRAINT FK_Shifts_Users FOREIGN KEY (CashierId) REFERENCES Users(UserId)
    );
END
GO

-- 13. Bảng Nhật ký chấm công mô phỏng (Attendances)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Attendances')
BEGIN
    CREATE TABLE Attendances (
        AttendanceId INT IDENTITY(1,1) NOT NULL,
        EmployeeId INT NOT NULL,
        WorkDate DATE NOT NULL,
        CheckInTime DATETIME2(0) NOT NULL,
        CheckOutTime DATETIME2(0) NULL,
        AttendanceMethod VARCHAR(30) NOT NULL CONSTRAINT DF_Attendances_Method DEFAULT 'SimulatedButton',
        Notes NVARCHAR(255) NULL,
        CONSTRAINT PK_Attendances PRIMARY KEY CLUSTERED (AttendanceId),
        CONSTRAINT FK_Attendances_Employees FOREIGN KEY (EmployeeId) REFERENCES Employees(EmployeeId)
    );
END
GO

-- =======================================================================================
-- PHẦN 4: MODULE ĐƠN HÀNG VÀ GIAO NHẬN (ORDERS & DELIVERIES)
-- =======================================================================================

-- 14. Bảng Đơn hàng (Orders)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Orders')
BEGIN
    CREATE TABLE Orders (
        OrderId INT IDENTITY(1,1) NOT NULL,
        OrderCode VARCHAR(30) NOT NULL,
        OrderType VARCHAR(20) NOT NULL,
        CustomerId INT NULL,
        CashierId INT NULL,
        ShiftId INT NULL,
        OrderStatus VARCHAR(30) NOT NULL CONSTRAINT DF_Orders_OrderStatus DEFAULT 'Pending',
        PaymentStatus VARCHAR(30) NOT NULL CONSTRAINT DF_Orders_PaymentStatus DEFAULT 'Unpaid',
        SubTotal DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_SubTotal DEFAULT 0,
        DiscountAmount DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_Discount DEFAULT 0,
        ShippingFee DECIMAL(18,2) NOT NULL CONSTRAINT DF_Orders_ShippingFee DEFAULT 0,
        TotalAmount DECIMAL(18,2) NOT NULL,
        CancelReason NVARCHAR(255) NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_CreatedAt DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_UpdatedAt DEFAULT SYSDATETIME(),
        CONSTRAINT PK_Orders PRIMARY KEY CLUSTERED (OrderId),
        CONSTRAINT UQ_Orders_OrderCode UNIQUE (OrderCode),
        CONSTRAINT CK_Orders_OrderType CHECK (OrderType IN ('InStore', 'TakeAway', 'OnlinePickUp', 'OnlineDelivery')),
        CONSTRAINT CK_Orders_OrderStatus CHECK (OrderStatus IN ('Pending', 'Confirmed', 'Processing', 'Ready', 'Delivering', 'Completed', 'Cancelled')),
        CONSTRAINT CK_Orders_PaymentStatus CHECK (PaymentStatus IN ('Unpaid', 'Paid', 'PartiallyRefunded', 'Refunded')),
        CONSTRAINT CK_Orders_SubTotal CHECK (SubTotal >= 0),
        CONSTRAINT CK_Orders_Discount CHECK (DiscountAmount >= 0),
        CONSTRAINT CK_Orders_ShippingFee CHECK (ShippingFee >= 0),
        CONSTRAINT FK_Orders_Customers FOREIGN KEY (CustomerId) REFERENCES Customers(CustomerId),
        CONSTRAINT FK_Orders_Cashier FOREIGN KEY (CashierId) REFERENCES Users(UserId),
        CONSTRAINT FK_Orders_Shifts FOREIGN KEY (ShiftId) REFERENCES Shifts(ShiftId)
    );
END
GO

-- 15. Bảng Chi tiết món ăn trong đơn hàng (OrderItems)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderItems')
BEGIN
    CREATE TABLE OrderItems (
        OrderItemId INT IDENTITY(1,1) NOT NULL,
        OrderId INT NOT NULL,
        VariantId INT NOT NULL,
        ProductName NVARCHAR(150) NOT NULL,
        SizeName NVARCHAR(20) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        Quantity INT NOT NULL,
        TotalPrice DECIMAL(18,2) NOT NULL,
        Notes NVARCHAR(255) NULL,
        CONSTRAINT PK_OrderItems PRIMARY KEY CLUSTERED (OrderItemId),
        CONSTRAINT CK_OrderItems_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_OrderItems_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT FK_OrderItems_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE CASCADE,
        CONSTRAINT FK_OrderItems_ProductVariants FOREIGN KEY (VariantId) REFERENCES ProductVariants(VariantId)
    );
END
GO

-- 16. Bảng Topping đi kèm của từng món (OrderItemToppings)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderItemToppings')
BEGIN
    CREATE TABLE OrderItemToppings (
        OrderItemToppingId INT IDENTITY(1,1) NOT NULL,
        OrderItemId INT NOT NULL,
        ToppingId INT NOT NULL,
        ToppingName NVARCHAR(100) NOT NULL,
        UnitPrice DECIMAL(18,2) NOT NULL,
        Quantity INT NOT NULL CONSTRAINT DF_OrderItemToppings_Qty DEFAULT 1,
        TotalPrice DECIMAL(18,2) NOT NULL,
        CONSTRAINT PK_OrderItemToppings PRIMARY KEY CLUSTERED (OrderItemToppingId),
        CONSTRAINT CK_OrderItemToppings_Quantity CHECK (Quantity > 0),
        CONSTRAINT CK_OrderItemToppings_UnitPrice CHECK (UnitPrice >= 0),
        CONSTRAINT FK_OrderItemToppings_OrderItems FOREIGN KEY (OrderItemId) REFERENCES OrderItems(OrderItemId) ON DELETE CASCADE,
        CONSTRAINT FK_OrderItemToppings_Toppings FOREIGN KEY (ToppingId) REFERENCES Toppings(ToppingId)
    );
END
GO

-- 17. Bảng Thông tin giao hàng tận nơi (OrderDeliveries)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'OrderDeliveries')
BEGIN
    CREATE TABLE OrderDeliveries (
        DeliveryId INT IDENTITY(1,1) NOT NULL,
        OrderId INT NOT NULL,
        ReceiverName NVARCHAR(100) NOT NULL,
        ReceiverPhone VARCHAR(20) NOT NULL,
        DeliveryAddress NVARCHAR(255) NOT NULL,
        ShipperNotes NVARCHAR(255) NULL,
        DispatchedAt DATETIME2(0) NULL,
        DeliveredAt DATETIME2(0) NULL,
        CONSTRAINT PK_OrderDeliveries PRIMARY KEY CLUSTERED (DeliveryId),
        CONSTRAINT UQ_OrderDeliveries_OrderId UNIQUE (OrderId),
        CONSTRAINT FK_OrderDeliveries_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId) ON DELETE CASCADE
    );
END
GO

-- =======================================================================================
-- PHẦN 5: MODULE GIAO DỊCH THANH TOÁN (PAYMENTS)
-- =======================================================================================

-- 18. Bảng Lịch sử giao dịch dòng tiền (PaymentTransactions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PaymentTransactions')
BEGIN
    CREATE TABLE PaymentTransactions (
        TransactionId INT IDENTITY(1,1) NOT NULL,
        OrderId INT NOT NULL,
        TransactionType VARCHAR(20) NOT NULL,
        PaymentMethod VARCHAR(20) NOT NULL,
        Amount DECIMAL(18,2) NOT NULL,
        TransactedBy INT NOT NULL,
        TransactedAt DATETIME2(0) NOT NULL CONSTRAINT DF_PaymentTransactions_TransactedAt DEFAULT SYSDATETIME(),
        ReferenceCode VARCHAR(100) NULL,
        Notes NVARCHAR(255) NULL,
        CONSTRAINT PK_PaymentTransactions PRIMARY KEY CLUSTERED (TransactionId),
        CONSTRAINT CK_PaymentTransactions_Type CHECK (TransactionType IN ('Payment', 'Refund')),
        CONSTRAINT CK_PaymentTransactions_Method CHECK (PaymentMethod IN ('Cash', 'VietQR')),
        CONSTRAINT CK_PaymentTransactions_Amount CHECK (Amount > 0),
        CONSTRAINT FK_PaymentTransactions_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId),
        CONSTRAINT FK_PaymentTransactions_Users FOREIGN KEY (TransactedBy) REFERENCES Users(UserId)
    );
END
GO

-- =======================================================================================
-- PHẦN 6: MODULE QUẢN LÝ TỒN KHO VÀ XỬ LÝ HỦY (INVENTORY AUDIT)
-- =======================================================================================

-- 19. Bảng Sổ cái biến động kho nguyên liệu (InventoryTransactions)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InventoryTransactions')
BEGIN
    CREATE TABLE InventoryTransactions (
        TransactionId INT IDENTITY(1,1) NOT NULL,
        IngredientId INT NOT NULL,
        TransactionType VARCHAR(30) NOT NULL,
        Quantity DECIMAL(12,3) NOT NULL,
        BalanceAfter DECIMAL(12,3) NOT NULL,
        ReferenceOrderId INT NULL,
        CreatedBy INT NOT NULL,
        CreatedAt DATETIME2(0) NOT NULL CONSTRAINT DF_InventoryTransactions_CreatedAt DEFAULT SYSDATETIME(),
        Notes NVARCHAR(255) NULL,
        CONSTRAINT PK_InventoryTransactions PRIMARY KEY CLUSTERED (TransactionId),
        CONSTRAINT CK_InventoryTransactions_Type CHECK (TransactionType IN ('StockIn', 'OrderDeduct', 'WasteLoss', 'Adjustment')),
        CONSTRAINT FK_InventoryTransactions_Ingredients FOREIGN KEY (IngredientId) REFERENCES Ingredients(IngredientId),
        CONSTRAINT FK_InventoryTransactions_Orders FOREIGN KEY (ReferenceOrderId) REFERENCES Orders(OrderId),
        CONSTRAINT FK_InventoryTransactions_Users FOREIGN KEY (CreatedBy) REFERENCES Users(UserId)
    );
END
GO

-- 20. Bảng Xử lý đơn hủy sau khi đã trừ kho (InventoryDisposalReviews)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'InventoryDisposalReviews')
BEGIN
    CREATE TABLE InventoryDisposalReviews (
        ReviewId INT IDENTITY(1,1) NOT NULL,
        OrderId INT NOT NULL,
        ReviewStatus VARCHAR(30) NOT NULL CONSTRAINT DF_Reviews_Status DEFAULT 'PendingManagerReview',
        SituationType VARCHAR(50) NULL,
        ManagerDecisionNotes NVARCHAR(500) NULL,
        ReviewedBy INT NULL,
        ReviewedAt DATETIME2(0) NULL,
        CONSTRAINT PK_InventoryDisposalReviews PRIMARY KEY CLUSTERED (ReviewId),
        CONSTRAINT UQ_InventoryDisposalReviews_OrderId UNIQUE (OrderId),
        CONSTRAINT CK_Reviews_Status CHECK (ReviewStatus IN ('PendingManagerReview', 'Reviewed')),
        CONSTRAINT FK_InventoryDisposalReviews_Orders FOREIGN KEY (OrderId) REFERENCES Orders(OrderId),
        CONSTRAINT FK_InventoryDisposalReviews_Users FOREIGN KEY (ReviewedBy) REFERENCES Users(UserId)
    );
END
GO

-- =======================================================================================
-- PHẦN 7: CHIẾN LƯỢC TẠO CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
-- =======================================================================================

-- Chỉ mục hỗ trợ tìm kiếm và Polling đơn hàng nhanh chóng
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Orders_OrderStatus_CreatedAt')
    CREATE NONCLUSTERED INDEX IX_Orders_OrderStatus_CreatedAt ON Orders(OrderStatus, CreatedAt);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_Orders_OrderCode')
    CREATE NONCLUSTERED INDEX IX_Orders_OrderCode ON Orders(OrderCode);
GO

-- Chỉ mục tăng tốc JOIN chi tiết đơn hàng khi xem hoặc in hóa đơn
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OrderItems_OrderId')
    CREATE NONCLUSTERED INDEX IX_OrderItems_OrderId ON OrderItems(OrderId);
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_OrderItemToppings_OrderItemId')
    CREATE NONCLUSTERED INDEX IX_OrderItemToppings_OrderItemId ON OrderItemToppings(OrderItemId);
GO

-- Chỉ mục tính toán tổng tiền thanh toán để dẫn xuất PaymentStatus
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_PaymentTransactions_OrderId')
    CREATE NONCLUSTERED INDEX IX_PaymentTransactions_OrderId ON PaymentTransactions(OrderId);
GO

-- Chỉ mục hỗ trợ tra cứu công thức trừ kho tự động
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ProductRecipes_VariantId')
    CREATE NONCLUSTERED INDEX IX_ProductRecipes_VariantId ON ProductRecipes(VariantId);
GO

-- Chỉ mục xem sổ cái kho của từng nguyên liệu
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_InventoryTransactions_IngredientId')
    CREATE NONCLUSTERED INDEX IX_InventoryTransactions_IngredientId ON InventoryTransactions(IngredientId);
GO

PRINT N'>>> KHỞI TẠO THÀNH CÔNG TOÀN BỘ CẤU TRÚC DATABASE VỚI ĐẦY ĐỦ CÁC BẢNG VÀ CHỈ MỤC! <<<';
GO
