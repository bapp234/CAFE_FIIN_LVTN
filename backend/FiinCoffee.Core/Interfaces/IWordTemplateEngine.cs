namespace FiinCoffee.Core.Interfaces;

public interface IWordTemplateEngine
{
    /// <summary>
    /// Đọc file Word (.docx) mẫu, thay thế các thẻ {{Key}} và trả về mảng byte của file .docx mới.
    /// </summary>
    Task<byte[]> RenderFromTemplateAsync(string templatePath, IDictionary<string, string> placeholders);

    /// <summary>
    /// Tự động tạo file Word mẫu Hợp đồng Lao động chuẩn tiếng Việt nếu chưa tồn tại.
    /// </summary>
    void EnsureDefaultContractTemplate(string templatePath);
}
