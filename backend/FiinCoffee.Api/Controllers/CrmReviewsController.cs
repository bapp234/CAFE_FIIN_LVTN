using System.Data;
using System.Security.Claims;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/crm/reviews")]
[Authorize]
public sealed class CrmReviewsController : ControllerBase
{
    private readonly IConfiguration _config;

    public CrmReviewsController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetReviews(
        [FromQuery] string? search = null,
        [FromQuery] int? rating = null,
        [FromQuery] bool? isVisible = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 50)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_CRM_GetReviews",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                Rating = rating,
                IsVisible = isVisible,
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                Offset = Math.Max(0, offset),
                FetchCount = Math.Clamp(limit, 1, 200)
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách đánh giá thành công."));
    }

    [HttpPost("reply")]
    public async Task<IActionResult> SaveReply([FromBody] SaveReviewReplyRequest request)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        int? userId = int.TryParse(userIdClaim, out var uid) ? uid : null;

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync(
            "dbo.sp_CRM_SaveReviewReply",
            new
            {
                request.ReviewId,
                request.AdminReply,
                request.IsVisible,
                RepliedByUserId = userId
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse.Ok("Đã cập nhật phản hồi đánh giá."));
    }

    public sealed record SaveReviewReplyRequest(
        int ReviewId,
        string? AdminReply,
        bool IsVisible);
}
