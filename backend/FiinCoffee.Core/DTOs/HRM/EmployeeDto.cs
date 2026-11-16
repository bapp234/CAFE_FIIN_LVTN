namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO thông tin chi tiết hồ sơ nhân sự (ánh xạ từ View v_EmployeeDetails)
/// </summary>
public class EmployeeDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? CitizenId { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string Position { get; set; } = string.Empty;
    public int? ContractTypeId { get; set; }
    public string? ContractCode { get; set; }
    public string? ContractName { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? Allowance { get; set; }
    public string? BenefitsDescription { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime HireDate { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? Note { get; set; }
    public DateTime UpdatedAt { get; set; }
}
