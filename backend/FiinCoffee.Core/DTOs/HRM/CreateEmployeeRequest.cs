using System.ComponentModel.DataAnnotations;

namespace FiinCoffee.Core.DTOs.HRM;

/// <summary>
/// Yêu cầu tạo mới nhân viên (cung cấp tài khoản đăng nhập, CCCD, thông tin ngân hàng & hợp đồng)
/// </summary>
public class CreateEmployeeRequest
{
    [Required(ErrorMessage = "Tên đăng nhập không được để trống")]
    [StringLength(50, MinimumLength = 3, ErrorMessage = "Tên đăng nhập từ 3 đến 50 ký tự")]
    public string Username { get; set; } = string.Empty;

    [Required(ErrorMessage = "Mật khẩu không được để trống")]
    [StringLength(100, MinimumLength = 6, ErrorMessage = "Mật khẩu tối thiểu 6 ký tự")]
    public string Password { get; set; } = string.Empty;

    [Required(ErrorMessage = "Họ và tên nhân viên không được để trống")]
    [StringLength(100, MinimumLength = 3, ErrorMessage = "Họ và tên tối thiểu 3 ký tự")]
    public string FullName { get; set; } = string.Empty;

    [Phone(ErrorMessage = "Số điện thoại không đúng định dạng")]
    [StringLength(20)]
    public string? PhoneNumber { get; set; }

    [EmailAddress(ErrorMessage = "Email không đúng định dạng")]
    [StringLength(100)]
    public string? Email { get; set; }

    public DateTime? DateOfBirth { get; set; }

    [StringLength(10)]
    public string? Gender { get; set; }

    [Required(ErrorMessage = "Số Căn cước công dân (CCCD) không được để trống")]
    [RegularExpression(@"^[0-9]{12}$", ErrorMessage = "Số CCCD phải bao gồm chính xác 12 chữ số")]
    public string CitizenId { get; set; } = string.Empty;

    [StringLength(100)]
    public string? BankName { get; set; }

    [StringLength(30)]
    public string? BankAccountNumber { get; set; }

    [StringLength(100)]
    public string? BankAccountName { get; set; }

    [Required(ErrorMessage = "Chi nhánh làm việc không được để trống")]
    public int BranchId { get; set; }

    [Required(ErrorMessage = "Chức vụ không được để trống")]
    [StringLength(50)]
    public string Position { get; set; } = string.Empty;

    [Required(ErrorMessage = "Loại hợp đồng không được để trống")]
    public int ContractTypeId { get; set; }

    public decimal? HourlyRate { get; set; }

    [StringLength(500)]
    public string? Note { get; set; }

    public int? RoleId { get; set; }
}
