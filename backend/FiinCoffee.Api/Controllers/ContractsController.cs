using System.Globalization;
using System.Security.Claims;
using FiinCoffee.Core.Common;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/hrm/contracts")]
[Produces("application/json")]
[Authorize]
public class ContractsController : ControllerBase
{
    private readonly IContractRepository _contractRepo;
    private readonly IExcelExportEngine _excelExportEngine;
    private readonly IContractExcelService _contractExcelService;
    private readonly IWordTemplateEngine _wordTemplateEngine;
    private readonly IWebHostEnvironment _env;

    public ContractsController(
        IContractRepository contractRepo,
        IExcelExportEngine excelExportEngine,
        IContractExcelService contractExcelService,
        IWordTemplateEngine wordTemplateEngine,
        IWebHostEnvironment env)
    {
        _contractRepo = contractRepo;
        _excelExportEngine = excelExportEngine;
        _contractExcelService = contractExcelService;
        _wordTemplateEngine = wordTemplateEngine;
        _env = env;
    }

    [HttpGet]
    public async Task<IActionResult> GetContracts(
        [FromQuery] string tabMode = "current",
        [FromQuery] int? branchId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? contractTypeId = null,
        [FromQuery] string? status = null,
        [FromQuery] int expiringDays = 30,
        [FromQuery] string? search = null)
    {
        var (myLevel, myEmpId, myBranchId) = GetCallerScope();

        // Phương án A: Cấp 1-2 chỉ xem của mình; Cấp 3 (StoreManager) khóa trong chi nhánh mình; Cấp 4-5 xem toàn chuỗi
        int? scopedBranchId = myLevel <= 3 && myBranchId.HasValue ? myBranchId.Value : branchId;
        int? scopedEmployeeId = myLevel <= 2 && myEmpId.HasValue ? myEmpId.Value : employeeId;

        var list = await _contractRepo.GetContractsAsync(
            tabMode, scopedBranchId, scopedEmployeeId, contractTypeId, status, expiringDays, search);

        return Ok(ApiResponse<IEnumerable<ContractItemDto>>.Ok(list, "Lấy danh sách hợp đồng thành công."));
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary([FromQuery] int? branchId = null, [FromQuery] int expiringDays = 30)
    {
        var (myLevel, _, myBranchId) = GetCallerScope();
        int? scopedBranchId = myLevel <= 3 && myBranchId.HasValue ? myBranchId.Value : branchId;

        var summary = await _contractRepo.GetSummaryAsync(scopedBranchId, expiringDays);
        return Ok(ApiResponse<ContractSummaryDto>.Ok(summary, "Lấy thống kê hợp đồng thành công."));
    }

    [HttpPost]
    public async Task<IActionResult> SubmitContractChange([FromBody] SubmitContractChangeRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu hợp đồng không hợp lệ.", errors));
        }

        var (myLevel, myEmpId, _) = GetCallerScope();

        // Kế toán (Accountant) chỉ đối soát đọc, không được chỉnh sửa hợp đồng trừ khi có quyền Admin/HRM/StoreManager
        if (User.IsInRole("Accountant") && myLevel < 5 && !User.IsInRole("HRManager"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail("Tài khoản Kế toán chỉ có quyền xem hợp đồng để đối soát."));
        }

        try
        {
            var result = await _contractRepo.SubmitContractChangeAsync(request, myEmpId, myLevel);
            var msg = result.Status == "pending"
                ? $"Đã gửi đề xuất hợp đồng ({result.ContractCode}) lên cấp quản lý Nhân sự phê duyệt."
                : $"Đã cập nhật và kích hoạt hợp đồng ({result.ContractCode}) thành công.";

            return Ok(ApiResponse<SubmitContractChangeResultDto>.Ok(result, msg));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("{contractId:int}/approve")]
    public async Task<IActionResult> ProcessApproval(int contractId, [FromBody] ProcessContractApprovalRequestDto request)
    {
        var (myLevel, myEmpId, _) = GetCallerScope();
        if (myLevel < 4)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Fail("Chỉ Trưởng phòng Nhân sự (Cấp 4) hoặc Quản trị viên (Cấp 5) mới có quyền phê duyệt hợp đồng."));
        }

        try
        {
            await _contractRepo.ProcessApprovalAsync(contractId, request.Decision, myEmpId, myLevel, request.Note);
            var msg = request.Decision == "approved"
                ? "Đã phê duyệt và kích hoạt hiệu lực hợp đồng."
                : "Đã từ chối đề xuất hợp đồng.";
            return Ok(ApiResponse<bool>.Ok(true, msg));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("types")]
    public async Task<IActionResult> GetContractTypes()
    {
        var list = await _contractRepo.GetContractTypesAsync();
        return Ok(ApiResponse<IEnumerable<ContractTypeSettingDto>>.Ok(list, "Lấy danh mục loại hợp đồng thành công."));
    }

    [HttpPost("types")]
    public async Task<IActionResult> SaveContractType([FromBody] SaveContractTypeRequestDto request)
    {
        var (myLevel, _, _) = GetCallerScope();
        if (myLevel < 4)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Fail("Chỉ HRM (Cấp 4) hoặc Admin (Cấp 5) mới được thiết lập danh mục loại hợp đồng."));
        }

        if (!ModelState.IsValid)
        {
            var errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage).ToList();
            return BadRequest(ApiResponse.Fail("Dữ liệu loại hợp đồng không hợp lệ.", errors));
        }

        try
        {
            var id = await _contractRepo.SaveContractTypeAsync(request);
            return Ok(ApiResponse<int>.Ok(id, "Lưu loại hợp đồng thành công."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("types/{id:int}")]
    public async Task<IActionResult> DeleteContractType(int id)
    {
        var (myLevel, _, _) = GetCallerScope();
        if (myLevel < 4)
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                ApiResponse.Fail("Chỉ HRM (Cấp 4) hoặc Admin (Cấp 5) mới được xóa loại hợp đồng."));
        }

        var (ok, msg) = await _contractRepo.DeleteContractTypeAsync(id);
        return Ok(ApiResponse<bool>.Ok(ok, msg));
    }

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string tabMode = "current",
        [FromQuery] int? branchId = null,
        [FromQuery] int? employeeId = null,
        [FromQuery] int? contractTypeId = null,
        [FromQuery] string? status = null,
        [FromQuery] int expiringDays = 30,
        [FromQuery] string? search = null)
    {
        var (myLevel, myEmpId, myBranchId) = GetCallerScope();
        int? scopedBranchId = myLevel <= 3 && myBranchId.HasValue ? myBranchId.Value : branchId;
        int? scopedEmployeeId = myLevel <= 2 && myEmpId.HasValue ? myEmpId.Value : employeeId;

        var templatePath = Path.Combine(_env.ContentRootPath, "Templates", "Fiin_HRM_Contracts_Export_Template.xlsx");
        _contractExcelService.EnsureExportTemplate(templatePath);

        var dataSet = await _contractRepo.GetContractsExportDataSetAsync(
            tabMode, scopedBranchId, scopedEmployeeId, contractTypeId, status, expiringDays, search);

        // Dùng chung 1 Engine ExportFromTemplateAsync của hệ thống!
        var bytes = await _excelExportEngine.ExportFromTemplateAsync(templatePath, dataSet);
        var fileName = $"Fiin_HopDong_{tabMode}_{DateTime.Now:yyyyMMdd_HHmm}.xlsx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }

    [HttpGet("import-template")]
    public async Task<IActionResult> DownloadImportTemplate()
    {
        var types = await _contractRepo.GetContractTypesAsync();
        var bytes = _contractExcelService.GenerateImportTemplate(types.Where(t => t.IsActive));
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Fiin_HRM_Contracts_Import_Template.xlsx");
    }

    [HttpPost("import-preview")]
    public async Task<IActionResult> ImportPreview(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(ApiResponse.Fail("Vui lòng chọn file Excel (.xlsx)."));
        }

        var (myLevel, _, myBranchId) = GetCallerScope();
        int? scopedBranch = myLevel <= 3 ? myBranchId : null;

        var empLookup = await _contractRepo.GetActiveEmployeeLookupAsync(scopedBranch);
        var types = (await _contractRepo.GetContractTypesAsync())
            .Where(t => t.IsActive)
            .ToDictionary(t => t.ContractCode.Trim().ToUpperInvariant(), t => t, StringComparer.OrdinalIgnoreCase);

        using var stream = file.OpenReadStream();
        var preview = await _contractExcelService.ParseAndValidateImportAsync(stream, empLookup, types);
        return Ok(ApiResponse<ContractImportPreviewResultDto>.Ok(preview, "Đọc và kiểm tra file Excel thành công."));
    }

    [HttpPost("import-save")]
    public async Task<IActionResult> ImportSave([FromBody] ContractImportSaveRequestDto request)
    {
        var (myLevel, myEmpId, _) = GetCallerScope();
        if (User.IsInRole("Accountant") && myLevel < 5 && !User.IsInRole("HRManager"))
        {
            return StatusCode(StatusCodes.Status403Forbidden, ApiResponse.Fail("Tài khoản Kế toán không có quyền nhập hợp đồng."));
        }

        var validItems = request.Items.Where(i => i.IsValid && i.EmployeeId > 0 && i.ContractTypeId > 0).ToList();
        int saved = 0, pending = 0, activated = 0;

        foreach (var item in validItems)
        {
            if (!DateTime.TryParse(item.StartDate, out var startDate)) continue;
            DateTime? endDate = DateTime.TryParse(item.EndDate, out var parsedEnd) ? parsedEnd : null;

            var res = await _contractRepo.SubmitContractChangeAsync(new SubmitContractChangeRequestDto
            {
                EmployeeId = item.EmployeeId,
                ContractTypeId = item.ContractTypeId,
                Position = item.Position,
                HourlyRate = item.HourlyRate,
                Allowance = item.Allowance,
                StartDate = startDate,
                EndDate = endDate,
                ActionType = "new",
                Note = string.IsNullOrWhiteSpace(item.Note) ? "Nhập hàng loạt từ Excel" : item.Note,
                AutoApproveIfAllowed = myLevel >= 4,
            }, myEmpId, myLevel);

            saved++;
            if (res.Status == "pending") pending++;
            else activated++;
        }

        var result = new ContractImportSaveResultDto
        {
            TotalReceived = request.Items.Count,
            TotalSaved = saved,
            PendingCount = pending,
            ActivatedCount = activated,
        };

        var msg = pending > 0
            ? $"Đã nhập {saved} hợp đồng ở trạng thái Chờ duyệt."
            : $"Đã nhập và kích hoạt thành công {saved} hợp đồng.";

        return Ok(ApiResponse<ContractImportSaveResultDto>.Ok(result, msg));
    }

    [HttpGet("{contractId:int}/export-word")]
    public async Task<IActionResult> ExportWord(int contractId)
    {
        var detail = await _contractRepo.GetContractWordDetailAsync(contractId);
        if (detail == null)
        {
            return NotFound(ApiResponse.Fail("Không tìm thấy hợp đồng cần xuất Word."));
        }

        var templatePath = Path.Combine(_env.ContentRootPath, "Templates", "Fiin_HRM_Contract_Word_Template.docx");
        _wordTemplateEngine.EnsureDefaultContractTemplate(templatePath);

        var signDate = detail.SignDate ?? detail.StartDate;
        var vi = CultureInfo.GetCultureInfo("vi-VN");
        var genderText = detail.Gender?.ToLowerInvariant() switch
        {
            "male" => "Nam",
            "female" => "Nữ",
            _ => "Khác"
        };

        var placeholders = new Dictionary<string, string>
        {
            ["ContractCode"] = detail.ContractCode,
            ["EmployeeCode"] = detail.EmployeeCode,
            ["FullName"] = detail.FullName,
            ["CitizenId"] = detail.CitizenId,
            ["DateOfBirth"] = detail.DateOfBirth?.ToString("dd/MM/yyyy") ?? "—",
            ["GenderText"] = genderText,
            ["PhoneNumber"] = detail.PhoneNumber ?? "—",
            ["Email"] = detail.Email ?? "—",
            ["BranchName"] = detail.BranchName,
            ["BranchAddress"] = detail.BranchAddress,
            ["ContractTypeCode"] = detail.ContractTypeCode,
            ["ContractName"] = detail.ContractName,
            ["Position"] = detail.Position,
            ["HourlyRate"] = detail.HourlyRate.ToString("N0", vi),
            ["Allowance"] = detail.Allowance.ToString("N0", vi),
            ["StartDate"] = detail.StartDate.ToString("dd/MM/yyyy"),
            ["EndDate"] = detail.EndDate?.ToString("dd/MM/yyyy") ?? "Không xác định thời hạn",
            ["SignDay"] = signDate.ToString("dd"),
            ["SignMonth"] = signDate.ToString("MM"),
            ["SignYear"] = signDate.ToString("yyyy"),
            ["BenefitsDescription"] = detail.BenefitsDescription,
            ["Note"] = string.IsNullOrWhiteSpace(detail.Note) ? "Không có" : detail.Note,
        };

        var bytes = await _wordTemplateEngine.RenderFromTemplateAsync(templatePath, placeholders);
        var fileName = $"HopDong_{detail.EmployeeCode}_{detail.ContractCode}.docx";
        return File(bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName);
    }

    private (byte Level, int? EmployeeId, int? BranchId) GetCallerScope()
    {
        byte.TryParse(User.FindFirstValue("hierarchy_level"), out var lvl);

        if (User.IsInRole("Admin") || User.IsInRole("SuperAdmin"))
        {
            if (lvl < 5) lvl = 5;
        }
        else if (User.IsInRole("HRManager"))
        {
            if (lvl < 4) lvl = 4;
        }
        else if (lvl <= 0)
        {
            lvl = 1;
        }

        int? empId = int.TryParse(User.FindFirstValue("employee_id"), out var eid) ? eid : null;
        int? branchId = int.TryParse(User.FindFirstValue("branch_id"), out var bid) ? bid : null;
        return (lvl, empId, branchId);
    }
}
