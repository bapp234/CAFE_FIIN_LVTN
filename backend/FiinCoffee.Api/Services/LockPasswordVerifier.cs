using System.Security.Claims;
using Dapper;
using FiinCoffee.Infrastructure.Data;

namespace FiinCoffee.Api.Services;

public interface ILockPasswordVerifier
{
    Task<(bool IsValid, string? ErrorMessage)> VerifyAsync(ClaimsPrincipal user, string? password, string? actorHint = null);
}

public class LockPasswordVerifier : ILockPasswordVerifier
{
    private readonly IDbConnectionFactory _connectionFactory;

    public LockPasswordVerifier(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<(bool IsValid, string? ErrorMessage)> VerifyAsync(
        ClaimsPrincipal user,
        string? password,
        string? actorHint = null)
    {
        if (string.IsNullOrWhiteSpace(password))
        {
            return (false, "Vui lòng nhập mật khẩu xác nhận.");
        }

        var trimmed = password.Trim();

        // Chỉ xác thực theo mật khẩu khóa/mở khóa cấu hình trong dbo.HrmSettings
        using var conn = _connectionFactory.CreateConnection();
        var configured = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT TOP 1 SettingValue FROM dbo.HrmSettings WHERE SettingKey = 'ATTENDANCE_UNLOCK_PASSWORD'");

        if (string.IsNullOrWhiteSpace(configured))
        {
            return (false, "Chưa cấu hình mật khẩu khóa/mở khóa trong cơ sở dữ liệu.");
        }

        if (string.Equals(configured.Trim(), trimmed, StringComparison.Ordinal))
        {
            return (true, null);
        }

        return (false, "Mật khẩu xác nhận không chính xác.");
    }
}
