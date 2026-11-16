using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;
using FiinCoffee.Infrastructure.Repositories;
using FiinCoffee.Infrastructure.Security;
using Microsoft.Extensions.DependencyInjection;

namespace FiinCoffee.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Đăng ký toàn bộ dịch vụ hạ tầng (Database Dapper, Password Hasher, Repositories) vào DI Container
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        // 1. Dịch vụ cốt lõi
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        // 2. Repositories kết nối CSDL qua Dapper
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<IApprovalRepository, ApprovalRepository>();

        return services;
    }
}
