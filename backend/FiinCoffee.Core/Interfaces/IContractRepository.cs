using System.Data;
using FiinCoffee.Core.DTOs.HRM;

namespace FiinCoffee.Core.Interfaces;

public interface IContractRepository
{
    Task<IEnumerable<ContractItemDto>> GetContractsAsync(
        string tabMode = "current",
        int? branchId = null,
        int? employeeId = null,
        int? contractTypeId = null,
        string? status = null,
        int expiringDays = 30,
        string? search = null);

    Task<ContractSummaryDto> GetSummaryAsync(int? branchId = null, int expiringDays = 30);

    Task<ContractWordDetailDto?> GetContractWordDetailAsync(int contractId);

    Task<DataSet> GetContractsExportDataSetAsync(
        string tabMode = "current",
        int? branchId = null,
        int? employeeId = null,
        int? contractTypeId = null,
        string? status = null,
        int expiringDays = 30,
        string? search = null);

    Task<Dictionary<string, (int EmployeeId, string FullName)>> GetActiveEmployeeLookupAsync(int? scopedBranchId = null);

    Task<SubmitContractChangeResultDto> SubmitContractChangeAsync(
        SubmitContractChangeRequestDto request,
        int? actorEmployeeId,
        byte actorHierarchyLevel);

    Task<bool> ProcessApprovalAsync(
        int contractId,
        string decision,
        int? approverEmployeeId,
        byte approverLevel,
        string? note);

    Task<IEnumerable<ContractTypeSettingDto>> GetContractTypesAsync();
    Task<int> SaveContractTypeAsync(SaveContractTypeRequestDto request);
    Task<(bool Success, string Message)> DeleteContractTypeAsync(int contractTypeId);
}
