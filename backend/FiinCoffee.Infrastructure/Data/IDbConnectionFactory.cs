using System.Data;

namespace FiinCoffee.Infrastructure.Data;

/// <summary>
/// Interface cung cấp kết nối Database cho Dapper
/// </summary>
public interface IDbConnectionFactory
{
    IDbConnection CreateConnection();
}
