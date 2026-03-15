$RootDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Test-Command($Name) {
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    "{0,-4} {1,-10} {2}" -f "OK", $Name, $command.Source
  } else {
    "{0,-4} {1,-10} not found" -f "MISS", $Name
  }
}

Write-Host "EduClawn local environment check"
Write-Host "Workspace: $RootDir"
Write-Host ""

Test-Command node
Test-Command npm
Test-Command python
Test-Command uv

Write-Host ""
Write-Host "Packaged desktop app:"
if (Test-Path "$RootDir\desktop\release\win-unpacked\EduClawn.exe") {
  Write-Host "OK   Windows desktop app present"
} else {
  Write-Host "INFO Windows desktop app not found yet"
}
