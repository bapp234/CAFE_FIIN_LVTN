using System.Net;
using System.Net.Mail;

namespace FiinCoffee.Api.Services;

public interface IEmailSender
{
    bool IsSmtpConfigured { get; }
    string FrontendBaseUrl { get; }
    Task<bool> SendAsync(string toEmail, string subject, string htmlBody);
}

public sealed class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration configuration, ILogger<SmtpEmailSender> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public string FrontendBaseUrl =>
        (_configuration["EmailSettings:FrontendBaseUrl"] ?? "http://localhost:4200").TrimEnd('/');

    public bool IsSmtpConfigured =>
        !string.IsNullOrWhiteSpace(_configuration["EmailSettings:SenderEmail"]) &&
        !string.IsNullOrWhiteSpace(_configuration["EmailSettings:AppPassword"]);

    public async Task<bool> SendAsync(string toEmail, string subject, string htmlBody)
    {
        var senderEmail = _configuration["EmailSettings:SenderEmail"]?.Trim();
        var senderName = _configuration["EmailSettings:SenderName"]?.Trim() ?? "Cà Phê Fiin";
        var appPassword = _configuration["EmailSettings:AppPassword"]?.Trim();
        var smtpHost = _configuration["EmailSettings:SmtpHost"]?.Trim() ?? "smtp.gmail.com";
        var smtpPort = int.TryParse(_configuration["EmailSettings:SmtpPort"], out var p) ? p : 587;
        var enableSsl = !bool.TryParse(_configuration["EmailSettings:EnableSsl"], out var ssl) || ssl;

        if (string.IsNullOrWhiteSpace(senderEmail) || string.IsNullOrWhiteSpace(appPassword))
        {
            _logger.LogWarning(
                "[DEV EMAIL FALLBACK] Chưa cấu hình EmailSettings:AppPassword. Bỏ qua gửi SMTP tới {Email}. Tiêu đề: {Subject}",
                toEmail,
                subject);
            return false;
        }

        using var message = new MailMessage
        {
            From = new MailAddress(senderEmail, senderName),
            Subject = subject,
            Body = htmlBody,
            IsBodyHtml = true,
        };
        message.To.Add(new MailAddress(toEmail));

        using var client = new SmtpClient(smtpHost, smtpPort)
        {
            EnableSsl = enableSsl,
            Credentials = new NetworkCredential(senderEmail, appPassword),
        };

        await client.SendMailAsync(message);
        return true;
    }
}
