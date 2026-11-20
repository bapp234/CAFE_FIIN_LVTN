USE CoffeeShopDB;
GO

SET NOCOUNT ON;
SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. KHỞI TẠO 6 LOẠI HỢP ĐỒNG CHUẨN
-- ============================================================================
MERGE INTO dbo.ContractTypes AS target
USING (
    VALUES
        ('HD-THU-VIEC',     N'Hợp đồng Thử việc - Học việc',      25000,  300000,  85,  2,    N'Hưởng 85% mức lương chuẩn trong thời gian thử việc / học việc (2 tháng).', 1),
        ('HD-LAO-DONG',     N'Hợp đồng Lao động',                 30000,  500000,  100, 12,   N'Hợp đồng lao động tiêu chuẩn (12 tháng), hưởng 100% lương và phụ cấp ăn ca.', 1),
        ('HD-CO-THOI-HAN',  N'Hợp đồng Có thời hạn',              32000,  700000,  100, 12,   N'Hợp đồng xác định thời hạn (12 tháng), đầy đủ BHXH/BHYT theo quy định.', 1),
        ('HD-VO-THOI-HAN',  N'Hợp đồng Không thời hạn',           35000,  1000000, 100, NULL, N'Hợp đồng không xác định thời hạn, đầy đủ BHXH, phụ cấp thâm niên và thưởng KPI.', 1),
        ('HD-PART-TIME',    N'Hợp đồng Thời vụ - Part-time',      25000,  0,       100, 3,    N'Hợp đồng thời vụ / bán thời gian linh hoạt ca, tính lương theo giờ công thực tế.', 1),
        ('HD-THANH-LY',     N'Hợp đồng Thanh lý / Thôi việc',     0,      0,       100, NULL, N'Biên bản thanh lý hợp đồng được hệ thống tự động tạo khi thanh lý / thôi việc.', 1)
) AS src (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
ON target.ContractCode = src.ContractCode
WHEN MATCHED THEN
    UPDATE SET
        ContractName        = src.ContractName,
        StandardHourlyRate  = src.StandardHourlyRate,
        Allowance           = src.Allowance,
        SalaryPercentage    = src.SalaryPercentage,
        DurationMonths      = src.DurationMonths,
        BenefitsDescription = src.BenefitsDescription,
        IsActive            = src.IsActive
WHEN NOT MATCHED THEN
    INSERT (ContractCode, ContractName, StandardHourlyRate, Allowance, SalaryPercentage, DurationMonths, BenefitsDescription, IsActive)
    VALUES (src.ContractCode, src.ContractName, src.StandardHourlyRate, src.Allowance, src.SalaryPercentage, src.DurationMonths, src.BenefitsDescription, src.IsActive);
GO

-- ============================================================================
-- 2. CẬP NHẬT sp_HRM_SubmitContractChange & sp_HRM_ProcessContractApproval
--    KHI THANH LÝ ('terminate') -> TỰ ĐỘNG TẠO HỢP ĐỒNG 'HD-THANH-LY'
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_SubmitContractChange
    @ActionType            VARCHAR(20)   = 'renew', -- 'new' | 'renew' | 'adjust' | 'terminate'
    @TargetContractId      INT           = NULL,
    @EmployeeId            INT,
    @ContractTypeId        INT,
    @Position              NVARCHAR(100),
    @HourlyRate            DECIMAL(12,0),
    @Allowance             DECIMAL(12,0) = 0,
    @StartDate             DATE,
    @EndDate               DATE          = NULL,
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

        DECLARE @EmpBranchId INT, @EmpCode VARCHAR(20);
        SELECT @EmpBranchId = BranchId, @EmpCode = EmployeeCode
        FROM dbo.Employees
        WHERE EmployeeId = @EmployeeId;

        IF @EmpCode IS NULL
            THROW 52001, N'Không tìm thấy nhân viên trong hệ thống.', 1;

        IF EXISTS (SELECT 1 FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId AND Status = 'pending')
            THROW 52002, N'Nhân sự này đang có một đề xuất hợp đồng chờ duyệt. Vui lòng duyệt hoặc từ chối đề xuất cũ trước.', 1;

        -- Nếu là thanh lý, tự động dùng loại hợp đồng HD-THANH-LY
        DECLARE @EffectiveContractTypeId INT = @ContractTypeId;
        IF @ActionType = 'terminate'
        BEGIN
            DECLARE @TermTypeId INT = (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-THANH-LY');
            IF @TermTypeId IS NOT NULL
                SET @EffectiveContractTypeId = @TermTypeId;
            SET @HourlyRate = 0;
            SET @Allowance = 0;
            IF @EndDate IS NULL SET @EndDate = @StartDate;
        END
        ELSE IF @EndDate IS NULL
        BEGIN
            DECLARE @Months INT = (SELECT DurationMonths FROM dbo.ContractTypes WHERE ContractTypeId = @EffectiveContractTypeId);
            IF @Months IS NOT NULL AND @Months > 0
                SET @EndDate = DATEADD(MONTH, @Months, @StartDate);
        END

        IF @EndDate IS NOT NULL AND @EndDate < @StartDate
            SET @EndDate = @StartDate;

        DECLARE @CanDirectApply BIT = CASE WHEN @ActorHierarchyLevel >= 4 AND @AutoApproveIfAllowed = 1 THEN 1 ELSE 0 END;

        DECLARE @NextNum INT = (SELECT COUNT(*) + 1 FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId);
        DECLARE @NewCode VARCHAR(30) =
            CASE WHEN @ActionType = 'terminate'
                THEN 'TL-' + @EmpCode + '-' + RIGHT('00' + CAST(@NextNum AS VARCHAR(5)), 2)
                ELSE 'HD-' + @EmpCode + '-' + RIGHT('00' + CAST(@NextNum AS VARCHAR(5)), 2)
            END;

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
                DECLARE @TermDate DATE = ISNULL(@EndDate, CAST(GETDATE() AS DATE));

                -- 1. Đóng các hợp đồng active cũ
                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    EndDate = CASE WHEN @TermDate >= StartDate THEN @TermDate ELSE StartDate END,
                    ApprovedByEmployeeId = @ActorEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId AND Status = 'active';

                -- 2. Tự động tạo hợp đồng Thanh lý / Thôi việc (HD-THANH-LY)
                INSERT INTO dbo.EmployeeContracts (
                    ContractCode, EmployeeId, ContractTypeId, Position,
                    HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                    RequestedByEmployeeId, ApprovedByEmployeeId, ApprovedAt, ApprovalRequestId, ActionType, TargetContractId,
                    CreatedAt, UpdatedAt
                )
                VALUES (
                    @NewCode, @EmployeeId, @EffectiveContractTypeId, @Position,
                    0, 0, @TermDate, @TermDate, 'terminated', @TermDate,
                    ISNULL(@Note, N'Thanh lý hợp đồng / Thôi việc'),
                    @ActorEmployeeId, @ActorEmployeeId, SYSDATETIME(), @ApprovalReqId, 'terminate', @TargetContractId,
                    SYSDATETIME(), SYSDATETIME()
                );

                DECLARE @InsertedTermId INT = SCOPE_IDENTITY();

                -- 3. Đồng bộ nhân viên sang trạng thái nghỉ việc + loại HĐ Thanh lý
                UPDATE dbo.Employees
                SET Status = 'resigned',
                    ContractTypeId = @EffectiveContractTypeId,
                    HourlyRate = 0,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId;

                SELECT @InsertedTermId AS ContractId, @NewCode AS ContractCode, 'terminated' AS Status;
            END
            ELSE
            BEGIN
                UPDATE dbo.EmployeeContracts
                SET Status = 'expired',
                    EndDate = CASE
                        WHEN EndDate IS NULL OR EndDate >= @StartDate
                            THEN CASE WHEN DATEADD(DAY, -1, @StartDate) >= StartDate THEN DATEADD(DAY, -1, @StartDate) ELSE StartDate END
                        ELSE EndDate
                    END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId AND Status = 'active';

                INSERT INTO dbo.EmployeeContracts (
                    ContractCode, EmployeeId, ContractTypeId, Position,
                    HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                    RequestedByEmployeeId, ApprovedByEmployeeId, ApprovedAt, ApprovalRequestId, ActionType, TargetContractId,
                    CreatedAt, UpdatedAt
                )
                VALUES (
                    @NewCode, @EmployeeId, @EffectiveContractTypeId, @Position,
                    @HourlyRate, @Allowance, @StartDate, @EndDate, 'active', @StartDate, @Note,
                    @ActorEmployeeId, @ActorEmployeeId, SYSDATETIME(), @ApprovalReqId, @ActionType, @TargetContractId,
                    SYSDATETIME(), SYSDATETIME()
                );

                DECLARE @InsertedId INT = SCOPE_IDENTITY();

                UPDATE dbo.Employees
                SET Position = @Position,
                    ContractTypeId = @EffectiveContractTypeId,
                    HourlyRate = @HourlyRate,
                    Status = CASE WHEN @ActionType = 'new' THEN 'active' ELSE Status END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId;

                SELECT @InsertedId AS ContractId, @NewCode AS ContractCode, 'active' AS Status;
            END
        END
        ELSE
        BEGIN
            INSERT INTO dbo.EmployeeContracts (
                ContractCode, EmployeeId, ContractTypeId, Position,
                HourlyRate, Allowance, StartDate, EndDate, Status, SignDate, Note,
                RequestedByEmployeeId, ApprovalRequestId, ActionType, TargetContractId,
                CreatedAt, UpdatedAt
            )
            VALUES (
                @NewCode, @EmployeeId, @EffectiveContractTypeId, @Position,
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
    END CATCH
END;
GO

CREATE OR ALTER PROCEDURE dbo.sp_HRM_ProcessContractApproval
    @ContractId          INT,
    @Decision            VARCHAR(20), -- 'approved' | 'rejected'
    @ApproverEmployeeId  INT           = NULL,
    @Note                NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @EmpId INT, @TypeId INT, @Pos NVARCHAR(100), @Rate DECIMAL(12,0),
                @StartDate DATE, @EndDate DATE, @Status VARCHAR(20), @ActionType VARCHAR(20),
                @TargetId INT, @ReqId BIGINT;

        SELECT
            @EmpId = EmployeeId,
            @TypeId = ContractTypeId,
            @Pos = Position,
            @Rate = HourlyRate,
            @StartDate = StartDate,
            @EndDate = EndDate,
            @Status = Status,
            @ActionType = ISNULL(ActionType, 'renew'),
            @TargetId = TargetContractId,
            @ReqId = ApprovalRequestId
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
                DECLARE @TermDate DATE = ISNULL(@EndDate, CAST(GETDATE() AS DATE));
                DECLARE @TermTypeId INT = ISNULL(
                    (SELECT TOP 1 ContractTypeId FROM dbo.ContractTypes WHERE ContractCode = 'HD-THANH-LY'),
                    @TypeId
                );

                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    EndDate = CASE WHEN @TermDate >= StartDate THEN @TermDate ELSE StartDate END,
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId AND Status = 'active'
                  AND (@TargetId IS NULL OR ContractId = @TargetId);

                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    ContractTypeId = @TermTypeId,
                    HourlyRate = 0,
                    Allowance = 0,
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE ContractId = @ContractId;

                UPDATE dbo.Employees
                SET Status = 'resigned',
                    ContractTypeId = @TermTypeId,
                    HourlyRate = 0,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId;
            END
            ELSE
            BEGIN
                UPDATE dbo.EmployeeContracts
                SET Status = 'expired',
                    EndDate = CASE
                        WHEN EndDate IS NULL OR EndDate >= @StartDate
                            THEN CASE WHEN DATEADD(DAY, -1, @StartDate) >= StartDate THEN DATEADD(DAY, -1, @StartDate) ELSE StartDate END
                        ELSE EndDate
                    END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId AND Status = 'active' AND ContractId <> @ContractId;

                UPDATE dbo.EmployeeContracts
                SET Status = 'active',
                    ApprovedByEmployeeId = @ApproverEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE ContractId = @ContractId;

                UPDATE dbo.Employees
                SET Position = @Pos,
                    ContractTypeId = @TypeId,
                    HourlyRate = @Rate,
                    Status = CASE WHEN @ActionType = 'new' THEN 'active' ELSE Status END,
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmpId;
            END

            IF @ReqId IS NOT NULL
                UPDATE dbo.ApprovalRequests SET Status = 'approved', CompletedAt = SYSDATETIME() WHERE RequestId = @ReqId;
        END

        COMMIT TRANSACTION;
        SELECT ContractId, ContractCode, Status FROM dbo.EmployeeContracts WHERE ContractId = @ContractId;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
PRINT N'-> Đã tạo 6 loại hợp đồng chuẩn và tự động tạo HD-THANH-LY khi thanh lý.';
GO
