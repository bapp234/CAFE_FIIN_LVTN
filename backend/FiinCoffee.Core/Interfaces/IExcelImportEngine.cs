using FiinCoffee.Core.DTOs.HRM;

namespace FiinCoffee.Core.Interfaces;

/// <summary>
/// Giao diện xử lý đọc, kiểm tra (Preview/Validate) và sinh file mẫu Excel nhập nhanh nhân sự
/// </summary>
public interface IExcelImportEngine
{
    /// <summary>
    /// Đọc stream file Excel, tự động map cột và kiểm tra tính hợp lệ của từng dòng (so khớp với danh sách CCCD đã có)
    /// </summary>
    Task<EmployeeImportPreviewResultDto> ParseAndValidateExcelAsync(Stream fileStream, HashSet<string> existingCitizenIds);

    /// <summary>
    /// Tạo file Excel mẫu (.xlsx) chuẩn hóa để người dùng tải về điền dữ liệu
    /// </summary>
    byte[] GenerateImportTemplate();
}
