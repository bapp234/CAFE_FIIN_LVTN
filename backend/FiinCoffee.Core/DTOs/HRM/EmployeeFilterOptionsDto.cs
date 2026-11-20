namespace FiinCoffee.Core.DTOs.HRM;

public record ComboOptionDto(string Value, string Label);

public class EmployeeFilterOptionsDto
{
    public List<ComboOptionDto> Branches { get; set; } = [];
    public List<ComboOptionDto> Positions { get; set; } = [];
    public List<ComboOptionDto> Statuses { get; set; } = [];
    public List<ComboOptionDto> ContractTypes { get; set; } = [];
}
