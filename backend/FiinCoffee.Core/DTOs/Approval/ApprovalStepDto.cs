namespace FiinCoffee.Core.DTOs.Approval;

/// <summary>
/// DTO chi tiết từng bước phê duyệt (Cấp 1, 2, 3)
/// </summary>
public class ApprovalStepDto
{
    public long StepId { get; set; }
    public long RequestId { get; set; }
    public byte StepLevel { get; set; }
    public int? ApproverId { get; set; }
    public int? ApproverEmployeeId { get; set; }
    public string? ApproverName { get; set; }
    public string? ApproverPosition { get; set; }
    public string Decision { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public DateTime? DecidedAt { get; set; }
}
