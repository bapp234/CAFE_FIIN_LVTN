using FiinCoffee.Core.DTOs.HRM;

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
}
