using System.Data;
using Dapper;
using FiinCoffee.Core.DTOs.Customer;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;

namespace FiinCoffee.Infrastructure.Repositories;

public class CustomerRepository : ICustomerRepository
{
    private readonly IDbConnectionFactory _connectionFactory;

    public CustomerRepository(IDbConnectionFactory connectionFactory)
    {
        _connectionFactory = connectionFactory;
    }

    public async Task<CustomerProfileDto?> GetProfileByUserIdAsync(int userId)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<CustomerProfileDto>(
            "dbo.sp_CUST_GetProfile",
            new { UserId = userId },
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<CustomerProfileDto?> UpdateProfileAsync(int userId, UpdateCustomerProfileRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        return await connection.QueryFirstOrDefaultAsync<CustomerProfileDto>(
            "dbo.sp_CUST_UpdateProfile",
            new
            {
                UserId = userId,
                FullName = request.FullName.Trim(),
                PhoneNumber = request.PhoneNumber?.Trim(),
                Email = request.Email?.Trim(),
                DateOfBirth = request.DateOfBirth?.Date,
                Gender = request.Gender?.Trim(),
            },
            commandType: CommandType.StoredProcedure
        );
    }
}
