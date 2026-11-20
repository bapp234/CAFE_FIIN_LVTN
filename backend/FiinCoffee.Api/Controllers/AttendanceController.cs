using FiinCoffee.Api.Services;
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
    private readonly ILockPasswordVerifier _lockPasswordVerifier;
    private readonly ILogger<AttendanceController> _logger;

    public AttendanceController(
        IEmployeeRepository employeeRepository,
        ILockPasswordVerifier lockPasswordVerifier,
        ILogger<AttendanceController> logger)
    {
        _employeeRepository = employeeRepository;
        _lockPasswordVerifier = lockPasswordVerifier;
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

    /// <summary>
    /// Lấy bảng tổng hợp công tháng theo quy tắc chuẩn hóa giờ ca + OT duyệt + nghỉ phép duyệt
    /// </summary>
    [HttpGet("monthly-summary")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<AttendanceMonthlySummaryItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMonthlySummary(
        [FromQuery] string periodMonth,
        [FromQuery] int? branchId = null,
        [FromQuery] string? search = null)
    {
        if (string.IsNullOrWhiteSpace(periodMonth) ||
            !System.Text.RegularExpressions.Regex.IsMatch(periodMonth.Trim(), @"^\d{4}-\d{2}$"))
        {
            return BadRequest(ApiResponse.Fail("Kỳ tháng (periodMonth) phải có định dạng YYYY-MM."));
        }

        var items = await _employeeRepository.GetAttendanceMonthlySummaryAsync(periodMonth.Trim(), branchId, search);
        return Ok(ApiResponse<IEnumerable<AttendanceMonthlySummaryItemDto>>.Ok(items, "Lấy bảng tổng hợp công tháng thành công"));
    }

    /// <summary>
    /// Lấy trạng thái chốt khóa bảng công tháng của chi nhánh
    /// </summary>
    [HttpGet("period-status")]
    [ProducesResponseType(typeof(ApiResponse<AttendancePeriodStatusDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPeriodStatus(
        [FromQuery] int? branchId,
        [FromQuery] string periodMonth)
    {
        if (string.IsNullOrWhiteSpace(periodMonth))
        {
            return BadRequest(ApiResponse.Fail("Kỳ tháng (periodMonth) không được để trống."));
        }

        var status = await _employeeRepository.GetAttendancePeriodStatusAsync(branchId, periodMonth.Trim());
        return Ok(ApiResponse<AttendancePeriodStatusDto?>.Ok(status, "Lấy trạng thái kỳ công thành công"));
    }

    /// <summary>
    /// Chốt và khóa bảng công tháng
    /// </summary>
    [HttpPost("lock-period")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> LockPeriod([FromBody] LockAttendancePeriodRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PeriodMonth))
        {
            return BadRequest(ApiResponse.Fail("Kỳ tháng (periodMonth) không được để trống."));
        }

        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.Password, request.LockedBy);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
        }

        string lockedBy = string.IsNullOrWhiteSpace(request.LockedBy) 
            ? (User.Identity?.Name ?? "hr_admin") 
            : request.LockedBy.Trim();

        try
        {
            var success = await _employeeRepository.LockAttendancePeriodAsync(request.BranchId, request.PeriodMonth.Trim(), lockedBy);
            return Ok(ApiResponse<bool>.Ok(success, $"Đã chốt và khóa bảng công tháng {request.PeriodMonth} thành công."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Mở khóa bảng công tháng (xác thực mật khẩu và lý do mở khóa)
    /// </summary>
    [HttpPost("unlock-period")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UnlockPeriod([FromBody] UnlockAttendancePeriodRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.PeriodMonth))
        {
            return BadRequest(ApiResponse.Fail("Kỳ tháng (periodMonth) không được để trống."));
        }
        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.UnlockPassword, request.UnlockedBy);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
        }
        if (string.IsNullOrWhiteSpace(request.UnlockReason) || request.UnlockReason.Trim().Length < 5)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng nhập lý do mở khóa (tối thiểu 5 ký tự)."));
        }

        string unlockedBy = string.IsNullOrWhiteSpace(request.UnlockedBy)
            ? (User.Identity?.Name ?? "hr_admin")
            : request.UnlockedBy.Trim();

        string? clientIp = HttpContext.Connection.RemoteIpAddress?.ToString();

        try
        {
            var success = await _employeeRepository.UnlockAttendancePeriodAsync(
                request.BranchId,
                request.PeriodMonth.Trim(),
                "__VERIFIED_BY_API__",
                request.UnlockReason.Trim(),
                unlockedBy,
                clientIp
            );
            return Ok(ApiResponse<bool>.Ok(success, $"Đã mở khóa bảng công tháng {request.PeriodMonth} thành công."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("overtime-types")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<OvertimeTypeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOvertimeTypes([FromQuery] string? scope = null, [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetOvertimeTypesAsync(scope, search);
        return Ok(ApiResponse<IEnumerable<OvertimeTypeDto>>.Ok(items, "Lấy danh mục mã tăng ca thành công"));
    }

    [HttpPost("overtime-types")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveOvertimeType([FromBody] SaveOvertimeTypeRequest request)
    {
        try
        {
            var id = await _employeeRepository.SaveOvertimeTypeAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Lưu mã tăng ca thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("overtime-types/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteOvertimeType(int id)
    {
        var deleted = await _employeeRepository.DeleteOvertimeTypeAsync(id);
        return deleted
            ? Ok(ApiResponse<bool>.Ok(true, "Đã xóa mã tăng ca"))
            : NotFound(ApiResponse.Fail("Không tìm thấy mã tăng ca cần xóa."));
    }

    [HttpGet("leave-types")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LeaveTypeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLeaveTypes([FromQuery] string? scope = null, [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetLeaveTypesAsync(scope, search);
        return Ok(ApiResponse<IEnumerable<LeaveTypeDto>>.Ok(items, "Lấy danh mục mã nghỉ phép thành công"));
    }

    [HttpPost("leave-types")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveLeaveType([FromBody] SaveLeaveTypeRequest request)
    {
        try
        {
            var id = await _employeeRepository.SaveLeaveTypeAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Lưu mã nghỉ phép thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("leave-types/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteLeaveType(int id)
    {
        var deleted = await _employeeRepository.DeleteLeaveTypeAsync(id);
        return deleted
            ? Ok(ApiResponse<bool>.Ok(true, "Đã xóa mã nghỉ phép"))
            : NotFound(ApiResponse.Fail("Không tìm thấy mã nghỉ phép cần xóa."));
    }

    [HttpGet("holidays")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<HolidayItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetHolidays([FromQuery] int? year = null)
    {
        var items = await _employeeRepository.GetHolidaysByYearAsync(year);
        return Ok(ApiResponse<IEnumerable<HolidayItemDto>>.Ok(items, "Lấy danh sách ngày lễ thành công"));
    }

    // =========================================================================
    // PHÂN HỆ ĐƠN TỪ (TĂNG CA | BÙ CÔNG | NGHỈ PHÉP)
    // =========================================================================

    [HttpGet("overtime-requests")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<OvertimeRequestItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetOvertimeRequests(
        [FromQuery] string? periodMonth = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetOvertimeRequestsAsync(periodMonth, branchId, status, search);
        return Ok(ApiResponse<IEnumerable<OvertimeRequestItemDto>>.Ok(items, "Lấy danh sách đơn xin tăng ca thành công"));
    }

    [HttpPost("overtime-requests")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateOvertimeRequest([FromBody] CreateOvertimeRequestDto request)
    {
        try
        {
            var id = await _employeeRepository.CreateOvertimeRequestAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Tạo đơn xin tăng ca thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("overtime-requests/{id:int}/process")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessOvertimeRequest(int id, [FromBody] ProcessHrmRequestDto request)
    {
        try
        {
            var ok = await _employeeRepository.ProcessOvertimeRequestAsync(id, request);
            return Ok(ApiResponse<bool>.Ok(ok, "Cập nhật trạng thái đơn tăng ca thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("correction-requests")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<AttendanceCorrectionRequestItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetCorrectionRequests(
        [FromQuery] string? periodMonth = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetAttendanceCorrectionRequestsAsync(periodMonth, branchId, status, search);
        return Ok(ApiResponse<IEnumerable<AttendanceCorrectionRequestItemDto>>.Ok(items, "Lấy danh sách đơn bù công thành công"));
    }

    [HttpPost("correction-requests")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateCorrectionRequest([FromBody] CreateAttendanceCorrectionRequestDto request)
    {
        try
        {
            var id = await _employeeRepository.CreateAttendanceCorrectionRequestAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Tạo đơn bù công thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("correction-requests/{id:int}/process")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessCorrectionRequest(int id, [FromBody] ProcessHrmRequestDto request)
    {
        try
        {
            var ok = await _employeeRepository.ProcessAttendanceCorrectionRequestAsync(id, request);
            return Ok(ApiResponse<bool>.Ok(ok, "Cập nhật trạng thái đơn bù công thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("leave-requests")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<LeaveRequestItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLeaveRequests(
        [FromQuery] string? periodMonth = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetLeaveRequestsAsync(periodMonth, branchId, status, search);
        return Ok(ApiResponse<IEnumerable<LeaveRequestItemDto>>.Ok(items, "Lấy danh sách đơn xin nghỉ phép thành công"));
    }

    [HttpPost("leave-requests")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> CreateLeaveRequest([FromBody] CreateLeaveRequestDto request)
    {
        try
        {
            var id = await _employeeRepository.CreateLeaveRequestAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Tạo đơn xin nghỉ phép thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("leave-requests/{id:int}/process")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ProcessLeaveRequest(int id, [FromBody] ProcessHrmRequestDto request)
    {
        try
        {
            var ok = await _employeeRepository.ProcessLeaveRequestAsync(id, request);
            return Ok(ApiResponse<bool>.Ok(ok, "Cập nhật trạng thái đơn nghỉ phép thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("adjust-manual")]
    [ProducesResponseType(typeof(ApiResponse<decimal>), StatusCodes.Status200OK)]
    public async Task<IActionResult> AdjustManual([FromBody] AdjustAttendanceManualByDateRequest request)
    {
        try
        {
            var workHours = await _employeeRepository.AdjustAttendanceByEmployeeDateAsync(request);
            return Ok(ApiResponse<decimal>.Ok(workHours, "Đã điều chỉnh giờ công và lưu Audit Trail thành công."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
