$ErrorActionPreference = "Stop"

$ServiceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ServiceDir
$DmVtonDir = Join-Path $BackendDir "dm-vton"
$CheckpointsDir = Join-Path $DmVtonDir "checkpoints"
$VenvDir = Join-Path $ServiceDir ".venv"

$PythonExe = @(
    "D:\Scratch\tools\python-3.12.10\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "C:\Program Files\Python312\python.exe",
    "python"
) | Where-Object {
    if ($_ -eq "python") {
        $null -ne (Get-Command python -ErrorAction SilentlyContinue)
    } else {
        Test-Path $_
    }
} | Select-Object -First 1

if (-not $PythonExe) {
    throw "Python 3.12 was not found. Install Python 3.12 (e.g. winget install Python.Python.3.12) and re-run."
}

Write-Host "Using Python: $PythonExe"

if (-not (Test-Path $VenvDir)) {
    & $PythonExe -m venv $VenvDir
}

$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
& $VenvPython -m pip install --upgrade pip
& $VenvPython -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
& $VenvPython -m pip install -r (Join-Path $ServiceDir "requirements.txt")

New-Item -ItemType Directory -Force -Path $CheckpointsDir | Out-Null

$WarpPath = Join-Path $CheckpointsDir "dmvton_pf_warp.pt"
$GenPath = Join-Path $CheckpointsDir "dmvton_pf_gen.pt"

if (-not (Test-Path $WarpPath)) {
    Write-Host "Downloading dmvton_pf_warp.pt..."
    Invoke-WebRequest -Uri "https://github.com/KiseKloset/DM-VTON/releases/download/1.0.0/dmvton_pf_warp.pt" -OutFile $WarpPath
}
if (-not (Test-Path $GenPath)) {
    Write-Host "Downloading dmvton_pf_gen.pt..."
    Invoke-WebRequest -Uri "https://github.com/KiseKloset/DM-VTON/releases/download/1.0.0/dmvton_pf_gen.pt" -OutFile $GenPath
}

Write-Host "AUREL DM-VTON service setup complete."
