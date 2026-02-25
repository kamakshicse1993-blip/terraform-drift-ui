Param(
    [int]$Port = 8080
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Push-Location $scriptDir

Write-Host "Starting PowerShell static server on port $Port"

$serve = Join-Path $scriptDir 'serve.ps1'
if (-not (Test-Path $serve)) {
    Write-Error "serve.ps1 not found in $scriptDir"
    Pop-Location
    exit 1
}

# Start the server in a new background PowerShell process
Start-Process -FilePath powershell -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$serve`" -Port $Port" -WindowStyle Hidden

# give the server a moment to start
Start-Sleep -Seconds 1

Write-Host "Opening http://localhost:$Port in the default browser"
Start-Process "http://localhost:$Port"

Pop-Location
