using System.Data;
using System.Security.Claims;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/loyalty-rules")]
[Authorize]
public sealed class LoyaltyRulesController : ControllerBase
{
    private readonly IConfiguration _config;

    public LoyaltyRulesController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetLoyaltyRules",
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách quy tắc Điểm Fiin thành công."));
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveLoyaltyRuleRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RuleCode) || string.IsNullOrWhiteSpace(request.RuleName))
            return BadRequest(ApiResponse.Fail("Vui lòng nhập mã và tên quy tắc."));

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? userId = int.TryParse(userIdClaim, out var uid) ? uid : null;

        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var ruleId = await conn.QueryFirstOrDefaultAsync<int>(
                "dbo.sp_CRM_SaveLoyaltyRule",
                new
                {
                    request.RuleId,
                    request.RuleCode,
                    request.RuleName,
                    request.RuleType,
                    request.EarnAmountPerPoint,
                    request.PointsPerStep,
                    request.Multiplier,
                    request.MinOrderAmount,
                    request.RedeemValuePerPoint,
                    request.StartDate,
                    request.EndDate,
                    request.IsActive,
                    UpdatedByUserId = userId
                },
                commandType: CommandType.StoredProcedure);

            return Ok(ApiResponse<object>.Ok(new { ruleId }, "Lưu quy tắc Điểm Fiin thành công."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("{ruleId:int}")]
    public async Task<IActionResult> Delete(int ruleId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync(
                "dbo.sp_CRM_DeleteLoyaltyRule",
                new { RuleId = ruleId },
                commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xóa quy tắc Điểm Fiin."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    public sealed record SaveLoyaltyRuleRequest(
        int? RuleId,
        string RuleCode,
        string RuleName,
        string RuleType,
        decimal EarnAmountPerPoint,
        int PointsPerStep,
        decimal Multiplier,
        decimal MinOrderAmount,
        decimal RedeemValuePerPoint,
        DateTime? StartDate,
        DateTime? EndDate,
        bool IsActive);
}
