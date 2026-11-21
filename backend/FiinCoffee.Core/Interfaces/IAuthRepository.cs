using FiinCoffee.Core.DTOs.Auth;

namespace FiinCoffee.Core.Interfaces;

public interface IAuthRepository
{
    Task<AuthUserRecord?> GetUserForLoginAsync(string identifier);
    Task<AuthUserRecord?> GetUserByIdAsync(int userId);
    Task UpdateActiveSessionTokenAsync(int userId, string? sessionToken);
    Task<bool> ChangePasswordAsync(int userId, string newPasswordHash);
    Task<(int UserId, int CustomerId)> RegisterCustomerAsync(string username, string passwordHash, string fullName, string phoneNumber, string email);
    Task<AuthTokenIssueResult> CreateAuthTokenAsync(string email, string tokenType, string tokenHash, int expireMinutes);
    Task<bool> VerifyEmailTokenAsync(string tokenHash);
    Task<bool> ResetPasswordByTokenAsync(string tokenHash, string newPasswordHash);
}
