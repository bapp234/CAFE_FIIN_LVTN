using System.Data;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/dashboard")]
[Authorize]
public sealed class CrmDashboardController : ControllerBase
{
    private readonly IConfiguration _config;

    public CrmDashboardController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? year = null, [FromQuery] int? month = null)
    {
        var now = DateTime.Now;
        var y = year ?? now.Year;
        var m = month ?? now.Month;

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        using var multi = await conn.QueryMultipleAsync(
            "dbo.sp_CRM_GetDashboardSummary",
            new { Year = y, Month = m },
            commandType: CommandType.StoredProcedure);

        var kpi = await multi.ReadFirstOrDefaultAsync();
        var monthlyTrend = (await multi.ReadAsync()).ToList();
        var tierDistribution = (await multi.ReadAsync()).ToList();
        var channelDistribution = (await multi.ReadAsync()).ToList();

        return Ok(ApiResponse<object>.Ok(
            new { kpi, monthlyTrend, tierDistribution, channelDistribution },
            "Lấy thống kê CRM Dashboard thành công."));
    }
}
