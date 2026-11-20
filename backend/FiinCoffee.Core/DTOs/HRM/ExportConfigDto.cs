namespace FiinCoffee.Core.DTOs.HRM;
/// <summary>
/// DTO ánh xạ bảng cấu hình xuất Excel từ Proc 
/// </summary>
public class ExportConfigDto
{
    public int Ord { get; set; }
    public string TableIndex { get; set; } = "0";
    public int SheetIndex { get; set; } = 0;
    public string ParseType { get; set; } = string.Empty;
    public string Position { get; set; } = "A1";
    public int WithHeader { get; set; } = 1;
    public bool WithBestFit { get; set; } = true;
    /// <summary>
    /// Ép chuỗi thiết lập bảng thành một Dictionary chứa các tham số để C# có thể kiểm tra
    /// </summary>
    public Dictionary<string, string> GetParameters()
    {
        var dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (string.IsNullOrWhiteSpace(ParseType)) return dict;
        var parts = ParseType.Split('|', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        foreach (var part in parts)
        {
            var kvp = part.Split('=', 2, StringSplitOptions.TrimEntries);
            if (kvp.Length == 2)
            {
                dict[kvp[0]] = kvp[1];
            }
            else if (kvp.Length == 1)
            {
                dict[kvp[0]] = "1";
            }
        }
        return dict;
    }
}