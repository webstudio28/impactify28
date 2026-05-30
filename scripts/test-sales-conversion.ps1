# API-only test for POST /api/track/conversion
# Usage:
#   $env:IMPACT28_BASE_URL = "http://localhost:3000"
#   $env:IMPACT28_WORKSPACE_ID = "your-profiles-uuid"
#   .\scripts\test-sales-conversion.ps1
#
# Optional:
#   $env:IMPACT28_ORDER_ID = "test-order-001"
#   $env:IMPACT28_ORDER_VALUE = "42.5"
#   $env:IMPACT28_CURRENCY = "BGN"
#   $env:IMPACT28_CAMPAIGN_TOKEN = "paste-cmp-token-from-results-page"

$baseUrl = if ($env:IMPACT28_BASE_URL) { $env:IMPACT28_BASE_URL.TrimEnd("/") } else { "http://localhost:3000" }
$workspaceId = $env:IMPACT28_WORKSPACE_ID
$orderId = if ($env:IMPACT28_ORDER_ID) { $env:IMPACT28_ORDER_ID } else { "test-order-$(Get-Date -Format 'yyyyMMdd-HHmmss')" }
$value = if ($env:IMPACT28_ORDER_VALUE) { [double]$env:IMPACT28_ORDER_VALUE } else { 42.5 }
$currency = if ($env:IMPACT28_CURRENCY) { $env:IMPACT28_CURRENCY } else { "BGN" }

if (-not $workspaceId) {
  Write-Host "Set IMPACT28_WORKSPACE_ID to your profiles.id (Supabase profiles table)." -ForegroundColor Red
  exit 1
}

$body = @{
  workspaceId = $workspaceId
  orderId     = $orderId
  value       = $value
  currency    = $currency
}

if ($env:IMPACT28_CAMPAIGN_TOKEN) {
  $body.campaignToken = $env:IMPACT28_CAMPAIGN_TOKEN
}

$json = $body | ConvertTo-Json -Compress
$url = "$baseUrl/api/track/conversion"

Write-Host "POST $url"
Write-Host "Body: $json"

try {
  $response = Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json" -Body $json
  Write-Host "Response:" ($response | ConvertTo-Json -Compress) -ForegroundColor Green
  Write-Host ""
  Write-Host "Verify in Supabase:"
  Write-Host "  SELECT * FROM campaign_sales_events WHERE order_id = '$orderId';"
} catch {
  Write-Host "Request failed: $_" -ForegroundColor Red
  exit 1
}
