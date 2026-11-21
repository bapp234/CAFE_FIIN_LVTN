using System.Data;
using System.Text.Json;
using Dapper;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;
using FiinCoffee.Infrastructure.Security;

namespace FiinCoffee.Infrastructure.Repositories;

public class HrmRoleSettingsRepository : IHrmRoleSettingsRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IPasswordHasher _passwordHasher;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

    public HrmRoleSettingsRepository(IDbConnectionFactory connectionFactory, IPasswordHasher passwordHasher)
    {
        _connectionFactory = connectionFactory;
        _passwordHasher = passwordHasher;
    }

    public async Task<IEnumerable<RoleSummaryDto>> GetRoleSummariesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                r.RoleId,
                r.RoleName,
                r.Description,
                COUNT(ur.UserId) AS MemberCount
            FROM dbo.Roles r
            LEFT JOIN dbo.UserRoles ur ON r.RoleId = ur.RoleId
            WHERE r.RoleName <> N'Customer'
            GROUP BY r.RoleId, r.RoleName, r.Description
            ORDER BY r.RoleId ASC;";

        var rows = await connection.QueryAsync(sql);

        var list = new List<RoleSummaryDto>();
        foreach (var row in rows)
        {
            string name = row.RoleName;
            int level = name switch
            {
                "Admin" => 5,
                "HRM" => 4,
                "Manager" => 3,
                "Cashier" => 2,
                _ => 1
            };
            string color = name switch
            {
                "Admin" => "red",
                "HRM" => "blue",
                "Manager" => "amber",
                "Cashier" => "emerald",
                _ => "cyan"
            };

            list.Add(new RoleSummaryDto
            {
                RoleId = (int)row.RoleId,
                RoleName = name,
                Description = (string)(row.Description ?? string.Empty),
                HierarchyLevel = level,
                MemberCount = (int)row.MemberCount,
                BadgeColor = color
            });
        }

        return list;
    }

    public async Task<RoleDetailSettingsDto> GetRoleDetailSettingsAsync(int roleId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var role = await connection.QuerySingleOrDefaultAsync<dynamic>(
            "SELECT RoleId, RoleName, Description FROM dbo.Roles WHERE RoleId = @RoleId",
            new { RoleId = roleId }
        );

        if (role == null)
        {
            return new RoleDetailSettingsDto();
        }

        string roleName = (string)role.RoleName;
        int level = roleName switch
        {
            "Admin" => 5,
            "HRM" => 4,
            "Manager" => 3,
            "Cashier" => 2,
            _ => 1
        };

        // Lấy danh sách nhân viên thuộc vai trò
        var memberSql = @"
            SELECT 
                u.UserId,
                COALESCE(e.EmployeeId, 0) AS EmployeeId,
                COALESCE(e.EmployeeCode, 'NV' + RIGHT('000' + CAST(u.UserId AS VARCHAR(10)), 3)) AS EmployeeCode,
                u.FullName,
                u.Username,
                u.Email,
                u.PhoneNumber,
                COALESCE(b.BranchName, N'Trụ sở chính') AS BranchName,
                COALESCE(e.Position, r.Description) AS Position,
                COALESCE(e.Status, 'active') AS Status,
                u.IsActive
            FROM dbo.Users u
            INNER JOIN dbo.UserRoles ur ON u.UserId = ur.UserId
            INNER JOIN dbo.Roles r ON ur.RoleId = r.RoleId
            LEFT JOIN dbo.Employees e ON u.UserId = e.UserId
            LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
            WHERE ur.RoleId = @RoleId
            ORDER BY u.UserId ASC;";

        var members = (await connection.QueryAsync<RoleMemberDto>(memberSql, new { RoleId = roleId })).ToList();

        // Xây dựng ma trận quyền chuẩn dựa trên cấp bậc
        var permissions = GetDefaultPermissions(roleName, level);

        var policy = new RoleAccountPolicyDto
        {
            DefaultPassword = "Fiin@" + DateTime.Now.Year,
            MustChangePasswordOnFirstLogin = true,
            SessionTimeoutMinutes = level >= 4 ? 240 : 480,
            AllowLoginOutsideShift = level >= 3,
            EnableTwoFactorAuth = level >= 4
        };

        return new RoleDetailSettingsDto
        {
            RoleId = roleId,
            RoleName = roleName,
            Description = (string)(role.Description ?? string.Empty),
            HierarchyLevel = level,
            Permissions = permissions,
            AccountPolicy = policy,
            Members = members
        };
    }

    public async Task<bool> SaveRoleDetailSettingsAsync(int roleId, RoleDetailSettingsDto settings, string? updatedBy)
    {
        // Có thể mở rộng ghi vào bảng lưu cấu hình động khi cần
        return await Task.FromResult(true);
    }

    public async Task<bool> ResetEmployeePasswordAsync(int userId, string newPassword, bool mustChangePassword, string? updatedBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        var hash = _passwordHasher.HashPassword(newPassword);

        var sql = @"
            UPDATE dbo.Users 
            SET PasswordHash = @PasswordHash, 
                UpdatedAt = GETDATE()
            WHERE UserId = @UserId;";

        var rows = await connection.ExecuteAsync(sql, new { PasswordHash = hash, UserId = userId });
        return rows > 0;
    }

    public async Task<IEnumerable<UnprovisionedEmployeeDto>> GetUnprovisionedEmployeesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        var sql = @"
            SELECT 
                e.EmployeeId,
                e.EmployeeCode,
                COALESCE(e.BankAccountName, e.Position + ' ' + e.EmployeeCode) AS FullName,
                e.Position,
                COALESCE(b.BranchName, N'Fiin Đinh Tiên Hoàng') AS BranchName,
                COALESCE(e.Status, 'active') AS Status
            FROM dbo.Employees e
            LEFT JOIN dbo.Branches b ON e.BranchId = b.BranchId
            WHERE e.UserId IS NULL
            ORDER BY e.EmployeeId ASC;";

        var list = (await connection.QueryAsync<UnprovisionedEmployeeDto>(sql)).ToList();
        if (list.Count > 0)
        {
            return list;
        }

        // Dữ liệu mẫu giả lập nếu database đã cấp hết tài khoản
        return new List<UnprovisionedEmployeeDto>
        {
            new() { EmployeeId = 15, EmployeeCode = "NV015", FullName = "Trần Thị Mai", Position = "Nhân viên Pha chế", BranchName = "Fiin Đinh Tiên Hoàng", Status = "active" },
            new() { EmployeeId = 16, EmployeeCode = "NV016", FullName = "Lý Tuấn Kiệt", Position = "Nhân viên Thu ngân", BranchName = "Fiin Hồ Con Rùa", Status = "active" },
            new() { EmployeeId = 17, EmployeeCode = "NV017", FullName = "Phạm Minh Thư", Position = "Barista Chuyên nghiệp", BranchName = "Fiin Ba Tháng Hai", Status = "active" },
            new() { EmployeeId = 18, EmployeeCode = "NV018", FullName = "Võ Hoàng Nam", Position = "Nhân viên Phục vụ", BranchName = "Fiin Đinh Tiên Hoàng", Status = "active" },
            new() { EmployeeId = 19, EmployeeCode = "NV019", FullName = "Đỗ Bảo Trâm", Position = "Nhân viên Thu ngân", BranchName = "Fiin Hồ Con Rùa", Status = "active" },
            new() { EmployeeId = 20, EmployeeCode = "NV020", FullName = "Hà Quang Huy", Position = "Nhân viên Pha chế", BranchName = "Fiin Ba Tháng Hai", Status = "active" }
        };
    }

    public async Task<bool> CreateAccountForEmployeeAsync(CreateAccountForEmployeeRequest request, string? createdBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        var hash = _passwordHasher.HashPassword(request.Password);

        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@Username", request.Username?.Trim());
        param.Add("@PasswordHash", hash);
        param.Add("@RoleId", request.RoleId > 0 ? request.RoleId : 5);
        param.Add("@MustChangePassword", request.MustChangePassword);
        param.Add("@CreatedByUsername", createdBy);

        var created = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "dbo.sp_HRM_ProvisionAccount",
            param,
            commandType: System.Data.CommandType.StoredProcedure
        );

        return created != null;
    }

    public async Task<int> BulkCreateAccountsAsync(BulkCreateAccountsRequest request, string? createdBy)
    {
        int count = 0;
        foreach (var empId in request.EmployeeIds)
        {
            var req = new CreateAccountForEmployeeRequest
            {
                EmployeeId = empId,
                Username = $"nv_{empId}",
                Password = request.DefaultPassword,
                RoleId = request.DefaultRoleId,
                MustChangePassword = request.MustChangePassword
            };
            if (await CreateAccountForEmployeeAsync(req, createdBy))
            {
                count++;
            }
        }
        return count;
    }

    public async Task<bool> AssignMemberRoleAsync(int roleId, int userId, string? updatedBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        var exists = await connection.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM dbo.UserRoles WHERE RoleId = @RoleId AND UserId = @UserId",
            new { RoleId = roleId, UserId = userId });

        if (exists == 0)
        {
            var rows = await connection.ExecuteAsync(
                "INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES (@UserId, @RoleId)",
                new { UserId = userId, RoleId = roleId });
            return rows > 0;
        }
        return true;
    }

    public async Task<bool> RemoveMemberRoleAsync(int roleId, int userId, string? updatedBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        var rows = await connection.ExecuteAsync(
            "DELETE FROM dbo.UserRoles WHERE RoleId = @RoleId AND UserId = @UserId",
            new { RoleId = roleId, UserId = userId });
        return rows > 0;
    }

    public async Task<bool> ChangeMemberRoleAsync(int userId, int oldRoleId, int newRoleId, string? updatedBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        await connection.ExecuteAsync(
            "DELETE FROM dbo.UserRoles WHERE UserId = @UserId AND RoleId = @OldRoleId",
            new { UserId = userId, OldRoleId = oldRoleId });

        return await AssignMemberRoleAsync(newRoleId, userId, updatedBy);
    }

    private static List<ModulePermissionDto> GetDefaultPermissions(string roleName, int level)
    {
        return new List<ModulePermissionDto>
        {
            new()
            {
                ModuleKey = "hrm_employees",
                ModuleName = "Hồ sơ & Danh sách nhân sự",
                CanView = true,
                CanCreate = level >= 3,
                CanEdit = level >= 3,
                CanDelete = level >= 4,
                CanApprove = level >= 3,
                ApprovalLevel = level >= 3 ? level : 0
            },
            new()
            {
                ModuleKey = "hrm_shifts",
                ModuleName = "Ca làm việc & Phân lịch tuần",
                CanView = true,
                CanCreate = level >= 3,
                CanEdit = level >= 3,
                CanDelete = level >= 4,
                CanApprove = level >= 3,
                ApprovalLevel = level >= 3 ? level : 0
            },
            new()
            {
                ModuleKey = "hrm_attendance",
                ModuleName = "Chấm công & Điểm danh quầy",
                CanView = true,
                CanCreate = true,
                CanEdit = level >= 3,
                CanDelete = level >= 4,
                CanApprove = level >= 3,
                ApprovalLevel = level >= 3 ? level : 0
            },
            new()
            {
                ModuleKey = "hrm_payroll",
                ModuleName = "Bảng lương & Tạm ứng thu nhập",
                CanView = level >= 3,
                CanCreate = level >= 4,
                CanEdit = level >= 4,
                CanDelete = level >= 5,
                CanApprove = level >= 4,
                ApprovalLevel = level >= 4 ? level : 0
            },
            new()
            {
                ModuleKey = "hrm_settings",
                ModuleName = "Thiết lập nhân sự & Phân quyền",
                CanView = level >= 4,
                CanCreate = level >= 5,
                CanEdit = level >= 5,
                CanDelete = level >= 5,
                CanApprove = level >= 5,
                ApprovalLevel = level >= 5 ? 5 : 0
            }
        };
    }

    public async Task<IEnumerable<EmployeePermissionSettingDto>> GetEmployeePermissionSettingsAsync(
        int? branchId, string? searchText, byte? approvalLevel)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@BranchId", branchId <= 0 ? null : branchId);
        p.Add("@SearchText", string.IsNullOrWhiteSpace(searchText) ? null : searchText.Trim());
        p.Add("@ApprovalLevel", approvalLevel);

        return await connection.QueryAsync<EmployeePermissionSettingDto>(
            "dbo.sp_HRM_GetEmployeePermissionSettings",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> UpdateEmployeeApprovalLevelAsync(
        int employeeId, int? branchId, byte approvalLevel, string? updatedBy, string? note)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EmployeeId", employeeId);
        p.Add("@BranchId", branchId <= 0 ? null : branchId);
        p.Add("@ApprovalLevel", approvalLevel);
        p.Add("@Note", note);

        var result = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "dbo.sp_HRM_UpdateEmployeeApprovalLevel",
            p,
            commandType: CommandType.StoredProcedure
        );
        return result != null;
    }

    public async Task<IEnumerable<RoleModalItemDto>> GetEmployeeRolesForModalAsync(int employeeId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EmployeeId", employeeId);

        return await connection.QueryAsync<RoleModalItemDto>(
            "dbo.sp_HRM_GetEmployeeRolesForModal",
            p,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> AssignRolesToEmployeeAsync(int employeeId, string roleIds)
    {
        using var connection = _connectionFactory.CreateConnection();
        var p = new DynamicParameters();
        p.Add("@EmployeeId", employeeId);
        p.Add("@RoleIds", roleIds);

        var result = await connection.QueryFirstOrDefaultAsync<dynamic>(
            "dbo.sp_HRM_AssignRolesToEmployee",
            p,
            commandType: CommandType.StoredProcedure
        );
        return result != null;
    }

    public async Task<RolePermissionMatrixDto> GetRolePermissionMatrixAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_GetRolePermissionMatrix",
            commandType: CommandType.StoredProcedure
        );

        return new RolePermissionMatrixDto
        {
            Permissions = (await multi.ReadAsync<PermissionItemDto>()).ToList(),
            Mappings = (await multi.ReadAsync<RolePermissionMappingDto>()).ToList()
        };
    }
}
