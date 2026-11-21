using FiinCoffee.Core.DTOs.Customer;

namespace FiinCoffee.Core.Interfaces;

public interface ICustomerRepository
{
    Task<CustomerProfileDto?> GetProfileByUserIdAsync(int userId);
    Task<CustomerProfileDto?> UpdateProfileAsync(int userId, UpdateCustomerProfileRequestDto request);
}
