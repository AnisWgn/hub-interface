# build-local.ps1 - Build local sans publication
# Usage: .\build-local.ps1

Write-Host "=== Nexus Hub - Build Local ===" -ForegroundColor Cyan

# Affiche la version actuelle
$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Host "Version actuelle: $($packageJson.version)" -ForegroundColor Yellow

# Build sans publier
Write-Host ""
Write-Host "Lancement du build (sans publication)..." -ForegroundColor Cyan
npm run build

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Build reussi!" -ForegroundColor Green
    Write-Host "Le fichier .exe se trouve dans: dist_build\Nexus Hub Setup $($packageJson.version).exe" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERREUR] Erreur lors du build" -ForegroundColor Red
}
