using System.Data;
using Dapper;
using FiinCoffee.Core.DTOs.Approval;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;

namespace FiinCoffee.Infrastructure.Repositories;

/// <summary>
/// Triển khai kho dữ liệu Động cơ Phê duyệt Đa cấp (1-3 cấp) sử dụng Dapper
/// </summary>
public class ApprovalRepository : IApprovalRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public ApprovalRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<IEnumerable<ApprovalPendingItemDto>> GetPendingQueueAsync(int? branchId = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                RequestId, RequestCode, WorkflowCode, WorkflowName,
                BranchId, BranchCode, BranchName,
                RequesterId, RequesterCode, RequesterName, RequesterPosition,
                Title, Reason, TotalLevels, CurrentLevel, RequestStatus,
                CreatedAt, WaitingHours
            FROM dbo.v_ApprovalPendingQueue
            WHERE (@BranchId IS NULL OR BranchId = @BranchId)
            ORDER BY CreatedAt ASC";

        return await connection.QueryAsync<ApprovalPendingItemDto>(sql, new { BranchId = branchId });
    }

    public async Task<ApprovalRequestDetailDto?> GetRequestDetailAsync(long requestId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var requestSql = @"
            SELECT 
                ar.RequestId, ar.RequestCode, ar.WorkflowCode, ad.WorkflowName,
                ar.BranchId, b.BranchCode, b.BranchName,
                ar.RequesterId, req.EmployeeCode AS RequesterCode, u.FullName AS RequesterName, req.Position AS RequesterPosition,
                ar.ReferenceTable, ar.ReferenceId, ar.Title, ar.Reason, ar.PayloadJson,
                ar.TotalLevels, ar.CurrentLevel, ar.Status, ar.CreatedAt, ar.CompletedAt
            FROM dbo.ApprovalRequests ar
            INNER JOIN dbo.ApprovalDefinitions ad ON ar.WorkflowCode = ad.WorkflowCode
            INNER JOIN dbo.Branches b ON ar.BranchId = b.BranchId
            INNER JOIN dbo.Employees req ON ar.RequesterId = req.EmployeeId
            INNER JOIN dbo.Users u ON req.UserId = u.UserId
            WHERE ar.RequestId = @RequestId";

        var detail = await connection.QuerySingleOrDefaultAsync<ApprovalRequestDetailDto>(requestSql, new { RequestId = requestId });
        if (detail == null) return null;

        var stepsSql = @"
            SELECT 
                ast.StepId, ast.RequestId, ast.StepLevel, ast.ApproverId, ast.ApproverEmployeeId,
                appUser.FullName AS ApproverName, appEmp.Position AS ApproverPosition,
                ast.Decision, ast.Comment, ast.DecidedAt
            FROM dbo.ApprovalSteps ast
            LEFT JOIN dbo.Employees appEmp ON ast.ApproverEmployeeId = appEmp.EmployeeId
            LEFT JOIN dbo.Users appUser ON appEmp.UserId = appUser.UserId
            WHERE ast.RequestId = @RequestId
            ORDER BY ast.StepLevel ASC";

        var steps = await connection.QueryAsync<ApprovalStepDto>(stepsSql, new { RequestId = requestId });
        detail.Steps = steps.AsList();

        return detail;
    }

    public async Task<SubmitApprovalResultDto> SubmitRequestAsync(SubmitApprovalRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@WorkflowCode", request.WorkflowCode.Trim());
        parameters.Add("@RequesterId", request.RequesterId);
        parameters.Add("@Title", request.Title.Trim());
        parameters.Add("@Reason", request.Reason.Trim());
        parameters.Add("@ReferenceTable", string.IsNullOrWhiteSpace(request.ReferenceTable) ? null : request.ReferenceTable.Trim());
        parameters.Add("@ReferenceId", string.IsNullOrWhiteSpace(request.ReferenceId) ? null : request.ReferenceId.Trim());
        parameters.Add("@PayloadJson", string.IsNullOrWhiteSpace(request.PayloadJson) ? null : request.PayloadJson.Trim());

        parameters.Add("@NewRequestId", dbType: DbType.Int64, direction: ParameterDirection.Output);
        parameters.Add("@NewRequestCode", dbType: DbType.String, size: 30, direction: ParameterDirection.Output);

        var result = await connection.QuerySingleAsync<SubmitApprovalResultDto>(
            "dbo.sp_Approval_SubmitRequest",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return result;
    }

    public async Task<ProcessStepResultDto> ProcessStepAsync(long requestId, ProcessApprovalStepRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@RequestId", requestId);
        parameters.Add("@ApproverEmployeeId", request.ApproverEmployeeId);
        parameters.Add("@Decision", request.Decision.Trim().ToLowerInvariant());
        parameters.Add("@Comment", string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim());

        var result = await connection.QuerySingleAsync<ProcessStepResultDto>(
            "dbo.sp_Approval_ProcessStep",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return result;
    }
}
