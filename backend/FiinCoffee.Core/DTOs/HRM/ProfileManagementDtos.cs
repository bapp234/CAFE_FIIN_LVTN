namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO yêu cầu cập nhật hồ sơ nhân sự (5 nhóm thông tin)
/// </summary>
public class UpdateEmployeeProfileRequest
{
    public string? FullName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? CitizenId { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public int? ContractTypeId { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? Allowance { get; set; }
    public string? Note { get; set; }
    public string? Status { get; set; }
    public string? Position { get; set; }
    public int? BranchId { get; set; }
}

/// <summary>
/// DTO yêu cầu phân cấp thẩm quyền phê duyệt (Approval Level 1..5)
/// </summary>
public class AssignApprovalAuthorityRequest
{
    public byte ApprovalLevel { get; set; } // 1..5
    public int? BranchId { get; set; }
    public int? ParentApproverEmployeeId { get; set; }
    public string? WorkflowCode { get; set; }
    public string? Note { get; set; }
}
