using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using FiinCoffee.Core.Interfaces;

namespace FiinCoffee.Infrastructure.Word;

/// <summary>
/// Engine xử lý xuất file Word (.docx) từ file mẫu bằng OpenXML thuần (.NET ZipArchive + XDocument),
/// không cần cài thêm thư viện ngoài và giữ nguyên 100% định dạng của file Word mẫu.
/// </summary>
public class WordTemplateEngine : IWordTemplateEngine
{
    private static readonly XNamespace W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    public Task<byte[]> RenderFromTemplateAsync(string templatePath, IDictionary<string, string> placeholders)
    {
        if (!File.Exists(templatePath))
        {
            EnsureDefaultContractTemplate(templatePath);
        }

        byte[] templateBytes = File.ReadAllBytes(templatePath);
        using var outputStream = new MemoryStream();
        outputStream.Write(templateBytes, 0, templateBytes.Length);
        outputStream.Position = 0;

        using (var archive = new ZipArchive(outputStream, ZipArchiveMode.Update, leaveOpen: true))
        {
            var xmlEntries = archive.Entries
                .Where(e => e.FullName.Equals("word/document.xml", StringComparison.OrdinalIgnoreCase)
                         || e.FullName.StartsWith("word/header", StringComparison.OrdinalIgnoreCase)
                         || e.FullName.StartsWith("word/footer", StringComparison.OrdinalIgnoreCase))
                .ToList();

            foreach (var entry in xmlEntries)
            {
                XDocument doc;
                using (var entryStream = entry.Open())
                {
                    doc = XDocument.Load(entryStream);
                }

                ReplacePlaceholdersInXml(doc, placeholders);

                using var writeStream = entry.Open();
                writeStream.SetLength(0);
                using var writer = new StreamWriter(writeStream, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
                doc.Save(writer, SaveOptions.DisableFormatting);
            }
        }

        return Task.FromResult(outputStream.ToArray());
    }

    private static void ReplacePlaceholdersInXml(XDocument doc, IDictionary<string, string> placeholders)
    {
        if (doc.Root == null) return;

        foreach (var paragraph in doc.Root.Descendants(W + "p"))
        {
            var textNodes = paragraph.Descendants(W + "t").ToList();
            if (textNodes.Count == 0) continue;

            string combined = string.Concat(textNodes.Select(t => t.Value));
            if (!combined.Contains("{{")) continue;

            string replaced = combined;
            foreach (var kv in placeholders)
            {
                replaced = replaced.Replace($"{{{{{kv.Key}}}}}", kv.Value ?? string.Empty);
            }

            if (replaced == combined) continue;

            // Giữ nguyên định dạng của run đầu tiên chứa text, đặt toàn bộ text đã thay thế vào đó và làm rỗng các run còn lại trong đoạn
            textNodes[0].Value = replaced;
            textNodes[0].SetAttributeValue(XNamespace.Xml + "space", "preserve");
            for (int i = 1; i < textNodes.Count; i++)
            {
                textNodes[i].Value = string.Empty;
            }
        }
    }

    public void EnsureDefaultContractTemplate(string templatePath)
    {
        var dir = Path.GetDirectoryName(templatePath);
        if (!string.IsNullOrWhiteSpace(dir) && !Directory.Exists(dir))
        {
            Directory.CreateDirectory(dir);
        }

        if (File.Exists(templatePath)) return;

        using var ms = new MemoryStream();
        using (var archive = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            WriteZipEntry(archive, "[Content_Types].xml", ContentTypesXml);
            WriteZipEntry(archive, "_rels/.rels", RootRelsXml);
            WriteZipEntry(archive, "word/_rels/document.xml.rels", DocumentRelsXml);
            WriteZipEntry(archive, "word/document.xml", BuildDefaultDocumentXml());
        }

        File.WriteAllBytes(templatePath, ms.ToArray());
    }

    private static void WriteZipEntry(ZipArchive archive, string path, string content)
    {
        var entry = archive.CreateEntry(path, CompressionLevel.Optimal);
        using var stream = entry.Open();
        using var writer = new StreamWriter(stream, new UTF8Encoding(false));
        writer.Write(content);
    }

    private static string BuildDefaultDocumentXml()
    {
        var sb = new StringBuilder();
        sb.Append("""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>""");
        sb.Append("""<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>""");

        void AddPara(string text, bool bold = false, int fontSizeHalfPt = 24, string align = "left", int spaceAfter = 100)
        {
            var jc = align == "center" ? "<w:jc w:val=\"center\"/>" : align == "right" ? "<w:jc w:val=\"right\"/>" : "";
            var bTag = bold ? "<w:b/>" : "";
            var escaped = System.Security.SecurityElement.Escape(text) ?? string.Empty;
            sb.Append($"<w:p><w:pPr>{jc}<w:spacing w:after=\"{spaceAfter}\" w:line=\"276\" w:lineRule=\"auto\"/></w:pPr>");
            sb.Append($"<w:r><w:rPr><w:rFonts w:ascii=\"Times New Roman\" w:hAnsi=\"Times New Roman\" w:cs=\"Times New Roman\"/>{bTag}<w:sz w:val=\"{fontSizeHalfPt}\"/><w:szCs w:val=\"{fontSizeHalfPt}\"/></w:rPr>");
            sb.Append($"<w:t xml:space=\"preserve\">{escaped}</w:t></w:r></w:p>");
        }

        AddPara("CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM", bold: true, fontSizeHalfPt: 24, align: "center", spaceAfter: 40);
        AddPara("Độc lập - Tự do - Hạnh phúc", bold: true, fontSizeHalfPt: 24, align: "center", spaceAfter: 160);
        AddPara("HỢP ĐỒNG LAO ĐỘNG", bold: true, fontSizeHalfPt: 32, align: "center", spaceAfter: 60);
        AddPara("Số: {{ContractCode}}", bold: true, fontSizeHalfPt: 22, align: "center", spaceAfter: 200);

        AddPara("Hôm nay, ngày {{SignDay}} tháng {{SignMonth}} năm {{SignYear}}, tại {{BranchName}}, chúng tôi gồm:", fontSizeHalfPt: 24, spaceAfter: 120);

        AddPara("BÊN A: NGƯỜI SỬ DỤNG LAO ĐỘNG (HỆ THỐNG CÀ PHÊ FIIN)", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("- Đơn vị: Hệ thống Cà Phê Fiin — Chi nhánh {{BranchName}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Địa chỉ: {{BranchAddress}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Đại diện theo pháp luật: Ban Giám Đốc / Phòng Nhân Sự Fiin Coffee", fontSizeHalfPt: 24, spaceAfter: 140);

        AddPara("BÊN B: NGƯỜI LAO ĐỘNG", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("- Họ và tên: {{FullName}}        (Mã nhân viên: {{EmployeeCode}})", bold: true, fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Ngày sinh: {{DateOfBirth}}        Giới tính: {{GenderText}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Số CCCD/CMND: {{CitizenId}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Số điện thoại: {{PhoneNumber}}        Email: {{Email}}", fontSizeHalfPt: 24, spaceAfter: 140);

        AddPara("Hai bên thống nhất ký kết Hợp đồng lao động với các điều khoản sau:", bold: true, fontSizeHalfPt: 24, spaceAfter: 100);

        AddPara("Điều 1. Loại hợp đồng, thời hạn và công việc đảm nhiệm", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("- Loại hợp đồng: {{ContractName}} ({{ContractTypeCode}})", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Thời hạn hiệu lực: Từ ngày {{StartDate}} đến ngày {{EndDate}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Chức danh / Vị trí công tác: {{Position}}", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Địa điểm làm việc: {{BranchName}}", fontSizeHalfPt: 24, spaceAfter: 120);

        AddPara("Điều 2. Chế độ tiền lương, phụ cấp và phúc lợi", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("- Đơn giá lương cơ bản theo giờ: {{HourlyRate}} VNĐ/giờ", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Phụ cấp cố định hàng tháng: {{Allowance}} VNĐ/tháng", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("- Chế độ đãi ngộ & quyền lợi kèm theo: {{BenefitsDescription}}", fontSizeHalfPt: 24, spaceAfter: 120);

        AddPara("Điều 3. Điều khoản thi hành", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("Hợp đồng này được lập thành 02 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản và có hiệu lực kể từ ngày ký.", fontSizeHalfPt: 24, spaceAfter: 40);
        AddPara("Ghi chú bổ sung: {{Note}}", fontSizeHalfPt: 22, spaceAfter: 240);

        AddPara("          ĐẠI DIỆN BÊN A                                                  NGƯỜI LAO ĐỘNG (BÊN B)", bold: true, fontSizeHalfPt: 24, spaceAfter: 60);
        AddPara("         (Ký, ghi rõ họ tên)                                                  (Ký, ghi rõ họ tên)", fontSizeHalfPt: 22, spaceAfter: 260);
        AddPara("          Hệ thống Cà Phê Fiin                                                  {{FullName}}", bold: true, fontSizeHalfPt: 24, spaceAfter: 40);

        sb.Append("""<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1417"/></w:sectPr></w:body></w:document>""");
        return sb.ToString();
    }

    private const string ContentTypesXml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>""";
    private const string RootRelsXml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>""";
    private const string DocumentRelsXml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>""";
}
