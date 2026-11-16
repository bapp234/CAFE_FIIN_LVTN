namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO đầy đủ 5 nhóm thông tin hồ sơ nhân sự (Lý lịch, Ngân hàng, Hợp đồng, Thẩm quyền, Ghi chú)
/// Ánh xạ từ Stored Procedure dbo.sp_HRM_GetEmployeeFullProfile
/// </summary>
public class EmployeeFullProfileDto
{
    // 1. Định danh & Lý lịch
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? CitizenId { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime HireDate { get; set; }
    public string? Note { get; set; }

    // 2. Tài khoản Ngân hàng
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }

    // Chi nhánh công tác
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string Position { get; set; } = string.Empty;

    // 3. Hợp đồng lao động & Đãi ngộ
    public int? ContractTypeId { get; set; }
    public string? ContractCode { get; set; }
    public string? ContractName { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? Allowance { get; set; }
    public string? BenefitsDescription { get; set; }

    // 4. Phân cấp thẩm quyền & Quy trình phê duyệt
    public int? UserId { get; set; }
    public string? Username { get; set; }
    public int? RoleId { get; set; }
    public string? RoleName { get; set; }
    public int HierarchyLevel { get; set; }
    public int? ApprovalLevel { get; set; }
    public string? DirectManagerName { get; set; }
    public string? DirectManagerCode { get; set; }
    public string? AllowedWorkflowsJson { get; set; }
}
