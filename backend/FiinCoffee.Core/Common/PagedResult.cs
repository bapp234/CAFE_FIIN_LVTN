namespace FiinCoffee.Core.Common;

/// <summary>
/// Cấu trúc phân trang chuẩn, đồng bộ trực tiếp với kiểu Page&lt;T&gt; phía Angular Admin
/// </summary>
/// <typeparam name="T">Kiểu dữ liệu phần tử</typeparam>
public class PagedResult<T>
{
    public IReadOnlyList<T> Items { get; set; } = [];
    public int Total { get; set; }
    public int Page { get; set; }
    public int Size { get; set; }
    public int TotalPages => Size > 0 ? (int)Math.Ceiling((double)Total / Size) : 0;

    public PagedResult() { }

    public PagedResult(IReadOnlyList<T> items, int total, int page, int size)
    {
        Items = items;
        Total = total;
        Page = page;
        Size = size;
    }
}
