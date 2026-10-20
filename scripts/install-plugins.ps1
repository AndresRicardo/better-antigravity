<#
.SYNOPSIS
  Installs or links all plugins in this repository to the local Antigravity configuration directory.
#>

$RepoRoot = Split-Path -Parent $PSScriptRoot
$PluginsDir = Join-Path $RepoRoot "plugins"
$TargetConfigDir = [System.IO.Path]::Combine($env:USERPROFILE, ".gemini", "config", "plugins")

if (-not (Test-Path $TargetConfigDir)) {
    New-Item -ItemType Directory -Path $TargetConfigDir -Force | Out-Null
}

Write-Host "==> Installing Better Antigravity plugins into: $TargetConfigDir" -ForegroundColor Cyan

Get-ChildItem -Path $PluginsDir -Directory | ForEach-Object {
    $pluginName = $_.Name
    $sourcePath = $_.FullName
    $destPath = Join-Path $TargetConfigDir $pluginName

    Write-Host "  -> Installing [$pluginName]..." -NoNewline

    # Copy files
    if (Test-Path $destPath) {
        Remove-Item -Path $destPath -Recurse -Force -ErrorAction SilentlyContinue
    }
    Copy-Item -Path $sourcePath -Destination $destPath -Recurse -Force
    Write-Host " [OK]" -ForegroundColor Green
}

Write-Host "`nAll plugins have been successfully installed into Antigravity!" -ForegroundColor Green
Write-Host "Reload Antigravity or trigger your plugin from the interface."
