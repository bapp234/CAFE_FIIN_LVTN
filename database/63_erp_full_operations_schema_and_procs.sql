USE [CoffeeShopDB];
GO

-- =======================================================================================
-- SCRIPT 63: TOÀN BỘ SCHEMA & STORED PROCEDURES CHO ERP (KHO TỔNG, CHI NHÁNH, NCC/PO, GIÁM SÁT ĐƠN, BÁO CÁO)
-- =======================================================================================

-- 1. Mở rộng dbo.Branches với ParentBranchId & IsCentralWarehouse
IF COL_LENGTH('dbo.Branches', 'ParentBranchId') IS NULL
BEGIN
    ALTER TABLE dbo.Branches ADD
        ParentBranchId     INT NULL,
        IsCentralWarehouse BIT NOT NULL CONSTRAINT DF_Branches_IsCentral DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Branches WHERE IsCentralWarehouse = 1)
BEGIN
    INSERT INTO dbo.Branches (BranchCode, BranchName, Address, PhoneNumber, IsActive, IsCentralWarehouse)
    VALUES ('KHO-TONG', N'Kho Tổng Trung Tâm', N'Trung tâm phân phối Fiin Coffee', '19001755', 1, 1);
END
GO

-- 2. Mở rộng dbo.Ingredients & Tạo bảng dbo.BranchInventory
IF COL_LENGTH('dbo.Ingredients', 'AverageCost') IS NULL
BEGIN
    ALTER TABLE dbo.Ingredients ADD
        AverageCost   DECIMAL(18,2) NOT NULL CONSTRAINT DF_Ingredients_AvgCost DEFAULT (0),
        CategoryGroup NVARCHAR(50)  NOT NULL CONSTRAINT DF_Ingredients_Group DEFAULT (N'Nguyên liệu');
END
GO

IF OBJECT_ID('dbo.BranchInventory', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BranchInventory (
        BranchInventoryId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId          INT               NOT NULL,
        IngredientId      INT               NOT NULL,
        CurrentStock      DECIMAL(12,3)     NOT NULL DEFAULT (0),
        ReorderLevel      DECIMAL(12,3)     NOT NULL DEFAULT (0),
        AverageCost       DECIMAL(18,2)     NOT NULL DEFAULT (0),
        UpdatedAt         DATETIME2(0)      NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT UQ_BranchInventory_Branch_Ing UNIQUE (BranchId, IngredientId),
        CONSTRAINT FK_BranchInventory_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_BranchInventory_Ingredients FOREIGN KEY (IngredientId) REFERENCES dbo.Ingredients(IngredientId)
    );
END
GO

IF COL_LENGTH('dbo.InventoryTransactions', 'BranchId') IS NULL
BEGIN
    ALTER TABLE dbo.InventoryTransactions ADD BranchId INT NULL;
END
GO

-- 3. Bảng Điều chuyển & Cấp phát định kỳ (Kho Tổng <-> Chi nhánh)
IF OBJECT_ID('dbo.StockTransfers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StockTransfers (
        TransferId     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferCode   VARCHAR(30)       NOT NULL UNIQUE,
        FromBranchId   INT               NOT NULL,
        ToBranchId     INT               NOT NULL,
        TransferType   VARCHAR(20)       NOT NULL, -- 'Periodic' | 'ExtraRequest'
        [Status]       VARCHAR(20)       NOT NULL DEFAULT ('Requested'), -- 'Requested' | 'Approved' | 'Received' | 'Rejected'
        Notes          NVARCHAR(255)     NULL,
        CreatedBy      INT               NULL,
        ApprovedBy     INT               NULL,
        CreatedAt      DATETIME2(0)      NOT NULL DEFAULT (SYSDATETIME()),
        UpdatedAt      DATETIME2(0)      NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_StockTransfers_From FOREIGN KEY (FromBranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_StockTransfers_To   FOREIGN KEY (ToBranchId)   REFERENCES dbo.Branches(BranchId)
    );
END
GO

IF OBJECT_ID('dbo.StockTransferItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.StockTransferItems (
        TransferItemId INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId     INT               NOT NULL,
        IngredientId   INT               NOT NULL,
        RequestedQty   DECIMAL(12,3)     NOT NULL,
        ApprovedQty    DECIMAL(12,3)     NOT NULL DEFAULT (0),
        ReceivedQty    DECIMAL(12,3)     NOT NULL DEFAULT (0),
        CONSTRAINT FK_StockTransferItems_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.StockTransfers(TransferId) ON DELETE CASCADE,
        CONSTRAINT FK_StockTransferItems_Ing      FOREIGN KEY (IngredientId) REFERENCES dbo.Ingredients(IngredientId)
    );
END
GO

IF OBJECT_ID('dbo.PeriodicSupplyRules', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PeriodicSupplyRules (
        RuleId         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId       INT               NOT NULL,
        IngredientId   INT               NOT NULL,
        SupplyCycle    VARCHAR(20)       NOT NULL DEFAULT ('Weekly'), -- 'Weekly' | 'BiWeekly' | 'Monthly'
        DefaultQty     DECIMAL(12,3)     NOT NULL,
        NextSupplyDate DATE              NOT NULL,
        IsActive       BIT               NOT NULL DEFAULT (1),
        CONSTRAINT UQ_PeriodicRule_Branch_Ing UNIQUE (BranchId, IngredientId),
        CONSTRAINT FK_PeriodicRule_Branch FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId),
        CONSTRAINT FK_PeriodicRule_Ing    FOREIGN KEY (IngredientId) REFERENCES dbo.Ingredients(IngredientId)
    );
END
GO

-- 4. Bảng Cấu hình giao hàng & Phí ship theo Chi nhánh
IF OBJECT_ID('dbo.BranchDeliverySettings', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.BranchDeliverySettings (
        BranchId          INT            NOT NULL PRIMARY KEY,
        IsDeliveryEnabled BIT            NOT NULL DEFAULT (1),
        MaxRadiusKm       DECIMAL(5,2)   NOT NULL DEFAULT (5),
        BaseShippingFee   DECIMAL(18,2)  NOT NULL DEFAULT (15000),
        FeePerKm          DECIMAL(18,2)  NOT NULL DEFAULT (5000),
        FreeShipMinOrder  DECIMAL(18,2)  NOT NULL DEFAULT (150000),
        SupportedAreas    NVARCHAR(500)  NULL,
        UpdatedAt         DATETIME2(0)   NOT NULL DEFAULT (SYSDATETIME()),
        CONSTRAINT FK_BranchDelivery_Branches FOREIGN KEY (BranchId) REFERENCES dbo.Branches(BranchId)
    );
END
GO

-- 5. Bảng Nhà cung cấp & Phiếu nhập hàng (PO)
IF OBJECT_ID('dbo.Suppliers', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Suppliers (
        SupplierId    INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SupplierCode  VARCHAR(20)       NOT NULL UNIQUE,
        SupplierName  NVARCHAR(150)     NOT NULL,
        CategoryGroup NVARCHAR(50)      NULL,
        ContactPerson NVARCHAR(100)     NULL,
        Phone         VARCHAR(20)       NULL,
        Email         VARCHAR(100)      NULL,
        [Address]     NVARCHAR(255)     NULL,
        CurrentDebt   DECIMAL(18,2)     NOT NULL DEFAULT (0),
        IsActive      BIT               NOT NULL DEFAULT (1),
        CreatedAt     DATETIME2(0)      NOT NULL DEFAULT (SYSDATETIME())
    );
END
GO

IF OBJECT_ID('dbo.PurchaseOrders', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseOrders (
        PoId          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PoCode        VARCHAR(30)       NOT NULL UNIQUE,
        SupplierId    INT               NOT NULL,
        BranchId      INT               NOT NULL,
        [Status]      VARCHAR(20)       NOT NULL DEFAULT ('Draft'), -- 'Draft' | 'Ordered' | 'Received' | 'Cancelled'
        PaymentStatus VARCHAR(20)       NOT NULL DEFAULT ('Unpaid'), -- 'Unpaid' | 'Partial' | 'Paid'
        TotalAmount   DECIMAL(18,2)     NOT NULL DEFAULT (0),
        PaidAmount    DECIMAL(18,2)     NOT NULL DEFAULT (0),
        Notes         NVARCHAR(255)     NULL,
        CreatedBy     INT               NULL,
        CreatedAt     DATETIME2(0)      NOT NULL DEFAULT (SYSDATETIME()),
        ReceivedAt    DATETIME2(0)      NULL,
        CONSTRAINT FK_PurchaseOrders_Suppliers FOREIGN KEY (SupplierId) REFERENCES dbo.Suppliers(SupplierId),
        CONSTRAINT FK_PurchaseOrders_Branches  FOREIGN KEY (BranchId)   REFERENCES dbo.Branches(BranchId)
    );
END
GO

IF OBJECT_ID('dbo.PurchaseOrderItems', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.PurchaseOrderItems (
        PoItemId     INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PoId         INT               NOT NULL,
        IngredientId INT               NOT NULL,
        Quantity     DECIMAL(12,3)     NOT NULL,
        UnitPrice    DECIMAL(18,2)     NOT NULL,
        CONSTRAINT FK_PurchaseOrderItems_PO  FOREIGN KEY (PoId) REFERENCES dbo.PurchaseOrders(PoId) ON DELETE CASCADE,
        CONSTRAINT FK_PurchaseOrderItems_Ing FOREIGN KEY (IngredientId) REFERENCES dbo.Ingredients(IngredientId)
    );
END
GO

-- =======================================================================================
-- STORED PROCEDURES: MENU 3 (KHO TỔNG)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetCentralInventory
    @Search NVARCHAR(100) = NULL,
    @Group  NVARCHAR(50)  = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);

    SELECT
        i.IngredientId,
        i.IngredientCode,
        i.IngredientName,
        i.CategoryGroup,
        i.Unit,
        ISNULL(bi.CurrentStock, i.CurrentStock) AS CurrentStock,
        ISNULL(bi.ReorderLevel, i.ReorderLevel) AS ReorderLevel,
        ISNULL(bi.AverageCost, i.AverageCost)   AS AverageCost,
        i.IsActive
    FROM dbo.Ingredients i
    LEFT JOIN dbo.BranchInventory bi ON bi.IngredientId = i.IngredientId AND bi.BranchId = @CentralId
    WHERE (@Search IS NULL OR i.IngredientCode LIKE '%' + @Search + '%' OR i.IngredientName LIKE N'%' + @Search + N'%')
      AND (@Group  IS NULL OR i.CategoryGroup = @Group)
    ORDER BY i.IngredientId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveIngredient
    @IngredientId   INT = NULL,
    @IngredientCode VARCHAR(20),
    @IngredientName NVARCHAR(100),
    @CategoryGroup  NVARCHAR(50),
    @Unit           NVARCHAR(20),
    @CurrentStock   DECIMAL(12,3),
    @ReorderLevel   DECIMAL(12,3),
    @AverageCost    DECIMAL(18,2),
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);

    IF @IngredientId IS NULL OR @IngredientId <= 0
    BEGIN
        INSERT INTO dbo.Ingredients (IngredientCode, IngredientName, CategoryGroup, Unit, CurrentStock, ReorderLevel, AverageCost, IsActive)
        VALUES (@IngredientCode, @IngredientName, @CategoryGroup, @Unit, @CurrentStock, @ReorderLevel, @AverageCost, @IsActive);
        SET @IngredientId = SCOPE_IDENTITY();
    END
    ELSE
    BEGIN
        UPDATE dbo.Ingredients
        SET IngredientCode = @IngredientCode,
            IngredientName = @IngredientName,
            CategoryGroup  = @CategoryGroup,
            Unit           = @Unit,
            CurrentStock   = @CurrentStock,
            ReorderLevel   = @ReorderLevel,
            AverageCost    = @AverageCost,
            IsActive       = @IsActive
        WHERE IngredientId = @IngredientId;
    END

    IF @CentralId IS NOT NULL
    BEGIN
        MERGE dbo.BranchInventory AS tgt
        USING (SELECT @CentralId AS BranchId, @IngredientId AS IngredientId) AS src
        ON tgt.BranchId = src.BranchId AND tgt.IngredientId = src.IngredientId
        WHEN MATCHED THEN
            UPDATE SET CurrentStock = @CurrentStock, ReorderLevel = @ReorderLevel, AverageCost = @AverageCost, UpdatedAt = SYSDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (BranchId, IngredientId, CurrentStock, ReorderLevel, AverageCost)
            VALUES (@CentralId, @IngredientId, @CurrentStock, @ReorderLevel, @AverageCost);
    END
    SELECT @IngredientId AS IngredientId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetStockTransfers
    @BranchId INT = NULL,
    @Status   VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        t.TransferId,
        t.TransferCode,
        bf.BranchName AS FromBranchName,
        bt.BranchName AS ToBranchName,
        t.ToBranchId,
        t.TransferType,
        t.[Status],
        t.Notes,
        t.CreatedAt,
        (SELECT COUNT(*) FROM dbo.StockTransferItems ti WHERE ti.TransferId = t.TransferId) AS ItemCount,
        (SELECT TOP 1 i.IngredientName + N' (' + CAST(CAST(ti.RequestedQty AS INT) AS NVARCHAR) + N' ' + i.Unit + N')'
         FROM dbo.StockTransferItems ti JOIN dbo.Ingredients i ON i.IngredientId = ti.IngredientId
         WHERE ti.TransferId = t.TransferId) AS SummaryItem
    FROM dbo.StockTransfers t
    JOIN dbo.Branches bf ON bf.BranchId = t.FromBranchId
    JOIN dbo.Branches bt ON bt.BranchId = t.ToBranchId
    WHERE (@BranchId IS NULL OR t.ToBranchId = @BranchId OR t.FromBranchId = @BranchId)
      AND (@Status IS NULL OR t.[Status] = @Status)
    ORDER BY t.TransferId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_ApproveTransfer
    @TransferId INT,
    @ApprovedBy INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;
    DECLARE @FromBranchId INT, @CurStatus VARCHAR(20);
    SELECT @FromBranchId = FromBranchId, @CurStatus = [Status] FROM dbo.StockTransfers WHERE TransferId = @TransferId;

    IF @CurStatus <> 'Requested'
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Chỉ được duyệt phiếu đang ở trạng thái Chờ duyệt.', 16, 1);
        RETURN;
    END

    UPDATE ti SET ApprovedQty = ti.RequestedQty
    FROM dbo.StockTransferItems ti WHERE ti.TransferId = @TransferId;

    -- Trừ tồn kho Kho Tổng
    UPDATE bi
    SET bi.CurrentStock = CASE WHEN bi.CurrentStock >= ti.RequestedQty THEN bi.CurrentStock - ti.RequestedQty ELSE 0 END,
        bi.UpdatedAt = SYSDATETIME()
    FROM dbo.BranchInventory bi
    JOIN dbo.StockTransferItems ti ON ti.IngredientId = bi.IngredientId
    WHERE ti.TransferId = @TransferId AND bi.BranchId = @FromBranchId;

    UPDATE dbo.StockTransfers SET [Status] = 'Approved', ApprovedBy = @ApprovedBy, UpdatedAt = SYSDATETIME()
    WHERE TransferId = @TransferId;
    COMMIT TRAN;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_RejectTransfer
    @TransferId INT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.StockTransfers SET [Status] = 'Rejected', UpdatedAt = SYSDATETIME()
    WHERE TransferId = @TransferId AND [Status] = 'Requested';
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetPeriodicRules
AS
BEGIN
    SET NOCOUNT ON;
    SELECT r.RuleId, r.BranchId, b.BranchName, r.IngredientId, i.IngredientName, i.Unit,
           r.SupplyCycle, r.DefaultQty, r.NextSupplyDate, r.IsActive
    FROM dbo.PeriodicSupplyRules r
    JOIN dbo.Branches b ON b.BranchId = r.BranchId
    JOIN dbo.Ingredients i ON i.IngredientId = r.IngredientId
    ORDER BY r.RuleId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SavePeriodicRule
    @RuleId         INT = NULL,
    @BranchId       INT,
    @IngredientId   INT,
    @SupplyCycle    VARCHAR(20),
    @DefaultQty     DECIMAL(12,3),
    @NextSupplyDate DATE,
    @IsActive       BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @RuleId IS NULL OR @RuleId <= 0
    BEGIN
        INSERT INTO dbo.PeriodicSupplyRules (BranchId, IngredientId, SupplyCycle, DefaultQty, NextSupplyDate, IsActive)
        VALUES (@BranchId, @IngredientId, @SupplyCycle, @DefaultQty, @NextSupplyDate, @IsActive);
        SELECT SCOPE_IDENTITY() AS RuleId;
    END
    ELSE
    BEGIN
        UPDATE dbo.PeriodicSupplyRules
        SET BranchId = @BranchId, IngredientId = @IngredientId, SupplyCycle = @SupplyCycle,
            DefaultQty = @DefaultQty, NextSupplyDate = @NextSupplyDate, IsActive = @IsActive
        WHERE RuleId = @RuleId;
        SELECT @RuleId AS RuleId;
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetInventoryTransactions
    @BranchId INT = NULL,
    @TxType   VARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT t.TransactionId, ISNULL(b.BranchName, N'Kho Tổng') AS BranchName,
           i.IngredientCode, i.IngredientName, i.Unit,
           t.TransactionType, t.Quantity, t.BalanceAfter, t.Notes, t.CreatedAt
    FROM dbo.InventoryTransactions t
    JOIN dbo.Ingredients i ON i.IngredientId = t.IngredientId
    LEFT JOIN dbo.Branches b ON b.BranchId = t.BranchId
    WHERE (@BranchId IS NULL OR t.BranchId = @BranchId)
      AND (@TxType IS NULL OR t.TransactionType = @TxType)
    ORDER BY t.TransactionId DESC;
END;
GO

-- =======================================================================================
-- STORED PROCEDURES: MENU 4 (CHI NHÁNH)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetBranchInventory
    @BranchId INT,
    @Search   NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        i.IngredientId,
        i.IngredientCode,
        i.IngredientName,
        i.CategoryGroup,
        i.Unit,
        ISNULL(bi.CurrentStock, 0) AS CurrentStock,
        ISNULL(bi.ReorderLevel, i.ReorderLevel) AS ReorderLevel,
        ISNULL(bi.AverageCost, i.AverageCost) AS AverageCost,
        CASE
            WHEN ISNULL(bi.CurrentStock, 0) <= 0 THEN 'out_of_stock'
            WHEN ISNULL(bi.CurrentStock, 0) <= ISNULL(bi.ReorderLevel, i.ReorderLevel) THEN 'low_stock'
            ELSE 'in_stock'
        END AS [Status]
    FROM dbo.Ingredients i
    LEFT JOIN dbo.BranchInventory bi ON bi.IngredientId = i.IngredientId AND bi.BranchId = @BranchId
    WHERE i.IsActive = 1
      AND (@Search IS NULL OR i.IngredientCode LIKE '%' + @Search + '%' OR i.IngredientName LIKE N'%' + @Search + N'%')
    ORDER BY i.IngredientId ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_CreateExtraTransferRequest
    @ToBranchId   INT,
    @IngredientId INT,
    @RequestedQty DECIMAL(12,3),
    @Notes        NVARCHAR(255) = NULL,
    @CreatedBy    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;
    DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);
    DECLARE @Code VARCHAR(30) = 'REQ-' + FORMAT(SYSDATETIME(), 'yyMMddHHmmss');

    INSERT INTO dbo.StockTransfers (TransferCode, FromBranchId, ToBranchId, TransferType, [Status], Notes, CreatedBy)
    VALUES (@Code, @CentralId, @ToBranchId, 'ExtraRequest', 'Requested', @Notes, @CreatedBy);

    DECLARE @TransferId INT = SCOPE_IDENTITY();
    INSERT INTO dbo.StockTransferItems (TransferId, IngredientId, RequestedQty)
    VALUES (@TransferId, @IngredientId, @RequestedQty);

    COMMIT TRAN;
    SELECT @TransferId AS TransferId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_ConfirmTransferReceived
    @TransferId INT,
    @UserId     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRAN;
    DECLARE @ToBranchId INT, @CurStatus VARCHAR(20);
    SELECT @ToBranchId = ToBranchId, @CurStatus = [Status] FROM dbo.StockTransfers WHERE TransferId = @TransferId;

    IF @CurStatus <> 'Approved'
    BEGIN
        ROLLBACK TRAN;
        RAISERROR(N'Chỉ xác nhận nhận hàng cho phiếu đã được Kho Tổng duyệt xuất.', 16, 1);
        RETURN;
    END

    UPDATE ti SET ReceivedQty = ti.ApprovedQty
    FROM dbo.StockTransferItems ti WHERE ti.TransferId = @TransferId;

    MERGE dbo.BranchInventory AS tgt
    USING (
        SELECT @ToBranchId AS BranchId, ti.IngredientId, ti.ApprovedQty AS Qty
        FROM dbo.StockTransferItems ti WHERE ti.TransferId = @TransferId
    ) AS src
    ON tgt.BranchId = src.BranchId AND tgt.IngredientId = src.IngredientId
    WHEN MATCHED THEN
        UPDATE SET CurrentStock = tgt.CurrentStock + src.Qty, UpdatedAt = SYSDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (BranchId, IngredientId, CurrentStock, ReorderLevel)
        VALUES (src.BranchId, src.IngredientId, src.Qty, 0);

    UPDATE dbo.StockTransfers SET [Status] = 'Received', UpdatedAt = SYSDATETIME() WHERE TransferId = @TransferId;
    COMMIT TRAN;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetProductRecipes
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        r.RecipeId,
        r.VariantId,
        p.ProductCode,
        p.ProductName,
        pv.SizeName,
        r.IngredientId,
        i.IngredientName,
        i.Unit,
        r.Quantity
    FROM dbo.ProductRecipes r
    JOIN dbo.ProductVariants pv ON pv.VariantId = r.VariantId
    JOIN dbo.Products p ON p.ProductId = pv.ProductId
    JOIN dbo.Ingredients i ON i.IngredientId = r.IngredientId
    WHERE (@Search IS NULL OR p.ProductName LIKE N'%' + @Search + N'%' OR i.IngredientName LIKE N'%' + @Search + N'%')
    ORDER BY p.ProductId, pv.VariantId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveProductRecipe
    @RecipeId     INT = NULL,
    @VariantId    INT,
    @IngredientId INT,
    @Quantity     DECIMAL(12,3)
AS
BEGIN
    SET NOCOUNT ON;
    IF @RecipeId IS NULL OR @RecipeId <= 0
    BEGIN
        INSERT INTO dbo.ProductRecipes (VariantId, IngredientId, Quantity)
        VALUES (@VariantId, @IngredientId, @Quantity);
        SELECT SCOPE_IDENTITY() AS RecipeId;
    END
    ELSE
    BEGIN
        UPDATE dbo.ProductRecipes SET VariantId = @VariantId, IngredientId = @IngredientId, Quantity = @Quantity
        WHERE RecipeId = @RecipeId;
        SELECT @RecipeId AS RecipeId;
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_DeleteProductRecipe
    @RecipeId INT
AS
BEGIN
    SET NOCOUNT ON;
    DELETE FROM dbo.ProductRecipes WHERE RecipeId = @RecipeId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetBranchDeliverySettings
    @BranchId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        b.BranchId,
        b.BranchName,
        ISNULL(d.IsDeliveryEnabled, 1) AS IsDeliveryEnabled,
        ISNULL(d.MaxRadiusKm, 5) AS MaxRadiusKm,
        ISNULL(d.BaseShippingFee, 15000) AS BaseShippingFee,
        ISNULL(d.FeePerKm, 5000) AS FeePerKm,
        ISNULL(d.FreeShipMinOrder, 150000) AS FreeShipMinOrder,
        ISNULL(d.SupportedAreas, N'') AS SupportedAreas
    FROM dbo.Branches b
    LEFT JOIN dbo.BranchDeliverySettings d ON d.BranchId = b.BranchId
    WHERE b.IsCentralWarehouse = 0
      AND (@BranchId IS NULL OR b.BranchId = @BranchId)
    ORDER BY b.BranchId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveBranchDeliverySettings
    @BranchId          INT,
    @IsDeliveryEnabled BIT,
    @MaxRadiusKm       DECIMAL(5,2),
    @BaseShippingFee   DECIMAL(18,2),
    @FeePerKm          DECIMAL(18,2),
    @FreeShipMinOrder  DECIMAL(18,2),
    @SupportedAreas    NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    MERGE dbo.BranchDeliverySettings AS tgt
    USING (SELECT @BranchId AS BranchId) AS src ON tgt.BranchId = src.BranchId
    WHEN MATCHED THEN
        UPDATE SET IsDeliveryEnabled = @IsDeliveryEnabled, MaxRadiusKm = @MaxRadiusKm,
                   BaseShippingFee = @BaseShippingFee, FeePerKm = @FeePerKm,
                   FreeShipMinOrder = @FreeShipMinOrder, SupportedAreas = @SupportedAreas, UpdatedAt = SYSDATETIME()
    WHEN NOT MATCHED THEN
        INSERT (BranchId, IsDeliveryEnabled, MaxRadiusKm, BaseShippingFee, FeePerKm, FreeShipMinOrder, SupportedAreas)
        VALUES (@BranchId, @IsDeliveryEnabled, @MaxRadiusKm, @BaseShippingFee, @FeePerKm, @FreeShipMinOrder, @SupportedAreas);
END;
GO

-- =======================================================================================
-- STORED PROCEDURES: MENU 5 (NHẬP HÀNG & NCC)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetSuppliers
    @Search NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT * FROM dbo.Suppliers
    WHERE (@Search IS NULL OR SupplierCode LIKE '%' + @Search + '%' OR SupplierName LIKE N'%' + @Search + N'%')
    ORDER BY SupplierId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SaveSupplier
    @SupplierId    INT = NULL,
    @SupplierCode  VARCHAR(20),
    @SupplierName  NVARCHAR(150),
    @CategoryGroup NVARCHAR(50) = NULL,
    @ContactPerson NVARCHAR(100) = NULL,
    @Phone         VARCHAR(20) = NULL,
    @Email         VARCHAR(100) = NULL,
    @Address       NVARCHAR(255) = NULL,
    @CurrentDebt   DECIMAL(18,2) = 0,
    @IsActive      BIT = 1
AS
BEGIN
    SET NOCOUNT ON;
    IF @SupplierId IS NULL OR @SupplierId <= 0
    BEGIN
        INSERT INTO dbo.Suppliers (SupplierCode, SupplierName, CategoryGroup, ContactPerson, Phone, Email, [Address], CurrentDebt, IsActive)
        VALUES (@SupplierCode, @SupplierName, @CategoryGroup, @ContactPerson, @Phone, @Email, @Address, @CurrentDebt, @IsActive);
        SELECT SCOPE_IDENTITY() AS SupplierId;
    END
    ELSE
    BEGIN
        UPDATE dbo.Suppliers
        SET SupplierCode = @SupplierCode, SupplierName = @SupplierName, CategoryGroup = @CategoryGroup,
            ContactPerson = @ContactPerson, Phone = @Phone, Email = @Email, [Address] = @Address,
            CurrentDebt = @CurrentDebt, IsActive = @IsActive
        WHERE SupplierId = @SupplierId;
        SELECT @SupplierId AS SupplierId;
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_DeleteSupplier
    @SupplierId INT
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM dbo.PurchaseOrders WHERE SupplierId = @SupplierId)
    BEGIN
        RAISERROR(N'Nhà cung cấp đã có phiếu nhập hàng, chỉ được tắt trạng thái hoạt động.', 16, 1);
        RETURN;
    END
    DELETE FROM dbo.Suppliers WHERE SupplierId = @SupplierId;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetPurchaseOrders
    @Search NVARCHAR(100) = NULL,
    @Status VARCHAR(20)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        po.PoId,
        po.PoCode,
        po.SupplierId,
        s.SupplierName,
        po.BranchId,
        b.BranchName,
        po.[Status],
        po.PaymentStatus,
        po.TotalAmount,
        po.PaidAmount,
        po.Notes,
        po.CreatedAt,
        po.ReceivedAt
    FROM dbo.PurchaseOrders po
    JOIN dbo.Suppliers s ON s.SupplierId = po.SupplierId
    JOIN dbo.Branches b ON b.BranchId = po.BranchId
    WHERE (@Search IS NULL OR po.PoCode LIKE '%' + @Search + '%' OR s.SupplierName LIKE N'%' + @Search + N'%')
      AND (@Status IS NULL OR po.[Status] = @Status)
    ORDER BY po.PoId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_SavePurchaseOrder
    @PoId          INT = NULL,
    @PoCode        VARCHAR(30),
    @SupplierId    INT,
    @Status        VARCHAR(20),
    @PaymentStatus VARCHAR(20),
    @TotalAmount   DECIMAL(18,2),
    @PaidAmount    DECIMAL(18,2),
    @Notes         NVARCHAR(255) = NULL,
    @CreatedBy     INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @CentralId INT = (SELECT TOP 1 BranchId FROM dbo.Branches WHERE IsCentralWarehouse = 1);

    IF @PoId IS NULL OR @PoId <= 0
    BEGIN
        INSERT INTO dbo.PurchaseOrders (PoCode, SupplierId, BranchId, [Status], PaymentStatus, TotalAmount, PaidAmount, Notes, CreatedBy, ReceivedAt)
        VALUES (@PoCode, @SupplierId, @CentralId, @Status, @PaymentStatus, @TotalAmount, @PaidAmount, @Notes, @CreatedBy,
                CASE WHEN @Status = 'Received' THEN SYSDATETIME() ELSE NULL END);
        SELECT SCOPE_IDENTITY() AS PoId;
    END
    ELSE
    BEGIN
        UPDATE dbo.PurchaseOrders
        SET PoCode = @PoCode, SupplierId = @SupplierId, [Status] = @Status, PaymentStatus = @PaymentStatus,
            TotalAmount = @TotalAmount, PaidAmount = @PaidAmount, Notes = @Notes,
            ReceivedAt = CASE WHEN @Status = 'Received' AND ReceivedAt IS NULL THEN SYSDATETIME() ELSE ReceivedAt END
        WHERE PoId = @PoId;
        SELECT @PoId AS PoId;
    END
END;
GO

-- =======================================================================================
-- STORED PROCEDURES: MENU 6 (GIÁM SÁT ĐƠN & TRẢ MÓN)
-- =======================================================================================
CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetLiveOrders
    @Search      NVARCHAR(100) = NULL,
    @OrderStatus VARCHAR(30)   = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP 100
        o.OrderId,
        o.OrderCode,
        ISNULL(u.FullName, N'Khách lẻ') AS CustomerName,
        u.PhoneNumber,
        o.OrderType,
        o.OrderStatus,
        o.PaymentStatus,
        o.TotalAmount,
        o.CancelReason,
        o.CreatedAt,
        o.UpdatedAt
    FROM dbo.Orders o
    LEFT JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
    LEFT JOIN dbo.Users u ON u.UserId = c.UserId
    WHERE (@Search IS NULL OR o.OrderCode LIKE '%' + @Search + '%' OR u.FullName LIKE N'%' + @Search + N'%')
      AND (@OrderStatus IS NULL OR o.OrderStatus = @OrderStatus)
    ORDER BY o.UpdatedAt DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_GetDisposalReviews
    @Status VARCHAR(30) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        r.ReviewId,
        r.OrderId,
        o.OrderCode,
        o.TotalAmount,
        o.CancelReason,
        r.ReviewStatus,
        r.SituationType,
        r.ManagerDecisionNotes,
        r.ReviewedAt
    FROM dbo.InventoryDisposalReviews r
    JOIN dbo.Orders o ON o.OrderId = r.OrderId
    WHERE (@Status IS NULL OR r.ReviewStatus = @Status)
    ORDER BY r.ReviewId DESC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_ERP_ApproveDisposalReview
    @ReviewId             INT,
    @SituationType        VARCHAR(50),
    @ManagerDecisionNotes NVARCHAR(500),
    @ReviewedBy           INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.InventoryDisposalReviews
    SET ReviewStatus = 'Reviewed',
        SituationType = @SituationType,
        ManagerDecisionNotes = @ManagerDecisionNotes,
        ReviewedBy = @ReviewedBy,
        ReviewedAt = SYSDATETIME()
    WHERE ReviewId = @ReviewId;
END;
GO

-- =======================================================================================
-- STORED PROCEDURES: MENU 7 (BÁO CÁO DOANH THU)
-- =======================================================================================
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
    WHERE OrderStatus <> 'Cancelled' AND YEAR(CreatedAt) = @Year
    GROUP BY MONTH(CreatedAt)
    ORDER BY [Month];
END;
GO

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
    WHERE o.OrderStatus <> 'Cancelled' AND YEAR(o.CreatedAt) = @Year
    GROUP BY p.ProductCode, p.ProductName, c.CategoryName
    ORDER BY TotalRevenue DESC;
END;
GO
