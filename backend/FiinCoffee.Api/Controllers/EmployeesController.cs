using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Produces("application/json")]
public class EmployeesController : ControllerBase
{
    private readonly IEmployeeRepository _employeeRepository;
    private readonly ILogger<EmployeesController> _logger;

    public EmployeesController(IEmployeeRepository employeeRepository, ILogger<EmployeesController> logger)
    {
        _employeeRepository = employeeRepository;
        _logger = logger;
    }

    /// <summary>
    /// Lấy danh sách hồ sơ nhân sự (hỗ trợ lọc theo chi nhánh, trạng thái, và tìm kiếm)
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<EmployeeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? branchId, 
        [FromQuery] string? status, 
        [FromQuery] string? search)
    {
        var employees = await _employeeRepository.GetAllAsync(branchId, status, search);
        return Ok(ApiResponse<IEnumerable<EmployeeDto>>.Ok(employees, "Lấy danh sách nhân viên thành công"));
    }

    /// <summary>
    /// Lấy thông tin chi tiết một nhân viên theo ID
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById([FromRoute] int id)
    {
        var employee = await _employeeRepository.GetByIdAsync(id);
        if (employee == null)
        {
            return NotFound(ApiResponse.Fail($"Không tìm thấy hồ sơ nhân viên có ID = {id}."));
        }

        return Ok(ApiResponse<EmployeeDto>.Ok(employee, "Lấy chi tiết nhân viên thành công"));
    }

    /// <summary>
    /// Thêm nhân viên mới (cấp tài khoản, CCCD, thông tin ngân hàng & tự động phân bổ hợp đồng lao động)
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<EmployeeDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateEmployeeRequest request)
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
            var createdEmployee = await _employeeRepository.CreateEmployeeAsync(request);

            _logger.LogInformation("Đã tạo mới nhân viên {EmployeeCode} ({FullName}) thành công", 
                createdEmployee.EmployeeCode, createdEmployee.FullName);

            return CreatedAtAction(
                nameof(GetById), 
                new { id = createdEmployee.EmployeeId }, 
                ApiResponse<EmployeeDto>.Ok(createdEmployee, "Tạo mới nhân viên thành công")
            );
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex, "Lỗi nghiệp vụ CSDL khi tạo nhân viên: {Message}", ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi hệ thống khi tạo nhân viên mới");
            return StatusCode(StatusCodes.Status500InternalServerError, 
                ApiResponse.Fail("Đã xảy ra lỗi máy chủ trong quá trình xử lý tạo mới nhân viên."));
        }
    }

    /// <summary>
    /// Lấy danh mục 5 loại hợp đồng lao động & phúc lợi chuẩn
    /// </summary>
    [HttpGet("contract-types")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<ContractTypeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetContractTypes()
    {
        var contracts = await _employeeRepository.GetContractTypesAsync();
        return Ok(ApiResponse<IEnumerable<ContractTypeDto>>.Ok(contracts, "Lấy danh mục hợp đồng thành công"));
    }

    /// <summary>
    /// Lấy danh mục các chi nhánh cửa hàng đang hoạt động
    /// </summary>
    [HttpGet("branches")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<BranchDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBranches()
    {
        var branches = await _employeeRepository.GetBranchesAsync();
        return Ok(ApiResponse<IEnumerable<BranchDto>>.Ok(branches, "Lấy danh mục chi nhánh thành công"));
    }

    /// <summary>
    /// Lấy danh sách nhân viên theo phân quyền cây phả hệ (hỗ trợ phân trang lười Combobox và Danh sách)
    /// </summary>
    [HttpGet("hierarchy")]
    [ProducesResponseType(typeof(ApiResponse<PagedResult<HierarchyEmployeeDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetByHierarchy(
        [FromQuery] int? currentUserId,
        [FromQuery] string? currentUsername,
        [FromQuery] int? currentEmployeeId,
        [FromQuery] int? branchId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 50)
    {
        var (items, totalCount) = await _employeeRepository.GetEmployeesByHierarchyAsync(
            currentUserId,
            currentUsername,
            currentEmployeeId,
            branchId,
            status,
            search,
            pageIndex,
            pageSize
        );

        var pagedResult = new PagedResult<HierarchyEmployeeDto>(items.ToList(), totalCount, pageIndex, pageSize);
        return Ok(ApiResponse<PagedResult<HierarchyEmployeeDto>>.Ok(pagedResult, "Lấy danh sách nhân sự theo cây phả hệ thành công"));
    }

    /// <summary>
    /// Lấy toàn bộ 5 nhóm trường thông tin chi tiết hồ sơ nhân sự (Lý lịch, Ngân hàng, Hợp đồng, Thẩm quyền, Ghi chú)
    /// </summary>
    [HttpGet("{id:int}/full-profile")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeFullProfileDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetFullProfile(
        [FromRoute] int id,
        [FromQuery] DateTime? targetDate = null)
    {
        var profile = await _employeeRepository.GetFullProfileAsync(id, targetDate);
        if (profile == null)
        {
            return NotFound(ApiResponse.Fail($"Không tìm thấy hồ sơ nhân viên chi tiết có ID = {id}."));
        }

        return Ok(ApiResponse<EmployeeFullProfileDto>.Ok(profile, "Lấy chi tiết hồ sơ nhân sự thành công"));
    }

    /// <summary>
    /// Cập nhật thông tin hồ sơ nhân sự (Lý lịch, ngân hàng, mức lương/hợp đồng, ghi chú)
    /// </summary>
    [HttpPut("{id:int}/profile")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateProfile(
        [FromRoute] int id,
        [FromBody] UpdateEmployeeProfileRequest request,
        [FromQuery] string? updatedBy = null)
    {
        try
        {
            await _employeeRepository.UpdateEmployeeProfileAsync(id, request, updatedBy);
            _logger.LogInformation("Đã cập nhật hồ sơ nhân viên ID = {EmployeeId} thành công", id);

            return Ok(ApiResponse<object>.Ok(new { employeeId = id }, "Cập nhật hồ sơ nhân viên thành công"));
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex, "Lỗi SQL khi cập nhật hồ sơ ID = {EmployeeId}: {Message}", id, ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi máy chủ khi cập nhật hồ sơ ID = {EmployeeId}", id);
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.Fail("Đã xảy ra lỗi máy chủ khi cập nhật hồ sơ."));
        }
    }

    /// <summary>
    /// Trao và phân cấp thẩm quyền phê duyệt quy trình (Approval Level 1..5)
    /// </summary>
    [HttpPost("{id:int}/approval-authority")]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AssignApprovalAuthority(
        [FromRoute] int id,
        [FromBody] AssignApprovalAuthorityRequest request,
        [FromQuery] string grantedBy)
    {
        if (string.IsNullOrWhiteSpace(grantedBy))
        {
            return BadRequest(ApiResponse.Fail("Tên người thực hiện trao quyền (grantedBy) là bắt buộc để kiểm soát bảo mật."));
        }

        try
        {
            await _employeeRepository.AssignApprovalAuthorityAsync(id, request, grantedBy);
            _logger.LogInformation("Đã phân cấp thẩm quyền Level {ApprovalLevel} cho nhân viên ID = {EmployeeId} bởi {GrantedBy}", 
                request.ApprovalLevel, id, grantedBy);

            return Ok(ApiResponse<object>.Ok(new { employeeId = id, request.ApprovalLevel }, "Phân cấp thẩm quyền thành công"));
        }
        catch (SqlException ex)
        {
            _logger.LogWarning(ex, "Lỗi kiểm tra thẩm quyền SQL: {Message}", ex.Message);
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
        catch (Exception ex)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, ApiResponse.Fail(ex.Message));
        }
    }
}
