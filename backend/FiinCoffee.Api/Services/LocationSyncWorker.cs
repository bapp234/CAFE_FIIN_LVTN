using System.Data;
using System.Text.Json;
using System.Threading.Channels;
using Dapper;
using Microsoft.Data.SqlClient;

namespace FiinCoffee.Api.Services;

public sealed class LocationSyncWorker : BackgroundService
{
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;
    private readonly ILogger<LocationSyncWorker> _logger;
    private readonly Channel<bool> _triggerChannel = Channel.CreateUnbounded<bool>();

    public LocationSyncWorker(
        IHttpClientFactory httpFactory,
        IConfiguration config,
        ILogger<LocationSyncWorker> logger)
    {
        _httpFactory = httpFactory;
        _config = config;
        _logger = logger;
    }

    public void TriggerSyncNow() => _triggerChannel.Writer.TryWrite(true);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var totalInterval = TimeSpan.FromDays(90);
        var maxDelayChunk = TimeSpan.FromDays(30); // Task.Delay tối đa ~49.7 ngày

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncFromSourceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Lỗi khi đồng bộ danh mục khu vực hành chính.");
            }

            var remaining = totalInterval;
            while (remaining > TimeSpan.Zero && !stoppingToken.IsCancellationRequested)
            {
                var chunk = remaining > maxDelayChunk ? maxDelayChunk : remaining;
                using var delayCts = CancellationTokenSource.CreateLinkedTokenSource(stoppingToken);
                var delayTask = Task.Delay(chunk, delayCts.Token);
                var triggerTask = _triggerChannel.Reader.ReadAsync(stoppingToken).AsTask();

                var completed = await Task.WhenAny(delayTask, triggerTask);
                delayCts.Cancel();

                if (completed == triggerTask)
                {
                    break;
                }

                remaining -= chunk;
            }
        }
    }

    private async Task SyncFromSourceAsync(CancellationToken ct)
    {
        var provincesUrl = _config["LocationSync:ProvincesUrl"];
        if (string.IsNullOrWhiteSpace(provincesUrl))
        {
            _logger.LogWarning("Chưa cấu hình LocationSync:ProvincesUrl.");
            return;
        }

        // Gọi ?depth=3 để lấy đầy đủ Tỉnh -> Quận/Huyện -> Phường/Xã và map ProvinceId cho từng Phường/Xã
        var treeUrl = provincesUrl.TrimEnd('/') + "/?depth=3";
        if (provincesUrl.Contains("/api/p", StringComparison.OrdinalIgnoreCase))
        {
            treeUrl = provincesUrl[..provincesUrl.IndexOf("/api/p", StringComparison.OrdinalIgnoreCase)] + "/api/?depth=3";
        }

        var client = _httpFactory.CreateClient();
        var rawJson = await client.GetStringAsync(treeUrl, ct);

        using var doc = JsonDocument.Parse(rawJson);
        var provincesList = new List<object>();
        var wardsList = new List<object>();

        foreach (var prov in doc.RootElement.EnumerateArray())
        {
            var provCode = prov.GetProperty("code").ToString();
            var provName = prov.GetProperty("name").GetString() ?? "";
            provincesList.Add(new { code = provCode, name = provName });

            if (!prov.TryGetProperty("districts", out var districts)) continue;
            foreach (var dist in districts.EnumerateArray())
            {
                var distName = dist.GetProperty("name").GetString() ?? "";
                if (!dist.TryGetProperty("wards", out var wards)) continue;
                foreach (var ward in wards.EnumerateArray())
                {
                    var wardCode = ward.GetProperty("code").ToString();
                    var wardName = ward.GetProperty("name").GetString() ?? "";
                    var fullWardName = string.IsNullOrWhiteSpace(distName)
                        ? wardName
                        : $"{wardName} ({distName})";
                    wardsList.Add(new { code = wardCode, province_code = provCode, name = fullWardName });
                }
            }
        }

        var provincesJson = JsonSerializer.Serialize(provincesList);
        var wardsJson = JsonSerializer.Serialize(wardsList);

        await using var conn = new SqlConnection(_config.GetConnectionString("DefaultConnection"));
        await conn.ExecuteAsync(
            "dbo.sp_ADDR_SyncLocations",
            new { ProvincesJson = provincesJson, WardsJson = wardsJson },
            commandType: CommandType.StoredProcedure);

        _logger.LogInformation("Đồng bộ danh mục khu vực hành chính thành công ({Provinces} tỉnh, {Wards} phường/xã).",
            provincesList.Count, wardsList.Count);
    }
}
