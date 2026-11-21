using System.Data;
using System.Security.Claims;
using Dapper;
using FiinCoffee.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
public sealed class LocationsController : ControllerBase
{
    private readonly IConfiguration _config;

    public LocationsController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet("api/locations/provinces")]
    public async Task<IActionResult> GetProvinces()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ADDR_GetProvinces",
            commandType: CommandType.StoredProcedure);
        return Ok(rows);
    }

    [HttpGet("api/locations/wards")]
    public async Task<IActionResult> GetWards([FromQuery] string provinceId)
    {
        if (string.IsNullOrWhiteSpace(provinceId))
        {
            return BadRequest(new { message = "Thiếu provinceId." });
        }

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ADDR_GetWardsByProvince",
            new { ProvinceId = provinceId },
            commandType: CommandType.StoredProcedure);
        return Ok(rows);
    }

    [HttpPost("api/admin/locations/sync")]
    public IActionResult SyncLocationsNow([FromServices] LocationSyncWorker worker)
    {
        worker.TriggerSyncNow();
        return Accepted(new { message = "Đã kích hoạt đồng bộ khu vực ngay lập tức." });
    }

    [Authorize]
    [HttpPut("api/v1/customer/default-address")]
    public async Task<IActionResult> SaveDefaultAddress([FromBody] SaveDefaultAddressRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Phiên đăng nhập không hợp lệ." });
        }

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync(
            "dbo.sp_CUST_SaveDefaultAddress",
            new
            {
                UserId = userId,
                request.ReceiverName,
                request.ReceiverPhone,
                request.ProvinceId,
                request.WardId,
                request.StreetAddress
            },
            commandType: CommandType.StoredProcedure);

        return Ok(new { message = "Đã lưu địa chỉ mặc định." });
    }
}

public sealed record SaveDefaultAddressRequest(
    string ReceiverName,
    string ReceiverPhone,
    string ProvinceId,
    string WardId,
    string StreetAddress);
