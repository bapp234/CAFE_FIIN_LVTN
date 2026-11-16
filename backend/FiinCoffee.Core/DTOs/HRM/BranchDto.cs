namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO thông tin chi nhánh cửa hàng
/// </summary>
public class BranchDto
{
    public int BranchId { get; set; }
    public string BranchCode { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? PhoneNumber { get; set; }
    public TimeSpan? OpeningTime { get; set; }
    public TimeSpan? ClosingTime { get; set; }
    public bool IsActive { get; set; }
}
