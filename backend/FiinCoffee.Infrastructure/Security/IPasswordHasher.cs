namespace FiinCoffee.Infrastructure.Security;

/// <summary>
/// Interface mã hóa và kiểm tra mật khẩu sử dụng BCrypt
/// </summary>
public interface IPasswordHasher
{
    string HashPassword(string password);
    bool VerifyPassword(string password, string passwordHash);
}
