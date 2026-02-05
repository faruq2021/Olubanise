# Test script to verify Render environment configuration

Write-Host "🔍 Testing Olubanise Orchestrator Configuration..." -ForegroundColor Cyan
Write-Host ""

$ORCHESTRATOR_URL = "https://olubanise-orchestrator.onrender.com"

Write-Host "1️⃣ Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$ORCHESTRATOR_URL/api/sessions/health" -Method Get
    Write-Host ($health | ConvertTo-Json) -ForegroundColor Green
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "2️⃣ Testing debug/config endpoint..." -ForegroundColor Yellow
try {
    $config = Invoke-RestMethod -Uri "$ORCHESTRATOR_URL/api/sessions/debug/config" -Method Get
    Write-Host ($config | ConvertTo-Json) -ForegroundColor Green
    
    if ($config.hasWorkerSecret -eq $false) {
        Write-Host "⚠️  WARNING: Worker__SharedSecret is NOT configured on Render!" -ForegroundColor Red
    } else {
        Write-Host "✅ Worker secret is configured (length: $($config.secretLength))" -ForegroundColor Green
    }
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
Write-Host ""

Write-Host "3️⃣ Testing authentication with correct secret..." -ForegroundColor Yellow
try {
    $headers = @{
        "Content-Type" = "application/json"
        "X-Worker-Secret" = "OlubaniseInternalSecureKey_2026"
    }
    $body = @{
        status = "connecting"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "$ORCHESTRATOR_URL/api/sessions/00000000-0000-0000-0000-000000000000/status" `
        -Method Post `
        -Headers $headers `
        -Body $body
    
    Write-Host "✅ Authentication successful! (HTTP 200)" -ForegroundColor Green
} catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    Write-Host "❌ Authentication failed! HTTP Status: $statusCode" -ForegroundColor Red
    
    if ($statusCode -eq 401) {
        Write-Host "   This means Worker__SharedSecret is NOT set correctly on Render!" -ForegroundColor Red
    }
}
Write-Host ""

Write-Host "📋 Summary:" -ForegroundColor Cyan
Write-Host "  Expected results:" -ForegroundColor White
Write-Host "    - Health: {'status':'healthy'}" -ForegroundColor Gray
Write-Host "    - Config: {'hasWorkerSecret':true,'secretLength':31}" -ForegroundColor Gray
Write-Host "    - Auth test: HTTP Status 200" -ForegroundColor Gray
Write-Host ""
Write-Host "  If you see 401 Unauthorized, go to Render and add:" -ForegroundColor White
Write-Host "    Worker__SharedSecret = OlubaniseInternalSecureKey_2026" -ForegroundColor Yellow
Write-Host "    (Note the double underscore __)" -ForegroundColor Yellow
