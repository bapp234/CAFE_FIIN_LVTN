using System.Security.Claims;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.Customer;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
[Authorize]
public class CustomerController : ControllerBase
{
    private readonly ICustomerRepository _customerRepository;

    public CustomerController(ICustomerRepository customerRepository)
    {
        _customerRepository = customerRepository;
    }

    [HttpGet("profile")]
    public async Task<IActionResult> GetProfile()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));

        var profile = await _customerRepository.GetProfileByUserIdAsync(userId);
        if (profile == null)
            return NotFound(ApiResponse.Fail("Không tìm thấy hồ sơ khách hàng."));

        return Ok(ApiResponse<CustomerProfileDto>.Ok(profile, "Lấy hồ sơ khách hàng thành công."));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateCustomerProfileRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Thông tin cập nhật không hợp lệ.", errors));
        }

        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdClaim, out var userId))
            return Unauthorized(ApiResponse.Fail("Phiên đăng nhập không hợp lệ."));

        var updated = await _customerRepository.UpdateProfileAsync(userId, request);
        if (updated == null)
            return NotFound(ApiResponse.Fail("Không tìm thấy hồ sơ khách hàng."));

        return Ok(ApiResponse<CustomerProfileDto>.Ok(updated, "Cập nhật hồ sơ thành công."));
    }
}
