namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO đại diện cho một dòng dữ liệu đối soát chấm công ngày
/// </summary>
public class DailyAttendanceItemDto
{
    public int? AttendanceId { get; set; }
    public int? AssignmentId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string AvatarInitial { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string? ShiftCode { get; set; }
    public string? ShiftName { get; set; }
    public TimeSpan? ScheduledStartTime { get; set; }
    public TimeSpan? ScheduledEndTime { get; set; }
    public string ScheduledTimeRange { get; set; } = string.Empty;
    public DateTime? CheckInTime { get; set; }
    public DateTime? CheckOutTime { get; set; }
    public string ActualTimeRange { get; set; } = string.Empty;
    public decimal WorkHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public int LateMinutes { get; set; }
    public int EarlyLeaveMinutes { get; set; }
    public string AttendanceStatus { get; set; } = "on_time";
    public string StatusLabel { get; set; } = string.Empty;
    public bool IsManualAdjusted { get; set; }
    public string? AdjustedBy { get; set; }
    public string? AdjustedReason { get; set; }
    public DateTime? AdjustedAt { get; set; }
}

/// <summary>
/// DTO thống kê 4 thẻ KPI chấm công ngày chuẩn DevExtreme
/// </summary>
public class AttendanceKpiSummaryDto
{
    public DateTime WorkDate { get; set; }
    public int TotalScheduled { get; set; }
    public int TotalOnTime { get; set; }
    public int TotalLate { get; set; }
    public int TotalAbsent { get; set; }
    public decimal TotalWorkHours { get; set; }
    public decimal TotalOvertimeHours { get; set; }
}

/// <summary>
/// Response đóng gói toàn diện màn hình giám sát chấm công ngày
/// </summary>
public class DailyAttendanceMonitorResponse
{
    public DateTime WorkDate { get; set; }
    public AttendanceKpiSummaryDto Summary { get; set; } = new();
    public IEnumerable<DailyAttendanceItemDto> Items { get; set; } = [];
}

/// <summary>
/// DTO xuất báo cáo chấm công tổng hợp theo khoảng thời gian
/// </summary>
public class AttendanceReportItemDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string? ContractName { get; set; }
    public int TotalWorkDays { get; set; }
    public int TotalScheduledShifts { get; set; }
    public decimal TotalStandardHours { get; set; }
    public decimal TotalOvertimeHours { get; set; }
    public int TotalLateMinutes { get; set; }
    public int LateCount { get; set; }
    public int EarlyLeaveCount { get; set; }
    public int OnTimeCount { get; set; }
    public int AbsentCount { get; set; }
    public decimal OnTimeRatePercentage { get; set; }
}
