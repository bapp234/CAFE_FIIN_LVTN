namespace FiinCoffee.Core.DTOs.Approval;

/// <summary>
/// DTO hàng đợi các yêu cầu đang chờ phê duyệt (ánh xạ từ View v_ApprovalPendingQueue)
/// </summary>
public class ApprovalPendingItemDto
{
    public long RequestId { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string WorkflowCode { get; set; } = string.Empty;
    public string WorkflowName { get; set; } = string.Empty;
    public int BranchId { get; set; }
    public string BranchCode { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public int RequesterId { get; set; }
    public string RequesterCode { get; set; } = string.Empty;
    public string RequesterName { get; set; } = string.Empty;
    public string RequesterPosition { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public byte TotalLevels { get; set; }
    public byte CurrentLevel { get; set; }
    public string RequestStatus { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public int WaitingHours { get; set; }
}
