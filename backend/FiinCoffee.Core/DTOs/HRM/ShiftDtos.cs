namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO yêu cầu thêm mới hoặc cập nhật ca làm việc mẫu
/// </summary>
public class UpsertShiftTemplateRequest
{
    public int? TemplateId { get; set; }
    public string ShiftCode { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public int BreakMinutes { get; set; } = 0;
    public decimal? StandardHours { get; set; }
    public string ColorCode { get; set; } = "emerald";
    public bool IsActive { get; set; } = true;
}

/// <summary>
/// DTO đại diện cho mẫu ca làm việc
/// </summary>
public class ShiftTemplateDto
{
    public int TemplateId { get; set; }
    public string ShiftCode { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }
    public int BreakMinutes { get; set; }
    public decimal StandardHours { get; set; }
    public string ColorCode { get; set; } = "emerald";
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// DTO xuất ma trận lịch phân ca 7 ngày trong tuần phục vụ hiển thị & tải Excel
/// </summary>
public class WeeklyScheduleMatrixRowDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string Monday_Schedule { get; set; } = "-";
    public string Tuesday_Schedule { get; set; } = "-";
    public string Wednesday_Schedule { get; set; } = "-";
    public string Thursday_Schedule { get; set; } = "-";
    public string Friday_Schedule { get; set; } = "-";
    public string Saturday_Schedule { get; set; } = "-";
    public string Sunday_Schedule { get; set; } = "-";
    public int TotalShiftsScheduled { get; set; }
    public decimal TotalScheduledHours { get; set; }
}

/// <summary>
/// DTO trạng thái khóa lịch ca tuần của chi nhánh
/// </summary>
public class ShiftScheduleWeekStatusDto
{
    public int WeekId { get; set; }
    public int BranchId { get; set; }
    public int Year { get; set; }
    public int WeekNumber { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    public bool IsLocked { get; set; }
    public string? LockedBy { get; set; }
    public DateTime? LockedAt { get; set; }
}

/// <summary>
/// Yêu cầu khóa lịch ca làm việc tuần
/// </summary>
public class LockShiftScheduleRequest
{
    public int BranchId { get; set; }
    public DateTime StartDate { get; set; }
    public string? LockedBy { get; set; }
    public string? Password { get; set; }
}

/// <summary>
/// Yêu cầu mở khóa lịch ca làm việc tuần
/// </summary>
public class UnlockShiftScheduleRequest
{
    public int BranchId { get; set; }
    public DateTime StartDate { get; set; }
    public string? Password { get; set; }
    public string? UnlockReason { get; set; }
    public string? UnlockedBy { get; set; }
}

public class ShiftAssignmentDto
{
    public int Id { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public int BranchId { get; set; }
    public string Date { get; set; } = string.Empty;
    public int ShiftId { get; set; }
    public string ShiftCode { get; set; } = string.Empty;
    public string ShiftName { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string RegisteredBy { get; set; } = "manager";
    public string Status { get; set; } = "scheduled";
    public string? Note { get; set; }
}

public class SaveShiftAssignmentRequest
{
    public int EmployeeId { get; set; }
    public DateTime WorkDate { get; set; }
    public string? ShiftCode { get; set; }
    public int? TemplateId { get; set; }
    public int? BranchId { get; set; }
    public string? RegisteredBy { get; set; } = "manager";
    public string? Status { get; set; } = "scheduled";
    public string? Note { get; set; }
}
