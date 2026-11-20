using FiinCoffee.Core.DTOs.HRM;

namespace FiinCoffee.Core.Interfaces;

public interface IContractExcelService
{
    void EnsureExportTemplate(string templatePath);
    byte[] GenerateImportTemplate(IEnumerable<ContractTypeSettingDto> contractTypes);
    Task<ContractImportPreviewResultDto> ParseAndValidateImportAsync(
        Stream fileStream,
        IDictionary<string, (int EmployeeId, string FullName)> employeeByCode,
        IDictionary<string, ContractTypeSettingDto> contractTypeByCode);
}
