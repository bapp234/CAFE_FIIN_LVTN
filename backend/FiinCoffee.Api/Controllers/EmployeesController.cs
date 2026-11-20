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
    private readonly IExcelExportEngine _excelExportEngine;
    private readonly IExcelImportEngine _excelImportEngine;
    private readonly IWebHostEnvironment _env;

    public EmployeesController(
        IEmployeeRepository employeeRepository, 
        ILogger<EmployeesController> logger, 
        IExcelExportEngine excelExportEngine,
        IExcelImportEngine excelImportEngine,
        IWebHostEnvironment env)
    {
        _employeeRepository = employeeRepository;
        _logger = logger;
        _excelExportEngine = excelExportEngine;
        _excelImportEngine = excelImportEngine;
        _env = env;
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

    /// <summary>
    /// Lấy danh sách nhân viên tinh gọn hỗ trợ công tắc @AccountStatus: 1 (có TK), 0 (chưa có TK), -1 (tất cả)
    /// Hỗ trợ phân trang: mặc định nạp 50 nhân viên đầu tiên (pageIndex = 1, pageSize = 50)
    /// </summary>
    [HttpGet("simple")]
    [ProducesResponseType(typeof(ApiResponse<IEnumerable<EmployeeSimpleDto>>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetSimple(
        [FromQuery] int accountStatus = -1,
        [FromQuery] DateTime? viewDate = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? search = null,
        [FromQuery] int loginId = -1,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 50)
    {
        var list = await _employeeRepository.GetEmployeesSimpleAsync(
            accountStatus, viewDate, branchId, search, loginId, pageIndex, pageSize);

        return Ok(ApiResponse<IEnumerable<EmployeeSimpleDto>>.Ok(list, "Lấy danh sách nhân sự thành công"));
    }

    /// <summary>
    /// Lấy số liệu tổng hợp KPI & biểu đồ chuyên biệt cho HRM Dashboard (tính trực tiếp trên SQL Server)
    /// </summary>
    [HttpGet("dashboard-summary")]
    [ProducesResponseType(typeof(ApiResponse<HrmDashboardSummaryDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboardSummary(
        [FromQuery] int? branchId = null,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] int loginId = -1)
    {
        var summary = await _employeeRepository.GetDashboardSummaryAsync(branchId, year, month, loginId);
        return Ok(ApiResponse<HrmDashboardSummaryDto>.Ok(summary, "Lấy dữ liệu tổng hợp Dashboard HRM thành công"));
    }

    /// <summary>
    /// Lấy bộ dữ liệu lưới động (Metadata Cột + Dữ liệu Dòng) cho AdminGridTable
    /// </summary>
    [HttpGet("grid-dataset")]
    [ProducesResponseType(typeof(ApiResponse<GridDatasetDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetGridDataset(
        [FromQuery] string? currentUsername = null,
        [FromQuery] int? branchId = null,
        [FromQuery] string? position = null,
        [FromQuery] string? status = null,
        [FromQuery] DateTime? targetDate = null,
        [FromQuery] string? search = null,
        [FromQuery] int pageIndex = 1,
        [FromQuery] int pageSize = 50)
    {
        var dataset = await _employeeRepository.GetEmployeesGridDatasetAsync(
            currentUsername, branchId, position, status, targetDate, search, pageIndex, pageSize
        );
        return Ok(ApiResponse<GridDatasetDto>.Ok(dataset, "Lấy dataset lưới nhân sự thành công"));
    }
    /// <summary>
    /// Xuất danh sách nhân sự ra file Excel dựa trên mẫu Template người dùng thiết kế (Kiến trúc ParadiseHR)
    /// </summary>
    [HttpGet("export-excel")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] int? branchId,
        [FromQuery] string? position,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] string? employeeCodes,
        [FromQuery] int accountStatus = -1)
    {
        try
        {
            // 1. Xác định đường dẫn file mẫu template trên server
            var templatePath = Path.Combine(_env.ContentRootPath, "Templates", "Fiin_HRM_Employees_Template.xlsx");
            if (!System.IO.File.Exists(templatePath))
            {
                return NotFound(ApiResponse<string>.Fail($"Không tìm thấy file mẫu Excel tại: {templatePath}"));
            }
            // 2. Lấy DataSet gồm dữ liệu nhân viên và cấu hình xuất từ Stored Procedure
            var dataSet = await _employeeRepository.GetEmployeesExportDataSetAsync(
                currentUsername: User?.Identity?.Name ?? "admin",
                branchId: branchId,
                position: position,
                status: status,
                searchText: search,
                employeeCodes: employeeCodes,
                accountStatus: accountStatus);
            // 3. Đổ dữ liệu vào template qua Engine ParadiseHR
            byte[] fileBytes = await _excelExportEngine.ExportFromTemplateAsync(templatePath, dataSet);
            // 4. Trả về file nhị phân đính kèm tên file tải về
            string fileName = $"Fiin_HRM_NhanSu_{DateTime.Now:yyyyMMdd_HHmmss}.xlsx";
            const string contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            return File(fileBytes, contentType, fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi trong quá trình xuất Excel danh sách nhân sự");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<string>.Fail($"Xuất file Excel thất bại: {ex.Message}"));
        }
    }

    /// <summary>
    /// Lấy toàn bộ tùy chọn cho các combobox bộ lọc (Chi nhánh, Chức vụ, Trạng thái, Loại HĐ)
    /// </summary>
    [HttpGet("filter-options")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeFilterOptionsDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetFilterOptions()
    {
        var options = await _employeeRepository.GetEmployeesFilterOptionsAsync();
        return Ok(ApiResponse<EmployeeFilterOptionsDto>.Ok(options, "Lấy danh sách tùy chọn bộ lọc thành công"));
    }

    /// <summary>
    /// Tải file Excel mẫu biểu chuẩn (.xlsx) để người dùng điền dữ liệu nhân sự nhập nhanh
    /// </summary>
    [HttpGet("import-template")]
    [ProducesResponseType(typeof(FileContentResult), StatusCodes.Status200OK)]
    public IActionResult DownloadImportTemplate()
    {
        var templateBytes = _excelImportEngine.GenerateImportTemplate();
        return File(
            templateBytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Fiin_HRM_NhanSu_MauNhapNhanh.xlsx"
        );
    }

    /// <summary>
    /// Tải lên file Excel để đọc trước và kiểm tra lỗi dữ liệu (Preview & Validate)
    /// </summary>
    [HttpPost("import-preview")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportPreviewResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> PreviewImportExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("Vui lòng chọn file Excel (.xlsx) hợp lệ."));
        }

        try
        {
            var existingCitizenIds = await _employeeRepository.GetExistingCitizenIdsAsync();
            using var stream = file.OpenReadStream();
            var previewResult = await _excelImportEngine.ParseAndValidateExcelAsync(stream, existingCitizenIds);

            return Ok(ApiResponse<EmployeeImportPreviewResultDto>.Ok(
                previewResult,
                $"Đọc thành công {previewResult.TotalRows} dòng dữ liệu ({previewResult.ValidRows} hợp lệ, {previewResult.ErrorRows} dòng lỗi)."
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi đọc file Excel nhập nhân sự");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<string>.Fail($"Không thể xử lý file Excel: {ex.Message}"));
        }
    }

    /// <summary>
    /// Xác nhận lưu hàng loạt (100+ nhân viên) vào CSDL qua Stored Procedure Batch
    /// </summary>
    [HttpPost("import-save")]
    [ProducesResponseType(typeof(ApiResponse<EmployeeImportSaveResultDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> SaveImportedEmployees([FromBody] EmployeeImportSaveRequestDto request)
    {
        if (request == null || request.Employees == null || request.Employees.Count == 0)
        {
            return BadRequest(ApiResponse<object>.Fail("Không có dữ liệu nhân viên hợp lệ để lưu."));
        }

        try
        {
            var result = await _employeeRepository.ImportEmployeesBatchAsync(request, User?.Identity?.Name ?? "admin");
            return Ok(ApiResponse<EmployeeImportSaveResultDto>.Ok(
                result,
                $"Đã nạp thành công {result.TotalImported}/{result.TotalReceived} hồ sơ nhân sự vào hệ thống."
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Lỗi khi lưu hàng loạt nhân sự vào CSDL");
            return StatusCode(StatusCodes.Status500InternalServerError,
                ApiResponse<string>.Fail($"Lưu nhân sự thất bại: {ex.Message}"));
        }
    }
}
