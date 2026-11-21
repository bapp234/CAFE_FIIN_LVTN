using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Dapper;
using Microsoft.Data.SqlClient;
using FiinCoffee.Api.Services;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.Auth;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class AuthController : ControllerBase
{
    private readonly IAuthRepository _authRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailSender _emailSender;
    private readonly IWebHostEnvironment _environment;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthRepository authRepository,
        IPasswordHasher passwordHasher,
        IEmailSender emailSender,
        IWebHostEnvironment environment,
        ILogger<AuthController> logger)
    {
        _authRepository = authRepository;
        _passwordHasher = passwordHasher;
        _emailSender = emailSender;
        _environment = environment;
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
        if (requestedPortal == "customer")
        {
            if (record.CustomerId == null && !record.Roles.Contains("Customer", StringComparer.OrdinalIgnoreCase))
            {
                return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail("Tài khoản này là tài khoản nội bộ, không phải tài khoản khách hàng."));
            }

            if (!record.IsEmailVerified)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new
                {
                    success = false,
                    code = "EMAIL_NOT_VERIFIED",
                    email = record.Email,
                    message = "Tài khoản chưa xác thực Gmail. Vui lòng kiểm tra hộp thư hoặc bấm gửi lại liên kết xác thực."
                });
            }
        }
        else
        {
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
        }


        var activePortal = requestedPortal switch
        {
            "staff" => "staff",
            "customer" => "customer",
            _ => "admin",
        };

        var authScheme = activePortal == "customer"
            ? "CustomerCookie"
            : CookieAuthenticationDefaults.AuthenticationScheme;

        var sessionToken = string.Empty;
        if (activePortal != "customer")
        {
            sessionToken = Guid.NewGuid().ToString("N");
            await _authRepository.UpdateActiveSessionTokenAsync(record.UserId, sessionToken);
        }

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
        if (record.CustomerId.HasValue)
            claims.Add(new Claim("customer_id", record.CustomerId.Value.ToString()));
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

        var identity = new ClaimsIdentity(claims, authScheme);
        var principal = new ClaimsPrincipal(identity);

        await HttpContext.SignInAsync(
            authScheme,
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
    public async Task<IActionResult> Me()
    {
        var staffAuth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        var customerAuth = await HttpContext.AuthenticateAsync("CustomerCookie");

        var activePrincipal = staffAuth.Succeeded
            ? staffAuth.Principal
            : (customerAuth.Succeeded ? customerAuth.Principal : null);

        var isCustomerScheme = !staffAuth.Succeeded && customerAuth.Succeeded;

        if (activePrincipal == null)
        {
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập chưa được xác thực hoặc đã hết hạn."));
        }

        var userIdClaim = activePrincipal.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));
        }

        var record = await _authRepository.GetUserByIdAsync(userId);
        if (record == null || !record.IsActive || (!isCustomerScheme && string.Equals(record.EmployeeStatus, "resigned", StringComparison.OrdinalIgnoreCase)))
        {
            await HttpContext.SignOutAsync(isCustomerScheme ? "CustomerCookie" : CookieAuthenticationDefaults.AuthenticationScheme);
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập đã hết hiệu lực."));
        }

        if (!isCustomerScheme)
        {
            var tabToken = Request.Headers["X-Tab-Session-Id"].FirstOrDefault();
            var cookieToken = activePrincipal.FindFirstValue("session_token");
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
        }

        var portal = isCustomerScheme
            ? "customer"
            : (activePrincipal.FindFirstValue("portal") ?? (record.HierarchyLevel >= 3 ? "admin" : "staff"));

        var userDto = MapToDto(record, portal, record.ActiveSessionToken ?? string.Empty);
        return Ok(ApiResponse<AuthUserDto>.Ok(userDto, "Lấy thông tin phiên đăng nhập thành công."));
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout([FromQuery] string? portal = null)
    {
        if (string.Equals(portal, "customer", StringComparison.OrdinalIgnoreCase))
        {
            await HttpContext.SignOutAsync("CustomerCookie");
            return Ok(ApiResponse<bool>.Ok(true, "Đã đăng xuất tài khoản khách hàng."));
        }

        var staffAuth = await HttpContext.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        var userIdStr = staffAuth.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdStr, out var userId))
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

    /// <summary>
    /// Đăng ký tài khoản Khách hàng mới và gửi liên kết xác thực qua Gmail
    /// </summary>
    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterCustomer([FromBody] CustomerRegisterRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Thông tin đăng ký chưa hợp lệ.", errors));
        }

        try
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var passwordHash = _passwordHasher.HashPassword(request.Password);
            var (userId, customerId) = await _authRepository.RegisterCustomerAsync(
                email,
                passwordHash,
                request.FullName,
                request.PhoneNumber,
                email);

            var (actionLink, sentViaSmtp) = await IssueAndSendTokenEmailAsync(
                email,
                "EmailVerify",
                expireMinutes: 1440,
                modeQuery: "verify-email",
                subject: "[Cà Phê Fiin] Xác thực tài khoản thành viên",
                heading: "Xác thực tài khoản Cà Phê Fiin",
                description: "Cảm ơn bạn đã đăng ký thành viên. Vui lòng bấm vào nút bên dưới để xác thực địa chỉ Gmail (liên kết có hiệu lực trong 24 giờ):",
                buttonText: "Xác thực tài khoản ngay");

            return Ok(ApiResponse<object>.Ok(
                new
                {
                    userId,
                    customerId,
                    sentViaSmtp,
                    devActionLink = _environment.IsDevelopment() && !sentViaSmtp ? actionLink : null,
                },
                sentViaSmtp
                    ? "Đăng ký thành công! Vui lòng kiểm tra hộp thư Gmail để xác thực tài khoản."
                    : "Đăng ký thành công! (Chưa cấu hình SMTP Gmail, hãy dùng liên kết xác thực hiển thị bên dưới để kích hoạt)."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Gửi lại liên kết xác thực Gmail cho tài khoản chưa kích hoạt
    /// </summary>
    [HttpPost("resend-verification")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendVerification([FromBody] ForgotPasswordRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse.Fail("Email không hợp lệ."));

        try
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var record = await _authRepository.GetUserForLoginAsync(email);
            if (record == null)
                return BadRequest(ApiResponse.Fail("Không tìm thấy tài khoản gắn với email này."));

            if (record.IsEmailVerified)
                return Ok(ApiResponse<object>.Ok(new { alreadyVerified = true }, "Tài khoản này đã được xác thực trước đó."));

            var (actionLink, sentViaSmtp) = await IssueAndSendTokenEmailAsync(
                email,
                "EmailVerify",
                expireMinutes: 1440,
                modeQuery: "verify-email",
                subject: "[Cà Phê Fiin] Gửi lại liên kết xác thực tài khoản",
                heading: "Xác thực tài khoản Cà Phê Fiin",
                description: "Vui lòng bấm vào nút bên dưới để hoàn tất xác thực địa chỉ Gmail của bạn:",
                buttonText: "Xác thực tài khoản");

            return Ok(ApiResponse<object>.Ok(
                new
                {
                    sentViaSmtp,
                    devActionLink = _environment.IsDevelopment() && !sentViaSmtp ? actionLink : null,
                },
                sentViaSmtp
                    ? "Đã gửi lại liên kết xác thực tới Gmail của bạn."
                    : "Đã tạo liên kết xác thực mới (chưa cấu hình SMTP Gmail)."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Xác thực tài khoản từ token trong link Gmail
    /// </summary>
    [HttpPost("verify-email")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyEmail([FromBody] VerifyEmailRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse.Fail("Liên kết xác thực không hợp lệ."));

        try
        {
            var tokenHash = HashToken(request.Token);
            await _authRepository.VerifyEmailTokenAsync(tokenHash);
            return Ok(ApiResponse<bool>.Ok(true, "Xác thực tài khoản thành công! Bạn có thể đăng nhập ngay."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Gửi liên kết đặt lại mật khẩu tới Gmail
    /// </summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequestDto request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ApiResponse.Fail("Email không hợp lệ."));

        try
        {
            var email = request.Email.Trim().ToLowerInvariant();
            var (actionLink, sentViaSmtp) = await IssueAndSendTokenEmailAsync(
                email,
                "PasswordReset",
                expireMinutes: 30,
                modeQuery: "reset-password",
                subject: "[Cà Phê Fiin] Đặt lại mật khẩu tài khoản",
                heading: "Yêu cầu đặt lại mật khẩu",
                description: "Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản Cà Phê Fiin. Liên kết dưới đây có hiệu lực trong 30 phút:",
                buttonText: "Đặt lại mật khẩu");

            return Ok(ApiResponse<object>.Ok(
                new
                {
                    sentViaSmtp,
                    devActionLink = _environment.IsDevelopment() && !sentViaSmtp ? actionLink : null,
                },
                sentViaSmtp
                    ? $"Đã gửi liên kết đặt lại mật khẩu tới {email}. Vui lòng kiểm tra hộp thư."
                    : $"Đã tạo liên kết đặt lại mật khẩu cho {email} (chưa cấu hình SMTP Gmail)."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Đặt lại mật khẩu mới từ token trong link Gmail
    /// </summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordByTokenRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu đặt lại mật khẩu chưa hợp lệ.", errors));
        }

        try
        {
            var tokenHash = HashToken(request.Token);
            var newHash = _passwordHasher.HashPassword(request.NewPassword);
            await _authRepository.ResetPasswordByTokenAsync(tokenHash, newHash);
            return Ok(ApiResponse<bool>.Ok(true, "Đặt lại mật khẩu thành công! Vui lòng đăng nhập bằng mật khẩu mới."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    private async Task<(string ActionLink, bool SentViaSmtp)> IssueAndSendTokenEmailAsync(
        string email,
        string tokenType,
        int expireMinutes,
        string modeQuery,
        string subject,
        string heading,
        string description,
        string buttonText)
    {
        var rawToken = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var tokenHash = HashToken(rawToken);
        var issued = await _authRepository.CreateAuthTokenAsync(email, tokenType, tokenHash, expireMinutes);
        var actionLink = $"{_emailSender.FrontendBaseUrl}/auth?mode={modeQuery}&token={Uri.EscapeDataString(rawToken)}";

        var htmlBody = $@"
<div style=""font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e6dcc8;border-radius:8px;background:#faf7f0;color:#2b1e16"">
  <h2 style=""margin-top:0;color:#2f5d58"">{heading}</h2>
  <p>Xin chào <strong>{System.Net.WebUtility.HtmlEncode(issued.FullName)}</strong>,</p>
  <p>{description}</p>
  <p style=""margin:24px 0"">
    <a href=""{actionLink}"" style=""display:inline-block;padding:12px 20px;background:#2f5d58;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold"">{buttonText}</a>
  </p>
  <p style=""font-size:12px;color:#6d5c4d"">Nếu nút không hoạt động, bạn có thể dán đường dẫn sau vào trình duyệt:<br/>{actionLink}</p>
</div>";

        var sentViaSmtp = await _emailSender.SendAsync(email, subject, htmlBody);
        return (actionLink, sentViaSmtp);
    }

    private static string HashToken(string rawToken)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(rawToken.Trim()));
        return Convert.ToHexString(bytes);
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
        else if (activePortal == "customer")
        {
            modules.Add("customer");
        }
        else
        {
            // Cổng Nhân viên (/staff): chỉ phục vụ phân hệ HRM cá nhân / trưởng ca
            modules.Add("hrm");
        }

        var roleDisplay = activePortal == "customer"
            ? "Khách hàng thành viên"
            : (!string.IsNullOrWhiteSpace(record.Position)
                ? record.Position
                : (record.RoleDescriptions.FirstOrDefault() ?? record.Roles.FirstOrDefault() ?? "Nhân viên"));

        return new AuthUserDto
        {
            UserId = record.UserId,
            Username = record.Username,
            FullName = record.FullName,
            Email = record.Email ?? string.Empty,
            PhoneNumber = record.PhoneNumber,
            MustChangePassword = record.MustChangePassword,
            IsEmailVerified = record.IsEmailVerified,
            CustomerId = record.CustomerId,
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

    [HttpPost("change-password/request")]
    [Authorize]
    public async Task<IActionResult> RequestPasswordChange(
        [FromBody] FiinCoffee.Core.DTOs.Auth.ChangePasswordRequestDto request,
        [FromServices] IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(ApiResponse.Fail("Mật khẩu mới phải có ít nhất 6 ký tự."));

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));

        var record = await _authRepository.GetUserByIdAsync(userId);
        if (record == null || string.IsNullOrWhiteSpace(record.Email))
            return NotFound(ApiResponse.Fail("Không tìm thấy tài khoản hoặc email."));

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, record.PasswordHash))
            return BadRequest(ApiResponse.Fail("Mật khẩu hiện tại không chính xác."));

        var newHash = _passwordHasher.HashPassword(request.NewPassword);
        var token = WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(32));

        await using var conn = new SqlConnection(config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync(
            "dbo.sp_AUTH_CreatePasswordChangeRequest",
            new { UserId = userId, NewPasswordHash = newHash, Token = token },
            commandType: CommandType.StoredProcedure);

        var frontendUrl = config["EmailSettings:FrontendBaseUrl"] ?? "http://localhost:4200";
        var confirmUrl = $"{frontendUrl.TrimEnd('/')}/profile?pwToken={Uri.EscapeDataString(token)}";
        var html = $"<p>Nhấn vào liên kết sau để xác nhận đổi mật khẩu:</p><p><a href=\"{confirmUrl}\">Xác nhận đổi mật khẩu</a></p>";

        await _emailSender.SendAsync(record.Email, "Xác nhận đổi mật khẩu - Cà Phê Fiin", html);
        return Ok(ApiResponse.Ok("Đã gửi email xác nhận đổi mật khẩu. Vui lòng kiểm tra hộp thư."));
    }

    [HttpGet("change-password/confirm")]
    [AllowAnonymous]
    public async Task<IActionResult> ConfirmPasswordChange(
        [FromQuery] string token,
        [FromServices] IConfiguration config)
    {
        if (string.IsNullOrWhiteSpace(token))
            return BadRequest(ApiResponse.Fail("Thiếu mã xác nhận."));

        await using var conn = new SqlConnection(config.GetConnectionString("DefaultConnection"));
        var affected = await conn.QueryFirstOrDefaultAsync<int>(
            "dbo.sp_AUTH_ConfirmPasswordChange",
            new { Token = token },
            commandType: CommandType.StoredProcedure);

        if (affected <= 0)
            return BadRequest(ApiResponse.Fail("Liên kết xác nhận không hợp lệ hoặc đã hết hạn."));

        return Ok(ApiResponse.Ok("Đổi mật khẩu thành công!"));
    }
}