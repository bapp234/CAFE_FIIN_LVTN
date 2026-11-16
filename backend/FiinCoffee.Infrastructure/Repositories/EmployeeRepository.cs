using System.Data;
using Dapper;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Data;
using FiinCoffee.Infrastructure.Security;

namespace FiinCoffee.Infrastructure.Repositories;

/// <summary>
/// Triển khai kho dữ liệu Nhân sự, Chấm công, Bảng lương & Phân quyền (HRM) sử dụng Dapper kết nối SQL Server
/// </summary>
public class EmployeeRepository : IEmployeeRepository
{
    private readonly IDbConnectionFactory _connectionFactory;
    private readonly IPasswordHasher _passwordHasher;

    public EmployeeRepository(IDbConnectionFactory connectionFactory, IPasswordHasher hasher)
    {
        _connectionFactory = connectionFactory;
        _passwordHasher = hasher;
    }

    public async Task<IEnumerable<EmployeeDto>> GetAllAsync(int? branchId = null, string? status = null, string? searchTerm = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                EmployeeId, EmployeeCode, UserId, Username, FullName, 
                PhoneNumber, Email, CitizenId, BankName, BankAccountNumber, BankAccountName,
                BranchId, BranchCode, BranchName, Position, 
                ContractTypeId, ContractCode, ContractName, HourlyRate, Allowance, BenefitsDescription, 
                Status, HireDate, DateOfBirth, Gender, Note, UpdatedAt
            FROM dbo.v_EmployeeDetails
            WHERE (@BranchId IS NULL OR BranchId = @BranchId)
              AND (@Status IS NULL OR Status = @Status)
              AND (
                  @SearchTerm IS NULL 
                  OR FullName LIKE '%' + @SearchTerm + '%'
                  OR EmployeeCode LIKE '%' + @SearchTerm + '%'
                  OR PhoneNumber LIKE '%' + @SearchTerm + '%'
                  OR Email LIKE '%' + @SearchTerm + '%'
                  OR CitizenId LIKE '%' + @SearchTerm + '%'
              )
            ORDER BY EmployeeId DESC";

        return await connection.QueryAsync<EmployeeDto>(sql, new
        {
            BranchId = branchId,
            Status = status,
            SearchTerm = string.IsNullOrWhiteSpace(searchTerm) ? null : searchTerm.Trim()
        });
    }

    public async Task<EmployeeDto?> GetByIdAsync(int employeeId)
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                EmployeeId, EmployeeCode, UserId, Username, FullName, 
                PhoneNumber, Email, CitizenId, BankName, BankAccountNumber, BankAccountName,
                BranchId, BranchCode, BranchName, Position, 
                ContractTypeId, ContractCode, ContractName, HourlyRate, Allowance, BenefitsDescription, 
                Status, HireDate, DateOfBirth, Gender, Note, UpdatedAt
            FROM dbo.v_EmployeeDetails
            WHERE EmployeeId = @EmployeeId";

        return await connection.QuerySingleOrDefaultAsync<EmployeeDto>(sql, new { EmployeeId = employeeId });
    }

    public async Task<EmployeeDto> CreateEmployeeAsync(CreateEmployeeRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();

        var passwordHash = _passwordHasher.HashPassword(request.Password);

        var parameters = new DynamicParameters();
        parameters.Add("@Username", request.Username.Trim());
        parameters.Add("@PasswordHash", passwordHash);
        parameters.Add("@FullName", request.FullName.Trim());
        parameters.Add("@PhoneNumber", string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim());
        parameters.Add("@Email", string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim());
        parameters.Add("@DateOfBirth", request.DateOfBirth);
        parameters.Add("@Gender", string.IsNullOrWhiteSpace(request.Gender) ? null : request.Gender.Trim());
        parameters.Add("@CitizenId", request.CitizenId.Trim());
        parameters.Add("@BankName", string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim());
        parameters.Add("@BankAccountNumber", string.IsNullOrWhiteSpace(request.BankAccountNumber) ? null : request.BankAccountNumber.Trim());
        parameters.Add("@BankAccountName", string.IsNullOrWhiteSpace(request.BankAccountName) ? null : request.BankAccountName.Trim().ToUpper());
        parameters.Add("@BranchId", request.BranchId);
        parameters.Add("@Position", request.Position.Trim());
        parameters.Add("@ContractTypeId", request.ContractTypeId);
        parameters.Add("@HourlyRate", request.HourlyRate);
        parameters.Add("@Note", string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());
        parameters.Add("@RoleId", request.RoleId);

        parameters.Add("@NewEmployeeId", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@NewEmployeeCode", dbType: DbType.String, size: 20, direction: ParameterDirection.Output);

        var createdEmployee = await connection.QuerySingleAsync<EmployeeDto>(
            "dbo.sp_HRM_CreateEmployee",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return createdEmployee;
    }

    public async Task<IEnumerable<ContractTypeDto>> GetContractTypesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                ContractTypeId, ContractCode, ContractName, 
                StandardHourlyRate, Allowance, SalaryPercentage, 
                DurationMonths, BenefitsDescription, IsActive
            FROM dbo.ContractTypes
            WHERE IsActive = 1
            ORDER BY ContractTypeId";

        return await connection.QueryAsync<ContractTypeDto>(sql);
    }

    public async Task<IEnumerable<BranchDto>> GetBranchesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                BranchId, BranchCode, BranchName, Address, 
                PhoneNumber, OpeningTime, ClosingTime, IsActive
            FROM dbo.Branches
            WHERE IsActive = 1
            ORDER BY BranchId";

        return await connection.QueryAsync<BranchDto>(sql);
    }

    public async Task<(IEnumerable<HierarchyEmployeeDto> Items, int TotalCount)> GetEmployeesByHierarchyAsync(
        int? currentUserId = null,
        string? currentUsername = null,
        int? currentEmployeeId = null,
        int? branchId = null,
        string? status = null,
        string? searchText = null,
        int pageIndex = 1,
        int pageSize = 50)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@CurrentUserId", currentUserId);
        parameters.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());
        parameters.Add("@CurrentEmployeeId", currentEmployeeId);
        parameters.Add("@BranchId", branchId);
        parameters.Add("@Status", string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim());
        parameters.Add("@SearchText", string.IsNullOrWhiteSpace(searchText) ? null : searchText.Trim());
        parameters.Add("@PageIndex", pageIndex < 1 ? 1 : pageIndex);
        parameters.Add("@PageSize", pageSize < 1 ? 50 : pageSize);

        var items = (await connection.QueryAsync<HierarchyEmployeeDto>(
            "dbo.sp_HRM_GetEmployeesByHierarchy",
            parameters,
            commandType: CommandType.StoredProcedure
        )).ToList();

        var totalCount = items.FirstOrDefault()?.TotalCount ?? 0;
        return (items, totalCount);
    }

    public async Task<EmployeeFullProfileDto?> GetFullProfileAsync(int employeeId, DateTime? targetDate = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@EmployeeId", employeeId);
        parameters.Add("@TargetDate", targetDate?.Date);

        return await connection.QuerySingleOrDefaultAsync<EmployeeFullProfileDto>(
            "dbo.sp_HRM_GetEmployeeFullProfile",
            parameters,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> UpdateEmployeeProfileAsync(int employeeId, UpdateEmployeeProfileRequest request, string? updatedByUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@EmployeeId", employeeId);
        parameters.Add("@FullName", string.IsNullOrWhiteSpace(request.FullName) ? null : request.FullName.Trim());
        parameters.Add("@PhoneNumber", string.IsNullOrWhiteSpace(request.PhoneNumber) ? null : request.PhoneNumber.Trim());
        parameters.Add("@Email", string.IsNullOrWhiteSpace(request.Email) ? null : request.Email.Trim());
        parameters.Add("@DateOfBirth", request.DateOfBirth?.Date);
        parameters.Add("@Gender", string.IsNullOrWhiteSpace(request.Gender) ? null : request.Gender.Trim());
        parameters.Add("@CitizenId", string.IsNullOrWhiteSpace(request.CitizenId) ? null : request.CitizenId.Trim());
        parameters.Add("@BankName", string.IsNullOrWhiteSpace(request.BankName) ? null : request.BankName.Trim());
        parameters.Add("@BankAccountNumber", string.IsNullOrWhiteSpace(request.BankAccountNumber) ? null : request.BankAccountNumber.Trim());
        parameters.Add("@BankAccountName", string.IsNullOrWhiteSpace(request.BankAccountName) ? null : request.BankAccountName.Trim().ToUpper());
        parameters.Add("@ContractTypeId", request.ContractTypeId);
        parameters.Add("@HourlyRate", request.HourlyRate);
        parameters.Add("@Allowance", request.Allowance);
        parameters.Add("@Note", string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());
        parameters.Add("@Status", string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim());
        parameters.Add("@Position", string.IsNullOrWhiteSpace(request.Position) ? null : request.Position.Trim());
        parameters.Add("@BranchId", request.BranchId);
        parameters.Add("@UpdatedByUsername", string.IsNullOrWhiteSpace(updatedByUsername) ? null : updatedByUsername.Trim());

        await connection.ExecuteAsync(
            "dbo.sp_HRM_UpdateEmployeeProfile",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return true;
    }

    public async Task<bool> AssignApprovalAuthorityAsync(int employeeId, AssignApprovalAuthorityRequest request, string grantedByUsername)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@EmployeeId", employeeId);
        parameters.Add("@ApprovalLevel", request.ApprovalLevel);
        parameters.Add("@BranchId", request.BranchId);
        parameters.Add("@ParentApproverEmployeeId", request.ParentApproverEmployeeId);
        parameters.Add("@WorkflowCode", string.IsNullOrWhiteSpace(request.WorkflowCode) ? null : request.WorkflowCode.Trim());
        parameters.Add("@GrantedByUsername", grantedByUsername.Trim());
        parameters.Add("@Note", string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());

        await connection.ExecuteAsync(
            "dbo.sp_HRM_AssignApprovalAuthority",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return true;
    }

    public async Task<DailyAttendanceMonitorResponse> GetDailyAttendanceMonitorAsync(
        DateTime? workDate = null,
        int? branchId = null,
        string? status = null,
        string? search = null,
        string? currentUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@WorkDate", workDate?.Date);
        parameters.Add("@BranchId", branchId);
        parameters.Add("@Status", string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim());
        parameters.Add("@Search", string.IsNullOrWhiteSpace(search) ? null : search.Trim());
        parameters.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());

        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_GetDailyAttendanceMonitor",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        var items = (await multi.ReadAsync<DailyAttendanceItemDto>()).ToList();
        var summary = await multi.ReadSingleOrDefaultAsync<AttendanceKpiSummaryDto>() ?? new AttendanceKpiSummaryDto
        {
            WorkDate = workDate ?? DateTime.Today
        };

        return new DailyAttendanceMonitorResponse
        {
            WorkDate = workDate ?? DateTime.Today,
            Summary = summary,
            Items = items
        };
    }

    public async Task<IEnumerable<AttendanceReportItemDto>> ExportAttendanceReportAsync(
        DateTime fromDate,
        DateTime toDate,
        int? branchId = null,
        string? currentUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@FromDate", fromDate.Date);
        parameters.Add("@ToDate", toDate.Date);
        parameters.Add("@BranchId", branchId);
        parameters.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());

        return await connection.QueryAsync<AttendanceReportItemDto>(
            "dbo.sp_HRM_ExportAttendanceReport",
            parameters,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<PayrollPeriodDetailsResponse> GetPayrollPeriodDetailsAsync(
        string periodMonth,
        int? branchId = null,
        string? status = null,
        string? search = null,
        string? currentUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@PeriodMonth", periodMonth.Trim());
        parameters.Add("@BranchId", branchId);
        parameters.Add("@Status", string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim());
        parameters.Add("@Search", string.IsNullOrWhiteSpace(search) ? null : search.Trim());
        parameters.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());

        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_GetPayrollPeriodDetails",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        var header = await multi.ReadSingleOrDefaultAsync<PayrollPeriodHeaderDto>();
        var slips = (await multi.ReadAsync<PayrollSlipDetailDto>()).ToList();

        return new PayrollPeriodDetailsResponse
        {
            Period = header,
            Slips = slips
        };
    }

    public async Task<int> CalculatePayrollAsync(string periodMonth, int? branchId = null, string calculatedBy = "Hệ thống")
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@PeriodMonth", periodMonth.Trim());
        parameters.Add("@BranchId", branchId);
        parameters.Add("@CalculatedBy", calculatedBy);
        parameters.Add("@PeriodId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_CalculatePayroll",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return parameters.Get<int>("@PeriodId");
    }

    public async Task<bool> LockPayrollPeriodAsync(int periodId, string approverName)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@PeriodId", periodId);
        parameters.Add("@ApproverName", approverName.Trim());

        await connection.ExecuteAsync(
            "dbo.sp_HRM_LockPayrollPeriod",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return true;
    }

    public async Task<int> UpsertShiftTemplateAsync(UpsertShiftTemplateRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@TemplateId", request.TemplateId, direction: ParameterDirection.InputOutput);
        parameters.Add("@ShiftCode", request.ShiftCode.Trim());
        parameters.Add("@ShiftName", request.ShiftName.Trim());
        parameters.Add("@StartTime", request.StartTime);
        parameters.Add("@EndTime", request.EndTime);
        parameters.Add("@BreakMinutes", request.BreakMinutes);
        parameters.Add("@StandardHours", request.StandardHours);
        parameters.Add("@ColorCode", request.ColorCode);
        parameters.Add("@IsActive", request.IsActive);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_UpsertShiftTemplate",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return parameters.Get<int>("@TemplateId");
    }

    public async Task<IEnumerable<ShiftTemplateDto>> GetShiftTemplatesAsync()
    {
        using var connection = _connectionFactory.CreateConnection();

        var sql = @"
            SELECT 
                TemplateId, ShiftCode, ShiftName, StartTime, EndTime, 
                BreakMinutes, StandardHours, ColorCode, IsActive, CreatedAt
            FROM dbo.ShiftTemplates
            WHERE IsActive = 1
            ORDER BY StartTime";

        return await connection.QueryAsync<ShiftTemplateDto>(sql);
    }

    public async Task<IEnumerable<WeeklyScheduleMatrixRowDto>> ExportWeeklyScheduleAsync(
        int branchId,
        DateTime startDate,
        DateTime endDate,
        string? currentUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@BranchId", branchId);
        parameters.Add("@StartDate", startDate.Date);
        parameters.Add("@EndDate", endDate.Date);
        parameters.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());

        return await connection.QueryAsync<WeeklyScheduleMatrixRowDto>(
            "dbo.sp_HRM_ExportWeeklySchedule",
            parameters,
            commandType: CommandType.StoredProcedure
        );
    }
}
