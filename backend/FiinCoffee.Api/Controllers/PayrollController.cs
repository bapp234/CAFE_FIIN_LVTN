using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class PayrollController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly ILogger<PayrollController> _logger;

    public PayrollController(IEmployeeRepository employeeRepository, ILogger<PayrollController> logger)
    {
        _employeeRepository = employeeRepository;
        _logger = logger;
    }

    /// <summary>
    /// Lấy chi tiết bảng lương tháng (Header kỳ lương + Danh sách phiếu lương nhân sự)
    /// </summary>
    [HttpGet("{periodMonth}")]
    [ProducesResponseType(typeof(ApiResponse<PayrollPeriodDetailsResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayrollDetails(
        [FromRoute] string periodMonth,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? currentUsername = null)
    {
        var result = await _employeeRepository.GetPayrollPeriodDetailsAsync(periodMonth, branchId, status, search, currentUsername);
        return Ok(ApiResponse<PayrollPeriodDetailsResponse>.Ok(result, $"Lấy dữ liệu bảng lương kỳ {periodMonth} thành công"));
    }

    /// <summary>
    /// Kích hoạt tính toán bảng lương tự động (Giờ thực tế + OT x1.5 + Phụ cấp - Khấu trừ trễ)
    /// </summary>
    [HttpPost("calculate")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CalculatePayroll([FromBody] CalculatePayrollRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PeriodMonth))
        {
            return BadRequest(ApiResponse.Fail("Vui lòng cung cấp kỳ tính lương dạng YYYY-MM (ví dụ: '2026-11')."));
        }

        try
        {
            var periodId = await _employeeRepository.CalculatePayrollAsync(request.PeriodMonth, request.BranchId, "Hệ thống");
            _logger.LogInformation("Đã tính toán bảng lương kỳ {PeriodMonth} thành công (PeriodId = {PeriodId})", request.PeriodMonth, periodId);

            return Ok(ApiResponse<object>.Ok(new { periodId, request.PeriodMonth }, "Tính toán bảng lương thành công"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lỗi khi tính toán bảng lương kỳ {PeriodMonth}: {Message}", request.PeriodMonth, ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Phê duyệt và chính thức khóa sổ kỳ tính lương
    /// </summary>
    [HttpPost("lock")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LockPayrollPeriod([FromBody] LockPayrollPeriodRequest request)
    {
        if (request.PeriodId <= 0 || string.IsNullOrWhiteSpace(request.ApproverName))
        {
            return BadRequest(ApiResponse.Fail("PeriodId và tên người phê duyệt không được để trống."));
        }

        try
        {
            await _employeeRepository.LockPayrollPeriodAsync(request.PeriodId, request.ApproverName);
            return Ok(ApiResponse<object>.Ok(new { request.PeriodId }, "Đã phê duyệt và khóa sổ kỳ tính lương thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
