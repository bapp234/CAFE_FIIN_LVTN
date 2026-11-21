using System.Data;
using System.Security.Claims;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/erp")]
[Authorize]
public sealed class ErpOperationsController : ControllerBase
{
    private readonly IConfiguration _config;

    public ErpOperationsController(IConfiguration config)
    {
        _config = config;
    }

    private int? CurrentUserId =>
        int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var uid) ? uid : null;

    // =========================================================================
    // MENU 3: KHO TỔNG
    // =========================================================================
    [HttpGet("inventory/central")]
    public async Task<IActionResult> GetCentralInventory([FromQuery] string? search = null, [FromQuery] string? group = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ERP_GetCentralInventory",
            new { Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(), Group = string.IsNullOrWhiteSpace(group) ? null : group },
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("inventory/ingredients")]
    public async Task<IActionResult> SaveIngredient([FromBody] SaveIngredientRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.IngredientCode) || string.IsNullOrWhiteSpace(req.IngredientName))
            return BadRequest(ApiResponse.Fail("Vui lòng nhập mã và tên vật tư."));
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_SaveIngredient", req, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { ingredientId = id }, "Lưu vật tư thành công."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpGet("transfers")]
    public async Task<IActionResult> GetTransfers([FromQuery] int? branchId = null, [FromQuery] string? status = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetStockTransfers", new { BranchId = branchId, Status = string.IsNullOrWhiteSpace(status) ? null : status }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("transfers/{transferId:int}/approve")]
    public async Task<IActionResult> ApproveTransfer(int transferId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync("dbo.sp_ERP_ApproveTransfer", new { TransferId = transferId, ApprovedBy = CurrentUserId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã duyệt xuất kho."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpPost("transfers/{transferId:int}/reject")]
    public async Task<IActionResult> RejectTransfer(int transferId)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_ERP_RejectTransfer", new { TransferId = transferId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã từ chối phiếu xin."));
    }

    [HttpGet("periodic-rules")]
    public async Task<IActionResult> GetPeriodicRules()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetPeriodicRules", commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("periodic-rules")]
    public async Task<IActionResult> SavePeriodicRule([FromBody] SavePeriodicRuleRequest req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_SavePeriodicRule", req, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { ruleId = id }, "Lưu thiết lập định kỳ thành công."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpGet("inventory/transactions")]
    public async Task<IActionResult> GetInventoryTransactions([FromQuery] int? branchId = null, [FromQuery] string? txType = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetInventoryTransactions", new { BranchId = branchId, TxType = string.IsNullOrWhiteSpace(txType) ? null : txType }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    // =========================================================================
    // MENU 4: CHI NHÁNH
    // =========================================================================
    [HttpGet("branch/inventory")]
    public async Task<IActionResult> GetBranchInventory([FromQuery] int branchId, [FromQuery] string? search = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetBranchInventory", new { BranchId = branchId, Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("branch/transfer-requests")]
    public async Task<IActionResult> CreateExtraTransferRequest([FromBody] CreateExtraRequestDto req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_CreateExtraTransferRequest", new { req.ToBranchId, req.IngredientId, req.RequestedQty, req.Notes, CreatedBy = CurrentUserId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { transferId = id }, "Đã gửi đơn xin nhập kho."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpPost("transfers/{transferId:int}/receive")]
    public async Task<IActionResult> ConfirmTransferReceived(int transferId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync("dbo.sp_ERP_ConfirmTransferReceived", new { TransferId = transferId, UserId = CurrentUserId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xác nhận nhập hàng vào kho chi nhánh."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpGet("variants")]
    public async Task<IActionResult> GetVariants()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            @"SELECT pv.VariantId, p.ProductCode, p.ProductName, pv.SizeName
              FROM dbo.ProductVariants pv
              JOIN dbo.Products p ON p.ProductId = pv.ProductId
              WHERE pv.IsActive = 1 AND p.IsActive = 1
              ORDER BY p.ProductName, pv.SizeName");
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("recipes")]
    public async Task<IActionResult> GetRecipes([FromQuery] string? search = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetProductRecipes", new { Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("recipes")]
    public async Task<IActionResult> SaveRecipe([FromBody] SaveRecipeRequest req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_SaveProductRecipe", req, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { recipeId = id }, "Lưu công thức món thành công."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpDelete("recipes/{recipeId:int}")]
    public async Task<IActionResult> DeleteRecipe(int recipeId)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_ERP_DeleteProductRecipe", new { RecipeId = recipeId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã xóa công thức."));
    }

    [HttpGet("branch/delivery-settings")]
    public async Task<IActionResult> GetBranchDeliverySettings([FromQuery] int? branchId = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetBranchDeliverySettings", new { BranchId = branchId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("branch/delivery-settings")]
    public async Task<IActionResult> SaveBranchDeliverySettings([FromBody] SaveDeliverySettingsRequest req)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_ERP_SaveBranchDeliverySettings", req, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã lưu cấu hình giao hàng & phí ship."));
    }

    // =========================================================================
    // MENU 5: NHẬP HÀNG & NCC
    // =========================================================================
    [HttpGet("suppliers")]
    public async Task<IActionResult> GetSuppliers([FromQuery] string? search = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetSuppliers", new { Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim() }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("suppliers")]
    public async Task<IActionResult> SaveSupplier([FromBody] SaveSupplierRequest req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_SaveSupplier", req, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { supplierId = id }, "Lưu nhà cung cấp thành công."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpDelete("suppliers/{supplierId:int}")]
    public async Task<IActionResult> DeleteSupplier(int supplierId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync("dbo.sp_ERP_DeleteSupplier", new { SupplierId = supplierId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xóa nhà cung cấp."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpGet("purchase-orders")]
    public async Task<IActionResult> GetPurchaseOrders([FromQuery] string? search = null, [FromQuery] string? status = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetPurchaseOrders", new { Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(), Status = string.IsNullOrWhiteSpace(status) ? null : status }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("purchase-orders")]
    public async Task<IActionResult> SavePurchaseOrder([FromBody] SavePoRequest req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var id = await conn.QueryFirstOrDefaultAsync<int>("dbo.sp_ERP_SavePurchaseOrder", new { req.PoId, req.PoCode, req.SupplierId, req.Status, req.PaymentStatus, req.TotalAmount, req.PaidAmount, req.Notes, CreatedBy = CurrentUserId }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse<object>.Ok(new { poId = id }, "Lưu phiếu nhập hàng thành công."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    // =========================================================================
    // MENU 6: GIÁM SÁT ĐƠN & TRẢ MÓN
    // =========================================================================
    [HttpGet("live-orders")]
    public async Task<IActionResult> GetLiveOrders([FromQuery] string? search = null, [FromQuery] string? orderStatus = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetLiveOrders", new { Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(), OrderStatus = string.IsNullOrWhiteSpace(orderStatus) ? null : orderStatus }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("live-orders/{orderId:int}/advance")]
    public async Task<IActionResult> AdvanceOrderStatus(int orderId, [FromBody] AdvanceOrderDto req)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync("dbo.sp_ERP_SimulatePosAdvanceStatus", new { OrderId = orderId, req.NextStatus }, commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok($"Đã chuyển trạng thái đơn sang {req.NextStatus}."));
        }
        catch (SqlException ex) { return BadRequest(ApiResponse.Fail(ex.Message)); }
    }

    [HttpGet("order-history")]
    public async Task<IActionResult> GetOrderHistory(
        [FromQuery] string? search = null,
        [FromQuery] string? orderStatus = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 50)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ERP_GetOrderHistory",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                OrderStatus = string.IsNullOrWhiteSpace(orderStatus) ? null : orderStatus,
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                Offset = Math.Max(0, offset),
                FetchCount = Math.Clamp(limit, 1, 200)
            },
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("disposal-reviews")]
    public async Task<IActionResult> GetDisposalReviews([FromQuery] string? status = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetDisposalReviews", new { Status = string.IsNullOrWhiteSpace(status) ? null : status }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("disposal-reviews/approve")]
    public async Task<IActionResult> ApproveDisposalReview([FromBody] ApproveDisposalRequest req)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync("dbo.sp_ERP_ApproveDisposalReview", new { req.ReviewId, req.SituationType, req.ManagerDecisionNotes, ReviewedBy = CurrentUserId }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã duyệt xử lý đơn trả/hủy."));
    }

    // =========================================================================
    // MENU 7: BÁO CÁO DOANH THU
    // =========================================================================
    [HttpGet("reports/revenue")]
    public async Task<IActionResult> GetRevenueReport([FromQuery] int? year = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetRevenueReport", new { Year = year }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpGet("reports/products")]
    public async Task<IActionResult> GetProductRevenueReport([FromQuery] int? year = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync("dbo.sp_ERP_GetProductRevenueReport", new { Year = year }, commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    public sealed record SaveIngredientRequest(int? IngredientId, string IngredientCode, string IngredientName, string CategoryGroup, string Unit, decimal CurrentStock, decimal ReorderLevel, decimal AverageCost, bool IsActive);
    public sealed record SavePeriodicRuleRequest(int? RuleId, int BranchId, int IngredientId, string SupplyCycle, decimal DefaultQty, DateTime NextSupplyDate, bool IsActive);
    public sealed record CreateExtraRequestDto(int ToBranchId, int IngredientId, decimal RequestedQty, string? Notes);
    public sealed record SaveRecipeRequest(int? RecipeId, int VariantId, int IngredientId, decimal Quantity);
    public sealed record SaveDeliverySettingsRequest(int BranchId, bool IsDeliveryEnabled, decimal MaxRadiusKm, decimal BaseShippingFee, decimal FeePerKm, decimal FreeShipMinOrder, string? SupportedAreas);
    public sealed record SaveSupplierRequest(int? SupplierId, string SupplierCode, string SupplierName, string? CategoryGroup, string? ContactPerson, string? Phone, string? Email, string? Address, decimal CurrentDebt, bool IsActive);
    public sealed record SavePoRequest(int? PoId, string PoCode, int SupplierId, string Status, string PaymentStatus, decimal TotalAmount, decimal PaidAmount, string? Notes);
    public sealed record ApproveDisposalRequest(int ReviewId, string SituationType, string ManagerDecisionNotes);
    public sealed record AdvanceOrderDto(string NextStatus);
}
