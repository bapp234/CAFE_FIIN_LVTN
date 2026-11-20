using FiinCoffee.Api.Services;
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
    private readonly ILockPasswordVerifier _lockPasswordVerifier;
    private readonly ILogger<PayrollController> _logger;

    public PayrollController(
        IEmployeeRepository employeeRepository,
        ILockPasswordVerifier lockPasswordVerifier,
        ILogger<PayrollController> logger)
    {
        _employeeRepository = employeeRepository;
        _lockPasswordVerifier = lockPasswordVerifier;
        _logger = logger;
    }

    /// <summary>
    /// Lấy chi tiết bảng lương tháng (Header kỳ lương + Danh sách phiếu lương nhân sự)
    /// </summary>
    [HttpGet("{periodMonth:regex(^\\d{{4}}-\\d{{2}}$)}")]
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

        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.Password, request.ApproverName);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
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

    /// <summary>
    /// Mở khóa sổ kỳ tính lương (cho phép tính toán lại bảng lương)
    /// </summary>
    [HttpPost("unlock")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> UnlockPayrollPeriod([FromBody] UnlockPayrollPeriodRequest request)
    {
        if (request.PeriodId <= 0 || string.IsNullOrWhiteSpace(request.UnlockedBy))
        {
            return BadRequest(ApiResponse.Fail("PeriodId và tên người mở khóa không được để trống."));
        }

        var (isValid, pwdError) = await _lockPasswordVerifier.VerifyAsync(User, request.Password, request.UnlockedBy);
        if (!isValid)
        {
            return BadRequest(ApiResponse.Fail(pwdError ?? "Mật khẩu xác nhận không chính xác."));
        }

        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 5)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng nhập lý do mở khóa (tối thiểu 5 ký tự)."));
        }

        try
        {
            await _employeeRepository.UnlockPayrollPeriodAsync(request.PeriodId, request.UnlockedBy, request.Reason.Trim());
            return Ok(ApiResponse<object>.Ok(new { request.PeriodId }, "Đã mở khóa kỳ tính lương thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("settings")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<PayrollSettingItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPayrollSettings(
        [FromQuery] string? category = null,
        [FromQuery] string? calcType = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetPayrollSettingsAsync(category, calcType, search);
        return Ok(ApiResponse<IEnumerable<PayrollSettingItemDto>>.Ok(items, "Lấy danh mục thiết lập lương thành công"));
    }

    [HttpPost("settings")]
    [ProducesResponseType(typeof(ApiResponse<int>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SavePayrollSetting([FromBody] SavePayrollSettingRequest request)
    {
        try
        {
            var id = await _employeeRepository.SavePayrollSettingAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Lưu khoản mục thiết lập lương thành công"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("settings/{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    public async Task<IActionResult> DeletePayrollSetting(int id)
    {
        var deleted = await _employeeRepository.DeletePayrollSettingAsync(id);
        return deleted
            ? Ok(ApiResponse<bool>.Ok(true, "Đã xóa khoản mục thiết lập lương"))
            : NotFound(ApiResponse.Fail("Không tìm thấy khoản mục thiết lập lương."));
    }

    [HttpGet("advances")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<SalaryAdvanceItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSalaryAdvances(
        [FromQuery] string? periodMonth = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetSalaryAdvancesAsync(periodMonth, branchId, status, search);
        return Ok(ApiResponse<IEnumerable<SalaryAdvanceItemDto>>.Ok(items, "Lấy danh sách phiếu tạm ứng lương thành công"));
    }

    [HttpGet("quotas")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<EmployeeMonthlyQuotaItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetEmployeeMonthlyQuotas(
        [FromQuery] string periodMonth = "2026-11",
        [FromQuery] int? branchId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] string? search = null)
    {
        var items = await _employeeRepository.GetEmployeeMonthlyQuotasAsync(periodMonth, branchId, employeeId, search);
        return Ok(ApiResponse<IEnumerable<EmployeeMonthlyQuotaItemDto>>.Ok(items, "Lấy bảng đối soát hạn mức tăng ca & nghỉ phép thành công"));
    }

    [HttpPost("advances")]
    [ProducesResponseType(typeof(ApiResponse<CreateSalaryAdvanceResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateSalaryAdvance([FromBody] CreateSalaryAdvanceRequest request)
    {
        if (request.EmployeeId <= 0)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng chọn nhân sự tạm ứng hợp lệ."));
        }
        if (request.Amount < 100000)
        {
            return BadRequest(ApiResponse.Fail("Số tiền tạm ứng tối thiểu là 100.000đ."));
        }
        if (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Trim().Length < 3)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng nhập lý do tạm ứng (tối thiểu 3 ký tự)."));
        }

        try
        {
            var result = await _employeeRepository.CreateSalaryAdvanceAsync(request);
            return Ok(ApiResponse<CreateSalaryAdvanceResultDto>.Ok(result, $"Đã tạo phiếu tạm ứng {result.AdvanceCode} thành công"));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lỗi khi tạo phiếu tạm ứng lương: {Message}", ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("advances/{advanceId:int}/process")]
    [ProducesResponseType(typeof(ApiResponse<bool>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessSalaryAdvance(int advanceId, [FromBody] ProcessSalaryAdvanceRequest request)
    {
        var action = (request.Action ?? string.Empty).Trim().ToLowerInvariant();
        if (action is not ("approve" or "reject" or "request_cancel" or "approve_cancel" or "reject_cancel"))
        {
            return BadRequest(ApiResponse.Fail("Hành động xử lý không hợp lệ."));
        }
        if (action == "reject" && (string.IsNullOrWhiteSpace(request.Note) || request.Note.Trim().Length < 3))
        {
            return BadRequest(ApiResponse.Fail("Vui lòng nhập lý do từ chối phiếu tạm ứng (tối thiểu 3 ký tự)."));
        }

        try
        {
            var ok = await _employeeRepository.ProcessSalaryAdvanceAsync(advanceId, request);
            var msg = action switch
            {
                "approve" => "Đã phê duyệt phiếu tạm ứng lương thành công",
                "request_cancel" => "Đã gửi yêu cầu xin hủy phiếu tạm ứng lên cấp duyệt",
                "approve_cancel" => "Đã chấp thuận hủy phiếu tạm ứng lương",
                "reject_cancel" => "Đã từ chối yêu cầu hủy, giữ nguyên hiệu lực phiếu tạm ứng",
                _ => "Đã từ chối phiếu tạm ứng lương"
            };
            return ok
                ? Ok(ApiResponse<bool>.Ok(true, msg))
                : NotFound(ApiResponse.Fail("Không tìm thấy phiếu tạm ứng hoặc phiếu đã được xử lý."));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Lỗi khi xử lý phiếu tạm ứng {AdvanceId}: {Message}", advanceId, ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }
}
