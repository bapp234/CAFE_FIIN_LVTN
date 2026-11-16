using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.Approval;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class ApprovalsController : ControllerBase
{
    private readonly IApprovalRepository _approvalRepository;
    private readonly ILogger<ApprovalsController> _logger;

    public ApprovalsController(IApprovalRepository approvalRepository, ILogger<ApprovalsController> logger)
    {
        _approvalRepository = approvalRepository;
        _logger = logger;
    }

    /// <summary>
    /// Lấy danh sách hàng đợi các phiếu yêu cầu đang chờ phê duyệt (hỗ trợ lọc theo chi nhánh)
    /// </summary>
    [HttpGet("pending")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ApprovalPendingItemDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetPendingQueue([FromQuery] int? branchId)
    {
        var pendingItems = await _approvalRepository.GetPendingQueueAsync(branchId);
        return Ok(ApiResponse<IEnumerable<ApprovalPendingItemDto>>.Ok(pendingItems, "Lấy hàng đợi chờ duyệt thành công"));
    }

    /// <summary>
    /// Lấy thông tin chi tiết một phiếu yêu cầu và tiến độ từng bước phê duyệt (1..3 cấp)
    /// </summary>
    [HttpGet("{id:long}")]
    [ProducesResponseType(typeof(ApiResponse<ApprovalRequestDetailDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] long id)
    {
        var detail = await _approvalRepository.GetRequestDetailAsync(id);
        if (detail == null)
        {
            return NotFound(ApiResponse.Fail($"Không tìm thấy phiếu yêu cầu có ID = {id}."));
        }

        return Ok(ApiResponse<ApprovalRequestDetailDto>.Ok(detail, "Lấy chi tiết phiếu duyệt thành công"));
    }

    /// <summary>
    /// Nộp một phiếu yêu cầu phê duyệt mới (tự sinh mã REQ-YYYYMM-XXXX và khởi tạo các cấp duyệt)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<SubmitApprovalResultDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Submit([FromBody] SubmitApprovalRequest request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu đầu vào không hợp lệ", errors));
        }

        try
        {
            var result = await _approvalRepository.SubmitRequestAsync(request);

            _logger.LogInformation("Nhân viên {RequesterId} đã nộp phiếu yêu cầu {RequestCode} ({WorkflowCode}) thành công", 
                request.RequesterId, result.RequestCode, result.WorkflowCode);

            return CreatedAtAction(
                nameof(GetById), 
                new { id = result.RequestId }, 
                ApiResponse<SubmitApprovalResultDto>.Ok(result, "Nộp phiếu yêu cầu phê duyệt thành công")
            );
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex, "Lỗi nghiệp vụ CSDL khi nộp phiếu yêu cầu: {Message}", ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi hệ thống khi nộp phiếu yêu cầu");
            return StatusCode(StatusCodes.Status500InternalServerError, 
                ApiResponse.Fail("Đã xảy ra lỗi máy chủ trong quá trình nộp phiếu yêu cầu."));
        }
    }

    /// <summary>
    /// Xử lý bước phê duyệt (Phê duyệt: 'approved' hoặc Từ chối: 'rejected') tại cấp hiện tại
    /// </summary>
    [HttpPost("{id:long}/process")]
    [ProducesResponseType(typeof(ApiResponse<ProcessStepResultDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ProcessStep([FromRoute] long id, [FromBody] ProcessApprovalStepRequest request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values
                .SelectMany(v => v.Errors)
                .Select(e => e.ErrorMessage)
                .ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu đầu vào không hợp lệ", errors));
        }

        try
        {
            var result = await _approvalRepository.ProcessStepAsync(id, request);

            _logger.LogInformation("Nhân viên {ApproverId} đã xử lý bước {StepLevel} của phiếu {RequestId}: {Decision}",
                request.ApproverEmployeeId, result.StepLevel, id, result.StepDecision);

            var message = result.StepDecision == "approved" 
                ? (result.RequestStatus == "approved" ? "Quy trình đã được phê duyệt hoàn tất 100%" : $"Đã phê duyệt Cấp {result.StepLevel}, chuyển sang cấp tiếp theo")
                : $"Yêu cầu đã bị từ chối tại Cấp {result.StepLevel}";

            return Ok(ApiResponse<ProcessStepResultDto>.Ok(result, message));
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex, "Lỗi nghiệp vụ CSDL khi xử lý bước duyệt: {Message}", ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi hệ thống khi xử lý bước phê duyệt");
            return StatusCode(StatusCodes.Status500InternalServerError, 
                ApiResponse.Fail("Đã xảy ra lỗi máy chủ trong quá trình xử lý phê duyệt."));
        }
    }
}
