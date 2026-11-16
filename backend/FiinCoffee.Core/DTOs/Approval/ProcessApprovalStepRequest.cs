using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.Approval;

/// <summary>
/// Yêu cầu xử lý phê duyệt (Duyệt hoặc Từ chối) một cấp trong quy trình
/// </summary>
public class ProcessApprovalStepRequest
{
    [Required(ErrorMessage = "ID nhân viên phê duyệt không được để trống")]
    public int ApproverEmployeeId { get; set; }

    [Required(ErrorMessage = "Quyết định không được để trống")]
    [RegularExpression(@"^(approved|rejected)$", ErrorMessage = "Quyết định chỉ chấp nhận 'approved' hoặc 'rejected'")]
    public string Decision { get; set; } = string.Empty;

    [StringLength(500, ErrorMessage = "Ghi chú không được vượt quá 500 ký tự")]
    public string? Comment { get; set; }
}

/// <summary>
/// Kết quả trả về sau khi thực hiện xử lý bước phê duyệt
/// </summary>
public class ProcessStepResultDto
{
    public long RequestId { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string WorkflowCode { get; set; } = string.Empty;
    public byte TotalLevels { get; set; }
    public byte CurrentLevel { get; set; }
    public string RequestStatus { get; set; } = string.Empty;
    public byte StepLevel { get; set; }
    public string StepDecision { get; set; } = string.Empty;
    public int? ApproverEmployeeId { get; set; }
    public string? Comment { get; set; }
    public DateTime? DecidedAt { get; set; }
}
