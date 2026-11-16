using System.Text.Json;
using FiinCoffee.Infrastructure;
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

// 4. Đăng ký Hạ tầng dữ liệu Dapper & Bảo mật
builder.Services.AddInfrastructure();

var app = builder.Build();

// 5. Cấu hình HTTP Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Fiin Coffee API v1");
        c.RoutePrefix = "swagger";
    });
}

app.UseHttpsRedirection();

app.UseCors("AllowAngularClient");

app.UseAuthorization();

app.MapControllers();

// Chuyển hướng trang chủ sang Swagger UI trong môi trường Dev
app.MapGet("/", () => Results.Redirect("/swagger"));

app.Run();
