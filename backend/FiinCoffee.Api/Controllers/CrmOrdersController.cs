using System.Data;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/orders")]
[Authorize]
public sealed class CrmOrdersController : ControllerBase
{
    private readonly IConfiguration _config;

    public CrmOrdersController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetOrders(
        [FromQuery] string? search = null,
        [FromQuery] string? orderType = null,
        [FromQuery] string? orderStatus = null,
        [FromQuery] string? paymentStatus = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 50)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetOrders",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                OrderType = string.IsNullOrWhiteSpace(orderType) ? null : orderType,
                OrderStatus = string.IsNullOrWhiteSpace(orderStatus) ? null : orderStatus,
                PaymentStatus = string.IsNullOrWhiteSpace(paymentStatus) ? null : paymentStatus,
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                Offset = Math.Max(0, offset),
                FetchCount = Math.Clamp(limit, 1, 200)
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách đơn hàng thành công."));
    }

    [HttpGet("abandoned-carts")]
    public async Task<IActionResult> GetAbandonedCarts(
        [FromQuery] string? search = null,
        [FromQuery] string? sortOrder = "newest")
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetAbandonedCarts",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách giỏ hàng đang chọn thành công."));
    }
}
