using System.Security.Claims;
using System.Text.Json;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.OpenApi;

var builder = WebApplication.CreateBuilder(args);

// 1. Cấu hình Controllers và JSON Serializer đồng bộ với Angular (camelCase)
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    });

// 2. Cấu hình Swagger / OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Fiin Coffee Management API",
        Version = "v1",
        Description = "Hệ sinh thái Backend Web API Quản lý Kinh doanh Quán Cà Phê Fiin (Admin CMS, CRM, HRM, ERP & Customer App)."
    });
});

// 3. Cấu hình CORS cho phép Angular Client với Cookie Credentials
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:4200"];

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularClient", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials(); // Bắt buộc để truyền tải HttpOnly Cookie
    });
});

// 4. Cấu hình xác thực phiên HttpOnly Cookie (Admin Portal & Staff Portal)
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "fiin_auth_session";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(12);
        options.SlidingExpiration = true;

        options.Events = new CookieAuthenticationEvents
        {
            OnValidatePrincipal = async ctx =>
            {
                var userIdStr = ctx.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId))
                {
                    ctx.RejectPrincipal();
                    return;
                }

                var repo = ctx.HttpContext.RequestServices.GetRequiredService<IAuthRepository>();
                var record = await repo.GetUserByIdAsync(userId);
                if (record == null || !record.IsActive || string.Equals(record.EmployeeStatus, "resigned", StringComparison.OrdinalIgnoreCase))
                {
                    ctx.RejectPrincipal();
                    return;
                }

                var tabToken = ctx.HttpContext.Request.Headers["X-Tab-Session-Id"].FirstOrDefault();
                var cookieToken = ctx.Principal?.FindFirstValue("session_token");
                var presented = !string.IsNullOrWhiteSpace(tabToken) ? tabToken : cookieToken;

                if (string.IsNullOrWhiteSpace(record.ActiveSessionToken) ||
                    !string.Equals(record.ActiveSessionToken, presented, StringComparison.Ordinal))
                {
                    ctx.HttpContext.Items["SessionReplaced"] = true;
                    ctx.RejectPrincipal();
                }
            },
            OnRedirectToLogin = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
                ctx.Response.ContentType = "application/json; charset=utf-8";
                if (ctx.HttpContext.Items.ContainsKey("SessionReplaced"))
                {
                    return ctx.Response.WriteAsJsonAsync(new
                    {
                        success = false,
                        code = "SESSION_REPLACED",
                        message = "Tài khoản đã được đăng nhập ở một cửa sổ khác hoặc phiên đã kết thúc."
                    });
                }
                return ctx.Response.WriteAsJsonAsync(ApiResponse.Fail("Phiên đăng nhập chưa được xác thực hoặc đã hết hạn."));
            },
            OnRedirectToAccessDenied = ctx =>
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                ctx.Response.ContentType = "application/json; charset=utf-8";
                return ctx.Response.WriteAsJsonAsync(ApiResponse.Fail("Bạn không có quyền thực hiện thao tác này."));
            },
        };
    });

builder.Services.AddAuthorization();

// 5. Đăng ký Hạ tầng dữ liệu Dapper & Bảo mật
builder.Services.AddInfrastructure();
builder.Services.AddScoped<FiinCoffee.Api.Services.ILockPasswordVerifier, FiinCoffee.Api.Services.LockPasswordVerifier>();

var app = builder.Build();

// 6. Cấu hình HTTP Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Fiin Coffee API v1");
        c.RoutePrefix = "swagger";
    });
}
else
{
    app.UseHttpsRedirection();
}

app.UseCors("AllowAngularClient");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Chuyển hướng trang chủ sang Swagger UI trong môi trường Dev
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
