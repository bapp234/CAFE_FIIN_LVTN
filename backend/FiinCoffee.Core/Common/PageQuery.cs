namespace FiinCoffee.Core.Common;

/// <summary>
/// DTO truy vấn phân trang, tìm kiếm và sắp xếp dùng chung cho các API
/// </summary>
public class PageQuery
{
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
    public string? Keyword { get; set; }
    public string? SortBy { get; set; }
    public string? SortOrder { get; set; } = "asc"; // "asc" | "desc"
}
