using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.Approval;

/// <summary>
/// Yêu cầu nộp một phiếu phê duyệt mới
/// </summary>
public class SubmitApprovalRequest
{
    [Required(ErrorMessage = "Mã quy trình phê duyệt không được để trống")]
    [StringLength(50)]
    public string WorkflowCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "ID nhân viên nộp không được để trống")]
    public int RequesterId { get; set; }

    [Required(ErrorMessage = "Tiêu đề yêu cầu không được để trống")]
    [StringLength(200, MinimumLength = 5, ErrorMessage = "Tiêu đề từ 5 đến 200 ký tự")]
    public string Title { get; set; } = string.Empty;

    [Required(ErrorMessage = "Lý do nộp không được để trống")]
    [StringLength(500, MinimumLength = 5, ErrorMessage = "Lý do từ 5 đến 500 ký tự")]
    public string Reason { get; set; } = string.Empty;

    [StringLength(50)]
    public string? ReferenceTable { get; set; }

    [StringLength(50)]
    public string? ReferenceId { get; set; }

    public string? PayloadJson { get; set; }
}

/// <summary>
/// Kết quả trả về sau khi nộp phiếu yêu cầu thành công
/// </summary>
public class SubmitApprovalResultDto
{
    public long RequestId { get; set; }
    public string RequestCode { get; set; } = string.Empty;
    public string WorkflowCode { get; set; } = string.Empty;
    public string WorkflowName { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public byte TotalLevels { get; set; }
    public byte CurrentLevel { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
