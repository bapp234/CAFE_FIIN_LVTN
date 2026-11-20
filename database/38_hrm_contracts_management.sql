USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- RELEASE 38: QUẢN LÝ HỢP ĐỒNG LAO ĐỘNG & LUỒNG PHÊ DUYỆT ĐỀ XUẤT HỢP ĐỒNG
-- ============================================================================

-- 1. Bổ sung Permission HRM_CONTRACT vào dbo.Permissions và gán cho Admin, HRManager, Accountant, StoreManager
MERGE dbo.Permissions AS target
USING (VALUES
    ('HRM_CONTRACT', 'HRM', N'Nhân sự & Công', N'Quản lý Hợp đồng lao động', N'Xem, đề xuất ký mới/gia hạn/thanh lý và phê duyệt hợp đồng lao động', 18)
) AS src (PermissionCode, ModuleCode, ModuleName, PermissionName, Description, SortOrder)
ON target.PermissionCode = src.PermissionCode
WHEN MATCHED THEN
    UPDATE SET
        ModuleCode     = src.ModuleCode,
        ModuleName     = src.ModuleName,
        PermissionName = src.PermissionName,
        Description    = src.Description,
        SortOrder      = src.SortOrder
WHEN NOT MATCHED THEN
    INSERT (PermissionCode, ModuleCode, ModuleName, PermissionName, Description, SortOrder)
    VALUES (src.PermissionCode, src.ModuleCode, src.ModuleName, src.PermissionName, src.Description, src.SortOrder);
GO

DECLARE @PermContractId INT = (SELECT PermissionId FROM dbo.Permissions WHERE PermissionCode = 'HRM_CONTRACT');
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.RoleId, @PermContractId
FROM dbo.Roles r
WHERE r.RoleName IN (N'Admin', N'HRManager', N'Accountant', N'StoreManager')
  AND NOT EXISTS (
      SELECT 1 FROM dbo.RolePermissions rp
      WHERE rp.RoleId = r.RoleId AND rp.PermissionId = @PermContractId
  );
GO

-- 2. Bổ sung quy trình CONTRACT_CHANGE vào dbo.ApprovalDefinitions
MERGE dbo.ApprovalDefinitions AS target
USING (VALUES
    ('CONTRACT_CHANGE', N'Phê duyệt Ký mới / Gia hạn / Điều chỉnh / Thanh lý Hợp đồng', 1,
     N'Phê duyệt Nhân sự / Ban Giám đốc', NULL, NULL,
     N'Mọi đề xuất thay đổi hợp đồng từ Cửa hàng trưởng đều phải qua HRM hoặc Admin phê duyệt trước khi có hiệu lực.', 1)
) AS src (WorkflowCode, WorkflowName, TotalLevels, Level1_Title, Level2_Title, Level3_Title, Description, IsActive)
ON target.WorkflowCode = src.WorkflowCode
WHEN MATCHED THEN
    UPDATE SET
        WorkflowName = src.WorkflowName,
        TotalLevels  = src.TotalLevels,
        Level1_Title = src.Level1_Title,
        Description  = src.Description,
        IsActive     = src.IsActive
WHEN NOT MATCHED THEN
    INSERT (WorkflowCode, WorkflowName, TotalLevels, Level1_Title, Level2_Title, Level3_Title, Description, IsActive)
    VALUES (src.WorkflowCode, src.WorkflowName, src.TotalLevels, src.Level1_Title, src.Level2_Title, src.Level3_Title, src.Description, src.IsActive);
GO

-- 3. Mở rộng bảng dbo.EmployeeContracts cho luồng đề xuất & phê duyệt
IF COL_LENGTH('dbo.EmployeeContracts', 'RequestedByEmployeeId') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD RequestedByEmployeeId INT NULL;
IF COL_LENGTH('dbo.EmployeeContracts', 'ApprovedByEmployeeId') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD ApprovedByEmployeeId INT NULL;
IF COL_LENGTH('dbo.EmployeeContracts', 'ApprovedAt') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD ApprovedAt DATETIME2 NULL;
IF COL_LENGTH('dbo.EmployeeContracts', 'ApprovalRequestId') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD ApprovalRequestId BIGINT NULL;
IF COL_LENGTH('dbo.EmployeeContracts', 'ActionType') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD ActionType VARCHAR(20) NULL;
IF COL_LENGTH('dbo.EmployeeContracts', 'TargetContractId') IS NULL
    ALTER TABLE dbo.EmployeeContracts ADD TargetContractId INT NULL;
GO

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_EmployeeContracts_Status')
    ALTER TABLE dbo.EmployeeContracts DROP CONSTRAINT CK_EmployeeContracts_Status;
GO
ALTER TABLE dbo.EmployeeContracts
ADD CONSTRAINT CK_EmployeeContracts_Status
CHECK (Status IN ('pending', 'active', 'expired', 'terminated', 'rejected'));
GO

-- 4. Seed hợp đồng ban đầu cho các nhân viên hiện có (nếu bảng EmployeeContracts đang trống)
IF NOT EXISTS (SELECT 1 FROM dbo.EmployeeContracts)
BEGIN
    DECLARE @Today DATE = CAST(GETDATE() AS DATE);

    INSERT INTO dbo.EmployeeContracts (
        ContractCode, EmployeeId, ContractTypeId, Position,
        HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note, ActionType, CreatedAt, UpdatedAt
    )
    SELECT
        'HD-' + e.EmployeeCode + '-01' AS ContractCode,
        e.EmployeeId,
        ISNULL(e.ContractTypeId, 3) AS ContractTypeId,
        ISNULL(NULLIF(LTRIM(RTRIM(e.Position)), ''), N'Nhân viên') AS Position,
        ISNULL(e.HourlyRate, ct.StandardHourlyRate) AS HourlyRate,
        ISNULL(ct.Allowance, 0) AS Allowance,
        CASE
            -- Tạo vài hợp đồng sắp hết hạn trong 10..25 ngày tới để kiểm thử Tab "Đến hạn ký hợp đồng"
            WHEN e.EmployeeId % 4 = 0 AND ct.DurationMonths IS NOT NULL
                THEN DATEADD(MONTH, -ct.DurationMonths, DATEADD(DAY, 12 + (e.EmployeeId % 15), @Today))
            ELSE ISNULL(e.HireDate, DATEADD(MONTH, -6, @Today))
        END AS StartDate,
        CASE
            WHEN e.EmployeeId % 4 = 0 AND ct.DurationMonths IS NOT NULL
                THEN DATEADD(DAY, 12 + (e.EmployeeId % 15), @Today)
            WHEN ct.DurationMonths IS NOT NULL
                THEN DATEADD(MONTH, ct.DurationMonths, ISNULL(e.HireDate, DATEADD(MONTH, -6, @Today)))
            ELSE NULL
        END AS EndDate,
        'active' AS Status,
        ISNULL(e.HireDate, DATEADD(MONTH, -6, @Today)) AS SignDate,
        N'Khởi tạo hợp đồng lao động hiện hành từ hồ sơ nhân sự' AS Note,
        'new' AS ActionType,
        SYSDATETIME(),
        SYSDATETIME()
    FROM dbo.Employees e
    LEFT JOIN dbo.ContractTypes ct ON ct.ContractTypeId = ISNULL(e.ContractTypeId, 3)
    WHERE e.Status <> 'resigned';

    PRINT N'-> Đã seed hợp đồng hiện hành ban đầu cho nhân viên.';
END
GO

-- 5. Stored Procedure: Lấy danh sách hợp đồng theo 3 tab (current | expiring | history)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetContracts
    @TabMode        VARCHAR(20)   = 'current', -- 'current' | 'expiring' | 'history'
    @BranchId       INT           = NULL,
    @EmployeeId     INT           = NULL,
    @ContractTypeId INT           = NULL,
    @Status         VARCHAR(20)   = NULL,
    @ExpiringDays   INT           = 30,
    @Search         NVARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), N'');
    IF @ExpiringDays IS NULL OR @ExpiringDays < 1 SET @ExpiringDays = 30;

    SELECT
        ec.ContractId,
        ec.ContractCode,
        ec.EmployeeId,
        e.EmployeeCode,
        ISNULL(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName) AS FullName,
        e.BranchId,
        b.BranchName,
        ec.ContractTypeId,
        ct.ContractCode AS ContractTypeCode,
        ct.ContractName,
        ec.Position,
        ec.HourlyRate,
        ec.Allowance,
        ec.StartDate,
        ec.EndDate,
        ec.SignDate,
        ec.Status,
        ec.ActionType,
        ec.Note,
        ec.RequestedByEmployeeId,
        ISNULL(reqEmp.FullName, reqUser.FullName) AS RequestedByName,
        ec.ApprovedByEmployeeId,
        ISNULL(appEmp.FullName, appUser.FullName) AS ApprovedByName,
        ec.ApprovedAt,
        ec.ApprovalRequestId,
        ec.CreatedAt,
        CASE
            WHEN ec.EndDate IS NOT NULL THEN DATEDIFF(DAY, @Today, ec.EndDate)
            ELSE NULL
        END AS DaysRemaining
    FROM dbo.EmployeeContracts ec
    INNER JOIN dbo.Employees e ON ec.EmployeeId = e.EmployeeId
    LEFT JOIN dbo.Users u ON e.UserId = u.UserId
    LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
    LEFT JOIN dbo.ContractTypes ct ON ec.ContractTypeId = ct.ContractTypeId
    LEFT JOIN dbo.Employees reqEmp ON ec.RequestedByEmployeeId = reqEmp.EmployeeId
    LEFT JOIN dbo.Users reqUser ON reqEmp.UserId = reqUser.UserId
    LEFT JOIN dbo.Employees appEmp ON ec.ApprovedByEmployeeId = appEmp.EmployeeId
    LEFT JOIN dbo.Users appUser ON appEmp.UserId = appUser.UserId
    WHERE (@BranchId IS NULL OR @BranchId <= 0 OR e.BranchId = @BranchId)
      AND (@EmployeeId IS NULL OR @EmployeeId <= 0 OR ec.EmployeeId = @EmployeeId)
      AND (@ContractTypeId IS NULL OR @ContractTypeId <= 0 OR ec.ContractTypeId = @ContractTypeId)
      AND (@Status IS NULL OR @Status = 'all' OR ec.Status = @Status)
      AND (
          @Search IS NULL
          OR ec.ContractCode LIKE N'%' + @Search + N'%'
          OR e.EmployeeCode LIKE N'%' + @Search + N'%'
          OR ISNULL(e.FullName, u.FullName) LIKE N'%' + @Search + N'%'
          OR ec.Position LIKE N'%' + @Search + N'%'
          OR ct.ContractName LIKE N'%' + @Search + N'%'
      )
      AND (
          (@TabMode = 'current' AND ec.Status IN ('pending', 'active'))
          OR (@TabMode = 'expiring' AND ec.Status = 'active' AND ec.EndDate IS NOT NULL AND ec.EndDate <= DATEADD(DAY, @ExpiringDays, @Today))
          OR (@TabMode = 'history')
      )
    ORDER BY
        CASE WHEN ec.Status = 'pending' THEN 0 WHEN ec.Status = 'active' THEN 1 ELSE 2 END,
        CASE WHEN @TabMode = 'expiring' THEN ec.EndDate END ASC,
        ec.CreatedAt DESC,
        ec.ContractId DESC;
END;
GO

-- 6. Stored Procedure: Thống kê 4 thẻ KPI Hợp đồng
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetContractSummary
    @BranchId     INT = NULL,
    @ExpiringDays INT = 30
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @Today DATE = CAST(GETDATE() AS DATE);
    IF @ExpiringDays IS NULL OR @ExpiringDays < 1 SET @ExpiringDays = 30;

    SELECT
        COUNT(CASE WHEN ec.Status = 'active' THEN 1 END) AS ActiveCount,
        COUNT(CASE WHEN ec.Status = 'active' AND ec.EndDate IS NOT NULL AND ec.EndDate <= DATEADD(DAY, @ExpiringDays, @Today) THEN 1 END) AS ExpiringSoonCount,
        COUNT(CASE WHEN ec.Status = 'pending' THEN 1 END) AS PendingApprovalCount,
        COUNT(CASE WHEN ec.Status IN ('expired', 'terminated') THEN 1 END) AS ClosedCount
    FROM dbo.EmployeeContracts ec
    INNER JOIN dbo.Employees e ON ec.EmployeeId = e.EmployeeId
    WHERE (@BranchId IS NULL OR @BranchId <= 0 OR e.BranchId = @BranchId);
END;
GO

-- 7. Stored Procedure: Tạo / Gia hạn / Điều chỉnh / Đề xuất thanh lý hợp đồng (Có kiểm tra cấp duyệt)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_SubmitContractChange
    @EmployeeId            INT,
    @ContractTypeId        INT,
    @Position              NVARCHAR(100),
    @HourlyRate            DECIMAL(18,2),
    @Allowance             DECIMAL(18,2) = 0,
    @StartDate             DATE,
    @EndDate               DATE          = NULL,
    @ActionType            VARCHAR(20)   = 'renew', -- 'new' | 'renew' | 'adjust' | 'terminate'
    @TargetContractId      INT           = NULL,
    @Note                  NVARCHAR(500) = NULL,
    @ActorEmployeeId       INT           = NULL,
    @ActorHierarchyLevel   TINYINT       = 1,
    @AutoApproveIfAllowed  BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EmpCode VARCHAR(20);
        DECLARE @EmpBranchId INT;
        SELECT @EmpCode = EmployeeCode, @EmpBranchId = BranchId
        FROM dbo.Employees WHERE EmployeeId = @EmployeeId;

        IF @EmpCode IS NULL
            THROW 52001, N'Không tìm thấy nhân viên trong hệ thống.', 1;

        -- Tự động tính EndDate theo DurationMonths nếu không phải terminate và người dùng bỏ trống EndDate
        IF @ActionType <> 'terminate' AND @EndDate IS NULL
        BEGIN
            DECLARE @Months INT = (SELECT DurationMonths FROM dbo.ContractTypes WHERE ContractTypeId = @ContractTypeId);
            IF @Months IS NOT NULL AND @Months > 0
                SET @EndDate = DATEADD(MONTH, @Months, @StartDate);
        END

        -- Đảm bảo EndDate >= StartDate
        IF @EndDate IS NOT NULL AND @EndDate < @StartDate
            SET @EndDate = @StartDate;

        DECLARE @CanDirectApply BIT = CASE WHEN @ActorHierarchyLevel >= 4 AND @AutoApproveIfAllowed = 1 THEN 1 ELSE 0 END;

        -- Sinh mã hợp đồng mới: HD-<MaNV>-XX
        DECLARE @NextNum INT = (SELECT COUNT(*) + 1 FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId);
        DECLARE @NewCode VARCHAR(30) = 'HD-' + @EmpCode + '-' + RIGHT('00' + CAST(@NextNum AS VARCHAR(5)), 2);

        -- Tạo phiếu phê duyệt trong dbo.ApprovalRequests nếu có ActorEmployeeId hợp lệ
        DECLARE @ApprovalReqId BIGINT = NULL;
        DECLARE @ReqCode VARCHAR(30) = NULL;
        IF @ActorEmployeeId IS NOT NULL AND EXISTS (SELECT 1 FROM dbo.Employees WHERE EmployeeId = @ActorEmployeeId)
        BEGIN
            EXEC dbo.sp_Sys_GenerateDocumentCode @Prefix = 'REQ', @GeneratedCode = @ReqCode OUTPUT;
            INSERT INTO dbo.ApprovalRequests (
                RequestCode, WorkflowCode, RequesterId, BranchId,
                ReferenceTable, ReferenceId, Title, Reason,
                TotalLevels, CurrentLevel, Status, CompletedAt
            )
            VALUES (
                @ReqCode, 'CONTRACT_CHANGE', @ActorEmployeeId, ISNULL(@EmpBranchId, 1),
                'EmployeeContracts', @NewCode,
                N'Đề xuất ' + CASE @ActionType WHEN 'terminate' THEN N'thanh lý' WHEN 'adjust' THEN N'điều chỉnh' WHEN 'new' THEN N'ký mới' ELSE N'gia hạn' END + N' HĐ: ' + @EmpCode,
                ISNULL(@Note, N'Đề xuất thay đổi hợp đồng lao động'),
                1, 1,
                CASE WHEN @CanDirectApply = 1 THEN 'approved' ELSE 'pending' END,
                CASE WHEN @CanDirectApply = 1 THEN SYSDATETIME() ELSE NULL END
            );
            SET @ApprovalReqId = SCOPE_IDENTITY();
        END

        IF @CanDirectApply = 1
        BEGIN
            IF @ActionType = 'terminate'
            BEGIN
                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    EndDate = CASE WHEN @EndDate IS NOT NULL THEN @EndDate ELSE CAST(GETDATE() AS DATE) END,
                    Note = ISNULL(@Note, Note),
                    ApprovedByEmployeeId = @ActorEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId AND Status = 'active';

                SELECT TOP 1 ContractId, ContractCode, Status
                FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId ORDER BY UpdatedAt DESC;
            END
            ELSE
            BEGIN
                UPDATE dbo.EmployeeContracts
                SET Status = 'expired',
                    EndDate = CASE WHEN EndDate IS NULL OR EndDate >= @StartDate THEN DATEADD(DAY, -1, @StartDate) ELSE EndDate END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId AND Status = 'active';

                INSERT INTO dbo.EmployeeContracts (
                    ContractCode, EmployeeId, ContractTypeId, Position,
                    HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                    RequestedByEmployeeId, ApprovedByEmployeeId, ApprovedAt, ApprovalRequestId, ActionType, TargetContractId,
                    CreatedAt, UpdatedAt
                )
                VALUES (
                    @NewCode, @EmployeeId, @ContractTypeId, @Position,
                    @HourlyRate, @Allowance, @StartDate, @EndDate, 'active', @StartDate, @Note,
                    @ActorEmployeeId, @ActorEmployeeId, SYSDATETIME(), @ApprovalReqId, @ActionType, @TargetContractId,
                    SYSDATETIME(), SYSDATETIME()
                );

                DECLARE @InsertedId INT = SCOPE_IDENTITY();

                UPDATE dbo.Employees
                SET Position = @Position,
                    ContractTypeId = @ContractTypeId,
                    HourlyRate = @HourlyRate,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId;

                SELECT @InsertedId AS ContractId, @NewCode AS ContractCode, 'active' AS Status;
            END
        END
        ELSE
        BEGIN
            -- Cấp dưới (vd: StoreManager Cấp 3) -> tạo bản ghi chờ duyệt 'pending', chưa đụng vào HĐ đang active
            INSERT INTO dbo.EmployeeContracts (
                ContractCode, EmployeeId, ContractTypeId, Position,
                HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                RequestedByEmployeeId, ApprovalRequestId, ActionType, TargetContractId,
                CreatedAt, UpdatedAt
            )
            VALUES (
                @NewCode, @EmployeeId, @ContractTypeId, @Position,
                @HourlyRate, @Allowance, @StartDate, @EndDate, 'pending', @StartDate, @Note,
                @ActorEmployeeId, @ApprovalReqId, @ActionType, @TargetContractId,
                SYSDATETIME(), SYSDATETIME()
            );

            SELECT SCOPE_IDENTITY() AS ContractId, @NewCode AS ContractCode, 'pending' AS Status;
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 8. Stored Procedure: Duyệt hoặc Từ chối đề xuất hợp đồng (Chỉ HRM Cấp 4 / Admin Cấp 5)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessContractApproval
    @ContractId           INT,
    @Decision             VARCHAR(20), -- 'approved' | 'rejected'
    @ApproverEmployeeId   INT     = NULL,
    @ApproverLevel        TINYINT = 4,
    @Note                 NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @ApproverLevel < 4
        THROW 52002, N'Chỉ Trưởng phòng Nhân sự (Cấp 4) hoặc Quản trị viên (Cấp 5) mới có quyền phê duyệt hợp đồng.', 1;

    IF @Decision NOT IN ('approved', 'rejected')
        THROW 52003, N'Quyết định phê duyệt không hợp lệ.', 1;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EmpId INT, @TypeId INT, @Pos NVARCHAR(100), @Rate DECIMAL(18,2),
                @StartDate DATE, @EndDate DATE, @Status VARCHAR(20), @ActionType VARCHAR(20),
                @ReqId BIGINT, @TargetId INT;

        SELECT
            @EmpId = EmployeeId,
            @TypeId = ContractTypeId,
            @Pos = Position,
            @Rate = HourlyRate,
            @StartDate = StartDate,
            @EndDate = EndDate,
            @Status = Status,
            @ActionType = ISNULL(ActionType, 'renew'),
            @ReqId = ApprovalRequestId,
            @TargetId = TargetContractId
        FROM dbo.EmployeeContracts
        WHERE ContractId = @ContractId;

        IF @EmpId IS NULL
            THROW 52004, N'Không tìm thấy đề xuất hợp đồng.', 1;

        IF @Status <> 'pending'
            THROW 52005, N'Hợp đồng này không ở trạng thái chờ duyệt.', 1;

        IF @Decision = 'rejected'
        BEGIN
            UPDATE dbo.EmployeeContracts
            SET Status = 'rejected',
                ApprovedByEmployeeId = @ApproverEmployeeId,
                ApprovedAt = SYSDATETIME(),
                Note = CASE WHEN @Note IS NOT NULL THEN ISNULL(Note + N' | Từ chối: ', N'') + @Note ELSE Note END,
                UpdatedAt = SYSDATETIME()
            WHERE ContractId = @ContractId;

            IF @ReqId IS NOT NULL
                UPDATE dbo.ApprovalRequests SET Status = 'rejected', CompletedAt = SYSDATETIME() WHERE RequestId = @ReqId;
        END
        ELSE
        BEGIN
            IF @ActionType = 'terminate'
            BEGIN
                -- Thanh lý hợp đồng đang active của nhân viên
                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    EndDate = ISNULL(@EndDate, CAST(GETDATE() AS DATE)),
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId AND Status = 'active'
                  AND (@TargetId IS NULL OR ContractId = @TargetId);

                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE ContractId = @ContractId;
            END
            ELSE
            BEGIN
                -- Đóng hợp đồng active cũ -> expired
                UPDATE dbo.EmployeeContracts
                SET Status = 'expired',
                    EndDate = CASE WHEN EndDate IS NULL OR EndDate >= @StartDate THEN DATEADD(DAY, -1, @StartDate) ELSE EndDate END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId AND Status = 'active' AND ContractId <> @ContractId;

                -- Kích hoạt hợp đồng mới
                UPDATE dbo.EmployeeContracts
                SET Status = 'active',
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE ContractId = @ContractId;

                -- Đồng bộ chức vụ, loại HĐ và lương giờ sang dbo.Employees
                UPDATE dbo.Employees
                SET Position = @Pos,
                    ContractTypeId = @TypeId,
                    HourlyRate = @Rate,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId;
            END

            IF @ReqId IS NOT NULL
                UPDATE dbo.ApprovalRequests SET Status = 'approved', CompletedAt = SYSDATETIME() WHERE RequestId = @ReqId;
        END

        COMMIT TRANSACTION;
        SELECT 1 AS Success;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH;
END;
GO

-- 9. Stored Procedures CRUD Danh mục Loại Hợp Đồng (Tab 4)
CREATE OR ALTER PROCEDURE dbo.sp_HRM_GetContractTypes
AS
BEGIN
    SET NOCOUNT ON;
    SELECT
        ContractTypeId,
        ContractCode,
        ContractName,
        ISNULL(StandardHourlyRate, 0) AS StandardHourlyRate,
        ISNULL(Allowance, 0) AS Allowance,
        ISNULL(SalaryPercentage, 100) AS SalaryPercentage,
        DurationMonths,
        ISNULL(BenefitsDescription, N'') AS BenefitsDescription,
        ISNULL(IsActive, 1) AS IsActive
    FROM dbo.ContractTypes
    ORDER BY ContractTypeId ASC;
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_SaveContractType
    @ContractTypeId      INT           = NULL,
    @ContractCode        VARCHAR(30),
    @ContractName        NVARCHAR(100),
    @StandardHourlyRate  DECIMAL(18,2),
    @Allowance           DECIMAL(18,2) = 0,
    @SalaryPercentage    DECIMAL(5,2)  = 100,
    @DurationMonths      INT           = NULL,
    @BenefitsDescription NVARCHAR(500) = NULL,
    @IsActive            BIT           = 1
AS
BEGIN
    SET NOCOUNT ON;

    IF @ContractTypeId IS NULL OR @ContractTypeId <= 0
    BEGIN
        INSERT INTO dbo.ContractTypes (
            ContractCode, ContractName, StandardHourlyRate, Allowance,
            SalaryPercentage, DurationMonths, BenefitsDescription, IsActive
        )
        VALUES (
            UPPER(LTRIM(RTRIM(@ContractCode))), LTRIM(RTRIM(@ContractName)), @StandardHourlyRate, @Allowance,
            @SalaryPercentage, @DurationMonths, @BenefitsDescription, @IsActive
        );
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS ContractTypeId;
    END
    ELSE
    BEGIN
        UPDATE dbo.ContractTypes
        SET ContractCode        = UPPER(LTRIM(RTRIM(@ContractCode))),
            ContractName        = LTRIM(RTRIM(@ContractName)),
            StandardHourlyRate  = @StandardHourlyRate,
            Allowance           = @Allowance,
            SalaryPercentage    = @SalaryPercentage,
            DurationMonths      = @DurationMonths,
            BenefitsDescription = @BenefitsDescription,
            IsActive            = @IsActive
        WHERE ContractTypeId = @ContractTypeId;
        SELECT @ContractTypeId AS ContractTypeId;
    END
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_DeleteContractType
    @ContractTypeId INT
AS
BEGIN
    SET NOCOUNT ON;

    IF EXISTS (SELECT 1 FROM dbo.EmployeeContracts WHERE ContractTypeId = @ContractTypeId)
        OR EXISTS (SELECT 1 FROM dbo.Employees WHERE ContractTypeId = @ContractTypeId)
    BEGIN
        UPDATE dbo.ContractTypes SET IsActive = 0 WHERE ContractTypeId = @ContractTypeId;
        SELECT 1 AS Success, N'Loại hợp đồng đang được sử dụng nên đã chuyển sang trạng thái Ngưng áp dụng.' AS Message;
    END
    ELSE
    BEGIN
        DELETE FROM dbo.ContractTypes WHERE ContractTypeId = @ContractTypeId;
        SELECT 1 AS Success, N'Đã xóa loại hợp đồng thành công.' AS Message;
    END
END;
GO

PRINT N'-> Đã triển khai hoàn tất Release 38 (Quản lý Hợp đồng & Phê duyệt đề xuất).';
GO
