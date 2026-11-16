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
}
