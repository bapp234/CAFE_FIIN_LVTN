namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// DTO đại diện cho 1 dòng dữ liệu nhân sự đọc từ file Excel
/// </summary>
public class EmployeeImportItemDto
{
    public int RowIndex { get; set; }
    public string? EmployeeCode { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string CitizenId { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? BranchInput { get; set; }
    public string? Position { get; set; }
    public string? ContractTypeInput { get; set; }
    public decimal? HourlyRate { get; set; }
    public decimal? Allowance { get; set; }
    public string Status { get; set; } = "active";
    public bool IsValid { get; set; } = true;
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Kết quả kiểm tra & đọc trước dữ liệu file Excel (Preview)
/// </summary>
public class EmployeeImportPreviewResultDto
{
    public int TotalRows { get; set; }
    public int ValidRows { get; set; }
    public int ErrorRows { get; set; }
    public List<EmployeeImportItemDto> Items { get; set; } = new();
}

/// <summary>
/// Yêu cầu xác nhận lưu hàng loạt nhân sự vào CSDL
/// </summary>
public class EmployeeImportSaveRequestDto
{
    public List<EmployeeImportItemDto> Employees { get; set; } = new();
    public bool CreateAccounts { get; set; } = false;
    public string? DefaultPassword { get; set; } = "Fiin@123";
}

/// <summary>
/// Kết quả sau khi lưu hàng loạt vào CSDL
/// </summary>
public class EmployeeImportSaveResultDto
{
    public int TotalReceived { get; set; }
    public int TotalImported { get; set; }
    public int TotalSkipped { get; set; }
    public int AccountsCreated { get; set; }
    public List<EmployeeImportedItemDto> ImportedEmployees { get; set; } = new();
}

public class EmployeeImportedItemDto
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string CitizenId { get; set; } = string.Empty;
    public string BranchName { get; set; } = string.Empty;
    public string Position { get; set; } = string.Empty;
    public string ContractName { get; set; } = string.Empty;
    public decimal HourlyRate { get; set; }
    public bool HasAccount { get; set; }
}
