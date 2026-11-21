using System.Data;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/vouchers")]
[Authorize]
public sealed class VouchersController : ControllerBase
{
    private readonly IConfiguration _config;

    public VouchersController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetVouchers",
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách Voucher thành công."));
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveVoucherRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VoucherCode) || string.IsNullOrWhiteSpace(request.VoucherName))
            return BadRequest(ApiResponse.Fail("Vui lòng nhập mã và tên Voucher."));

        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var voucherId = await conn.QueryFirstOrDefaultAsync<int>(
                "dbo.sp_CRM_SaveVoucher",
                new
                {
                    request.VoucherId,
                    request.VoucherCode,
                    request.VoucherName,
                    request.DiscountType,
                    request.DiscountValue,
                    request.MaxDiscountAmount,
                    request.MinOrderAmount,
                    request.PointsCost,
                    request.UsageLimit,
                    request.StartAt,
                    request.EndAt,
                    request.IsActive
                },
                commandType: CommandType.StoredProcedure);

            return Ok(ApiResponse<object>.Ok(new { voucherId }, "Lưu Voucher thành công."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("{voucherId:int}")]
    public async Task<IActionResult> Delete(int voucherId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync(
                "dbo.sp_CRM_DeleteVoucher",
                new { VoucherId = voucherId },
                commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xóa Voucher."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    public sealed record SaveVoucherRequest(
        int? VoucherId,
        string VoucherCode,
        string VoucherName,
        string DiscountType,
        decimal DiscountValue,
        decimal? MaxDiscountAmount,
        decimal MinOrderAmount,
        int PointsCost,
        int? UsageLimit,
        DateTime StartAt,
        DateTime EndAt,
        bool IsActive);
}
