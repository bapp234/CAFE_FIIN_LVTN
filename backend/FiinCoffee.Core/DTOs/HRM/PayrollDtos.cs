namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO thông tin tổng quan kỳ tính lương (Header)
/// </summary>
public class PayrollPeriodHeaderDto
{
    public int PeriodId { get; set; }
    public string PeriodMonth { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string? BranchName { get; set; }
    public string Status { get; set; } = "draft";
    public bool IsLocked { get; set; }
    public int TotalEmployees { get; set; }
    public decimal TotalNetPay { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// DTO chi tiết phiếu lương của một nhân viên
/// </summary>
public class PayrollSlipDetailDto
{
    public int SlipId { get; set; }
    public int PeriodId { get; set; }
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string? BranchCode { get; set; }
    public string? BranchName { get; set; }
    public string? ContractCode { get; set; }
    public string? ContractName { get; set; }
    public decimal HourlyRate { get; set; }
    public decimal StandardHours { get; set; }
    public decimal OvertimeHours { get; set; }
    public decimal BasePay { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal Allowance { get; set; }
    public decimal Deduction { get; set; }
    public decimal Advance { get; set; }
    public decimal NetPay { get; set; }
    public string SlipStatus { get; set; } = "draft";
    public string? BankName { get; set; }
    public string? BankAccountNumber { get; set; }
    public string? BankAccountName { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Response đóng gói màn hình danh sách bảng lương tháng
/// </summary>
public class PayrollPeriodDetailsResponse
{
    public PayrollPeriodHeaderDto? Period { get; set; }
    public IEnumerable<PayrollSlipDetailDto> Slips { get; set; } = [];
}

/// <summary>
/// DTO yêu cầu tự động tính toán lương tháng
/// </summary>
public class CalculatePayrollRequest
{
    public string PeriodMonth { get; set; } = string.Empty; // 'YYYY-MM'
    public int? BranchId { get; set; }
}

/// <summary>
/// DTO yêu cầu phê duyệt và khóa sổ kỳ lương
/// </summary>
public class LockPayrollPeriodRequest
{
    public int PeriodId { get; set; }
    public string ApproverName { get; set; } = string.Empty;
    public string? Password { get; set; }
}

/// <summary>
/// DTO yêu cầu mở khóa kỳ lương
/// </summary>
public class UnlockPayrollPeriodRequest
{
    public int PeriodId { get; set; }
    public string UnlockedBy { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string? Password { get; set; }
}

public class PayrollSettingItemDto
{
    public int SettingId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "allowance";
    public string CalcType { get; set; } = "fixed_month";
    public decimal RawValue { get; set; }
    public string Impact { get; set; } = "Addition";
    public string ApplyScope { get; set; } = string.Empty;
    public string? Note { get; set; }
    public bool IsActive { get; set; }
}

public class SavePayrollSettingRequest
{
    public int? SettingId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = "allowance";
    public string CalcType { get; set; } = "fixed_month";
    public decimal RawValue { get; set; }
    public string Impact { get; set; } = "Addition";
    public string ApplyScope { get; set; } = "Toàn hệ thống";
    public string? Note { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SalaryAdvanceItemDto
{
    public int AdvanceId { get; set; }
    public string AdvanceCode { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string EmployeeName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string RequestDate { get; set; } = string.Empty;
    public string Period { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "pending";
    public string? ApprovedBy { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public string? DecisionNote { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; }
    public decimal OtMonthlyLimit { get; set; } = 40m;
    public decimal OtApprovedHours { get; set; }
    public decimal OtPendingHours { get; set; }
    public decimal OtTotalRegisteredHours { get; set; }
    public decimal OtRemainingHours { get; set; } = 40m;
    public string OtWarningStatus { get; set; } = "Trong hạn mức";
    public decimal AnnualLeaveTotalDays { get; set; } = 12m;
    public decimal AnnualLeaveApprovedDays { get; set; }
    public decimal AnnualLeavePendingDays { get; set; }
    public decimal AnnualLeaveRemainingDays { get; set; } = 12m;
    public bool IsAttendanceLocked { get; set; }
}

public class EmployeeMonthlyQuotaItemDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string PeriodMonth { get; set; } = string.Empty;
    public decimal OtMonthlyLimit { get; set; } = 40m;
    public decimal OtApprovedHours { get; set; }
    public decimal OtPendingHours { get; set; }
    public decimal OtTotalRegisteredHours { get; set; }
    public decimal OtRemainingHours { get; set; } = 40m;
    public string OtWarningStatus { get; set; } = "Trong hạn mức";
    public decimal AnnualLeaveTotalDays { get; set; } = 12m;
    public decimal AnnualLeaveApprovedDays { get; set; }
    public decimal AnnualLeavePendingDays { get; set; }
    public decimal AnnualLeaveTotalRegisteredDays { get; set; }
    public decimal AnnualLeaveRemainingDays { get; set; } = 12m;
    public string AnnualLeaveWarningStatus { get; set; } = "Còn phép năm";
    public bool IsAttendanceLocked { get; set; }
}

public class CreateSalaryAdvanceRequest
{
    public int EmployeeId { get; set; }
    public string PeriodMonth { get; set; } = string.Empty;
    public DateTime RequestDate { get; set; }
    public decimal Amount { get; set; }
    public string PaymentMethod { get; set; } = "Chuyển khoản";
    public string Reason { get; set; } = string.Empty;
    public string? CreatedBy { get; set; }
}

public class CreateSalaryAdvanceResultDto
{
    public int AdvanceId { get; set; }
    public string AdvanceCode { get; set; } = string.Empty;
}

public class ProcessSalaryAdvanceRequest
{
    public string Action { get; set; } = string.Empty; // "approve" | "reject"
    public string ApproverName { get; set; } = string.Empty;
    public string? Note { get; set; }
}
