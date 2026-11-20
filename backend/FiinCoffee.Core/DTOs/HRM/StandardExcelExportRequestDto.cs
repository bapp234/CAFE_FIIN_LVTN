using System.Text.Json;

namespace FiinCoffee.Core.DTOs.HRM;

public class StandardExcelExportRequestDto
{
    public string TemplateKey { get; set; } = string.Empty;
    public string SheetName { get; set; } = "Dữ liệu";
    public string ReportTitle { get; set; } = string.Empty;
    public string SummaryLabel { get; set; } = "Tổng số bản ghi:";
    public string FileName { get; set; } = "Fiin_Export.xlsx";
    public List<string> Headers { get; set; } = new();
    public List<Dictionary<string, JsonElement>> Rows { get; set; } = new();
}
