namespace FiinCoffee.Core.Common;

/// <summary>
/// Định dạng phản hồi chuẩn cho toàn bộ API hệ thống Cà Phê Fiin
/// </summary>
/// <typeparam name="T">Kiểu dữ liệu của payload</typeparam>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public List<string>? Errors { get; set; }

    public static ApiResponse<T> Ok(T data, string message = "Thao tác thành công") =>
        new() { Success = true, Message = message, Data = data };

    public static ApiResponse<T> Fail(string message, List<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}

public class ApiResponse : ApiResponse<object>
{
    public static ApiResponse Ok(string message = "Thao tác thành công") =>
        new() { Success = true, Message = message };

    public new static ApiResponse Fail(string message, List<string>? errors = null) =>
        new() { Success = false, Message = message, Errors = errors };
}
