USE CoffeeShopDB;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

-- ============================================================================
-- 1. SỬA LỖI CK_EmployeeContracts_Dates + CHẶN ĐỀ XUẤT TRÙNG + ĐỒNG BỘ NGHỈ VIỆC
--    TRONG dbo.sp_HRM_SubmitContractChange VÀ dbo.sp_HRM_ProcessContractApproval
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

        -- Ràng buộc: không cho gửi thêm đề xuất nếu nhân sự đang có 1 đề xuất chờ duyệt
        IF EXISTS (SELECT 1 FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId AND Status = 'pending')
            THROW 52002, N'Nhân sự này đang có một đề xuất hợp đồng chờ duyệt. Vui lòng duyệt hoặc từ chối đề xuất cũ trước.', 1;

        -- Tự động tính EndDate theo DurationMonths nếu không phải terminate và người dùng bỏ trống EndDate
        IF @ActionType <> 'terminate' AND @EndDate IS NULL
        BEGIN
            DECLARE @Months INT = (SELECT DurationMonths FROM dbo.ContractTypes WHERE ContractTypeId = @ContractTypeId);
            IF @Months IS NOT NULL AND @Months > 0
                SET @EndDate = DATEADD(MONTH, @Months, @StartDate);
        END

        -- Đảm bảo EndDate >= StartDate cho hợp đồng mới
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
                    EndDate = CASE
                        WHEN ISNULL(@EndDate, CAST(GETDATE() AS DATE)) >= StartDate
                            THEN ISNULL(@EndDate, CAST(GETDATE() AS DATE))
                        ELSE StartDate
                    END,
                    Note = ISNULL(@Note, Note),
                    ApprovedByEmployeeId = @ActorEmployeeId,
                    ApprovedAt = SYSDATETIME(),
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId AND Status = 'active';

                -- Đồng bộ trạng thái nghỉ việc cho nhân viên khi thanh lý hợp đồng
                UPDATE dbo.Employees
                SET Status = 'resigned',
                    UpdatedAt = SYSDATETIME()
                WHERE EmployeeId = @EmployeeId;

                SELECT TOP 1 ContractId, ContractCode, Status
                FROM dbo.EmployeeContracts WHERE EmployeeId = @EmployeeId ORDER BY UpdatedAt DESC;
            END
            ELSE
            BEGIN
                -- Đóng hợp đồng active cũ an toàn (luôn đảm bảo EndDate >= StartDate tránh lỗi CK_EmployeeContracts_Dates)
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
                UPDATE dbo.EmployeeContracts
                SET Status = 'terminated',
                    EndDate = CASE
                        WHEN ISNULL(@EndDate, CAST(GETDATE() AS DATE)) >= StartDate
                            THEN ISNULL(@EndDate, CAST(GETDATE() AS DATE))
                        ELSE StartDate
                    END,
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

                UPDATE dbo.Employees
                SET Status = 'resigned',
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

-- ============================================================================
-- 2. THỦ TỤC ĐIỀU CHỈNH CHẤM CÔNG THỦ CÔNG CÓ KIỂM SOÁT KHÓA KỲ & AUDIT TRAIL
-- ============================================================================
CREATE OR ALTER PROCEDURE dbo.sp_HRM_AdjustAttendanceByEmployeeDate
    @EmployeeId     INT,
    @WorkDate       DATE,
    @CheckInTime    DATETIME2(0),
    @CheckOutTime   DATETIME2(0),
    @AdjustedBy     NVARCHAR(100),
    @AdjustedReason NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    IF @AdjustedReason IS NULL OR LTRIM(RTRIM(@AdjustedReason)) = N''
        THROW 52011, N'Lý do điều chỉnh chấm công là bắt buộc để đảm bảo tính minh bạch kiểm toán.', 1;

    IF @CheckOutTime < @CheckInTime
        THROW 52012, N'Giờ ra phải lớn hơn hoặc bằng giờ vào.', 1;

    DECLARE @BranchId INT = (SELECT BranchId FROM dbo.Employees WHERE EmployeeId = @EmployeeId);
    IF @BranchId IS NULL
        THROW 52013, N'Không tìm thấy nhân viên cần điều chỉnh công.', 1;

    DECLARE @PeriodMonth CHAR(7) = FORMAT(@WorkDate, 'yyyy-MM');
    IF EXISTS (
        SELECT 1
        FROM dbo.AttendancePeriods
        WHERE BranchId = @BranchId
          AND PeriodMonth = @PeriodMonth
          AND IsLocked = 1
    )
    BEGIN
        THROW 52010, N'Kỳ công tháng này đã bị khóa, không thể điều chỉnh giờ công thủ công.', 1;
    END

    DECLARE @WorkHrs DECIMAL(4,2) = dbo.fn_HRM_CalculateWorkHours(@CheckInTime, @CheckOutTime, 15);
    DECLARE @ExistingId INT = (
        SELECT TOP 1 AttendanceId
        FROM dbo.Attendances
        WHERE EmployeeId = @EmployeeId AND WorkDate = @WorkDate
    );

    IF @ExistingId IS NOT NULL
    BEGIN
        UPDATE dbo.Attendances
        SET CheckInTime = @CheckInTime,
            CheckOutTime = @CheckOutTime,
            WorkHours = @WorkHrs,
            LateMinutes = 0,
            EarlyLeaveMinutes = 0,
            Status = 'on_time',
            IsManualAdjusted = 1,
            AdjustedBy = @AdjustedBy,
            AdjustedReason = @AdjustedReason,
            AdjustedAt = SYSDATETIME()
        WHERE AttendanceId = @ExistingId;
    END
    ELSE
    BEGIN
        INSERT INTO dbo.Attendances (
            EmployeeId, WorkDate, CheckInTime, CheckOutTime,
            WorkHours, LateMinutes, EarlyLeaveMinutes, Status,
            IsManualAdjusted, AdjustedBy, AdjustedReason, AdjustedAt
        )
        VALUES (
            @EmployeeId, @WorkDate, @CheckInTime, @CheckOutTime,
            @WorkHrs, 0, 0, 'on_time',
            1, @AdjustedBy, @AdjustedReason, SYSDATETIME()
        );
    END

    SELECT 1 AS Success, @WorkHrs AS WorkHours;
END;
GO
PRINT N'-> Đã cập nhật sp_HRM_SubmitContractChange, sp_HRM_ProcessContractApproval và sp_HRM_AdjustAttendanceByEmployeeDate.';
GO
