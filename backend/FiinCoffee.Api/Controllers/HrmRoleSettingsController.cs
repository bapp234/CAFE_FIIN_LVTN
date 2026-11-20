using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/hrm/role-settings")]
public class HrmRoleSettingsController : ControllerBase
{
    private readonly IHrmRoleSettingsRepository _roleSettingsRepo;

    public HrmRoleSettingsController(IHrmRoleSettingsRepository roleSettingsRepo)
    {
        _roleSettingsRepo = roleSettingsRepo;
    }

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoleSummaries()
    {
        var list = await _roleSettingsRepo.GetRoleSummariesAsync();
        return Ok(new { success = true, data = list });
    }

    [HttpGet("roles/{roleId:int}")]
    public async Task<IActionResult> GetRoleDetail(int roleId)
    {
        var detail = await _roleSettingsRepo.GetRoleDetailSettingsAsync(roleId);
        return Ok(new { success = true, data = detail });
    }

    [HttpPut("roles/{roleId:int}")]
    public async Task<IActionResult> SaveRoleDetail(int roleId, [FromBody] RoleDetailSettingsDto payload)
    {
        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.SaveRoleDetailSettingsAsync(roleId, payload, updatedBy);
        return Ok(new { success, message = "Đã lưu thiết lập vai trò thành công!" });
    }

    [HttpPost("users/{userId:int}/reset-password")]
    public async Task<IActionResult> ResetPassword(int userId, [FromBody] ResetPasswordRequestDto payload)
    {
        if (string.IsNullOrWhiteSpace(payload.NewPassword) || payload.NewPassword.Length < 6)
        {
            return BadRequest(new { success = false, message = "Mật khẩu mới phải có tối thiểu 6 ký tự." });
        }

        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.ResetEmployeePasswordAsync(userId, payload.NewPassword, payload.MustChangePassword, updatedBy);
        return Ok(new { success, message = "Đã đặt lại mật khẩu cho nhân viên thành công!" });
    }

    [HttpGet("unprovisioned-employees")]
    public async Task<IActionResult> GetUnprovisionedEmployees()
    {
        var list = await _roleSettingsRepo.GetUnprovisionedEmployeesAsync();
        return Ok(new { success = true, data = list });
    }

    [HttpPost("employees/create-account")]
    public async Task<IActionResult> CreateAccountForEmployee([FromBody] CreateAccountForEmployeeRequest request)
    {
        try
        {
            var createdBy = User.Identity?.Name ?? "Admin";
            var success = await _roleSettingsRepo.CreateAccountForEmployeeAsync(request, createdBy);
            return Ok(new { success, message = "Đã cấp tài khoản cho nhân viên thành công!" });
        }
        catch (SqlException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("employees/bulk-create-accounts")]
    public async Task<IActionResult> BulkCreateAccounts([FromBody] BulkCreateAccountsRequest request)
    {
        try
        {
            var createdBy = User.Identity?.Name ?? "Admin";
            var count = await _roleSettingsRepo.BulkCreateAccountsAsync(request, createdBy);
            return Ok(new { success = count > 0, count, message = $"Đã cấp tài khoản thành công cho {count} nhân viên!" });
        }
        catch (SqlException ex)
        {
            return BadRequest(new { success = false, message = ex.Message });
        }
    }

    [HttpPost("roles/{roleId:int}/assign/{userId:int}")]
    public async Task<IActionResult> AssignRole(int roleId, int userId)
    {
        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.AssignMemberRoleAsync(roleId, userId, updatedBy);
        return Ok(new { success, message = "Đã thêm nhân sự vào vai trò thành công!" });
    }

    [HttpDelete("roles/{roleId:int}/remove/{userId:int}")]
    public async Task<IActionResult> RemoveRole(int roleId, int userId)
    {
        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.RemoveMemberRoleAsync(roleId, userId, updatedBy);
        return Ok(new { success, message = "Đã gỡ nhân sự khỏi vai trò thành công!" });
    }

    [HttpPut("users/{userId:int}/change-role")]
    public async Task<IActionResult> ChangeRole(int userId, [FromBody] ChangeMemberRoleRequest request)
    {
        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.ChangeMemberRoleAsync(userId, request.OldRoleId, request.NewRoleId, updatedBy);
        return Ok(new { success, message = "Đã cập nhật vai trò nhân sự thành công!" });
    }

    // =========================================================================
    // MA TRẬN PHÂN QUYỀN & CẤP DUYỆT (GRID MATRIX)
    // =========================================================================

    [HttpGet("matrix")]
    public async Task<IActionResult> GetPermissionMatrix([FromQuery] int? branchId, [FromQuery] string? search, [FromQuery] byte? approvalLevel)
    {
        var list = await _roleSettingsRepo.GetEmployeePermissionSettingsAsync(branchId, search, approvalLevel);
        return Ok(new { success = true, data = list });
    }

    [HttpGet("permissions-matrix")]
    public async Task<IActionResult> GetRolePermissionMatrix()
    {
        var data = await _roleSettingsRepo.GetRolePermissionMatrixAsync();
        return Ok(new { success = true, data });
    }

    [HttpPut("employees/{employeeId:int}/approval-level")]
    public async Task<IActionResult> UpdateEmployeeApprovalLevel(int employeeId, [FromBody] UpdateEmployeeApprovalLevelRequest request)
    {
        var updatedBy = User.Identity?.Name ?? "Admin";
        var success = await _roleSettingsRepo.UpdateEmployeeApprovalLevelAsync(employeeId, request.BranchId, request.ApprovalLevel, updatedBy, request.Note);
        return Ok(new { success, message = "Đã cập nhật cấp duyệt cho nhân viên thành công!" });
    }

    [HttpGet("employees/{employeeId:int}/roles")]
    public async Task<IActionResult> GetEmployeeRoles(int employeeId)
    {
        var list = await _roleSettingsRepo.GetEmployeeRolesForModalAsync(employeeId);
        return Ok(new { success = true, data = list });
    }

    [HttpPost("employees/{employeeId:int}/roles")]
    public async Task<IActionResult> AssignRolesToEmployee(int employeeId, [FromBody] AssignRolesToEmployeeRequest request)
    {
        var success = await _roleSettingsRepo.AssignRolesToEmployeeAsync(employeeId, request.RoleIds);
        return Ok(new { success, message = "Đã cập nhật phân quyền nhân sự thành công!" });
    }
}
