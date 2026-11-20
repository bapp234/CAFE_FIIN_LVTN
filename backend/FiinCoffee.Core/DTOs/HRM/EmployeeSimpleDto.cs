namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO thông tin nhân viên cơ bản tinh gọn ánh xạ từ Stored Procedure dbo.sp_HRM_GetEmployees_Simple
/// </summary>
public class EmployeeSimpleDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? CitizenId { get; set; }
    public string Position { get; set; } = string.Empty;
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string? ContractName { get; set; }
    public string EmployeeStatus { get; set; } = string.Empty;
    public DateTime HireDate { get; set; }
    public decimal? HourlyRate { get; set; }
    public bool HasAccount { get; set; }
    public int? UserId { get; set; }
    public string? Username { get; set; }
    public string? RoleName { get; set; }
    public byte HierarchyLevel { get; set; }
    public bool IsUserActive { get; set; }
    public bool MustChangePassword { get; set; }
    public int TotalCount { get; set; }
}
