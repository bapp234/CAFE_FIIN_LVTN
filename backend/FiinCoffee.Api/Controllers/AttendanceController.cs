using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class AttendanceController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly ILogger<AttendanceController> _logger;

    public AttendanceController(IEmployeeRepository employeeRepository, ILogger<AttendanceController> logger)
    {
        _employeeRepository = employeeRepository;
        _logger = logger;
    }

    /// <summary>
    /// Lấy danh sách đối soát chấm công ngày và 4 thẻ thống kê KPI chuẩn DevExtreme
    /// </summary>
    [HttpGet("monitor")]
    [ProducesResponseType(typeof(ApiResponse<DailyAttendanceMonitorResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDailyMonitor(
        [FromQuery] DateTime? workDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] string? currentUsername = null)
    {
        var result = await _employeeRepository.GetDailyAttendanceMonitorAsync(workDate, branchId, status, search, currentUsername);
        return Ok(ApiResponse<DailyAttendanceMonitorResponse>.Ok(result, "Lấy dữ liệu chấm công ngày thành công"));
    }

    /// <summary>
    /// Xuất dữ liệu báo cáo chấm công tổng hợp theo khoảng thời gian
    /// </summary>
    [HttpGet("report")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<AttendanceReportItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportReport(
        [FromQuery] DateTime fromDate,
        [FromQuery] DateTime toDate,
        [FromQuery] int? branchId = null,
        [FromQuery] string? currentUsername = null)
    {
        if (toDate < fromDate)
        {
            return BadRequest(ApiResponse.Fail("Ngày kết thúc không được nhỏ hơn ngày bắt đầu."));
        }

        var report = await _employeeRepository.ExportAttendanceReportAsync(fromDate, toDate, branchId, currentUsername);
        return Ok(ApiResponse<IEnumerable<AttendanceReportItemDto>>.Ok(report, "Xuất báo cáo chấm công thành công"));
    }
}
