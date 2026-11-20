using ClosedXML.Excel;
using FiinCoffee.Core.DTOs.HRM;
using FiinCoffee.Core.Interfaces;
using System.Data;
namespace FiinCoffee.Infrastructure.Excel;
/// <summary>
/// Sử dụng thư viện ClosedXML để thao tác trực tiếp trên OpenXML Spreadsheet.
/// </summary>
public class PExcelExportEngine : IExcelExportEngine
{
    public Task<byte[]> ExportFromTemplateAsync(string templatePath, DataSet dataSet)
    {
        if (!File.Exists(templatePath))
        {
            throw new FileNotFoundException($"Không tìm thấy file Excel template tại: {templatePath}");
        }
        if (dataSet == null || dataSet.Tables.Count == 0)
        {
            throw new ArgumentException("DataSet không có dữ liệu để xuất.", nameof(dataSet));
        }
        DataTable configTable = dataSet.Tables[dataSet.Tables.Count - 1];
        var configs = ParseExportConfigs(configTable);
        using var workbook = new XLWorkbook(templatePath);
        foreach (var config in configs)
        {
            ProcessConfig(workbook, config, dataSet);
        }
        workbook.RecalculateAllFormulas();
        using var memoryStream = new MemoryStream();
        workbook.SaveAs(memoryStream);
        return Task.FromResult(memoryStream.ToArray());
    }
    private static List<ExportConfigDto> ParseExportConfigs(DataTable configTable)
    {
        var list = new List<ExportConfigDto>();
        foreach (DataRow row in configTable.Rows)
        {
            list.Add(new ExportConfigDto
            {
                TableIndex = row.Table.Columns.Contains("TableIndex") ? row["TableIndex"]?.ToString() ?? "0" : "0",
                SheetIndex = row.Table.Columns.Contains("SheetIndex") && row["SheetIndex"] != DBNull.Value ? Convert.ToInt32(row["SheetIndex"]) : 0,
                ParseType = row.Table.Columns.Contains("ParseType") ? row["ParseType"]?.ToString() ?? string.Empty : string.Empty,
                Position = row.Table.Columns.Contains("Position") ? row["Position"]?.ToString() ?? "A1" : "A1",
                WithHeader = row.Table.Columns.Contains("WithHeader") && row["WithHeader"] != DBNull.Value ? Convert.ToInt32(row["WithHeader"]) : 1,
                WithBestFit = !row.Table.Columns.Contains("WithBestFit") || row["WithBestFit"] == DBNull.Value || Convert.ToBoolean(row["WithBestFit"])
            });
        }

        return list;
    }
    private static void ProcessConfig(XLWorkbook workbook, ExportConfigDto config, DataSet dataSet)
    {
        int sheetNumber = config.SheetIndex + 1;
        if (sheetNumber > workbook.Worksheets.Count) sheetNumber = 1;
        var ws = workbook.Worksheet(sheetNumber);
        var paramDict = config.GetParameters();
        if (!int.TryParse(config.TableIndex, out int tableIdx) || tableIdx >= dataSet.Tables.Count)
        {
            tableIdx = 0;
        }
        DataTable dataTable = dataSet.Tables[tableIdx];
        var startCell = ws.Cell(config.Position);
        int headerRow = startCell.Address.RowNumber;
        int startCol = startCell.Address.ColumnNumber;
        int dataStartRow = config.WithHeader == 1 ? headerRow + 1 : headerRow;
        bool isAutoMap = paramDict.ContainsKey("AutoMapColumn") && paramDict["AutoMapColumn"] == "1";
        bool hasOrderNumber = paramDict.ContainsKey("WithOrderNumber");
        var columnMapping = new Dictionary<int, string>();
        int orderNumberCol = -1;
        int currentCol = startCol;
        while (!ws.Cell(headerRow, currentCol).IsEmpty())
        {
            string headerText = ws.Cell(headerRow, currentCol).GetString().Trim();
            if (hasOrderNumber && headerText.Equals("STT", StringComparison.OrdinalIgnoreCase))
            {
                orderNumberCol = currentCol;
            }
            else if (isAutoMap)
            {
                foreach (DataColumn dc in dataTable.Columns)
                {
                    if (dc.ColumnName.Equals(headerText, StringComparison.OrdinalIgnoreCase))
                    {
                        columnMapping[currentCol] = dc.ColumnName;
                        break;
                    }
                }
            }
            else
            {
                int dtColIdx = currentCol - startCol;
                if (dtColIdx < dataTable.Columns.Count)
                {
                    columnMapping[currentCol] = dataTable.Columns[dtColIdx].ColumnName;
                }
            }
            currentCol++;
        }
        int totalDataRows = dataTable.Rows.Count;
        if (totalDataRows == 0) return;
        if (totalDataRows > 1)
        {
            ws.Row(dataStartRow).InsertRowsBelow(totalDataRows - 1);
        }
        for (int r = 0; r < totalDataRows; r++)
        {
            int targetRow = dataStartRow + r;
            DataRow dataRow = dataTable.Rows[r];
            if (orderNumberCol != -1)
            {
                var sttCell = ws.Cell(targetRow, orderNumberCol);
                sttCell.SetValue(r + 1);
                sttCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
            }
            foreach (var kvp in columnMapping)
            {
                int excelCol = kvp.Key;
                string dtColName = kvp.Value;
                object rawValue = dataRow[dtColName];
                var targetCell = ws.Cell(targetRow, excelCol);
                if (rawValue == DBNull.Value || rawValue == null)
                {
                    targetCell.SetValue(string.Empty);
                }
                else if (rawValue is decimal or double or float)
                {
                    targetCell.SetValue(Convert.ToDecimal(rawValue));
                    targetCell.Style.NumberFormat.Format = "#,##0";
                }
                else if (rawValue is int or long or short)
                {
                    targetCell.SetValue(Convert.ToInt64(rawValue));
                    targetCell.Style.NumberFormat.Format = "#,##0";
                }
                else if (rawValue is DateTime dtVal)
                {
                    targetCell.SetValue(dtVal.ToString("dd/MM/yyyy"));
                    targetCell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
                }
                else
                {
                    targetCell.SetValue(rawValue.ToString());
                }
            }
        }
        int lastDataRow = dataStartRow + totalDataRows - 1;
        int summaryRow = lastDataRow + 1;
        ws.Cell(summaryRow, 2).FormulaA1 = $"COUNTA(B{dataStartRow}:B{lastDataRow})";
        if (config.WithBestFit)
        {
            ws.Columns(startCol, currentCol - 1).AdjustToContents(5.0, 40.0);
        }
    }

}