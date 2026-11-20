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

/// <summary>
/// DTO trạng thái khóa bảng công tháng
/// </summary>
public class AttendancePeriodStatusDto
{
    public int PeriodId { get; set; }
    public int BranchId { get; set; }
    public string PeriodMonth { get; set; } = string.Empty;
    public bool IsLocked { get; set; }
    public string? LockedBy { get; set; }
    public DateTime? LockedAt { get; set; }
    public string? UnlockedBy { get; set; }
    public DateTime? UnlockedAt { get; set; }
    public string? UnlockReason { get; set; }
}

/// <summary>
/// Yêu cầu chốt và khóa bảng công tháng
/// </summary>
public class LockAttendancePeriodRequest
{
    public int BranchId { get; set; }
    public string PeriodMonth { get; set; } = string.Empty;
    public string? LockedBy { get; set; }
    public string? Password { get; set; }
}

/// <summary>
/// Yêu cầu mở khóa bảng công tháng khẩn cấp (yêu cầu mật khẩu IT và lý do)
/// </summary>
public class UnlockAttendancePeriodRequest
{
    public int BranchId { get; set; }
    public string PeriodMonth { get; set; } = string.Empty;
    public string UnlockPassword { get; set; } = string.Empty;
    public string UnlockReason { get; set; } = string.Empty;
    public string? UnlockedBy { get; set; }
}

/// <summary>
/// DTO tổng hợp bảng công tháng theo từng nhân viên (đã chuẩn hóa theo ca chuẩn, OT duyệt & nghỉ phép duyệt)
/// </summary>
public class AttendanceMonthlySummaryItemDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string WorkingStatus { get; set; } = "working";
    public int StandardDays { get; set; }
    public decimal WorkDays { get; set; }
    public decimal WorkHours { get; set; }
    public decimal TotalWorkHours { get; set; }
    public decimal PaidLeaveDays { get; set; }
    public decimal UnpaidLeaveDays { get; set; }
    public decimal OtNormalHours { get; set; }
    public decimal OtWeekendHours { get; set; }
    public decimal OtHolidayHours { get; set; }
    public int EarlyLateCount { get; set; }
    public int MissingPunchCount { get; set; }
}

/// <summary>
/// DTO danh mục mã tăng ca (OTCode)
/// </summary>
public class OvertimeTypeDto
{
    public int OvertimeTypeId { get; set; }
    public string OTCode { get; set; } = string.Empty;
    public string OTName { get; set; } = string.Empty;
    public string OTCategory { get; set; } = "normal";
    public string Scope { get; set; } = "all";
    public decimal PayMultiplier { get; set; }
    public decimal NightExtraRate { get; set; }
    public decimal MaxHoursPerDay { get; set; }
    public decimal MaxHoursPerMonth { get; set; }
    public int RoundingMinutes { get; set; }
    public bool RequireApproval { get; set; }
    public bool AllowCompensatoryLeave { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class SaveOvertimeTypeRequest
{
    public int? OvertimeTypeId { get; set; }
    public string OTCode { get; set; } = string.Empty;
    public string OTName { get; set; } = string.Empty;
    public string OTCategory { get; set; } = "normal";
    public string Scope { get; set; } = "all";
    public decimal PayMultiplier { get; set; } = 150m;
    public decimal NightExtraRate { get; set; }
    public decimal MaxHoursPerDay { get; set; } = 4m;
    public decimal MaxHoursPerMonth { get; set; } = 40m;
    public int RoundingMinutes { get; set; } = 15;
    public bool RequireApproval { get; set; } = true;
    public bool AllowCompensatoryLeave { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class AdjustAttendanceManualByDateRequest
{
    public int EmployeeId { get; set; }
    public DateTime WorkDate { get; set; }
    public DateTime CheckInTime { get; set; }
    public DateTime CheckOutTime { get; set; }
    public string AdjustedBy { get; set; } = string.Empty;
    public string AdjustedReason { get; set; } = string.Empty;
}

/// <summary>
/// DTO danh mục mã nghỉ phép (LeaveCode)
/// </summary>
public class LeaveTypeDto
{
    public int LeaveTypeId { get; set; }
    public string LeaveCode { get; set; } = string.Empty;
    public string LeaveName { get; set; } = string.Empty;
    public string Scope { get; set; } = "all";
    public bool IsPaid { get; set; }
    public decimal PaidPercent { get; set; }
    public bool DeductAnnualLeave { get; set; }
    public decimal StandardDaysPerYear { get; set; }
    public int MinNoticeDays { get; set; }
    public bool MonthlyAccrual { get; set; }
    public bool ProbationEligible { get; set; }
    public bool AllowNegativeBalance { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; }
}

public class SaveLeaveTypeRequest
{
    public int? LeaveTypeId { get; set; }
    public string LeaveCode { get; set; } = string.Empty;
    public string LeaveName { get; set; } = string.Empty;
    public string Scope { get; set; } = "all";
    public bool IsPaid { get; set; } = true;
    public decimal PaidPercent { get; set; } = 100m;
    public bool DeductAnnualLeave { get; set; } = true;
    public decimal StandardDaysPerYear { get; set; } = 12m;
    public int MinNoticeDays { get; set; } = 1;
    public bool MonthlyAccrual { get; set; } = true;
    public bool ProbationEligible { get; set; }
    public bool AllowNegativeBalance { get; set; }
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}

public class HolidayItemDto
{
    public int HolidayId { get; set; }
    public DateTime HolidayDate { get; set; }
    public string HolidayName { get; set; } = string.Empty;
    public int Year { get; set; }
    public decimal PayMultiplier { get; set; }
    public bool IsPaid { get; set; }
}

// ============================================================================
// DTOs CHO PHÂN HỆ ĐƠN TỪ (TĂNG CA | BÙ CÔNG | NGHỈ PHÉP)
// ============================================================================

public class OvertimeRequestItemDto
{
    public int OvertimeId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public decimal Hours { get; set; }
    public string OTCode { get; set; } = "OT-DAY";
    public string OTName { get; set; } = string.Empty;
    public string OTType { get; set; } = "normal";
    public decimal PayMultiplier { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ApprovalStatus { get; set; } = "pending";
    public DateTime? ApprovedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateOvertimeRequestDto
{
    public int EmployeeId { get; set; }
    public DateTime WorkDate { get; set; }
    public string StartTime { get; set; } = "17:00";
    public string EndTime { get; set; } = "19:00";
    public string OTCode { get; set; } = "OT-DAY";
    public string Reason { get; set; } = string.Empty;
}

public class AttendanceCorrectionRequestItemDto
{
    public int RequestId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public DateTime WorkDate { get; set; }
    public string ScheduledStart { get; set; } = "08:00";
    public string ScheduledEnd { get; set; } = "17:00";
    public string RequestedCheckIn { get; set; } = "08:00";
    public string RequestedCheckOut { get; set; } = "17:00";
    public decimal RequestedHours { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ApprovalStatus { get; set; } = "pending";
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? ApproverNote { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateAttendanceCorrectionRequestDto
{
    public int EmployeeId { get; set; }
    public DateTime WorkDate { get; set; }
    public string RequestedCheckIn { get; set; } = "08:00";
    public string RequestedCheckOut { get; set; } = "17:00";
    public string Reason { get; set; } = string.Empty;
}

public class LeaveRequestItemDto
{
    public int LeaveId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public decimal LeaveDays { get; set; }
    public string LeaveCode { get; set; } = "LV-PHEP";
    public string LeaveName { get; set; } = string.Empty;
    public string LeaveType { get; set; } = "annual";
    public bool IsPaid { get; set; }
    public decimal PaidPercent { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string ApprovalStatus { get; set; } = "pending";
    public DateTime? ApprovedAt { get; set; }
    public string? Note { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateLeaveRequestDto
{
    public int EmployeeId { get; set; }
    public DateTime FromDate { get; set; }
    public DateTime ToDate { get; set; }
    public string LeaveCode { get; set; } = "LV-PHEP";
    public string Reason { get; set; } = string.Empty;
}

public class ProcessHrmRequestDto
{
    public string Action { get; set; } = "approved"; // approved | rejected
    public string? ApproverName { get; set; }
    public string? Note { get; set; }
}
