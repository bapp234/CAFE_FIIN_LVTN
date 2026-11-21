using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;
using FiinCoffee.Infrastructure.Excel;
using FiinCoffee.Infrastructure.Repositories;
using FiinCoffee.Infrastructure.Security;
using FiinCoffee.Infrastructure.Word;
using Microsoft.Extensions.DependencyInjection;

namespace FiinCoffee.Infrastructure;

public static class DependencyInjection
{
    /// <summary>
    /// Đăng ký toàn bộ dịch vụ hạ tầng (Database Dapper, Password Hasher, Repositories) vào DI Container
    /// </summary>
    public static IServiceCollection AddInfrastructure(this IServiceCollection services)
    {
        services.AddSingleton<IDbConnectionFactory, DbConnectionFactory>();
        services.AddSingleton<IPasswordHasher, PasswordHasher>();
        services.AddScoped<IExcelExportEngine, PExcelExportEngine>();
        services.AddScoped<IExcelImportEngine, PExcelImportEngine>();
        services.AddScoped<IContractExcelService, ContractExcelService>();
        services.AddScoped<IWordTemplateEngine, WordTemplateEngine>();
        services.AddScoped<IAuthRepository, AuthRepository>();
        services.AddScoped<ICustomerRepository, CustomerRepository>();
        services.AddScoped<IContractRepository, ContractRepository>();
        services.AddScoped<IEmployeeRepository, EmployeeRepository>();
        services.AddScoped<IApprovalRepository, ApprovalRepository>();
        services.AddScoped<IHrmRoleSettingsRepository, HrmRoleSettingsRepository>();

        return services;
    }
}
