USE CoffeeShopDB;
GO

SET NOCOUNT ON;
GO

PRINT N'=======================================================================================';
PRINT N'BẮT ĐẦU KIỂM THỬ: QUY TRÌNH DUYỆT TUẦN TỰ (CẤP 1 DUYỆT -> CHỜ CẤP 2 DUYỆT -> HOÀN TẤT)';
PRINT N'=======================================================================================';

DECLARE @NewReqId BIGINT;
DECLARE @NewReqCode VARCHAR(30);

-- BƯỚC 1: Nhân viên NV023 (Huỳnh Quốc Khoa) nộp đơn xin đổi ca (SHIFT_SWAP: Quy trình 2 cấp)
EXEC dbo.sp_Approval_SubmitRequest 
    @WorkflowCode = 'SHIFT_SWAP',
    @RequesterId = 23, -- NV023 (Người nộp đơn từ bên dưới)
    @Title = N'Đơn xin đổi ca trực ngày 22/11/2026',
    @Reason = N'Bận lịch thi học kỳ, xin đổi từ ca sáng sang ca tối',
    @PayloadJson = '{"swapWithEmployeeId": 24, "targetShiftId": 105}',
    @NewRequestId = @NewReqId OUTPUT,
    @NewRequestCode = @NewReqCode OUTPUT;

PRINT N'---------------------------------------------------------------------------------------';
PRINT N'1. ĐƠN VỪA TẠO TỪ BÊN DƯỚI (Đang ở Cấp 1, Bước 1 pending, Bước 2 waiting):';
SELECT RequestId, RequestCode, WorkflowCode, CurrentLevel, TotalLevels, Status FROM dbo.ApprovalRequests WHERE RequestId = @NewReqId;
SELECT StepLevel, ApproverEmployeeId, Decision, DecidedAt FROM dbo.ApprovalSteps WHERE RequestId = @NewReqId ORDER BY StepLevel;

-- BƯỚC 2: Người có Cấp 1 (NV021 - Phạm Hải Dương) phê duyệt
PRINT N'---------------------------------------------------------------------------------------';
PRINT N'2. NGƯỜI CÓ CẤP 1 DUYỆT XONG (Đơn chuyển sang Cấp 2, trạng thái in_progress - PHẢI CHỜ CẤP CAO HƠN):';
EXEC dbo.sp_Approval_ProcessStep 
    @RequestId = @NewReqId,
    @ApproverEmployeeId = 21, -- NV021 (Người duyệt Cấp 1 tại Chi nhánh Q1)
    @Decision = 'approved',
    @Comment = N'Cấp 1 duyệt đồng ý: Ca trực hợp lệ, chuyển cấp trên phê duyệt lịch';

SELECT RequestId, RequestCode, CurrentLevel, TotalLevels, Status FROM dbo.ApprovalRequests WHERE RequestId = @NewReqId;
SELECT StepLevel, ApproverEmployeeId, Decision, Comment, DecidedAt FROM dbo.ApprovalSteps WHERE RequestId = @NewReqId ORDER BY StepLevel;

-- BƯỚC 3: Người có Cấp duyệt cao hơn (NV019 - Trần Bảo Vinh, Cấp 2) phê duyệt
PRINT N'---------------------------------------------------------------------------------------';
PRINT N'3. NGƯỜI CÓ CẤP DUYỆT CAO HƠN (CẤP 2) DUYỆT -> ĐƠN CHÍNH THỨC ĐƯỢC XÁC NHẬN (APPROVED)!';
EXEC dbo.sp_Approval_ProcessStep 
    @RequestId = @NewReqId,
    @ApproverEmployeeId = 19, -- NV019 (Người duyệt Cấp 2 tại Chi nhánh Q1)
    @Decision = 'approved',
    @Comment = N'Cấp 2 duyệt đồng ý: Đã điều chỉnh lịch trực chính thức trên hệ thống';

SELECT RequestId, RequestCode, CurrentLevel, TotalLevels, Status, CompletedAt FROM dbo.ApprovalRequests WHERE RequestId = @NewReqId;
SELECT StepLevel, ApproverEmployeeId, Decision, Comment, DecidedAt FROM dbo.ApprovalSteps WHERE RequestId = @NewReqId ORDER BY StepLevel;

PRINT N'=======================================================================================';
PRINT N'KIỂM THỬ THÀNH CÔNG 100%: ĐƠN TỪ ĐÃ ĐƯỢC XÁC NHẬN HOÀN TẤT QUA 2 CẤP DUYỆT TUẦN TỰ!';
PRINT N'=======================================================================================';
GO
