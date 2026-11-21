using System.Data;
using ClosedXML.Excel;
using Dapper;
using FiinCoffee.Core.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Controllers;

[ApiController]
[Route("api/v1/erp")]
[Authorize]
public sealed class ErpProductsController : ControllerBase
{
    private readonly IConfiguration _config;

    public ErpProductsController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet("dashboard/summary")]
    public async Task<IActionResult> GetDashboardSummary(
        [FromQuery] int? branchId = null,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null)
    {
        var now = DateTime.Now;
        var y = year ?? now.Year;
        var m = month ?? now.Month;

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        using var multi = await conn.QueryMultipleAsync(
            "dbo.sp_ERP_GetDashboardSummary",
            new { BranchId = branchId, Year = y, Month = m },
            commandType: CommandType.StoredProcedure);

        var stats = await multi.ReadFirstOrDefaultAsync();
        var lowStockItems = (await multi.ReadAsync()).ToList();
        var monthlyReports = (await multi.ReadAsync()).ToList();

        return Ok(ApiResponse<object>.Ok(
            new { stats, lowStockItems, monthlyReports },
            "Lấy tổng quan ERP từ dữ liệu thật thành công."));
    }

    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? search = null,
        [FromQuery] int? categoryId = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] string? sortOrder = "newest",
        [FromQuery] int offset = 0,
        [FromQuery] int limit = 50)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ERP_GetProductList",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                CategoryId = categoryId,
                IsActive = isActive,
                SortOrder = string.IsNullOrWhiteSpace(sortOrder) ? "newest" : sortOrder,
                Offset = Math.Max(0, offset),
                FetchCount = Math.Clamp(limit, 1, 200)
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách món thành công."));
    }

    [HttpPost("products")]
    public async Task<IActionResult> SaveProduct([FromBody] SaveProductRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ProductCode) || string.IsNullOrWhiteSpace(request.ProductName))
            return BadRequest(ApiResponse.Fail("Vui lòng nhập mã món và tên món."));

        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var productId = await conn.QueryFirstOrDefaultAsync<int>(
                "dbo.sp_ERP_SaveProduct",
                new
                {
                    request.ProductId,
                    request.ProductCode,
                    request.ProductName,
                    request.CategoryId,
                    request.BasePrice,
                    request.ImageUrl,
                    request.IsActive
                },
                commandType: CommandType.StoredProcedure);

            return Ok(ApiResponse<object>.Ok(new { productId }, "Lưu món thành công."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("products/{productId:int}")]
    public async Task<IActionResult> DeleteProduct(int productId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync(
                "dbo.sp_ERP_DeleteProduct",
                new { ProductId = productId },
                commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xóa món."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("categories")]
    public async Task<IActionResult> GetCategories(
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ERP_GetCategoryList",
            new
            {
                Search = string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                IsActive = isActive
            },
            commandType: CommandType.StoredProcedure);

        return Ok(ApiResponse<object>.Ok(rows, "Lấy danh sách danh mục thành công."));
    }

    [HttpPost("categories")]
    public async Task<IActionResult> SaveCategory([FromBody] SaveCategoryRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CategoryName))
            return BadRequest(ApiResponse.Fail("Vui lòng nhập tên danh mục."));

        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            var categoryId = await conn.QueryFirstOrDefaultAsync<int>(
                "dbo.sp_ERP_SaveCategory",
                new
                {
                    request.CategoryId,
                    request.CategoryName,
                    request.DisplayOrder,
                    request.IsActive
                },
                commandType: CommandType.StoredProcedure);

            return Ok(ApiResponse<object>.Ok(new { categoryId }, "Lưu danh mục thành công."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpDelete("categories/{categoryId:int}")]
    public async Task<IActionResult> DeleteCategory(int categoryId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync(
                "dbo.sp_ERP_DeleteCategory",
                new { CategoryId = categoryId },
                commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã xóa danh mục."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpGet("categories/products-pool")]
    public async Task<IActionResult> GetProductsPool()
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        var rows = await conn.QueryAsync(
            "dbo.sp_ERP_GetProductsForCategoryModal",
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse<object>.Ok(rows));
    }

    [HttpPost("categories/{categoryId:int}/assign/{productId:int}")]
    public async Task<IActionResult> AssignProductToCategory(int categoryId, int productId)
    {
        try
        {
            await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
            await conn.ExecuteAsync(
                "dbo.sp_ERP_AssignProductToCategory",
                new { CategoryId = categoryId, ProductId = productId },
                commandType: CommandType.StoredProcedure);
            return Ok(ApiResponse.Ok("Đã thêm sản phẩm vào danh mục."));
        }
        catch (SqlException ex)
        {
            return BadRequest(ApiResponse.Fail(ex.Message));
        }
    }

    [HttpPost("categories/unassign/{productId:int}")]
    public async Task<IActionResult> UnassignProduct(int productId)
    {
        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync(
            "dbo.sp_ERP_RemoveProductFromCategory",
            new { ProductId = productId },
            commandType: CommandType.StoredProcedure);
        return Ok(ApiResponse.Ok("Đã gỡ sản phẩm khỏi danh mục hiện tại."));
    }

    [HttpPost("products/export-excel")]
    public IActionResult ExportProductsExcel([FromBody] List<ExportProductExcelRow> rows, [FromServices] IWebHostEnvironment env)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Thực đơn");

        ws.Cell(1, 1).Value = "DANH SÁCH THỰC ĐƠN ĐỒ UỐNG & BÁNH FIIN COFFEE";
        ws.Range(1, 1, 1, 8).Merge().Style.Font.SetBold().Font.SetFontSize(14);

        var headers = new[] { "STT", "Ảnh", "Mã món", "Tên món", "Danh mục", "Size", "Giá bán", "Đang bán" };
        for (var c = 0; c < headers.Length; c++)
        {
            var cell = ws.Cell(3, c + 1);
            cell.Value = headers[c];
            cell.Style.Font.SetBold().Fill.SetBackgroundColor(XLColor.FromHtml("#1B4332")).Font.SetFontColor(XLColor.White);
        }

        ws.Column(1).Width = 6;
        ws.Column(2).Width = 10;
        ws.Column(3).Width = 14;
        ws.Column(4).Width = 30;
        ws.Column(5).Width = 24;
        ws.Column(6).Width = 8;
        ws.Column(7).Width = 14;
        ws.Column(8).Width = 14;

        var frontendPublicDir = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public"));

        for (var i = 0; i < rows.Count; i++)
        {
            var r = rows[i];
            var rowIdx = i + 4;
            ws.Row(rowIdx).Height = 40;

            ws.Cell(rowIdx, 1).Value = i + 1;
            ws.Cell(rowIdx, 3).Value = r.ProductCode;
            ws.Cell(rowIdx, 4).Value = r.ProductName;
            ws.Cell(rowIdx, 5).Value = r.CategoryName;
            ws.Cell(rowIdx, 6).Value = r.SizeName;
            ws.Cell(rowIdx, 7).Value = r.BasePrice;
            ws.Cell(rowIdx, 7).Style.NumberFormat.Format = "#,##0";
            ws.Cell(rowIdx, 8).Value = r.IsActive ? "Đang bán" : "Ngưng bán";

            if (!string.IsNullOrWhiteSpace(r.ImageUrl))
            {
                var relPath = r.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                var imgPath = Path.Combine(frontendPublicDir, relPath);
                if (System.IO.File.Exists(imgPath))
                {
                    ws.AddPicture(imgPath).MoveTo(ws.Cell(rowIdx, 2), 4, 4).WithSize(44, 44);
                }
            }
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "ThucDon_Fiin.xlsx");
    }

    public sealed record ExportProductExcelRow(
        string ProductCode,
        string ProductName,
        string CategoryName,
        string SizeName,
        decimal BasePrice,
        bool IsActive,
        string? ImageUrl);

    [HttpPost("products/upload-image")]
    public async Task<IActionResult> UploadProductImage(IFormFile file, [FromServices] IWebHostEnvironment env)
    {
        if (file == null || file.Length == 0)
            return BadRequest(ApiResponse.Fail("Vui lòng chọn file ảnh."));

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext is not (".png" or ".jpg" or ".jpeg" or ".webp"))
            return BadRequest(ApiResponse.Fail("Chỉ hỗ trợ ảnh .png, .jpg, .jpeg, .webp."));

        var monDir = Path.GetFullPath(Path.Combine(env.ContentRootPath, "..", "..", "frontend", "public", "mon"));
        Directory.CreateDirectory(monDir);

        var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid().ToString("N")[..6]}{ext}";
        var fullPath = Path.Combine(monDir, fileName);

        await using (var stream = System.IO.File.Create(fullPath))
        {
            await file.CopyToAsync(stream);
        }

        return Ok(ApiResponse<object>.Ok(new { imageUrl = $"/mon/{fileName}" }, "Tải ảnh lên thành công."));
    }

    public sealed record SaveProductRequest(
        int? ProductId,
        string ProductCode,
        string ProductName,
        int? CategoryId,
        decimal BasePrice,
        string? ImageUrl,
        bool IsActive);

    public sealed record SaveCategoryRequest(
        int? CategoryId,
        string CategoryName,
        int DisplayOrder,
        bool IsActive);
}
