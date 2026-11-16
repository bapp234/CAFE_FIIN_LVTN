using FiinCoffee.Core.DTOs.Approval;

namespace FiinCoffee.Core.Interfaces;

/// <summary>
/// Giao diện kho dữ liệu Động cơ Phê duyệt Đa cấp (Approval Engine)
/// </summary>
public interface IApprovalRepository
{
    Task<IEnumerable<ApprovalPendingItemDto>> GetPendingQueueAsync(int? branchId = null);
    Task<ApprovalRequestDetailDto?> GetRequestDetailAsync(long requestId);
    Task<SubmitApprovalResultDto> SubmitRequestAsync(SubmitApprovalRequest request);
    Task<ProcessStepResultDto> ProcessStepAsync(long requestId, ProcessApprovalStepRequest request);
}
