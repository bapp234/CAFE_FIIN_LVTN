using FiinCoffee.Api.Services;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class ShiftsController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly ILockPasswordVerifier _lockPasswordVerifier;
    private readonly ILogger<ShiftsController> _logger;

    public ShiftsController(
        IEmployeeRepository employeeRepository,
        ILockPasswordVerifier lockPasswordVerifier,
        ILogger<ShiftsController> logger)
    {
        _employeeRepository = employeeRepository;
        _lockPasswordVerifier = lockPasswordVerifier;
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
    /// Xóa mềm một mẫu ca làm việc (IsActive = 0)
    /// </summary>
    [HttpDelete("templates/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var ok = await _employeeRepository.DeleteShiftTemplateAsync(id);
        return ok
            ? Ok(ApiResponse<bool>.Ok(true, "Đã xóa mẫu ca làm việc thành công"))
            : NotFound(ApiResponse.Fail("Không tìm thấy mẫu ca làm việc."));
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

    /// <summary>
    /// Lấy trạng thái khóa lịch ca tuần của chi nhánh
    /// </summary>
    [HttpGet("week-status")]
    [ProducesResponseType(typeof(ApiResponse<ShiftScheduleWeekStatusDto?>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetWeekStatus(
        [FromQuery] int branchId,
        [FromQuery] DateTime? startDate)
    {
        if (branchId <= 0)
        {
            branchId = 1;
        }

        DateTime queryDate = (startDate.HasValue && startDate.Value >= new DateTime(1753, 1, 1))
            ? startDate.Value
            : DateTime.Today;

        var status = await _employeeRepository.GetShiftScheduleWeekStatusAsync(branchId, queryDate);
        return Ok(ApiResponse<ShiftScheduleWeekStatusDto?>.Ok(status, "Lấy trạng thái lịch ca tuần thành công"));
    }

    /// <summary>
    /// Chốt và khóa lịch phân ca tuần của chi nhánh
    /// </summary>
    [HttpPost("lock-week")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> LockWeek([FromBody] LockShiftScheduleRequest request)
    {
        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.Password, request.LockedBy);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
        }

        if (request.BranchId <= 0) request.BranchId = 1;
        string lockedBy = string.IsNullOrWhiteSpace(request.LockedBy)
            ? (User.Identity?.Name ?? "manager")
            : request.LockedBy.Trim();

        try
        {
            var success = await _employeeRepository.LockShiftScheduleAsync(request.BranchId, request.StartDate, lockedBy);
            return Ok(ApiResponse<bool>.Ok(success, $"Đã khóa lịch phân ca tuần bắt đầu {request.StartDate:dd/MM/yyyy} thành công."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Mở khóa lịch phân ca tuần của chi nhánh
    /// </summary>
    [HttpPost("unlock-week")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> UnlockWeek([FromBody] UnlockShiftScheduleRequest request)
    {
        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.Password, request.UnlockedBy);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
        }

        if (string.IsNullOrWhiteSpace(request.UnlockReason) || request.UnlockReason.Trim().Length < 5)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng nhập lý do mở khóa (tối thiểu 5 ký tự)."));
        }

        if (request.BranchId <= 0) request.BranchId = 1;

        try
        {
            var success = await _employeeRepository.UnlockShiftScheduleAsync(request.BranchId, request.StartDate);
            return Ok(ApiResponse<bool>.Ok(success, $"Đã mở khóa lịch phân ca tuần bắt đầu {request.StartDate:dd/MM/yyyy} thành công."));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Lấy danh sách phân ca thực tế theo tuần từ dbo.ShiftAssignments
    /// </summary>
    [HttpGet("assignments")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ShiftAssignmentDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAssignments(
        [FromQuery] int? branchId,
        [FromQuery] DateTime startDate,
        [FromQuery] DateTime endDate)
    {
        var list = await _employeeRepository.GetWeekShiftAssignmentsAsync(branchId, startDate, endDate);
        return Ok(ApiResponse<IEnumerable<ShiftAssignmentDto>>.Ok(list, "Lấy danh sách phân ca tuần thành công"));
    }

    /// <summary>
    /// Lưu hoặc cập nhật phân ca làm việc cho nhân viên theo ngày vào dbo.ShiftAssignments
    /// </summary>
    [HttpPost("assignments")]
    [ProducesResponseType(typeof(ApiResponse<ShiftAssignmentDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveAssignment([FromBody] SaveShiftAssignmentRequest request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest(ApiResponse.Fail("EmployeeId không hợp lệ."));
        }

        try
        {
            var saved = await _employeeRepository.SaveShiftAssignmentAsync(request);
            return Ok(ApiResponse<ShiftAssignmentDto>.Ok(saved, "Lưu phân ca làm việc thành công"));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    /// <summary>
    /// Hủy/xóa phân ca làm việc khỏi dbo.ShiftAssignments
    /// </summary>
    [HttpDelete("assignments/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> RemoveAssignment([FromRoute] int id)
    {
        try
        {
            var removed = await _employeeRepository.RemoveShiftAssignmentAsync(id);
            return Ok(ApiResponse<bool>.Ok(removed, "Đã hủy phân ca thành công"));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
