# Simple test script to call the /health endpoint and pretty-print the result
# Usage: .\test-health.ps1

$uri = 'http://127.0.0.1:8000/health'
try {
    $resp = Invoke-RestMethod -Uri $uri -UseBasicParsing -TimeoutSec 10
    $json = $resp | ConvertTo-Json -Depth 5
    Write-Host $json
} catch {
    Write-Host "Request failed: $($_.Exception.Message)"
}
