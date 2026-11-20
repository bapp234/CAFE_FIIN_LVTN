namespace FiinCoffee.Core.DTOs.HRM;

public class RoleSummaryDto
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int HierarchyLevel { get; set; }
    public int MemberCount { get; set; }
    public string BadgeColor { get; set; } = "amber";
}

public class ModulePermissionDto
{
    public string ModuleKey { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public bool CanView { get; set; }
    public bool CanCreate { get; set; }
    public bool CanEdit { get; set; }
    public bool CanDelete { get; set; }
    public bool CanApprove { get; set; }
    public int ApprovalLevel { get; set; }
}

public class RoleAccountPolicyDto
{
    public string DefaultPassword { get; set; } = "Fiin@123";
    public bool MustChangePasswordOnFirstLogin { get; set; } = true;
    public int SessionTimeoutMinutes { get; set; } = 480;
    public bool AllowLoginOutsideShift { get; set; } = true;
    public bool EnableTwoFactorAuth { get; set; } = false;
}

public class RoleMemberDto
{
    public int UserId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhoneNumber { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
    public bool IsActive { get; set; } = true;
}

public class RoleDetailSettingsDto
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public int HierarchyLevel { get; set; }
    public List<ModulePermissionDto> Permissions { get; set; } = new();
    public RoleAccountPolicyDto AccountPolicy { get; set; } = new();
    public List<RoleMemberDto> Members { get; set; } = new();
}

public class ResetPasswordRequestDto
{
    public int UserId { get; set; }
    public string NewPassword { get; set; } = string.Empty;
    public bool MustChangePassword { get; set; } = true;
}

public class UnprovisionedEmployeeDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public string Status { get; set; } = "active";
}

public class CreateAccountForEmployeeRequest
{
    public int EmployeeId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public int RoleId { get; set; } = 5;
    public bool MustChangePassword { get; set; } = true;
}

public class BulkCreateAccountsRequest
{
    public List<int> EmployeeIds { get; set; } = new();
    public string DefaultPassword { get; set; } = "Fiin@2026";
    public bool MustChangePassword { get; set; } = true;
    public int DefaultRoleId { get; set; } = 5;
}

public class AssignMemberRoleRequest
{
    public int RoleId { get; set; }
    public int UserId { get; set; }
}

public class ChangeMemberRoleRequest
{
    public int UserId { get; set; }
    public int OldRoleId { get; set; }
    public int NewRoleId { get; set; }
}

public class EmployeePermissionSettingDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string EmployeeStatus { get; set; } = "active";
    public int? UserId { get; set; }
    public string? Username { get; set; }
    public bool IsUserActive { get; set; }
    public byte ApprovalLevel { get; set; }
    public string ApprovalLevelName { get; set; } = string.Empty;
    public string? RoleNames { get; set; }
    public string? RoleIds { get; set; }
}

public class UpdateEmployeeApprovalLevelRequest
{
    public byte ApprovalLevel { get; set; }
    public int? BranchId { get; set; }
    public string? Note { get; set; }
}

public class RoleModalItemDto
{
    public int RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int? ParentRoleId { get; set; }
    public bool IsAssigned { get; set; }
}

public class AssignRolesToEmployeeRequest
{
    public string RoleIds { get; set; } = string.Empty;
}

public class PermissionItemDto
{
    public int PermissionId { get; set; }
    public string PermissionCode { get; set; } = string.Empty;
    public string ModuleCode { get; set; } = string.Empty;
    public string ModuleName { get; set; } = string.Empty;
    public string PermissionName { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int SortOrder { get; set; }
}

public class RolePermissionMappingDto
{
    public int RoleId { get; set; }
    public int PermissionId { get; set; }
    public string PermissionCode { get; set; } = string.Empty;
}

public class RolePermissionMatrixDto
{
    public List<PermissionItemDto> Permissions { get; set; } = new();
    public List<RolePermissionMappingDto> Mappings { get; set; } = new();
}
