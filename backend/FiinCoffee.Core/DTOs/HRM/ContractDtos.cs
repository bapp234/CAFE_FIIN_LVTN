using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.HRM;

public class ContractItemDto
{
    public int ContractId { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int? BranchId { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public int ContractTypeId { get; set; }
    public string ContractTypeCode { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public decimal HourlyRate { get; set; }
    public decimal Allowance { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? SignDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ActionType { get; set; }
    public string? Note { get; set; }
    public int? RequestedByEmployeeId { get; set; }
    public string? RequestedByName { get; set; }
    public int? ApprovedByEmployeeId { get; set; }
    public string? ApprovedByName { get; set; }
    public DateTime? ApprovedAt { get; set; }
    public long? ApprovalRequestId { get; set; }
    public DateTime CreatedAt { get; set; }
    public int? DaysRemaining { get; set; }
}

public class ContractSummaryDto
{
    public int ActiveCount { get; set; }
    public int ExpiringSoonCount { get; set; }
    public int PendingApprovalCount { get; set; }
    public int ClosedCount { get; set; }
}

public class SubmitContractChangeRequestDto
{
    [Required]
    public int EmployeeId { get; set; }

    [Required]
    public int ContractTypeId { get; set; }

    [Required]
    public string Position { get; set; } = string.Empty;

    [Range(0, 10000000)]
    public decimal HourlyRate { get; set; }

    [Range(0, 100000000)]
    public decimal Allowance { get; set; }

    [Required]
    public DateTime StartDate { get; set; }

    public DateTime? EndDate { get; set; }

    /// <summary>
    /// 'new' | 'renew' | 'adjust' | 'terminate'
    /// </summary>
    public string ActionType { get; set; } = "renew";

    public int? TargetContractId { get; set; }
    public string? Note { get; set; }
    public bool AutoApproveIfAllowed { get; set; } = true;
}

public class SubmitContractChangeResultDto
{
    public int ContractId { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}

public class ProcessContractApprovalRequestDto
{
    [Required]
    public string Decision { get; set; } = "approved"; // 'approved' | 'rejected'

    public string? Note { get; set; }
}

public class ContractTypeSettingDto
{
    public int ContractTypeId { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public decimal StandardHourlyRate { get; set; }
    public decimal Allowance { get; set; }
    public decimal SalaryPercentage { get; set; } = 100;
    public int? DurationMonths { get; set; }
    public string? BenefitsDescription { get; set; }
    public bool IsActive { get; set; } = true;
}

public class SaveContractTypeRequestDto
{
    public int? ContractTypeId { get; set; }

    [Required(ErrorMessage = "Vui lòng nhập mã loại hợp đồng.")]
    public string ContractCode { get; set; } = string.Empty;

    [Required(ErrorMessage = "Vui lòng nhập tên loại hợp đồng.")]
    public string ContractName { get; set; } = string.Empty;

    [Range(0, 10000000)]
    public decimal StandardHourlyRate { get; set; }

    [Range(0, 100000000)]
    public decimal Allowance { get; set; }

    [Range(1, 200)]
    public decimal SalaryPercentage { get; set; } = 100;

    public int? DurationMonths { get; set; }
    public string? BenefitsDescription { get; set; }
    public bool IsActive { get; set; } = true;
}

public class ContractWordDetailDto
{
    public int ContractId { get; set; }
    public string ContractCode { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string CitizenId { get; set; } = string.Empty;
    public DateTime? DateOfBirth { get; set; }
    public string Gender { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Email { get; set; }
    public string BranchName { get; set; } = string.Empty;
    public string BranchAddress { get; set; } = string.Empty;
    public string ContractTypeCode { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public string BenefitsDescription { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public decimal HourlyRate { get; set; }
    public decimal Allowance { get; set; }
    public DateTime StartDate { get; set; }
    public DateTime? EndDate { get; set; }
    public DateTime? SignDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
}

public class ContractImportItemDto
{
    public int RowIndex { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public int EmployeeId { get; set; }
    public string? FullName { get; set; }
    public string ContractTypeCode { get; set; } = string.Empty;
    public int ContractTypeId { get; set; }
    public string Position { get; set; } = string.Empty;
    public decimal HourlyRate { get; set; }
    public decimal Allowance { get; set; }
    public string StartDate { get; set; } = string.Empty;
    public string? EndDate { get; set; }
    public string? Note { get; set; }
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
}

public class ContractImportPreviewResultDto
{
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public List<ContractImportItemDto> Items { get; set; } = [];
}

public class ContractImportSaveRequestDto
{
    public List<ContractImportItemDto> Items { get; set; } = [];
}

public class ContractImportSaveResultDto
{
    public int TotalReceived { get; set; }
    public int TotalSaved { get; set; }
    public int PendingCount { get; set; }
    public int ActivatedCount { get; set; }
}
