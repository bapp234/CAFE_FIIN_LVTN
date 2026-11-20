using System.Data;
using Dapper;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Infrastructure.Repositories;

public class ContractRepository : IContractRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ContractRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<ContractItemDto>> GetContractsAsync(
        string tabMode = "current",
        int? branchId = null,
        int? employeeId = null,
        int? contractTypeId = null,
        string? status = null,
        int expiringDays = 30,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@TabMode", string.IsNullOrWhiteSpace(tabMode) ? "current" : tabMode.Trim().ToLowerInvariant());
        p.Add("@BranchId", branchId <= 0 ? null : branchId);
        p.Add("@EmployeeId", employeeId <= 0 ? null : employeeId);
        p.Add("@ContractTypeId", contractTypeId <= 0 ? null : contractTypeId);
        p.Add("@Status", string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim().ToLowerInvariant());
        p.Add("@ExpiringDays", expiringDays <= 0 ? 30 : expiringDays);
        p.Add("@Search", string.IsNullOrWhiteSpace(search) ? null : search.Trim());

        return await connection.QueryAsync<ContractItemDto>(
            "dbo.sp_HRM_GetContracts",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<ContractSummaryDto> GetSummaryAsync(int? branchId = null, int expiringDays = 30)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@BranchId", branchId <= 0 ? null : branchId);
        p.Add("@ExpiringDays", expiringDays <= 0 ? 30 : expiringDays);

        return await connection.QuerySingleAsync<ContractSummaryDto>(
            "dbo.sp_HRM_GetContractSummary",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<ContractWordDetailDto?> GetContractWordDetailAsync(int contractId)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<ContractWordDetailDto>(
            "dbo.sp_HRM_GetContractWordDetail",
            new { ContractId = contractId },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<DataSet> GetContractsExportDataSetAsync(
        string tabMode = "current",
        int? branchId = null,
        int? employeeId = null,
        int? contractTypeId = null,
        string? status = null,
        int expiringDays = 30,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var dataSet = new DataSet();
        using var cmd = (SqlCommand)connection.CreateCommand();
        cmd.CommandText = "dbo.sp_HRM_GetContractsExportDataSet";
        cmd.CommandType = CommandType.StoredProcedure;

        cmd.Parameters.AddWithValue("@TabMode", string.IsNullOrWhiteSpace(tabMode) ? "current" : tabMode.Trim().ToLowerInvariant());
        cmd.Parameters.AddWithValue("@BranchId", (object?)(branchId <= 0 ? null : branchId) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@EmployeeId", (object?)(employeeId <= 0 ? null : employeeId) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ContractTypeId", (object?)(contractTypeId <= 0 ? null : contractTypeId) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@Status", (object?)(string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim().ToLowerInvariant()) ?? DBNull.Value);
        cmd.Parameters.AddWithValue("@ExpiringDays", expiringDays <= 0 ? 30 : expiringDays);
        cmd.Parameters.AddWithValue("@Search", (object?)(string.IsNullOrWhiteSpace(search) ? null : search.Trim()) ?? DBNull.Value);

        if (connection.State != ConnectionState.Open)
            connection.Open();

        using var adapter = new SqlDataAdapter(cmd);
        await Task.Run(() => adapter.Fill(dataSet));

        return dataSet;
    }

    public async Task<Dictionary<string, (int EmployeeId, string FullName)>> GetActiveEmployeeLookupAsync(int? scopedBranchId = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT e.EmployeeId, e.EmployeeCode, ISNULL(NULLIF(LTRIM(RTRIM(e.FullName)), N''), u.FullName) AS FullName
            FROM dbo.Employees e
            LEFT JOIN dbo.Users u ON e.UserId = u.UserId
            WHERE e.Status <> 'resigned'
              AND (@BranchId IS NULL OR e.BranchId = @BranchId)";

        var rows = await connection.QueryAsync<(int EmployeeId, string EmployeeCode, string FullName)>(
            sql,
            new { BranchId = scopedBranchId <= 0 ? null : scopedBranchId }
        );

        var dict = new Dictionary<string, (int, string)>(StringComparer.OrdinalIgnoreCase);
        foreach (var r in rows)
        {
            if (!string.IsNullOrWhiteSpace(r.EmployeeCode) && !dict.ContainsKey(r.EmployeeCode.Trim()))
            {
                dict[r.EmployeeCode.Trim()] = (r.EmployeeId, r.FullName ?? string.Empty);
            }
        }
        return dict;
    }

    public async Task<SubmitContractChangeResultDto> SubmitContractChangeAsync(
        SubmitContractChangeRequestDto request,
        int? actorEmployeeId,
        byte actorHierarchyLevel)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EmployeeId", request.EmployeeId);
        p.Add("@ContractTypeId", request.ContractTypeId);
        p.Add("@Position", request.Position.Trim());
        p.Add("@HourlyRate", request.HourlyRate);
        p.Add("@Allowance", request.Allowance);
        p.Add("@StartDate", request.StartDate.Date);
        p.Add("@EndDate", request.EndDate?.Date);
        p.Add("@ActionType", string.IsNullOrWhiteSpace(request.ActionType) ? "renew" : request.ActionType.Trim().ToLowerInvariant());
        p.Add("@TargetContractId", request.TargetContractId);
        p.Add("@Note", string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());
        p.Add("@ActorEmployeeId", actorEmployeeId);
        p.Add("@ActorHierarchyLevel", actorHierarchyLevel);
        p.Add("@AutoApproveIfAllowed", request.AutoApproveIfAllowed);

        return await connection.QuerySingleAsync<SubmitContractChangeResultDto>(
            "dbo.sp_HRM_SubmitContractChange",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ProcessApprovalAsync(
        int contractId,
        string decision,
        int? approverEmployeeId,
        byte approverLevel,
        string? note)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@ContractId", contractId);
        p.Add("@Decision", decision.Trim().ToLowerInvariant());
        p.Add("@ApproverEmployeeId", approverEmployeeId);
        p.Add("@ApproverLevel", approverLevel);
        p.Add("@Note", string.IsNullOrWhiteSpace(note) ? null : note.Trim());

        var res = await connection.QuerySingleOrDefaultAsync<int>(
            "dbo.sp_HRM_ProcessContractApproval",
            p,
            commandType: CommandType.StoredProcedure
        );
        return res == 1;
    }

    public async Task<IEnumerable<ContractTypeSettingDto>> GetContractTypesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryAsync<ContractTypeSettingDto>(
            "dbo.sp_HRM_GetContractTypes",
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> SaveContractTypeAsync(SaveContractTypeRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@ContractTypeId", request.ContractTypeId);
        p.Add("@ContractCode", request.ContractCode.Trim());
        p.Add("@ContractName", request.ContractName.Trim());
        p.Add("@StandardHourlyRate", request.StandardHourlyRate);
        p.Add("@Allowance", request.Allowance);
        p.Add("@SalaryPercentage", request.SalaryPercentage);
        p.Add("@DurationMonths", request.DurationMonths);
        p.Add("@BenefitsDescription", string.IsNullOrWhiteSpace(request.BenefitsDescription) ? null : request.BenefitsDescription.Trim());
        p.Add("@IsActive", request.IsActive);

        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_SaveContractType",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<(bool Success, string Message)> DeleteContractTypeAsync(int contractTypeId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var res = await connection.QuerySingleOrDefaultAsync<DeleteResultRow>(
            "dbo.sp_HRM_DeleteContractType",
            new { ContractTypeId = contractTypeId },
            commandType: CommandType.StoredProcedure
        );
        return res == null ? (false, "Không tìm thấy loại hợp đồng.") : (res.Success == 1, res.Message);
    }

    private sealed class DeleteResultRow
    {
        public int Success { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
