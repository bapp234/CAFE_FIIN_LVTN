using ClosedXML.Excel;

namespace FiinCoffee.Infrastructure.Excel;

/// <summary>
/// Bộ dựng Template Excel dùng chung cho toàn bộ hệ thống Fiin Coffee,
/// đồng bộ 100% bảng màu Cafe Saigon Vintage (#FAF4E4, #F2E8D0, #9DBFB6, #7E2218, #2F5D58)
/// và bố cục tiêu đề + chân trang chữ ký của Fiin_HRM_Employees_Template.xlsx.
/// </summary>
public static class FiinExcelTemplateBuilder
{
    public static void CreateStandardExportTemplate(
        string templatePath,
        string sheetName,
        string reportTitle,
        IReadOnlyList<string> headers,
        string summaryLabel = "Tổng số bản ghi:",
        bool overwrite = false)
    {
        var dir = Path.GetDirectoryName(templatePath);
        if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        if (File.Exists(templatePath) && !overwrite)
        {
            return;
        }

        int colCount = Math.Max(headers.Count, 4);
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add(sheetName);

        // Dòng 1: Tên thương hiệu (Nền #FAF4E4, chữ #7E2218, Roboto 22pt Bold)
        ws.Row(1).Height = 28.2;
        ws.Range(1, 1, 1, colCount).Merge();
        var brandCell = ws.Cell(1, 1);
        brandCell.Value = "CÀ PHÊ FIIN - CHUỖI CỬA HÀNG CÀ PHÊ SÀI GÒN";
        ws.Range(1, 1, 1, colCount).Style.Fill.BackgroundColor = XLColor.FromHtml("#FAF4E4");
        brandCell.Style.Font.FontName = "Roboto";
        brandCell.Style.Font.FontSize = 22;
        brandCell.Style.Font.Bold = true;
        brandCell.Style.Font.FontColor = XLColor.FromHtml("#7E2218");
        brandCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        brandCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

        // Dòng 2: Thông tin chi nhánh / hotline (Nền #FAF4E4)
        ws.Row(2).Height = 20;
        ws.Range(2, 1, 2, colCount).Merge();
        var subCell = ws.Cell(2, 1);
        subCell.Value = "Chi Nhánh: 120 Đinh Tiên Hoàng, Đa Kao, Quận 1, TP. Hồ Chí Minh · Hotline: 0901 234 567";
        ws.Range(2, 1, 2, colCount).Style.Fill.BackgroundColor = XLColor.FromHtml("#FAF4E4");
        subCell.Style.Font.FontName = "Roboto";
        subCell.Style.Font.FontSize = 11;
        subCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        subCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

        // Dòng 3-4: Tiêu đề báo cáo riêng của từng bảng (Nền #F2E8D0, chữ #2F5D58, Roboto 18pt Bold)
        ws.Row(3).Height = 22;
        ws.Row(4).Height = 22;
        ws.Range(3, 1, 4, colCount).Merge();
        var titleCell = ws.Cell(3, 1);
        titleCell.Value = reportTitle.ToUpperInvariant();
        ws.Range(3, 1, 4, colCount).Style.Fill.BackgroundColor = XLColor.FromHtml("#F2E8D0");
        titleCell.Style.Font.FontName = "Roboto";
        titleCell.Style.Font.FontSize = 18;
        titleCell.Style.Font.Bold = true;
        titleCell.Style.Font.FontColor = XLColor.FromHtml("#2F5D58");
        titleCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        titleCell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;

        // Dòng 5: Header cột dữ liệu (Nền #9DBFB6, chữ đậm, có viền)
        ws.Row(5).Height = 24;
        for (int i = 0; i < headers.Count; i++)
        {
            var cell = ws.Cell(5, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.FontName = "Roboto";
            cell.Style.Font.FontSize = 11;
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#9DBFB6");
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            cell.Style.Alignment.Vertical = XLAlignmentVerticalValues.Center;
            cell.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            cell.Style.Border.OutsideBorderColor = XLColor.FromHtml("#6B6157");
        }

        // Dòng 6: Dòng giữ chỗ cho PExcelExportEngine chèn dữ liệu
        ws.Row(6).Height = 20;
        for (int i = 0; i < headers.Count; i++)
        {
            var c = ws.Cell(6, i + 1);
            c.Style.Font.FontName = "Roboto";
            c.Style.Font.FontSize = 11;
            c.Style.Border.OutsideBorder = XLBorderStyleValues.Thin;
            c.Style.Border.OutsideBorderColor = XLColor.FromHtml("#D8CEBA");
        }

        // Dòng 7: Tổng kết
        ws.Row(7).Height = 22;
        ws.Cell(7, 1).Value = summaryLabel;
        ws.Cell(7, 1).Style.Font.Bold = true;
        ws.Cell(7, 1).Style.Font.FontName = "Roboto";

        // Dòng 9-10: Khối chữ ký cuối trang
        int signRow = 9;
        int midCol = Math.Max(3, colCount / 2);
        int rightCol = Math.Max(5, colCount - 1);

        ws.Cell(signRow, 1).Value = "Người lập bảng";
        ws.Cell(signRow, 1).Style.Font.Bold = true;
        ws.Cell(signRow + 1, 1).Value = "(Ký và ghi rõ họ tên)";
        ws.Cell(signRow + 1, 1).Style.Font.Italic = true;

        ws.Cell(signRow, midCol).Value = "Cửa hàng trưởng";
        ws.Cell(signRow, midCol).Style.Font.Bold = true;
        ws.Cell(signRow + 1, midCol).Value = "(Ký và ghi rõ họ tên)";
        ws.Cell(signRow + 1, midCol).Style.Font.Italic = true;

        ws.Cell(signRow, rightCol).Value = "Giám đốc duyệt";
        ws.Cell(signRow, rightCol).Style.Font.Bold = true;
        ws.Cell(signRow + 1, rightCol).Value = "(Ký, đóng dấu)";
        ws.Cell(signRow + 1, rightCol).Style.Font.Italic = true;

        ws.Columns(1, colCount).AdjustToContents(10, 38);
        wb.SaveAs(templatePath);
    }
}
