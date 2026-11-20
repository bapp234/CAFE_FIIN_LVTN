using FiinCoffee.Core.DTOs.HRM;
using System.Data;
namespace FiinCoffee.Core.Interfaces;

/// <summary>
/// Giao diện kho dữ liệu Quản trị Nhân sự & Hợp đồng (HRM)
/// </summary>
public interface IEmployeeRepository
{
    Task<IEnumerable<EmployeeDto>> GetAllAsync(int? branchId = null, string? status = null, string? searchTerm = null);
    Task<EmployeeDto?> GetByIdAsync(int employeeId);
    Task<EmployeeDto> CreateEmployeeAsync(CreateEmployeeRequest request);
    Task<IEnumerable<ContractTypeDto>> GetContractTypesAsync();
    Task<IEnumerable<BranchDto>> GetBranchesAsync();

    /// <summary>
    /// Lấy danh sách nhân viên theo phân quyền cây phả hệ (hỗ trợ phân trang lười Combobox & Danh sách)
    /// </summary>
    Task<(IEnumerable<HierarchyEmployeeDto> Items, int TotalCount)> GetEmployeesByHierarchyAsync(
        int? currentUserId = null,
        string? currentUsername = null,
        int? currentEmployeeId = null,
        int? branchId = null,
        string? status = null,
        string? searchText = null,
        int pageIndex = 1,
        int pageSize = 50);

    /// <summary>
    /// Lấy toàn bộ 5 nhóm trường thông tin chi tiết hồ sơ nhân sự
    /// </summary>
    Task<EmployeeFullProfileDto?> GetFullProfileAsync(int employeeId, DateTime? targetDate = null);

    /// <summary>
    /// Cập nhật chi tiết thông tin hồ sơ nhân sự (5 nhóm thông tin)
    /// </summary>
    Task<bool> UpdateEmployeeProfileAsync(int employeeId, UpdateEmployeeProfileRequest request, string? updatedByUsername = null);

    /// <summary>
    /// Trao và phân cấp thẩm quyền phê duyệt cho nhân sự (Approval Level 1..5)
    /// </summary>
    Task<bool> AssignApprovalAuthorityAsync(int employeeId, AssignApprovalAuthorityRequest request, string grantedByUsername);

    /// <summary>
    /// Lấy danh sách chấm công ngày & đối soát lịch ca kèm 4 thẻ thống kê KPI
    /// </summary>
    Task<DailyAttendanceMonitorResponse> GetDailyAttendanceMonitorAsync(
        DateTime? workDate = null,
        int? branchId = null,
        string? status = null,
        string? search = null,
        string? currentUsername = null);

    /// <summary>
    /// Xuất báo cáo tổng hợp chấm công đối soát chuỗi theo khoảng thời gian
    /// </summary>
    Task<IEnumerable<AttendanceReportItemDto>> ExportAttendanceReportAsync(
        DateTime fromDate,
        DateTime toDate,
        int? branchId = null,
        string? currentUsername = null);

    /// <summary>
    /// Lấy chi tiết bảng lương tháng (Kỳ lương Header + Danh sách phiếu lương nhân viên)
    /// </summary>
    Task<PayrollPeriodDetailsResponse> GetPayrollPeriodDetailsAsync(
        string periodMonth,
        int? branchId = null,
        string? status = null,
        string? search = null,
        string? currentUsername = null);

    /// <summary>
    /// Tự động tính toán bảng lương tháng (Giờ chuẩn thực tế + OT x1.5 + Phụ cấp - Khấu trừ trễ)
    /// </summary>
    Task<int> CalculatePayrollAsync(string periodMonth, int? branchId = null, string calculatedBy = "Hệ thống");

    /// <summary>
    /// Phê duyệt và khóa sổ kỳ tính lương
    /// </summary>
    Task<bool> LockPayrollPeriodAsync(int periodId, string approverName);

    /// <summary>
    /// Mở khóa kỳ tính lương (về trạng thái nháp để tính toán lại)
    /// </summary>
    Task<bool> UnlockPayrollPeriodAsync(int periodId, string unlockedBy, string? reason = null);

    /// <summary>
    /// Thêm mới hoặc cập nhật mẫu ca làm việc
    /// </summary>
    Task<int> UpsertShiftTemplateAsync(UpsertShiftTemplateRequest request);

    /// <summary>
    /// Lấy danh mục các mẫu ca làm việc đang hoạt động
    /// </summary>
    Task<IEnumerable<ShiftTemplateDto>> GetShiftTemplatesAsync();

    /// <summary>
    /// Xuất ma trận phân ca 7 ngày trong tuần (Thứ 2 đến Chủ nhật) theo chi nhánh
    /// </summary>
    Task<IEnumerable<WeeklyScheduleMatrixRowDto>> ExportWeeklyScheduleAsync(
        int branchId,
        DateTime startDate,
        DateTime endDate,
        string? currentUsername = null);
    /// <summary>
    /// Lấy dữ liệu động gồm Metadata Cột và danh sách các dòng phục vụ AdminGridTable
    /// 
    Task<GridDatasetDto> GetEmployeesGridDatasetAsync(
        string? currentUsername=null,
        int? branchId=null,
        string? position =null,
        string? status=null,
        DateTime? targetDate=null,
        string? search=null,
        int pageIndex=1,
        int pageSize=50
    );
     /// <summary>
    /// Thực thi Stored Procedure sp_HRM_ExportEmployees_Excel để lấy DataSet gồm Dữ liệu nhân viên (Table 0) và Cấu hình #ExportConfig (Table 1)
    /// </summary>
    Task<DataSet> GetEmployeesExportDataSetAsync(
        string? currentUsername = null,
        int? branchId = null,
        string? position = null,
        string? status = null,
        string? searchText = null,
        string? employeeCodes = null,
        int accountStatus = -1);

    /// <summary>
    /// Lấy toàn bộ danh sách tùy chọn cho các combobox bộ lọc (Chi nhánh, Chức vụ, Trạng thái, Loại HĐ)
    /// </summary>
    Task<EmployeeFilterOptionsDto> GetEmployeesFilterOptionsAsync();

    /// <summary>
    /// Lấy tập hợp tất cả số CCCD/CMND đã tồn tại trong CSDL để phục vụ kiểm tra trùng lặp tốc độ O(1)
    /// </summary>
    Task<HashSet<string>> GetExistingCitizenIdsAsync();

    /// <summary>
    /// Nhập nhanh hàng loạt nhân sự vào CSDL qua Stored Procedure Batch dbo.sp_HRM_ImportEmployees_Batch
    /// </summary>
    Task<EmployeeImportSaveResultDto> ImportEmployeesBatchAsync(EmployeeImportSaveRequestDto request, string? currentUsername = null);

    /// <summary>
    /// Lấy danh sách nhân viên tinh gọn hỗ trợ công tắc @AccountStatus qua Stored Procedure dbo.sp_HRM_GetEmployees_Simple
    /// </summary>
    Task<IEnumerable<EmployeeSimpleDto>> GetEmployeesSimpleAsync(
        int accountStatus = -1,
        DateTime? viewDate = null,
        int? branchId = null,
        string? searchText = null,
        int loginId = -1,
        int pageIndex = 1,
        int pageSize = 50);

    /// <summary>
    /// Lấy toàn bộ số liệu tổng hợp KPI và biểu đồ cho HRM Dashboard qua Stored Procedure dbo.sp_HRM_GetDashboardSummary
    /// </summary>
    Task<HrmDashboardSummaryDto> GetDashboardSummaryAsync(
        int? branchId = null,
        int? year = null,
        int? month = null,
        int loginId = -1);

    /// <summary>
    /// Lấy trạng thái chốt khóa bảng công tháng của chi nhánh
    /// </summary>
    Task<AttendancePeriodStatusDto?> GetAttendancePeriodStatusAsync(int? branchId, string periodMonth);

    /// <summary>
    /// Lấy bảng tổng hợp công tháng theo quy tắc chuẩn hóa giờ ca + OT duyệt + nghỉ phép duyệt
    /// </summary>
    Task<IEnumerable<AttendanceMonthlySummaryItemDto>> GetAttendanceMonthlySummaryAsync(string periodMonth, int? branchId = null, string? search = null);

    Task<IEnumerable<OvertimeTypeDto>> GetOvertimeTypesAsync(string? scope = null, string? search = null);
    Task<int> SaveOvertimeTypeAsync(SaveOvertimeTypeRequest request);
    Task<bool> DeleteOvertimeTypeAsync(int overtimeTypeId);

    Task<IEnumerable<LeaveTypeDto>> GetLeaveTypesAsync(string? scope = null, string? search = null);
    Task<int> SaveLeaveTypeAsync(SaveLeaveTypeRequest request);
    Task<bool> DeleteLeaveTypeAsync(int leaveTypeId);

    Task<IEnumerable<HolidayItemDto>> GetHolidaysByYearAsync(int? year = null);

    Task<IEnumerable<PayrollSettingItemDto>> GetPayrollSettingsAsync(string? category = null, string? calcType = null, string? search = null);
    Task<int> SavePayrollSettingAsync(SavePayrollSettingRequest request);
    Task<bool> DeletePayrollSettingAsync(int settingId);

    Task<IEnumerable<OvertimeRequestItemDto>> GetOvertimeRequestsAsync(string? periodMonth = null, int? branchId = null, string? status = null, string? search = null);
    Task<int> CreateOvertimeRequestAsync(CreateOvertimeRequestDto request);
    Task<bool> ProcessOvertimeRequestAsync(int overtimeId, ProcessHrmRequestDto request);

    Task<IEnumerable<AttendanceCorrectionRequestItemDto>> GetAttendanceCorrectionRequestsAsync(string? periodMonth = null, int? branchId = null, string? status = null, string? search = null);
    Task<int> CreateAttendanceCorrectionRequestAsync(CreateAttendanceCorrectionRequestDto request);
    Task<bool> ProcessAttendanceCorrectionRequestAsync(int requestId, ProcessHrmRequestDto request);

    Task<IEnumerable<LeaveRequestItemDto>> GetLeaveRequestsAsync(string? periodMonth = null, int? branchId = null, string? status = null, string? search = null);
    Task<int> CreateLeaveRequestAsync(CreateLeaveRequestDto request);
    Task<bool> ProcessLeaveRequestAsync(int leaveId, ProcessHrmRequestDto request);

    /// <summary>
    /// Chốt và khóa bảng công tháng
    /// </summary>
    Task<bool> LockAttendancePeriodAsync(int branchId, string periodMonth, string lockedBy);

    /// <summary>
    /// Mở khóa bảng công tháng bằng mật khẩu IT và lý do giải trình
    /// </summary>
    Task<bool> UnlockAttendancePeriodAsync(int branchId, string periodMonth, string unlockPassword, string unlockReason, string unlockedBy, string? clientIp = null);

    /// <summary>
    /// Lấy trạng thái khóa lịch ca tuần của chi nhánh
    /// </summary>
    Task<ShiftScheduleWeekStatusDto?> GetShiftScheduleWeekStatusAsync(int branchId, DateTime startDate);

    /// <summary>
    /// Chốt và khóa lịch ca tuần của chi nhánh
    /// </summary>
    Task<bool> LockShiftScheduleAsync(int branchId, DateTime startDate, string lockedBy);

    /// <summary>
    /// Mở khóa lịch ca tuần của chi nhánh
    /// </summary>
    Task<bool> UnlockShiftScheduleAsync(int branchId, DateTime startDate);

    Task<IEnumerable<ShiftAssignmentDto>> GetWeekShiftAssignmentsAsync(int? branchId, DateTime startDate, DateTime endDate);
    Task<ShiftAssignmentDto> SaveShiftAssignmentAsync(SaveShiftAssignmentRequest request);
    Task<bool> RemoveShiftAssignmentAsync(int assignmentId);
    Task<decimal> AdjustAttendanceByEmployeeDateAsync(AdjustAttendanceManualByDateRequest request);
    Task<bool> DeleteShiftTemplateAsync(int templateId);

    Task<IEnumerable<SalaryAdvanceItemDto>> GetSalaryAdvancesAsync(
        string? periodMonth = null,
        int? branchId = null,
        string? status = null,
        string? search = null);
    Task<CreateSalaryAdvanceResultDto> CreateSalaryAdvanceAsync(CreateSalaryAdvanceRequest request);
    Task<bool> ProcessSalaryAdvanceAsync(int advanceId, ProcessSalaryAdvanceRequest request);
    Task<IEnumerable<EmployeeMonthlyQuotaItemDto>> GetEmployeeMonthlyQuotasAsync(
        string periodMonth,
        int? branchId = null,
        int? employeeId = null,
        string? search = null);
}
