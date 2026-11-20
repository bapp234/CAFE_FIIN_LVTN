namespace FiinCoffee.Core.DTOs.HRM;
/// <summary>
/// Mô tả thuộc tính hiển thị của một động từ CSDL
/// </summary>
public class GridColumnDto
{
    public string Key { get; set; } = string.Empty;
    public string? Label { get; set; }
    public string? Type { get; set; }
    public string? Align { get; set; }
    public string? Width { get; set; }
    public string? MinWidth { get; set; }
    public bool Sortable { get; set; }
    public bool Mono { get; set; }
    public bool Bold { get; set; }
}
/// <summary>
/// Dữ liệu tổng thể trả về cho AdminGridTable
/// 
public class GridDatasetDto
{
    public IEnumerable<GridColumnDto> Columns { get; set; } = new List<GridColumnDto>();
    public IEnumerable<dynamic> Rows { get; set; } = new List<dynamic>();
    public int TotalCount { get; set; }
}