using FiinCoffee.Core.DTOs.HRM;

namespace FiinCoffee.Core.Interfaces;

public interface IHrmRoleSettingsRepository
{
    Task<IEnumerable<RoleSummaryDto>> GetRoleSummariesAsync();
    Task<RoleDetailSettingsDto> GetRoleDetailSettingsAsync(int roleId);
    Task<bool> SaveRoleDetailSettingsAsync(int roleId, RoleDetailSettingsDto settings, string? updatedBy);
    Task<bool> ResetEmployeePasswordAsync(int userId, string newPassword, bool mustChangePassword, string? updatedBy);

    // Quản lý cấp tài khoản nhân viên (Sub-tab Chỉnh sửa tài khoản)
    Task<IEnumerable<UnprovisionedEmployeeDto>> GetUnprovisionedEmployeesAsync();
    Task<bool> CreateAccountForEmployeeAsync(CreateAccountForEmployeeRequest request, string? createdBy);
    Task<int> BulkCreateAccountsAsync(BulkCreateAccountsRequest request, string? createdBy);

    // Quản lý nhân sự thuộc vai trò (Thêm, Xóa, Sửa vai trò)
    Task<bool> AssignMemberRoleAsync(int roleId, int userId, string? updatedBy);
    Task<bool> RemoveMemberRoleAsync(int roleId, int userId, string? updatedBy);
    Task<bool> ChangeMemberRoleAsync(int userId, int oldRoleId, int newRoleId, string? updatedBy);

    // Ma trận phân quyền & Cấp duyệt nhân sự (Grid Matrix)
    Task<IEnumerable<EmployeePermissionSettingDto>> GetEmployeePermissionSettingsAsync(int? branchId, string? searchText, byte? approvalLevel);
    Task<bool> UpdateEmployeeApprovalLevelAsync(int employeeId, int? branchId, byte approvalLevel, string? updatedBy, string? note);
    Task<IEnumerable<RoleModalItemDto>> GetEmployeeRolesForModalAsync(int employeeId);
    Task<bool> AssignRolesToEmployeeAsync(int employeeId, string roleIds);
    Task<RolePermissionMatrixDto> GetRolePermissionMatrixAsync();
}
