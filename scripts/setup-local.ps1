$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $Name"
  }
}

Write-Host "Setting up EduClawn for local use..."
Write-Host ""
& "$RootDir\scripts\doctor.ps1"
Write-Host ""

Require-Command node
Require-Command npm
Require-Command python
Require-Command uv

Write-Host "1/3 Syncing backend dependencies..."
Push-Location "$RootDir\backend"
uv sync
Pop-Location

Write-Host ""
Write-Host "2/3 Installing frontend dependencies..."
Push-Location "$RootDir\frontend"
npm install
Pop-Location

Write-Host ""
Write-Host "3/3 Installing desktop dependencies..."
Push-Location "$RootDir\desktop"
npm install
Pop-Location

Write-Host ""
Write-Host "Setup complete."
Write-Host "Next steps:"
Write-Host "  - Run Open-EduClawn.bat"
Write-Host "  - Or run scripts\start-desktop.ps1"
