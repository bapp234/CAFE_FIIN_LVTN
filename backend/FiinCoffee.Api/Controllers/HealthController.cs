using System.Data;
using Dapper;
using FiinCoffee.Core.Common;
using FiinCoffee.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly IDbConnectionFactory _dbConnectionFactory;
    private readonly ILogger<HealthController> _logger;

    public HealthController(IDbConnectionFactory dbConnectionFactory, ILogger<HealthController> logger)
    {
        _dbConnectionFactory = dbConnectionFactory;
        _logger = logger;
    }

    /// <summary>
    /// Kiểm tra trạng thái hoạt động của Backend API và kết nối CSDL SQL Server
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> CheckHealth()
    {
        var result = new Dictionary<string, object>
        {
            ["api"] = "Healthy",
            ["version"] = "1.0.0",
            ["serverTime"] = DateTime.UtcNow,
            ["environment"] = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Production"
        };

        try
        {
            using var connection = _dbConnectionFactory.CreateConnection();
            if (connection.State != ConnectionState.Open)
            {
                if (connection is System.Data.Common.DbConnection dbConn)
                {
                    await dbConn.OpenAsync();
                }
                else
                {
                    connection.Open();
                }
            }

            var dbVersion = await connection.ExecuteScalarAsync<string>("SELECT @@VERSION;");
            result["database"] = "Connected";
            result["dbVersion"] = dbVersion?.Split('\n')[0].Trim() ?? "Unknown";
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Chưa thể kết nối CSDL SQL Server trong Health Check");
            result["database"] = "Disconnected (CSDL chưa khởi động hoặc sai ConnectionString)";
            result["dbError"] = ex.Message;
        }

        return Ok(ApiResponse<Dictionary<string, object>>.Ok(result, "Hệ thống Backend Cà Phê Fiin đang hoạt động"));
    }
}
