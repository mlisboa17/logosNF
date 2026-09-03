$ErrorActionPreference = "Stop"
$projectPath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectPath ".env"
$logPath = Join-Path $projectPath "logs\scheduled-sync.log"

$secretLine = Get-Content -LiteralPath $envPath | Where-Object { $_ -match '^CRON_SECRET=' } | Select-Object -First 1
if (-not $secretLine) { throw "CRON_SECRET não encontrado em .env" }
$secret = ($secretLine -replace '^CRON_SECRET=', '').Trim().Trim('"')
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $logPath) | Out-Null

try {
  $result = Invoke-RestMethod -Uri "http://127.0.0.1:4000/api/cron/sync-fiscal" -Headers @{ Authorization = "Bearer $secret" } -TimeoutSec 300
  "$(Get-Date -Format o) OK $($result | ConvertTo-Json -Compress -Depth 6)" | Add-Content -LiteralPath $logPath
} catch {
  "$(Get-Date -Format o) ERRO $($_.Exception.Message)" | Add-Content -LiteralPath $logPath
  throw
}
