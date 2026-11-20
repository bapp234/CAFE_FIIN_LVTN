using System.Data;
namespace FiinCoffee.Core.Interfaces;

/// <summary>
/// Giao diện bộ máy xuất Excel động theo Template và Cấu hình ParadiseHR.
/// </summary>
public interface IExcelExportEngine
{
    Task<byte[]> ExportFromTemplateAsync(string templatePath, DataSet dataSet);
}