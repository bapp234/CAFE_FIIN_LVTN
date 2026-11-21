using System.Data;
using System.Security.Claims;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
public sealed class CustomerMenuOrdersController : ControllerBase
{
    private readonly IConfiguration _config;

    public CustomerMenuOrdersController(IConfiguration config)
    {
        _config = config;
    }

    private int? CurrentUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : null;

    [AllowAnonymous]
    [HttpGet("api/v1/menu")]
    public async Task<IActionResult> GetPublicMenu()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        using var multi = await conn.QueryMultipleAsync("dbo.sp_PUBLIC_GetMenu", commandType: CommandType.StoredProcedure);
        var categories = (await multi.ReadAsync()).ToList();
        var products = (await multi.ReadAsync()).ToList();
        var variants = (await multi.ReadAsync()).ToList();
        var toppings = (await multi.ReadAsync()).ToList();
        return Ok(ApiResponse<object>.Ok(new { categories, products, variants, toppings }));
    }

    [Authorize]
    [HttpGet("api/v1/customer/cart")]
    public async Task<IActionResult> GetCart()
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_CUST_GetCart", new { UserId = CurrentUserId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [Authorize]
    [HttpPost("api/v1/customer/cart/add")]
    public async Task<IActionResult> AddToCart([FromBody] AddCartDto req)
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_CUST_AddToCart", new { UserId = CurrentUserId, req.VariantId, req.Quantity, req.Notes }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã thêm vào giỏ hàng."));
    }

    [Authorize]
    [HttpDelete("api/v1/customer/cart/{cartItemId:int}")]
    public async Task<IActionResult> RemoveCartItem(int cartItemId)
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_CUST_RemoveCartItem", new { UserId = CurrentUserId, CartItemId = cartItemId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã xóa món khỏi giỏ hàng."));
    }

    [Authorize]
    [HttpPut("api/v1/customer/cart/{cartItemId:int}")]
    public async Task<IActionResult> UpdateCartQuantity(int cartItemId, [FromBody] UpdateCartQuantityDto req)
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_CUST_UpdateCartItemQuantity", new { UserId = CurrentUserId, CartItemId = cartItemId, req.Quantity }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã cập nhật số lượng món."));
    }

    [Authorize]
    [HttpGet("api/v1/customer/vouchers")]
    public async Task<IActionResult> GetVoucherWallet()
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        using var multi = await conn.QueryMultipleAsync("dbo.sp_CUST_GetVoucherWallet", new { UserId = CurrentUserId }, commandType: CommandType.StoredProcedure);
        var myVouchers = (await multi.ReadAsync()).ToList();
        var availableVouchers = (await multi.ReadAsync()).ToList();
        return Ok(ApiResponse<object>.Ok(new { myVouchers, availableVouchers }));
    }

    [Authorize]
    [HttpPost("api/v1/customer/vouchers/{voucherId:int}/redeem")]
    public async Task<IActionResult> RedeemVoucher(int voucherId)
    {
        if (CurrentUserId is null) return Unauthorized();
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var points = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_CUST_RedeemVoucher", new { UserId = CurrentUserId, VoucherId = voucherId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { loyaltyPoints = points }, "Đổi Voucher thành công!"));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [Authorize]
    [HttpPost("api/v1/customer/orders")]
    public async Task<IActionResult> PlaceOrder([FromBody] PlaceOrderDto req)
    {
        if (CurrentUserId is null) return Unauthorized();
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var res = await conn.QueryFirstOrDefaultAsync("dbo.sp_CUST_PlaceOrder", new { UserId = CurrentUserId, req.OrderType, req.CustomerVoucherId, req.BranchId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(res, "Đặt hàng thành công!"));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [Authorize]
    [HttpGet("api/v1/customer/orders")]
    public async Task<IActionResult> GetMyOrders()
    {
        if (CurrentUserId is null) return Unauthorized();
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_CUST_GetMyOrders", new { UserId = CurrentUserId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [Authorize]
    [HttpPost("api/v1/customer/orders/{orderId:int}/cancel")]
    public async Task<IActionResult> CancelOrReturnOrder(int orderId, [FromBody] CancelOrderDto? req)
    {
        if (CurrentUserId is null) return Unauthorized();
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync("dbo.sp_CUST_CancelOrReturnOrder", new { UserId = CurrentUserId, OrderId = orderId, Reason = req?.Reason ?? "Khách hàng yêu cầu hủy/trả" }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xử lý yêu cầu hủy/trả đơn hàng."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    public sealed record AddCartDto(int VariantId, int Quantity = 1, string? Notes = null);
    public sealed record UpdateCartQuantityDto(int Quantity = 1);
    public sealed record PlaceOrderDto(string OrderType = "OnlineDelivery", int? CustomerVoucherId = null, int? BranchId = null);
    public sealed record CancelOrderDto(string? Reason = null);
}
