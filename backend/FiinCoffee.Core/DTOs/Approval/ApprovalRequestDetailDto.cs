namespace FiinCoffee.Core.DTOs.Approval;

/// <summary>
/// DTO thông tin toàn diện về phiếu yêu cầu phê duyệt và tiến độ các cấp
/// </summary>
public class ApprovalRequestDetailDto
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
    public string? ReferenceTable { get; set; }
    public string? ReferenceId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public byte TotalLevels { get; set; }
    public byte CurrentLevel { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public List<ApprovalStepDto> Steps { get; set; } = [];
}
