using FiinCoffee.Core.DTOs.Auth;

namespace FiinCoffee.Core.Interfaces;

public interface IAuthRepository
{
    Task<AuthUserRecord?> GetUserForLoginAsync(string identifier);
    Task<AuthUserRecord?> GetUserByIdAsync(int userId);
    Task UpdateActiveSessionTokenAsync(int userId, string? sessionToken);
    Task<bool> ChangePasswordAsync(int userId, string newPasswordHash);
}
