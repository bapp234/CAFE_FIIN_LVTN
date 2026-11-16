namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO danh mục loại hợp đồng lao động & phúc lợi
/// </summary>
public class ContractTypeDto
{
    public int ContractTypeId { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public decimal? StandardHourlyRate { get; set; }
    public decimal? Allowance { get; set; }
    public decimal? SalaryPercentage { get; set; }
    public int? DurationMonths { get; set; }
    public string? BenefitsDescription { get; set; }
    public bool IsActive { get; set; }
}
