param(
    [Parameter(Mandatory = $true)]
    [string]$SqlFile,
    [string]$Server = "localhost",
    [string]$Database = "CoffeeShopDB"
)

if (-not (Test-Path $SqlFile)) {
    Write-Error "Không tìm thấy file SQL: $SqlFile"
    exit 1
}

# Luôn ép codepage UTF-8 (65001) cho cả console lẫn sqlcmd để không bao giờ lỗi font tiếng Việt NVARCHAR
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

sqlcmd -S $Server -E -d $Database -f 65001 -I -i $SqlFile -C
exit $LASTEXITCODE
