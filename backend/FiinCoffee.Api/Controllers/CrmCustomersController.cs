using System.Data;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/customers")]
[Authorize]
public sealed class CrmCustomersController : ControllerBase
{
    private readonly IConfiguration _config;

    public CrmCustomersController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet("filter-options")]
    public async Task<IActionResult> GetFilterOptions()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        using var multi = await conn.QueryMultipleAsync(
            "dbo.sp_CRM_GetCustomerFilterOptions",
            commandType: CommandType.StoredProcedure);

        var tiers = (await multi.ReadAsync()).ToList();
        var segments = (await multi.ReadAsync()).ToList();
        var joinOrders = (await multi.ReadAsync()).ToList();
        var provinces = (await multi.ReadAsync()).ToList();

        return Ok(ApiResponse<object>.Ok(new { tiers, segments, joinOrders, provinces }, "Lấy bộ lọc thành công."));
    }

    [HttpGet]
    public async Task<IActionResult> GetCustomers(
        [FromQuery] string? search = null,
        [FromQuery] string? tier = null,
        [FromQuery] string? joinOrder = "newest",
        [FromQuery] string? segment = null,
        [FromQuery] string? provinceId = null,
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 50)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetCustomers",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                Tier = string.IsNullOrWhiteSpace(tier) ? null : tier,
                JoinOrder = string.IsNullOrWhiteSpace(joinOrder) ? "newest" : joinOrder,
                Segment = string.IsNullOrWhiteSpace(segment) ? null : segment,
                ProvinceId = string.IsNullOrWhiteSpace(provinceId) ? null : provinceId,
                Offset = Math.Max(0, offset),
                FetchCount = Math.Clamp(limit, 1, 200)
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách khách hàng thành công."));
    }

    [HttpGet("point-transactions")]
    public async Task<IActionResult> GetPointTransactions(
        [FromQuery] string? search = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] string? balanceFilter = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetPointTransactions",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                BalanceFilter = string.IsNullOrWhiteSpace(balanceFilter) ? null : balanceFilter
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy lịch sử Điểm Fiin thành công."));
    }

    [HttpGet("voucher-history")]
    public async Task<IActionResult> GetVoucherHistory(
        [FromQuery] string? search = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] string? statusFilter = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetCustomerVouchers",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                StatusFilter = string.IsNullOrWhiteSpace(statusFilter) ? null : statusFilter
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy lịch sử Voucher thành công."));
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> GetAuditLogs(
        [FromQuery] string? search = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] string? actionFilter = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetCustomerAuditLogs",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                ActionFilter = string.IsNullOrWhiteSpace(actionFilter) ? null : actionFilter
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy lịch sử chỉnh sửa khách hàng thành công."));
    }
}
