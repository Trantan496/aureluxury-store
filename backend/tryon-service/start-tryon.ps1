$ErrorActionPreference = "Stop"

$ServiceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $ServiceDir ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    throw "Virtual environment not found at $VenvDir. Run setup-tryon.ps1 first."
}

$env:CUPY_CACHE_DIR = Join-Path $ServiceDir ".cupy_cache"
$Port = if ($env:TRYON_PORT) { $env:TRYON_PORT } else { "8001" }

Write-Host "Starting AUREL DM-VTON local inference server on http://127.0.0.1:$Port ..."
Set-Location $ServiceDir
& $VenvPython -m uvicorn app:app --host 127.0.0.1 --port $Port --workers 1
