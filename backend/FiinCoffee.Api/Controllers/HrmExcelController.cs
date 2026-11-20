using System.Data;
using System.Text.Json;
using ClosedXML.Excel;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using FiinCoffee.Infrastructure.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FiinCoffee.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/hrm/excel")]
public class HrmExcelController : ControllerBase
{
    private readonly IExcelExportEngine _excelExportEngine;
    private readonly IWebHostEnvironment _env;

    public HrmExcelController(IExcelExportEngine excelExportEngine, IWebHostEnvironment env)
    {
        _excelExportEngine = excelExportEngine;
        _env = env;
    }

    [HttpPost("export-standard")]
    public async Task<IActionResult> ExportStandard([FromBody] StandardExcelExportRequestDto request)
    {
        if (request.Headers == null || request.Headers.Count == 0)
        {
            return BadRequest(new { message = "Danh sách cột xuất Excel không được để trống." });
        }

        var safeKey = string.Concat((request.TemplateKey ?? "Fiin_Export")
            .Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-'));
        if (string.IsNullOrWhiteSpace(safeKey))
        {
            safeKey = "Fiin_Export";
        }

        var templatesDir = Path.Combine(_env.ContentRootPath, "Templates");
        var templatePath = Path.Combine(templatesDir, $"{safeKey}_Template.xlsx");

        var headersWithStt = new List<string> { "STT" };
        headersWithStt.AddRange(request.Headers);

        FiinExcelTemplateBuilder.CreateStandardExportTemplate(
            templatePath: templatePath,
            sheetName: string.IsNullOrWhiteSpace(request.SheetName) ? "Dữ liệu" : request.SheetName,
            reportTitle: string.IsNullOrWhiteSpace(request.ReportTitle) ? "BÁO CÁO DỮ LIỆU" : request.ReportTitle,
            headers: headersWithStt,
            summaryLabel: string.IsNullOrWhiteSpace(request.SummaryLabel) ? "Tổng số bản ghi:" : request.SummaryLabel,
            overwrite: true);

        var dataTable = new DataTable("Data");
        foreach (var header in request.Headers)
        {
            dataTable.Columns.Add(header, typeof(object));
        }

        foreach (var rowDict in request.Rows)
        {
            var dataRow = dataTable.NewRow();
            foreach (var header in request.Headers)
            {
                if (rowDict.TryGetValue(header, out var element))
                {
                    dataRow[header] = UnwrapJsonElement(element);
                }
                else
                {
                    dataRow[header] = DBNull.Value;
                }
            }
            dataTable.Rows.Add(dataRow);
        }

        var exportConfig = new DataTable("ExportConfig");
        exportConfig.Columns.Add("TableIndex", typeof(string));
        exportConfig.Columns.Add("SheetIndex", typeof(int));
        exportConfig.Columns.Add("ParseType", typeof(string));
        exportConfig.Columns.Add("Position", typeof(string));
        exportConfig.Columns.Add("WithHeader", typeof(int));
        exportConfig.Columns.Add("WithBestFit", typeof(bool));
        exportConfig.Rows.Add("0", 0, "AutoMapColumn=1|WithOrderNumber=1", "A5", 1, true);

        var dataSet = new DataSet();
        dataSet.Tables.Add(dataTable);
        dataSet.Tables.Add(exportConfig);

        var fileBytes = await _excelExportEngine.ExportFromTemplateAsync(templatePath, dataSet);
        var downloadName = string.IsNullOrWhiteSpace(request.FileName) ? $"{safeKey}.xlsx" : request.FileName;
        if (!downloadName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase))
        {
            downloadName += ".xlsx";
        }

        return File(
            fileBytes,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            downloadName);
    }

    [HttpPost("parse-excel")]
    public async Task<IActionResult> ParseExcel(IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { success = false, message = "Vui lòng chọn tệp Excel (.xlsx) hợp lệ." });
        }

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        ms.Position = 0;

        using var wb = new XLWorkbook(ms);
        var ws = wb.Worksheets.FirstOrDefault();
        if (ws == null)
        {
            return BadRequest(new { success = false, message = "Tệp Excel không có sheet dữ liệu nào." });
        }

        var lastRow = ws.LastRowUsed()?.RowNumber() ?? 0;
        var lastCol = ws.LastColumnUsed()?.ColumnNumber() ?? 0;
        if (lastRow == 0 || lastCol == 0)
        {
            return BadRequest(new { success = false, message = "Tệp Excel không có dữ liệu." });
        }

        int headerRow = 1;
        for (int r = 1; r <= Math.Min(lastRow, 15); r++)
        {
            var rowTexts = Enumerable.Range(1, lastCol)
                .Select(c => ws.Cell(r, c).GetString().Trim())
                .ToList();
            if (rowTexts.Any(t => t.Equals("Mã NV", StringComparison.OrdinalIgnoreCase)
                              || t.Equals("Mã nhân viên", StringComparison.OrdinalIgnoreCase)
                              || t.Equals("MaNhanVien", StringComparison.OrdinalIgnoreCase)))
            {
                headerRow = r;
                break;
            }
        }

        var headers = new List<string>();
        var colIndices = new List<int>();
        for (int c = 1; c <= lastCol; c++)
        {
            var h = ws.Cell(headerRow, c).GetString().Trim();
            if (!string.IsNullOrWhiteSpace(h))
            {
                headers.Add(h);
                colIndices.Add(c);
            }
        }

        var rows = new List<Dictionary<string, string>>();
        for (int r = headerRow + 1; r <= lastRow; r++)
        {
            var dict = new Dictionary<string, string>();
            bool hasValue = false;
            for (int i = 0; i < headers.Count; i++)
            {
                var val = ws.Cell(r, colIndices[i]).GetString().Trim();
                dict[headers[i]] = val;
                if (!string.IsNullOrWhiteSpace(val)) hasValue = true;
            }

            // Bỏ qua dòng tổng kết hoặc chữ ký cuối trang
            var firstColVal = dict.Values.FirstOrDefault() ?? string.Empty;
            if (!hasValue || firstColVal.StartsWith("Tổng số", StringComparison.OrdinalIgnoreCase)
                          || firstColVal.StartsWith("Người lập", StringComparison.OrdinalIgnoreCase)
                          || firstColVal.StartsWith("(Ký", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            rows.Add(dict);
        }

        return Ok(new { success = true, data = new { headers, rows } });
    }

    private static object UnwrapJsonElement(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Null or JsonValueKind.Undefined => DBNull.Value,
            JsonValueKind.String => element.GetString() ?? string.Empty,
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDecimal(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => element.ToString()
        };
    }
}
