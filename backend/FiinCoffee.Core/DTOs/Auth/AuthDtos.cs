using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.Auth;

public class LoginRequestDto
{
    [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập, email hoặc mã nhân viên.")]
    public string Identifier { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Cổng đăng nhập: "admin" (Cấp 3–5), "staff" (Cấp 1–2) hoặc "customer" (Khách hàng).
    /// </summary>
    public string Portal { get; set; } = "admin";
}

public class CustomerRegisterRequestDto
{
    [Required(ErrorMessage = "Vui lòng nhập họ và tên.")]
    [MinLength(2, ErrorMessage = "Họ và tên tối thiểu 2 ký tự.")]
    public string FullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập số điện thoại.")]
    public string PhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    public string Email { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu.")]
    [MinLength(8, ErrorMessage = "Mật khẩu phải có tối thiểu 8 ký tự.")]
    public string Password { get; set; } = string.Empty;
}

public class ForgotPasswordRequestDto
{
    [Required(ErrorMessage = "Vui lòng nhập email.")]
    [EmailAddress(ErrorMessage = "Email không đúng định dạng.")]
    public string Email { get; set; } = string.Empty;
}

public class VerifyEmailRequestDto
{
    [Required(ErrorMessage = "Thiếu mã xác thực.")]
    public string Token { get; set; } = string.Empty;
}

public class ResetPasswordByTokenRequestDto
{
    [Required(ErrorMessage = "Thiếu mã đặt lại mật khẩu.")]
    public string Token { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới.")]
    [MinLength(8, ErrorMessage = "Mật khẩu mới phải có tối thiểu 8 ký tự.")]
    public string NewPassword { get; set; } = string.Empty;
}

public class AuthTokenIssueResult
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class ChangePasswordRequestDto
{
    [Required(ErrorMessage = "Vui lòng nhập mật khẩu hiện tại.")]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập mật khẩu mới.")]
    [MinLength(6, ErrorMessage = "Mật khẩu mới phải có tối thiểu 6 ký tự.")]
    public string NewPassword { get; set; } = string.Empty;
}

public class AuthUserRecord
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public bool IsActive { get; set; }
    public bool IsEmailVerified { get; set; }
    public bool MustChangePassword { get; set; }
    public string? ActiveSessionToken { get; set; }

    public int? CustomerId { get; set; }
    public int? EmployeeId { get; set; }
    public string? EmployeeCode { get; set; }
    public string? Position { get; set; }
    public string? EmployeeStatus { get; set; }
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }

    public int HierarchyLevel { get; set; } = 1;
    public int ApprovalLevel { get; set; }

    public List<string> Roles { get; set; } = [];
    public List<string> RoleDescriptions { get; set; } = [];
    public List<string> Permissions { get; set; } = [];
}

public class AuthUserDto
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public bool MustChangePassword { get; set; }
    public bool IsEmailVerified { get; set; }

    public int? CustomerId { get; set; }
    public int? EmployeeId { get; set; }
    public string? EmployeeCode { get; set; }
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }

    public int HierarchyLevel { get; set; }
    public int ApprovalLevel { get; set; }

    /// <summary>
    /// "admin" (Cấp 3–5) hoặc "staff" (Cấp 1–2)
    /// </summary>
    public string Portal { get; set; } = "staff";
    public string SessionToken { get; set; } = string.Empty;

    public string RoleDisplay { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = [];
    public List<string> Permissions { get; set; } = [];
    public List<string> Modules { get; set; } = [];
}
