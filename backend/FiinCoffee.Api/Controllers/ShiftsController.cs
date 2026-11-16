using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class ShiftsController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly ILogger<ShiftsController> _logger;

    public ShiftsController(IEmployeeRepository employeeRepository, ILogger<ShiftsController> logger)
    {
        _employeeRepository = employeeRepository;
        _logger = logger;
    }

    /// <summary>
    /// Lấy danh mục các mẫu ca làm việc đang hoạt động
    /// </summary>
    [HttpGet("templates")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ShiftTemplateDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTemplates()
    {
        var templates = await _employeeRepository.GetShiftTemplatesAsync();
        return Ok(ApiResponse<IEnumerable<ShiftTemplateDto>>.Ok(templates, "Lấy danh mục ca mẫu thành công"));
    }

    /// <summary>
    /// Thêm mới hoặc cập nhật một mẫu ca làm việc
    /// </summary>
    [HttpPost("templates")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UpsertTemplate([FromBody] UpsertShiftTemplateRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ShiftCode) || string.IsNullOrWhiteSpace(request.ShiftName))
        {
            return BadRequest(ApiResponse.Fail("Mã ca và tên ca không được để trống."));
        }

        try
        {
            var templateId = await _employeeRepository.UpsertShiftTemplateAsync(request);
            return Ok(ApiResponse<object>.Ok(new { templateId, request.ShiftCode }, "Lưu mẫu ca làm việc thành công"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lỗi khi lưu mẫu ca {ShiftCode}: {Message}", request.ShiftCode, ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Xuất ma trận lịch phân ca 7 ngày trong tuần phục vụ hiển thị & tải Excel
    /// </summary>
    [HttpGet("weekly-schedule")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<WeeklyScheduleMatrixRowDto>>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ExportWeeklySchedule(
        [FromQuery] int branchId,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate,
        [FromQuery] string? currentUsername = null)
    {
        if (branchId <= 0)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng chọn chi nhánh hợp lệ."));
        }

        if (endDate < startDate)
        {
            return BadRequest(ApiResponse.Fail("Ngày kết thúc không được nhỏ hơn ngày bắt đầu."));
        }

        var schedule = await _employeeRepository.ExportWeeklyScheduleAsync(branchId, startDate, endDate, currentUsername);
        return Ok(ApiResponse<IEnumerable<WeeklyScheduleMatrixRowDto>>.Ok(schedule, "Xuất lịch phân ca tuần thành công"));
    }
}
