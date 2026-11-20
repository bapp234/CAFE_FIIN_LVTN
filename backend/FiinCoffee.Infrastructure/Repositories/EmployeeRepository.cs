using System.Data;
using System.Text.Json;
using Dapper;
using System;
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
                PhoneNumber, IsActive
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

    public async Task<bool> UnlockPayrollPeriodAsync(int periodId, string unlockedBy, string? reason = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@PeriodId", periodId);
        parameters.Add("@UnlockedBy", unlockedBy.Trim());
        parameters.Add("@Reason", reason?.Trim());

        await connection.ExecuteAsync(
            "dbo.sp_HRM_UnlockPayrollPeriod",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        return true;
    }

    public async Task<int> UpsertShiftTemplateAsync(UpsertShiftTemplateRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();

        var parameters = new DynamicParameters();
        parameters.Add("@TemplateId", request.TemplateId, dbType: DbType.Int32, direction: ParameterDirection.InputOutput);
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
    public async Task<GridDatasetDto> GetEmployeesGridDatasetAsync(
    string? currentUsername = null,
    int? branchId = null,
    string? position = null,
    string? status = null,
    DateTime? targetDate = null,
    string? search = null,
    int pageIndex = 1,
    int pageSize = 50
    )
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@CurrentUsername", string.IsNullOrWhiteSpace(currentUsername) ? null : currentUsername.Trim());
        param.Add("@BranchId", branchId);
        param.Add("@Position", string.IsNullOrWhiteSpace(position) || position == "all" ? null :
        position.Trim());
        param.Add("@Status", string.IsNullOrWhiteSpace(status) || status == "all" ? null : status.Trim());
        param.Add("@TargetDate", targetDate?.Date);
        param.Add("@SearchText", string.IsNullOrWhiteSpace(search) ? null : search.Trim());
        param.Add("@PageIndex", pageIndex < 1 ? 1 : pageIndex);
        param.Add("@PageSize", pageSize < 1 ? 50 : pageSize);
        using var multi = await connection.QueryMultipleAsync(
       "dbo.sp_HRM_GetEmployees_GridDataset",
       param,
       commandType: CommandType.StoredProcedure
   );
        var columns = (await multi.ReadAsync<GridColumnDto>()).ToList();
        var rows = (await multi.ReadAsync<dynamic>()).ToList();
        int totalCount = 0;
        if (rows.Any())
        {
            var firstRow = (IDictionary<string, object>)rows.First();
            if (firstRow.ContainsKey("TotalCount") && firstRow["TotalCount"] != null)
            {
                totalCount = Convert.ToInt32(firstRow["TotalCount"]);
            }
            else
            {
                totalCount = rows.Count;
            }
        }
        return new GridDatasetDto
        {
            Columns = columns,
            Rows = rows,
            TotalCount = totalCount
        };
    }
    public async Task<DataSet> GetEmployeesExportDataSetAsync(
        string? currentUsername = null,
        int? branchId = null,
        string? position = null,
        string? status = null,
        string? searchText = null,
        string? employeeCodes = null,
        int accountStatus = -1)
    {
        using var connection = _connectionFactory.CreateConnection();
        var parameters = new DynamicParameters();
        parameters.Add("@CurrentUsername", currentUsername);
        parameters.Add("@BranchId", branchId);
        parameters.Add("@Position", position);
        parameters.Add("@Status", status);
        parameters.Add("@SearchText", searchText);
        parameters.Add("@EmployeeCodes", employeeCodes);
        parameters.Add("@AccountStatus", accountStatus);
        using var reader = await connection.ExecuteReaderAsync(
            "dbo.sp_HRM_ExportEmployees_Excel",
            parameters,
            commandType: CommandType.StoredProcedure
        );
        var dataSet = new DataSet();
        dataSet.Load(reader, LoadOption.OverwriteChanges, "Employees", "ExportConfig");
        return dataSet;
    }

    public async Task<EmployeeFilterOptionsDto> GetEmployeesFilterOptionsAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_GetEmployees_FilterOptions",
            commandType: CommandType.StoredProcedure
        );

        return new EmployeeFilterOptionsDto
        {
            Branches = (await multi.ReadAsync<ComboOptionDto>()).ToList(),
            Positions = (await multi.ReadAsync<ComboOptionDto>()).ToList(),
            Statuses = (await multi.ReadAsync<ComboOptionDto>()).ToList(),
            ContractTypes = (await multi.ReadAsync<ComboOptionDto>()).ToList()
        };
    }

    public async Task<HashSet<string>> GetExistingCitizenIdsAsync()
    {
        using var connection = _connectionFactory.CreateConnection();
        var citizenIds = await connection.QueryAsync<string>("SELECT CitizenId FROM dbo.Employees WHERE CitizenId IS NOT NULL");
        return new HashSet<string>(citizenIds.Where(c => !string.IsNullOrWhiteSpace(c)), StringComparer.OrdinalIgnoreCase);
    }

    public async Task<EmployeeImportSaveResultDto> ImportEmployeesBatchAsync(EmployeeImportSaveRequestDto request, string? currentUsername = null)
    {
        using var connection = _connectionFactory.CreateConnection();

        // 1. Nếu người dùng chọn tạo tài khoản, chỉ băm mật khẩu 1 lần duy nhất cho toàn bộ 100+ tài khoản
        string? defaultPasswordHash = null;
        if (request.CreateAccounts)
        {
            string passToHash = string.IsNullOrWhiteSpace(request.DefaultPassword) ? "Fiin@123" : request.DefaultPassword.Trim();
            defaultPasswordHash = _passwordHasher.HashPassword(passToHash);
        }

        var jsonOptions = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        string employeesJson = JsonSerializer.Serialize(request.Employees, jsonOptions);

        var parameters = new DynamicParameters();
        parameters.Add("@EmployeesJson", employeesJson);
        parameters.Add("@CreateAccounts", request.CreateAccounts);
        parameters.Add("@DefaultPasswordHash", defaultPasswordHash);
        parameters.Add("@ImportedByUsername", currentUsername);

        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_ImportEmployees_Batch",
            parameters,
            commandType: CommandType.StoredProcedure
        );

        var summary = await multi.ReadSingleOrDefaultAsync<EmployeeImportSaveResultDto>() 
                      ?? new EmployeeImportSaveResultDto();
        var details = (await multi.ReadAsync<EmployeeImportedItemDto>()).ToList();

        summary.ImportedEmployees = details;
        return summary;
    }

    public async Task<IEnumerable<EmployeeSimpleDto>> GetEmployeesSimpleAsync(
        int accountStatus = -1,
        DateTime? viewDate = null,
        int? branchId = null,
        string? searchText = null,
        int loginId = -1,
        int pageIndex = 1,
        int pageSize = 50)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@AccountStatus", accountStatus);
        param.Add("@ViewDate", viewDate?.Date);
        param.Add("@BranchId", branchId <= 0 ? null : branchId);
        param.Add("@SearchText", string.IsNullOrWhiteSpace(searchText) ? null : searchText.Trim());
        param.Add("@LoginID", loginId);
        param.Add("@PageIndex", pageIndex < 1 ? 1 : pageIndex);
        param.Add("@PageSize", pageSize);

        return await connection.QueryAsync<EmployeeSimpleDto>(
            "dbo.sp_HRM_GetEmployees_Simple",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<HrmDashboardSummaryDto> GetDashboardSummaryAsync(
        int? branchId = null,
        int? year = null,
        int? month = null,
        int loginId = -1)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId <= 0 ? null : branchId);
        param.Add("@Year", year);
        param.Add("@Month", month);
        param.Add("@LoginID", loginId);

        using var multi = await connection.QueryMultipleAsync(
            "dbo.sp_HRM_GetDashboardSummary",
            param,
            commandType: CommandType.StoredProcedure
        );

        var summary = await multi.ReadFirstOrDefaultAsync<HrmDashboardSummaryDto>()
                      ?? new HrmDashboardSummaryDto();

        summary.PositionBreakdown = (await multi.ReadAsync<DashboardPositionItemDto>()).ToList();
        summary.MonthlyStats = (await multi.ReadAsync<DashboardMonthlyStatDto>()).ToList();
        summary.AttendanceSummary = await multi.ReadFirstOrDefaultAsync<DashboardAttendanceSummaryDto>()
                                    ?? new DashboardAttendanceSummaryDto();

        return summary;
    }

    public async Task<AttendancePeriodStatusDto?> GetAttendancePeriodStatusAsync(int? branchId, string periodMonth)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@PeriodMonth", periodMonth);

        return await connection.QuerySingleOrDefaultAsync<AttendancePeriodStatusDto>(
            "dbo.sp_HRM_GetAttendancePeriodStatus",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<IEnumerable<AttendanceMonthlySummaryItemDto>> GetAttendanceMonthlySummaryAsync(
        string periodMonth,
        int? branchId = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@BranchId", branchId);
        param.Add("@Search", search);

        return await connection.QueryAsync<AttendanceMonthlySummaryItemDto>(
            "dbo.sp_HRM_GetAttendanceMonthlySummary",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<IEnumerable<OvertimeTypeDto>> GetOvertimeTypesAsync(string? scope = null, string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@Scope", scope);
        param.Add("@Search", search);
        return await connection.QueryAsync<OvertimeTypeDto>(
            "dbo.sp_HRM_GetOvertimeTypes",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> SaveOvertimeTypeAsync(SaveOvertimeTypeRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@OvertimeTypeId", request.OvertimeTypeId);
        param.Add("@OTCode", request.OTCode);
        param.Add("@OTName", request.OTName);
        param.Add("@OTCategory", request.OTCategory);
        param.Add("@Scope", request.Scope);
        param.Add("@PayMultiplier", request.PayMultiplier);
        param.Add("@NightExtraRate", request.NightExtraRate);
        param.Add("@MaxHoursPerDay", request.MaxHoursPerDay);
        param.Add("@MaxHoursPerMonth", request.MaxHoursPerMonth);
        param.Add("@RoundingMinutes", request.RoundingMinutes);
        param.Add("@RequireApproval", request.RequireApproval);
        param.Add("@AllowCompensatoryLeave", request.AllowCompensatoryLeave);
        param.Add("@Description", request.Description);
        param.Add("@IsActive", request.IsActive);

        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_SaveOvertimeType",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> DeleteOvertimeTypeAsync(int overtimeTypeId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@OvertimeTypeId", overtimeTypeId);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_DeleteOvertimeType",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<LeaveTypeDto>> GetLeaveTypesAsync(string? scope = null, string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@Scope", scope);
        param.Add("@Search", search);
        return await connection.QueryAsync<LeaveTypeDto>(
            "dbo.sp_HRM_GetLeaveTypes",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> SaveLeaveTypeAsync(SaveLeaveTypeRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@LeaveTypeId", request.LeaveTypeId);
        param.Add("@LeaveCode", request.LeaveCode);
        param.Add("@LeaveName", request.LeaveName);
        param.Add("@Scope", request.Scope);
        param.Add("@IsPaid", request.IsPaid);
        param.Add("@PaidPercent", request.PaidPercent);
        param.Add("@DeductAnnualLeave", request.DeductAnnualLeave);
        param.Add("@StandardDaysPerYear", request.StandardDaysPerYear);
        param.Add("@MinNoticeDays", request.MinNoticeDays);
        param.Add("@MonthlyAccrual", request.MonthlyAccrual);
        param.Add("@ProbationEligible", request.ProbationEligible);
        param.Add("@AllowNegativeBalance", request.AllowNegativeBalance);
        param.Add("@Description", request.Description);
        param.Add("@IsActive", request.IsActive);

        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_SaveLeaveType",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> DeleteLeaveTypeAsync(int leaveTypeId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@LeaveTypeId", leaveTypeId);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_DeleteLeaveType",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<HolidayItemDto>> GetHolidaysByYearAsync(int? year = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@Year", year);
        return await connection.QueryAsync<HolidayItemDto>(
            "dbo.sp_HRM_GetHolidaysByYear",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<IEnumerable<PayrollSettingItemDto>> GetPayrollSettingsAsync(
        string? category = null,
        string? calcType = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@Category", category);
        param.Add("@CalcType", calcType);
        param.Add("@Search", search);
        return await connection.QueryAsync<PayrollSettingItemDto>(
            "dbo.sp_HRM_GetPayrollSettings",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> SavePayrollSettingAsync(SavePayrollSettingRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@SettingId", request.SettingId);
        param.Add("@Code", request.Code);
        param.Add("@Name", request.Name);
        param.Add("@Category", request.Category);
        param.Add("@CalcType", request.CalcType);
        param.Add("@RawValue", request.RawValue);
        param.Add("@Impact", request.Impact);
        param.Add("@ApplyScope", request.ApplyScope);
        param.Add("@Note", request.Note);
        param.Add("@IsActive", request.IsActive);

        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_SavePayrollSetting",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> DeletePayrollSettingAsync(int settingId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@SettingId", settingId);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_DeletePayrollSetting",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<OvertimeRequestItemDto>> GetOvertimeRequestsAsync(
        string? periodMonth = null,
        int? branchId = null,
        string? status = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@BranchId", branchId);
        param.Add("@Status", status);
        param.Add("@Search", search);
        return await connection.QueryAsync<OvertimeRequestItemDto>(
            "dbo.sp_HRM_GetOvertimeRequests",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> CreateOvertimeRequestAsync(CreateOvertimeRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@WorkDate", request.WorkDate.Date);
        param.Add("@StartTime", TimeSpan.Parse(request.StartTime));
        param.Add("@EndTime", TimeSpan.Parse(request.EndTime));
        param.Add("@OTCode", request.OTCode);
        param.Add("@Reason", request.Reason);
        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_CreateOvertimeRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ProcessOvertimeRequestAsync(int overtimeId, ProcessHrmRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@OvertimeId", overtimeId);
        param.Add("@Action", request.Action);
        param.Add("@ApproverName", string.IsNullOrWhiteSpace(request.ApproverName) ? "Quản lý" : request.ApproverName);
        param.Add("@Note", request.Note);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_ProcessOvertimeRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<AttendanceCorrectionRequestItemDto>> GetAttendanceCorrectionRequestsAsync(
        string? periodMonth = null,
        int? branchId = null,
        string? status = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@BranchId", branchId);
        param.Add("@Status", status);
        param.Add("@Search", search);
        return await connection.QueryAsync<AttendanceCorrectionRequestItemDto>(
            "dbo.sp_HRM_GetAttendanceCorrectionRequests",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> CreateAttendanceCorrectionRequestAsync(CreateAttendanceCorrectionRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@WorkDate", request.WorkDate.Date);
        param.Add("@RequestedCheckIn", TimeSpan.Parse(request.RequestedCheckIn));
        param.Add("@RequestedCheckOut", TimeSpan.Parse(request.RequestedCheckOut));
        param.Add("@Reason", request.Reason);
        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_CreateAttendanceCorrectionRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ProcessAttendanceCorrectionRequestAsync(int requestId, ProcessHrmRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@RequestId", requestId);
        param.Add("@Action", request.Action);
        param.Add("@ApproverName", string.IsNullOrWhiteSpace(request.ApproverName) ? "Quản lý" : request.ApproverName);
        param.Add("@Note", request.Note);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_ProcessAttendanceCorrectionRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<LeaveRequestItemDto>> GetLeaveRequestsAsync(
        string? periodMonth = null,
        int? branchId = null,
        string? status = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@BranchId", branchId);
        param.Add("@Status", status);
        param.Add("@Search", search);
        return await connection.QueryAsync<LeaveRequestItemDto>(
            "dbo.sp_HRM_GetLeaveRequests",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<int> CreateLeaveRequestAsync(CreateLeaveRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@FromDate", request.FromDate.Date);
        param.Add("@ToDate", request.ToDate.Date);
        param.Add("@LeaveCode", request.LeaveCode);
        param.Add("@Reason", request.Reason);
        return await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_CreateLeaveRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ProcessLeaveRequestAsync(int leaveId, ProcessHrmRequestDto request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@LeaveId", leaveId);
        param.Add("@Action", request.Action);
        param.Add("@ApproverName", string.IsNullOrWhiteSpace(request.ApproverName) ? "Quản lý" : request.ApproverName);
        param.Add("@Note", request.Note);
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_ProcessLeaveRequest",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<bool> LockAttendancePeriodAsync(int branchId, string periodMonth, string lockedBy)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@LockedBy", lockedBy);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_LockAttendancePeriod",
            param,
            commandType: CommandType.StoredProcedure
        );
        return true;
    }

    public async Task<bool> UnlockAttendancePeriodAsync(int branchId, string periodMonth, string unlockPassword, string unlockReason, string unlockedBy, string? clientIp = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@UnlockPassword", unlockPassword);
        param.Add("@UnlockReason", unlockReason);
        param.Add("@UnlockedBy", unlockedBy);
        param.Add("@ClientIp", clientIp);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_UnlockAttendancePeriod",
            param,
            commandType: CommandType.StoredProcedure
        );
        return true;
    }

    public async Task<ShiftScheduleWeekStatusDto?> GetShiftScheduleWeekStatusAsync(int branchId, DateTime startDate)
    {
        if (startDate < new DateTime(1753, 1, 1))
        {
            startDate = DateTime.Today;
        }

        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@StartDate", startDate.Date);

        return await connection.QuerySingleOrDefaultAsync<ShiftScheduleWeekStatusDto>(
            "dbo.sp_HRM_GetShiftScheduleWeekStatus",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> LockShiftScheduleAsync(int branchId, DateTime startDate, string lockedBy)
    {
        if (startDate < new DateTime(1753, 1, 1))
        {
            startDate = DateTime.Today;
        }

        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@StartDate", startDate.Date);
        param.Add("@LockedBy", lockedBy);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_LockShiftSchedule",
            param,
            commandType: CommandType.StoredProcedure
        );
        return true;
    }

    public async Task<bool> UnlockShiftScheduleAsync(int branchId, DateTime startDate)
    {
        if (startDate < new DateTime(1753, 1, 1))
        {
            startDate = DateTime.Today;
        }

        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId);
        param.Add("@StartDate", startDate.Date);

        await connection.ExecuteAsync(
            "dbo.sp_HRM_UnlockShiftSchedule",
            param,
            commandType: CommandType.StoredProcedure
        );
        return true;
    }

    public async Task<IEnumerable<ShiftAssignmentDto>> GetWeekShiftAssignmentsAsync(
        int? branchId, DateTime startDate, DateTime endDate)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@BranchId", branchId <= 0 ? null : branchId);
        param.Add("@StartDate", startDate.Date);
        param.Add("@EndDate", endDate.Date);

        return await connection.QueryAsync<ShiftAssignmentDto>(
            "dbo.sp_HRM_GetWeekShiftAssignments",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<ShiftAssignmentDto> SaveShiftAssignmentAsync(SaveShiftAssignmentRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@WorkDate", request.WorkDate.Date);
        param.Add("@ShiftCode", request.ShiftCode);
        param.Add("@TemplateId", request.TemplateId);
        param.Add("@BranchId", request.BranchId <= 0 ? null : request.BranchId);
        param.Add("@RegisteredBy", request.RegisteredBy ?? "manager");
        param.Add("@Status", request.Status ?? "scheduled");
        param.Add("@Note", request.Note);

        return await connection.QuerySingleAsync<ShiftAssignmentDto>(
            "dbo.sp_HRM_SaveShiftAssignment",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> RemoveShiftAssignmentAsync(int assignmentId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@AssignmentId", assignmentId);

        var removed = await connection.QuerySingleOrDefaultAsync<int>(
            "dbo.sp_HRM_RemoveShiftAssignment",
            param,
            commandType: CommandType.StoredProcedure
        );
        return removed > 0;
    }

    public async Task<decimal> AdjustAttendanceByEmployeeDateAsync(AdjustAttendanceManualByDateRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@WorkDate", request.WorkDate.Date);
        param.Add("@CheckInTime", request.CheckInTime);
        param.Add("@CheckOutTime", request.CheckOutTime);
        param.Add("@AdjustedBy", request.AdjustedBy);
        param.Add("@AdjustedReason", request.AdjustedReason);

        var res = await connection.QuerySingleAsync<dynamic>(
            "dbo.sp_HRM_AdjustAttendanceByEmployeeDate",
            param,
            commandType: CommandType.StoredProcedure
        );
        return (decimal)(res.WorkHours ?? 0m);
    }

    public async Task<bool> DeleteShiftTemplateAsync(int templateId)
    {
        using var connection = _connectionFactory.CreateConnection();
        var affected = await connection.ExecuteAsync(
            "UPDATE dbo.ShiftTemplates SET IsActive = 0 WHERE TemplateId = @TemplateId",
            new { TemplateId = templateId }
        );
        return affected > 0;
    }

    public async Task<IEnumerable<SalaryAdvanceItemDto>> GetSalaryAdvancesAsync(
        string? periodMonth = null,
        int? branchId = null,
        string? status = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth);
        param.Add("@BranchId", branchId);
        param.Add("@Status", status);
        param.Add("@Search", search);
        return await connection.QueryAsync<SalaryAdvanceItemDto>(
            "dbo.sp_HRM_GetSalaryAdvances",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<CreateSalaryAdvanceResultDto> CreateSalaryAdvanceAsync(CreateSalaryAdvanceRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@EmployeeId", request.EmployeeId);
        param.Add("@PeriodMonth", request.PeriodMonth?.Trim());
        param.Add("@RequestDate", request.RequestDate.Date);
        param.Add("@Amount", request.Amount);
        param.Add("@PaymentMethod", string.IsNullOrWhiteSpace(request.PaymentMethod) ? "Chuyển khoản" : request.PaymentMethod.Trim());
        param.Add("@Reason", request.Reason?.Trim());
        param.Add("@CreatedBy", string.IsNullOrWhiteSpace(request.CreatedBy) ? null : request.CreatedBy.Trim());
        return await connection.QuerySingleAsync<CreateSalaryAdvanceResultDto>(
            "dbo.sp_HRM_CreateSalaryAdvance",
            param,
            commandType: CommandType.StoredProcedure
        );
    }

    public async Task<bool> ProcessSalaryAdvanceAsync(int advanceId, ProcessSalaryAdvanceRequest request)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@AdvanceId", advanceId);
        param.Add("@Action", request.Action?.Trim().ToLowerInvariant());
        param.Add("@ApproverName", string.IsNullOrWhiteSpace(request.ApproverName) ? "Quản lý" : request.ApproverName.Trim());
        param.Add("@Note", string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim());
        var affected = await connection.QuerySingleAsync<int>(
            "dbo.sp_HRM_ProcessSalaryAdvance",
            param,
            commandType: CommandType.StoredProcedure
        );
        return affected > 0;
    }

    public async Task<IEnumerable<EmployeeMonthlyQuotaItemDto>> GetEmployeeMonthlyQuotasAsync(
        string periodMonth,
        int? branchId = null,
        int? employeeId = null,
        string? search = null)
    {
        using var connection = _connectionFactory.CreateConnection();
        var param = new DynamicParameters();
        param.Add("@PeriodMonth", periodMonth?.Trim());
        param.Add("@BranchId", branchId <= 0 ? null : branchId);
        param.Add("@EmployeeId", employeeId <= 0 ? null : employeeId);
        param.Add("@Search", string.IsNullOrWhiteSpace(search) ? null : search.Trim());
        return await connection.QueryAsync<EmployeeMonthlyQuotaItemDto>(
            "dbo.sp_HRM_GetEmployeeMonthlyQuotas",
            param,
            commandType: CommandType.StoredProcedure
        );
    }
}
