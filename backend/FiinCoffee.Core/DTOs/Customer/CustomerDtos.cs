using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.Customer;

public class CustomerProfileDto
{
    public int CustomerId { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string? DefaultAddress { get; set; }
    public string MembershipTier { get; set; } = "Standard";
    public int LoyaltyPoints { get; set; }
    public int TotalOrders { get; set; }
    public decimal TotalSpent { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
}

public class UpdateCustomerProfileRequestDto
{
    [Required(ErrorMessage = "Vui lòng nhập họ và tên.")]
    [MinLength(2, ErrorMessage = "Họ và tên tối thiểu 2 ký tự.")]
    public string FullName { get; set; } = string.Empty;

    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public DateTime? DateOfBirth { get; set; }
    public string? Gender { get; set; }
}
