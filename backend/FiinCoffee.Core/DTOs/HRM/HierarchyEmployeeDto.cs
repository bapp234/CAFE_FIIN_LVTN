namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO nhân sự phân cấp phả hệ dùng cho Combobox tra cứu và Danh sách nhân sự
/// Ánh xạ từ Stored Procedure dbo.sp_HRM_GetEmployeesByHierarchy
/// </summary>
public class HierarchyEmployeeDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string Status { get; set; } = string.Empty;
    public int HierarchyLevel { get; set; }
    public string? RoleName { get; set; }
    public string? RoleDescription { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? CitizenId { get; set; }
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public DateTime HireDate { get; set; }
    public string? AvatarInitial { get; set; }
    public int TotalCount { get; set; }
}
