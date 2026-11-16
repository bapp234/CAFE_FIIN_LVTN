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
