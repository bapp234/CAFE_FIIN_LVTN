using System.Security.Claims;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.Auth;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthRepository _authRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthRepository authRepository,
        IPasswordHasher passwordHasher,
        ILogger<AuthController> logger)
    {
        _authRepository = authRepository;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    /// <summary>
    /// Đăng nhập thật bằng Username / Email / Mã NV với kiểm tra cổng (Admin Portal vs Staff Portal) và cấp HttpOnly Cookie
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Vui lòng nhập đầy đủ thông tin đăng nhập.", errors));
        }

        var record = await _authRepository.GetUserForLoginAsync(request.Identifier);
        if (record == null)
        {
            return Unauthorized(ApiResponse.Fail("Tài khoản hoặc mật khẩu không chính xác."));
        }

        if (!record.IsActive)
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Quản trị viên."));
        }

        if (string.Equals(record.EmployeeStatus, "resigned", StringComparison.OrdinalIgnoreCase))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail("Nhân sự này đã nghỉ việc và không còn quyền truy cập hệ thống."));
        }

        if (!_passwordHasher.VerifyPassword(request.Password, record.PasswordHash))
        {
            return Unauthorized(ApiResponse.Fail("Tài khoản hoặc mật khẩu không chính xác."));
        }

        var requestedPortal = (request.Portal ?? "admin").Trim().ToLowerInvariant();
        var isAdminEligible = record.HierarchyLevel >= 3 || record.Roles.Contains("Admin", StringComparer.OrdinalIgnoreCase);

        // Chặn chéo cổng: Nhân viên cấp 1-2 không thể đăng nhập qua Cổng Quản trị (/admin/login)
        if (requestedPortal == "admin" && !isAdminEligible)
        {
            _logger.LogWarning("Chặn đăng nhập chéo cổng: User {Username} (Cấp {Level}) cố đăng nhập vào Admin Portal.", record.Username, record.HierarchyLevel);
            return StatusCode(StatusCodes.Status403Forbidden, new
            {
                success = false,
                code = "WRONG_PORTAL",
                expectedPortal = "staff",
                redirectUrl = "/staff/login",
                message = "Tài khoản nhân viên (Cấp 1–2) không được đăng nhập tại Cổng Quản trị. Vui lòng chuyển sang Cổng Nhân viên (/staff/login)."
            });
        }

        var activePortal = requestedPortal == "staff" ? "staff" : "admin";
        var sessionToken = Guid.NewGuid().ToString("N");
        await _authRepository.UpdateActiveSessionTokenAsync(record.UserId, sessionToken);

        var userDto = MapToDto(record, activePortal, sessionToken);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, record.UserId.ToString()),
            new(ClaimTypes.Name, record.Username),
            new(ClaimTypes.GivenName, record.FullName),
            new("hierarchy_level", record.HierarchyLevel.ToString()),
            new("approval_level", record.ApprovalLevel.ToString()),
            new("portal", activePortal),
            new("session_token", sessionToken),
        };

        if (!string.IsNullOrWhiteSpace(record.Email))
            claims.Add(new Claim(ClaimTypes.Email, record.Email));
        if (record.EmployeeId.HasValue)
            claims.Add(new Claim("employee_id", record.EmployeeId.Value.ToString()));
        if (!string.IsNullOrWhiteSpace(record.EmployeeCode))
            claims.Add(new Claim("employee_code", record.EmployeeCode));
        if (record.BranchId.HasValue)
            claims.Add(new Claim("branch_id", record.BranchId.Value.ToString()));

        foreach (var role in record.Roles)
            claims.Add(new Claim(ClaimTypes.Role, role));
        foreach (var perm in record.Permissions)
            claims.Add(new Claim("permission", perm));

        var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            principal,
            new AuthenticationProperties
            {
                IsPersistent = true,
                ExpiresUtc = DateTimeOffset.UtcNow.AddHours(12),
                AllowRefresh = true,
            });

        _logger.LogInformation("User {Username} (Cấp {Level}) đăng nhập thành công vào cổng {Portal}.", record.Username, record.HierarchyLevel, activePortal);

        return Ok(ApiResponse<AuthUserDto>.Ok(userDto, "Đăng nhập thành công."));
    }

    /// <summary>
    /// Lấy thông tin phiên đăng nhập hiện tại từ HttpOnly Cookie (truy vấn lại quyền mới nhất từ CSDL)
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));
        }

        var record = await _authRepository.GetUserByIdAsync(userId);
        if (record == null || !record.IsActive || string.Equals(record.EmployeeStatus, "resigned", StringComparison.OrdinalIgnoreCase))
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập đã hết hiệu lực."));
        }

        // Kiểm tra Single Active Session: ưu tiên đối chiếu X-Tab-Session-Id của từng tab/cửa sổ
        var tabToken = Request.Headers["X-Tab-Session-Id"].FirstOrDefault();
        var cookieToken = User.FindFirstValue("session_token");
        var presentedToken = !string.IsNullOrWhiteSpace(tabToken) ? tabToken : cookieToken;

        if (string.IsNullOrWhiteSpace(record.ActiveSessionToken) ||
            !string.Equals(record.ActiveSessionToken, presentedToken, StringComparison.Ordinal))
        {
            return Unauthorized(new
            {
                success = false,
                code = "SESSION_REPLACED",
                message = "Tài khoản đã được đăng nhập ở một cửa sổ khác hoặc phiên đã kết thúc."
            });
        }

        var cookiePortal = User.FindFirstValue("portal") ?? (record.HierarchyLevel >= 3 ? "admin" : "staff");
        var userDto = MapToDto(record, cookiePortal, record.ActiveSessionToken);
        return Ok(ApiResponse<AuthUserDto>.Ok(userDto, "Lấy thông tin phiên đăng nhập thành công."));
    }

    /// <summary>
    /// Đăng xuất và hủy HttpOnly Cookie
    /// </summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdClaim, out var userId))
        {
            var tabToken = Request.Headers["X-Tab-Session-Id"].FirstOrDefault();
            var record = await _authRepository.GetUserByIdAsync(userId);
            if (record != null && (string.IsNullOrWhiteSpace(tabToken) || string.Equals(record.ActiveSessionToken, tabToken, StringComparison.Ordinal)))
            {
                await _authRepository.UpdateActiveSessionTokenAsync(userId, null);
            }
        }

        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Ok(ApiResponse<bool>.Ok(true, "Đã đăng xuất khỏi hệ thống."));
    }

    /// <summary>
    /// Đổi mật khẩu của người dùng đang đăng nhập
    /// </summary>
    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu đổi mật khẩu không hợp lệ.", errors));
        }

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));
        }

        var record = await _authRepository.GetUserByIdAsync(userId);
        if (record == null)
        {
            return Unauthorized(ApiResponse.Fail("Không tìm thấy tài khoản."));
        }

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, record.PasswordHash))
        {
            return BadRequest(ApiResponse.Fail("Mật khẩu hiện tại không chính xác."));
        }

        var newHash = _passwordHasher.HashPassword(request.NewPassword);
        await _authRepository.ChangePasswordAsync(userId, newHash);

        return Ok(ApiResponse<bool>.Ok(true, "Đổi mật khẩu thành công."));
    }

    private static AuthUserDto MapToDto(AuthUserRecord record, string activePortal, string sessionToken)
    {
        var perms = new HashSet<string>(record.Permissions, StringComparer.OrdinalIgnoreCase);
        var isAdminRole = record.Roles.Contains("Admin", StringComparer.OrdinalIgnoreCase);

        var modules = new List<string>();
        if (activePortal == "admin")
        {
            if (isAdminRole || perms.Contains("CMS_MANAGE"))
                modules.Add("cms");
            if (isAdminRole || perms.Contains("CRM_MANAGE") || perms.Contains("CRM_VOUCHER"))
                modules.Add("crm");
            if (isAdminRole || perms.Any(p => p.StartsWith("HRM_", StringComparison.OrdinalIgnoreCase) || p.Equals("PAYROLL_MANAGE", StringComparison.OrdinalIgnoreCase) || p.Equals("SYSTEM_RBAC", StringComparison.OrdinalIgnoreCase)))
                modules.Add("hrm");
            if (isAdminRole || perms.Any(p => p.StartsWith("ERP_", StringComparison.OrdinalIgnoreCase) || p.Equals("REPORT_VIEW", StringComparison.OrdinalIgnoreCase)))
                modules.Add("erp");
        }
        else
        {
            // Cổng Nhân viên (/staff): chỉ phục vụ phân hệ HRM cá nhân / trưởng ca
            modules.Add("hrm");
        }

        var roleDisplay = !string.IsNullOrWhiteSpace(record.Position)
            ? record.Position
            : (record.RoleDescriptions.FirstOrDefault() ?? record.Roles.FirstOrDefault() ?? "Nhân viên");

        return new AuthUserDto
        {
            UserId = record.UserId,
            Username = record.Username,
            FullName = record.FullName,
            Email = record.Email ?? string.Empty,
            PhoneNumber = record.PhoneNumber,
            MustChangePassword = record.MustChangePassword,
            EmployeeId = record.EmployeeId,
            EmployeeCode = record.EmployeeCode,
            Position = record.Position ?? string.Empty,
            BranchId = record.BranchId,
            BranchCode = record.BranchCode,
            BranchName = record.BranchName,
            HierarchyLevel = record.HierarchyLevel,
            ApprovalLevel = record.ApprovalLevel,
            Portal = activePortal,
            SessionToken = sessionToken,
            RoleDisplay = roleDisplay,
            Roles = record.Roles,
            Permissions = record.Permissions,
            Modules = modules,
        };
    }
}
