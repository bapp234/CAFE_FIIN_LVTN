using System.Globalization;
using ClosedXML.Excel;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;

namespace FiinCoffee.Infrastructure.Excel;

public class ContractExcelService : IContractExcelService
{
    public void EnsureExportTemplate(string templatePath)
    {
        string[] headers =
        [
            "STT", "Mã HĐ", "Mã NV", "Họ và tên", "Chức vụ", "Chi nhánh",
            "Loại hợp đồng", "Lương giờ", "Phụ cấp", "Hiệu lực từ", "Đến ngày", "Trạng thái", "Ghi chú"
        ];

        FiinExcelTemplateBuilder.CreateStandardExportTemplate(
            templatePath,
            sheetName: "HopDongLaoDong",
            reportTitle: "DANH SÁCH HỢP ĐỒNG LAO ĐỘNG NHÂN SỰ",
            headers: headers,
            summaryLabel: "Tổng số hợp đồng:",
            overwrite: false
        );
    }

    public byte[] GenerateImportTemplate(IEnumerable<ContractTypeSettingDto> contractTypes)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("NhapHopDong");

        string[] headers =
        [
            "Mã NV (*)",
            "Mã loại HĐ (*)",
            "Chức vụ (*)",
            "Lương giờ (VNĐ)",
            "Phụ cấp (VNĐ)",
            "Ngày hiệu lực (YYYY-MM-DD) (*)",
            "Ngày hết hạn (YYYY-MM-DD)",
            "Ghi chú"
        ];

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#2F5D58");
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
        }

        // Dòng dữ liệu mẫu
        ws.Cell(2, 1).Value = "BAR001";
        ws.Cell(2, 2).Value = "HD-CHINH-THUC";
        ws.Cell(2, 3).Value = "Barista Chuyên nghiệp";
        ws.Cell(2, 4).Value = 28000;
        ws.Cell(2, 5).Value = 1000000;
        ws.Cell(2, 6).Value = DateTime.Today.ToString("yyyy-MM-dd");
        ws.Cell(2, 7).Value = DateTime.Today.AddMonths(12).ToString("yyyy-MM-dd");
        ws.Cell(2, 8).Value = "Ký mới theo mẫu Excel";

        var guide = wb.Worksheets.Add("DanhMucLoaiHD");
        guide.Cell(1, 1).Value = "Mã loại HĐ";
        guide.Cell(1, 2).Value = "Tên loại hợp đồng";
        guide.Cell(1, 3).Value = "Lương giờ chuẩn";
        guide.Cell(1, 4).Value = "Phụ cấp chuẩn";
        guide.Cell(1, 5).Value = "Thời hạn (tháng)";
        guide.Range("A1:E1").Style.Font.Bold = true;

        int r = 2;
        foreach (var ct in contractTypes)
        {
            guide.Cell(r, 1).Value = ct.ContractCode;
            guide.Cell(r, 2).Value = ct.ContractName;
            guide.Cell(r, 3).Value = ct.StandardHourlyRate;
            guide.Cell(r, 4).Value = ct.Allowance;
            guide.Cell(r, 5).Value = ct.DurationMonths?.ToString() ?? "Không xác định";
            r++;
        }

        ws.Columns().AdjustToContents();
        guide.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    public Task<ContractImportPreviewResultDto> ParseAndValidateImportAsync(
        Stream fileStream,
        IDictionary<string, (int EmployeeId, string FullName)> employeeByCode,
        IDictionary<string, ContractTypeSettingDto> contractTypeByCode)
    {
        var result = new ContractImportPreviewResultDto();
        using var wb = new XLWorkbook(fileStream);
        var ws = wb.Worksheets.FirstOrDefault();
        if (ws == null)
        {
            return Task.FromResult(result);
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 1;
        for (int rowIdx = 2; rowIdx <= lastRow; rowIdx++)
        {
            var row = ws.Row(rowIdx);
            string empCode = row.Cell(1).GetString().Trim();
            string typeCode = row.Cell(2).GetString().Trim().ToUpperInvariant();
            string position = row.Cell(3).GetString().Trim();
            string rateRaw = row.Cell(4).GetString().Trim();
            string allowRaw = row.Cell(5).GetString().Trim();
            string startRaw = ReadDateString(row.Cell(6));
            string endRaw = ReadDateString(row.Cell(7));
            string note = row.Cell(8).GetString().Trim();

            if (string.IsNullOrWhiteSpace(empCode) && string.IsNullOrWhiteSpace(typeCode) && string.IsNullOrWhiteSpace(position))
            {
                continue;
            }

            var errors = new List<string>();
            int empId = 0;
            string? fullName = null;
            if (string.IsNullOrWhiteSpace(empCode) || !employeeByCode.TryGetValue(empCode, out var empInfo))
            {
                errors.Add($"Không tìm thấy Mã NV '{empCode}' trong phạm vi quyền.");
            }
            else
            {
                empId = empInfo.EmployeeId;
                fullName = empInfo.FullName;
            }

            int typeId = 0;
            decimal defaultRate = 0;
            decimal defaultAllow = 0;
            if (string.IsNullOrWhiteSpace(typeCode) || !contractTypeByCode.TryGetValue(typeCode, out var ctInfo))
            {
                errors.Add($"Mã loại HĐ '{typeCode}' không hợp lệ.");
            }
            else
            {
                typeId = ctInfo.ContractTypeId;
                defaultRate = ctInfo.StandardHourlyRate;
                defaultAllow = ctInfo.Allowance;
            }

            if (string.IsNullOrWhiteSpace(position))
            {
                errors.Add("Thiếu Chức vụ.");
            }

            decimal hourlyRate = decimal.TryParse(rateRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedRate)
                ? parsedRate
                : defaultRate;
            decimal allowance = decimal.TryParse(allowRaw, NumberStyles.Any, CultureInfo.InvariantCulture, out var parsedAllow)
                ? parsedAllow
                : defaultAllow;

            if (!DateTime.TryParse(startRaw, out var startDate))
            {
                errors.Add("Ngày hiệu lực không đúng định dạng YYYY-MM-DD.");
            }

            string? endDateStr = null;
            if (!string.IsNullOrWhiteSpace(endRaw))
            {
                if (!DateTime.TryParse(endRaw, out var endDate))
                {
                    errors.Add("Ngày hết hạn không hợp lệ.");
                }
                else
                {
                    if (endDate < startDate)
                        errors.Add("Ngày hết hạn nhỏ hơn ngày hiệu lực.");
                    endDateStr = endDate.ToString("yyyy-MM-dd");
                }
            }

            bool isValid = errors.Count == 0;
            result.Items.Add(new ContractImportItemDto
            {
                RowIndex = rowIdx,
                EmployeeCode = empCode,
                EmployeeId = empId,
                FullName = fullName,
                ContractTypeCode = typeCode,
                ContractTypeId = typeId,
                Position = position,
                HourlyRate = hourlyRate,
                Allowance = allowance,
                StartDate = startDate == default ? startRaw : startDate.ToString("yyyy-MM-dd"),
                EndDate = endDateStr,
                Note = string.IsNullOrWhiteSpace(note) ? null : note,
                IsValid = isValid,
                ErrorMessage = isValid ? null : string.Join(" ", errors),
            });
        }

        result.TotalRows = result.Items.Count;
        result.ValidRows = result.Items.Count(x => x.IsValid);
        result.ErrorRows = result.Items.Count(x => !x.IsValid);
        return Task.FromResult(result);
    }

    private static string ReadDateString(IXLCell cell)
    {
        if (cell.IsEmpty()) return string.Empty;
        if (cell.DataType == XLDataType.DateTime)
        {
            return cell.GetDateTime().ToString("yyyy-MM-dd");
        }
        return cell.GetString().Trim();
    }
}
