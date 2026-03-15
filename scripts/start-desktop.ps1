$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$PackagedExe = "$RootDir\desktop\release\win-unpacked\EduClawn.exe"

if (Test-Path $PackagedExe) {
  Write-Host "Opening packaged EduClawn desktop app..."
  Start-Process -FilePath $PackagedExe
  exit 0
}

if (-not (Test-Path "$RootDir\desktop\node_modules") -or -not (Test-Path "$RootDir\frontend\node_modules")) {
  throw "Dependencies are missing. Run scripts\setup-local.ps1 first."
}

Write-Host "Launching EduClawn desktop shell from source..."
Push-Location "$RootDir\desktop"
npm run dev
Pop-Location
