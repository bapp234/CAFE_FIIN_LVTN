namespace FiinCoffee.Core.DTOs.HRM;

public class HrmDashboardSummaryDto
{
    public int TotalEmployees { get; set; }
    public int WorkingEmployees { get; set; }
    public int ResignedEmployees { get; set; }
    public int ProbationEmployees { get; set; }

    public List<DashboardPositionItemDto> PositionBreakdown { get; set; } = new();
    public List<DashboardMonthlyStatDto> MonthlyStats { get; set; } = new();
    public DashboardAttendanceSummaryDto AttendanceSummary { get; set; } = new();
}

public class DashboardPositionItemDto
{
    public string GroupId { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Color { get; set; } = string.Empty;
    public int Count { get; set; }
}

public class DashboardMonthlyStatDto
{
    public int Month { get; set; }
    public int Headcount { get; set; }
    public int HiredCount { get; set; }
    public int ResignedCount { get; set; }
    public decimal SalaryCostVnd { get; set; }
    public decimal WorkHours { get; set; }
}

public class DashboardAttendanceSummaryDto
{
    public int TotalShifts { get; set; }
    public int OnTimeCount { get; set; }
    public int LateCount { get; set; }
    public int EarlyLeaveCount { get; set; }
    public int MissingPunchCount { get; set; }
}
