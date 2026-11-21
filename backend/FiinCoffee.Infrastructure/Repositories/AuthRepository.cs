using System.Data;
using Dapper;
using FiinCoffee.Core.DTOs.Auth;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;

namespace FiinCoffee.Infrastructure.Repositories;

public class AuthRepository : IAuthRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public AuthRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<AuthUserRecord?> GetUserForLoginAsync(string identifier)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_Auth_GetUserForLogin",
            new { Identifier = identifier.Trim() },
            commandType: CommandType.StoredProcedure
        );

        return await ReadAuthUserRecordAsync(multi);
    }

    public async Task<AuthUserRecord?> GetUserByIdAsync(int userId)
    {
        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_Auth_GetUserById",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure
        );

        return await ReadAuthUserRecordAsync(multi);
    }

    public async Task UpdateActiveSessionTokenAsync(int userId, string? sessionToken)
    {
        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(
            "dbo.sp_Auth_UpdateActiveSessionToken",
            new { UserId = userId, SessionToken = sessionToken },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ChangePasswordAsync(int userId, string newPasswordHash)
    {
        using var connection = _connectionFactory.CreateConnection();
        var affected = await connection.ExecuteScalarAsync<int>(
            "dbo.sp_Auth_ChangePassword",
            new { UserId = userId, NewPasswordHash = newPasswordHash },
            commandType: CommandType.StoredProcedure
        );

        return affected > 0;
    }

    public async Task<(int UserId, int CustomerId)> RegisterCustomerAsync(
        string username,
        string passwordHash,
        string fullName,
        string phoneNumber,
        string email)
    {
        using var connection = _connectionFactory.CreateConnection();
        var row = await connection.QuerySingleAsync<(int UserId, int CustomerId)>(
            "dbo.sp_CUST_Register",
            new
            {
                Username = username.Trim(),
                PasswordHash = passwordHash,
                PasswordSalt = (string?)null,
                FullName = fullName.Trim(),
                PhoneNumber = phoneNumber.Trim(),
                Email = email.Trim(),
                DefaultAddress = (string?)null,
            },
            commandType: CommandType.StoredProcedure
        );

        return row;
    }

    public async Task<AuthTokenIssueResult> CreateAuthTokenAsync(
        string email,
        string tokenType,
        string tokenHash,
        int expireMinutes)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QuerySingleAsync<AuthTokenIssueResult>(
            "dbo.sp_Auth_CreateAuthToken",
            new
            {
                Email = email.Trim(),
                TokenType = tokenType,
                TokenHash = tokenHash,
                ExpireMinutes = expireMinutes,
            },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> VerifyEmailTokenAsync(string tokenHash)
    {
        using var connection = _connectionFactory.CreateConnection();
        var row = await connection.QueryFirstOrDefaultAsync<VerifyResultRow>(
            "dbo.sp_Auth_VerifyEmailToken",
            new { TokenHash = tokenHash },
            commandType: CommandType.StoredProcedure
        );

        return row?.IsEmailVerified ?? false;
    }

    public async Task<bool> ResetPasswordByTokenAsync(string tokenHash, string newPasswordHash)
    {
        using var connection = _connectionFactory.CreateConnection();
        var row = await connection.QueryFirstOrDefaultAsync<ResetResultRow>(
            "dbo.sp_Auth_ResetPasswordByToken",
            new { TokenHash = tokenHash, NewPasswordHash = newPasswordHash },
            commandType: CommandType.StoredProcedure
        );

        return row?.ResetSuccess ?? false;
    }

    private sealed class VerifyResultRow
    {
        public int UserId { get; set; }
        public bool IsEmailVerified { get; set; }
    }

    private sealed class ResetResultRow
    {
        public int UserId { get; set; }
        public bool ResetSuccess { get; set; }
    }

    private static async Task<AuthUserRecord?> ReadAuthUserRecordAsync(SqlMapper.GridReader multi)
    {
        if (multi.IsConsumed) return null;

        var record = await multi.ReadFirstOrDefaultAsync<AuthUserRecord>();
        if (record == null) return null;

        if (!multi.IsConsumed)
        {
            var roles = (await multi.ReadAsync<RoleRow>()).ToList();
            record.Roles = roles.Select(r => r.RoleName).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
            record.RoleDescriptions = roles.Select(r => r.Description ?? r.RoleName).Where(n => !string.IsNullOrWhiteSpace(n)).ToList();
        }

        if (!multi.IsConsumed)
        {
            var perms = (await multi.ReadAsync<string>()).ToList();
            record.Permissions = perms.Where(p => !string.IsNullOrWhiteSpace(p)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();
        }

        return record;
    }

    private sealed class RoleRow
    {
        public string RoleName { get; set; } = string.Empty;
        public string? Description { get; set; }
    }
}
