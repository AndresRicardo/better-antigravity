<#
.SYNOPSIS
  Cleans up the legacy D:\betterantigravity folder once Antigravity has opened D:\better-antigravity.
#>

$oldPath = "D:\betterantigravity"

if (Test-Path $oldPath) {
    try {
        Remove-Item -Path $oldPath -Recurse -Force -ErrorAction Stop
        Write-Host "Carpeta anterior '$oldPath' eliminada exitosamente." -ForegroundColor Green
    } catch {
        Write-Host "No se pudo eliminar '$oldPath' todavia porque sigue abierta en Antigravity." -ForegroundColor Yellow
        Write-Host "Asegurate de haber abierto la nueva carpeta 'D:\better-antigravity' en Antigravity (Archivo -> Abrir carpeta) y vuelve a ejecutar este script." -ForegroundColor Cyan
    }
} else {
    Write-Host "La carpeta '$oldPath' ya no existe." -ForegroundColor Green
}
