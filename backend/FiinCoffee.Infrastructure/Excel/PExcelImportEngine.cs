using ClosedXML.Excel;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;

namespace FiinCoffee.Infrastructure.Excel;

/// <summary>
/// Động cơ xử lý đọc, kiểm tra (Preview/Validate) và sinh file mẫu Excel nhập nhanh nhân sự sử dụng ClosedXML
/// </summary>
public class PExcelImportEngine : IExcelImportEngine
{
    public Task<EmployeeImportPreviewResultDto> ParseAndValidateExcelAsync(Stream fileStream, HashSet<string> existingCitizenIds)
    {
        using var workbook = new XLWorkbook(fileStream);
        var ws = workbook.Worksheets.FirstOrDefault();
        if (ws == null)
        {
            return Task.FromResult(new EmployeeImportPreviewResultDto());
        }

        // 1. Tìm dòng tiêu đề (Header Row)
        int headerRowIndex = 5; // Mặc định dòng 5 theo template ParadiseHR
        for (int r = 1; r <= 15; r++)
        {
            var row = ws.Row(r);
            var cells = row.CellsUsed().Select(c => NormalizeKey(c.GetString())).ToList();
            if (cells.Any(k => k == "hovaten" || k == "hoten" || k == "fullname") &&
                cells.Any(k => k == "socccd" || k == "cccd" || k == "cmnd" || k == "citizenid"))
            {
                headerRowIndex = r;
                break;
            }
        }

        // 2. Lập bản đồ ánh xạ cột
        var headerRow = ws.Row(headerRowIndex);
        var colMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        foreach (var cell in headerRow.CellsUsed())
        {
            string key = NormalizeKey(cell.GetString());
            if (!string.IsNullOrEmpty(key) && !colMap.ContainsKey(key))
            {
                colMap[key] = cell.Address.ColumnNumber;
            }
        }

        int Col(string[] possibleKeys, int fallbackCol)
        {
            foreach (var pk in possibleKeys)
            {
                var norm = NormalizeKey(pk);
                if (colMap.TryGetValue(norm, out int colIdx)) return colIdx;
            }
            return fallbackCol;
        }

        int colCode = Col(new[] { "MaNhanVien", "MaNV", "Code", "EmployeeCode" }, 2);
        int colName = Col(new[] { "HoVaTen", "HoTen", "FullName", "TenNhanVien" }, 3);
        int colCitizen = Col(new[] { "SoCCCD", "CCCD", "CMND", "CitizenId", "SoCMND" }, 4);
        int colPhone = Col(new[] { "SoDienThoai", "SDT", "Phone", "PhoneNumber" }, 5);
        int colBranch = Col(new[] { "ChiNhanh", "Branch", "BranchName", "MaChiNhanh" }, 6);
        int colPos = Col(new[] { "ChucDanh", "ChucVu", "Position", "ViTri" }, 7);
        int colContract = Col(new[] { "LoaiHopDong", "LoaiHD", "ContractType", "HopDong" }, 8);
        int colRate = Col(new[] { "LuongGio", "Luong", "HourlyRate", "MucLuong" }, 9);
        int colAllowance = Col(new[] { "PhuCap", "Allowance" }, 10);
        int colStatus = Col(new[] { "TrangThai", "Status" }, 11);

        var result = new EmployeeImportPreviewResultDto();
        var fileSeenCitizenIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        int lastRowNumber = ws.LastRowUsed()?.RowNumber() ?? headerRowIndex;
        int rowCounter = 1;

        for (int r = headerRowIndex + 1; r <= lastRowNumber; r++)
        {
            var row = ws.Row(r);
            if (row.IsEmpty()) continue;

            string rawName = row.Cell(colName).GetString().Trim();
            string rawCitizen = row.Cell(colCitizen).GetString().Trim();
            string rawCode = row.Cell(colCode).GetString().Trim();

            // Bỏ qua các dòng chú thích chân trang (Footer / Ký tên)
            if (rawName.StartsWith("Tổng", StringComparison.OrdinalIgnoreCase) ||
                rawName.StartsWith("Người", StringComparison.OrdinalIgnoreCase) ||
                rawName.StartsWith("Giám đốc", StringComparison.OrdinalIgnoreCase) ||
                rawName.StartsWith("Cửa hàng", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            // Nếu cả Họ tên và CCCD đều trống thì bỏ qua dòng rác
            if (string.IsNullOrWhiteSpace(rawName) && string.IsNullOrWhiteSpace(rawCitizen))
            {
                continue;
            }

            var item = new EmployeeImportItemDto
            {
                RowIndex = rowCounter++,
                EmployeeCode = string.IsNullOrWhiteSpace(rawCode) ? null : rawCode,
                FullName = rawName,
                CitizenId = rawCitizen.Replace(" ", "").Replace(".", "").Replace("-", ""),
                PhoneNumber = row.Cell(colPhone).GetString().Trim(),
                BranchInput = row.Cell(colBranch).GetString().Trim(),
                Position = row.Cell(colPos).GetString().Trim(),
                ContractTypeInput = row.Cell(colContract).GetString().Trim(),
                Status = "active"
            };

            // Parse số lương và phụ cấp an toàn
            if (decimal.TryParse(row.Cell(colRate).GetString().Replace(",", "").Replace(".", "").Trim(), out decimal rate))
            {
                item.HourlyRate = rate;
            }
            if (decimal.TryParse(row.Cell(colAllowance).GetString().Replace(",", "").Replace(".", "").Trim(), out decimal allowance))
            {
                item.Allowance = allowance;
            }

            string rawStatus = row.Cell(colStatus).GetString().Trim().ToLower();
            if (rawStatus.Contains("thôi") || rawStatus == "resigned") item.Status = "resigned";

            // 3. Validation Logic
            var errors = new List<string>();

            if (string.IsNullOrWhiteSpace(item.FullName))
            {
                errors.Add("Thiếu họ và tên nhân sự");
            }

            if (string.IsNullOrWhiteSpace(item.CitizenId))
            {
                errors.Add("Thiếu số CCCD/Định danh");
            }
            else if (item.CitizenId.Length < 9 || item.CitizenId.Length > 12 || !item.CitizenId.All(char.IsDigit))
            {
                errors.Add($"Số CCCD '{item.CitizenId}' không hợp lệ (phải từ 9-12 chữ số)");
            }
            else if (fileSeenCitizenIds.Contains(item.CitizenId))
            {
                errors.Add($"Trùng số CCCD '{item.CitizenId}' với dòng khác trong file");
            }
            else if (existingCitizenIds.Contains(item.CitizenId))
            {
                errors.Add($"Số CCCD '{item.CitizenId}' đã tồn tại trên hệ thống");
            }
            else
            {
                fileSeenCitizenIds.Add(item.CitizenId);
            }

            if (errors.Count > 0)
            {
                item.IsValid = false;
                item.ErrorMessage = string.Join("; ", errors);
            }

            result.Items.Add(item);
        }

        result.TotalRows = result.Items.Count;
        result.ValidRows = result.Items.Count(x => x.IsValid);
        result.ErrorRows = result.Items.Count(x => !x.IsValid);

        return Task.FromResult(result);
    }

    public byte[] GenerateImportTemplate()
    {
        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("NhanVien_Template");

        // Header Banner & Tiêu đề
        ws.Cell("A1").Value = "CÀ PHÊ FIIN - BIỂU MẪU NHẬP NHANH HỒ SƠ NHÂN SỰ";
        ws.Range("A1:K1").Merge().Style.Font.SetBold().Font.SetFontSize(14).Font.SetFontColor(XLColor.FromHtml("#4A2C11"));
        ws.Row(1).Height = 28;

        ws.Cell("A2").Value = "Lưu ý: Cột HoVaTen và SoCCCD là bắt buộc. Nếu để trống MaNhanVien, hệ thống sẽ tự sinh liên tục (NV...).";
        ws.Range("A2:K2").Merge().Style.Font.SetItalic().Font.SetFontColor(XLColor.DimGray);

        // Header Row 5
        var headers = new[]
        {
            ("A5", "STT", 6),
            ("B5", "MaNhanVien", 14),
            ("C5", "HoVaTen", 26),
            ("D5", "SoCCCD", 18),
            ("E5", "SoDienThoai", 16),
            ("F5", "ChiNhanh", 24),
            ("G5", "ChucDanh", 24),
            ("H5", "LoaiHopDong", 32),
            ("I5", "LuongGio", 14),
            ("J5", "PhuCap", 14),
            ("K5", "TrangThai", 14),
        };

        foreach (var (cell, label, width) in headers)
        {
            var c = ws.Cell(cell);
            c.Value = label;
            c.Style.Font.SetBold(true);
            c.Style.Font.SetFontColor(XLColor.White);
            c.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#6F4E37")); // Vintage Brown
            c.Style.Alignment.SetHorizontal(XLAlignmentHorizontalValues.Center);
            c.Style.Alignment.SetVertical(XLAlignmentVerticalValues.Center);
            c.Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);

            char colChar = cell[0];
            ws.Column(colChar - 'A' + 1).Width = width;
        }
        ws.Row(5).Height = 24;

        // 3 dòng dữ liệu mẫu hướng dẫn
        var sampleData = new[]
        {
            (1, "", "Nguyễn Văn An", "079203001234", "0901234567", "Fiin Đinh Tiên Hoàng", "Barista Chuyên nghiệp", "Hợp đồng Lao động Chính thức (Full-time)", 28000, 1000000, "active"),
            (2, "", "Trần Thị Bình", "079203005678", "0909888777", "Fiin Hồ Con Rùa", "Thu ngân & Phục vụ", "Hợp đồng Bán thời gian (Part-time)", 25000, 300000, "active"),
            (3, "", "Lê Hoàng Cường", "079203009988", "0903112233", "Fiin Võ Văn Ngân", "Phục vụ & Bàn", "Hợp đồng Bán thời gian (Part-time)", 24000, 200000, "active")
        };

        int rIndex = 6;
        foreach (var item in sampleData)
        {
            ws.Cell(rIndex, 1).Value = item.Item1;
            ws.Cell(rIndex, 2).Value = item.Item2;
            ws.Cell(rIndex, 3).Value = item.Item3;
            ws.Cell(rIndex, 4).Value = item.Item4;
            ws.Cell(rIndex, 5).Value = item.Item5;
            ws.Cell(rIndex, 6).Value = item.Item6;
            ws.Cell(rIndex, 7).Value = item.Item7;
            ws.Cell(rIndex, 8).Value = item.Item8;
            ws.Cell(rIndex, 9).Value = item.Item9;
            ws.Cell(rIndex, 10).Value = item.Item10;
            ws.Cell(rIndex, 11).Value = item.Item11;

            for (int c = 1; c <= 11; c++)
            {
                ws.Cell(rIndex, c).Style.Border.SetOutsideBorder(XLBorderStyleValues.Thin);
            }
            rIndex++;
        }

        using var ms = new MemoryStream();
        workbook.SaveAs(ms);
        return ms.ToArray();
    }

    private static string NormalizeKey(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return string.Empty;
        return text.Trim().ToLower().Replace(" ", "").Replace("_", "").Replace("-", "");
    }
}
