# publish.ps1 - Script de publication pour Nexus Hub
# Usage: .\publish.ps1

Write-Host "=== Nexus Hub - Publication ===" -ForegroundColor Cyan

# Charge le token depuis .env
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "GH_TOKEN=(\S+)") {
        $env:GH_TOKEN = $matches[1]
        Write-Host "[OK] Token GitHub charge depuis .env" -ForegroundColor Green
    } else {
        Write-Host "[ERREUR] Token non trouve dans .env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[ERREUR] Fichier .env introuvable" -ForegroundColor Red
    exit 1
}

# Affiche la version actuelle
$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Host "Version actuelle: $($packageJson.version)" -ForegroundColor Yellow

# Build et publie
Write-Host ""
Write-Host "Lancement du build..." -ForegroundColor Cyan
npm run build -- --publish always

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[OK] Publication reussie!" -ForegroundColor Green
    Write-Host "La release v$($packageJson.version) est disponible sur GitHub Releases" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[ERREUR] Erreur lors de la publication" -ForegroundColor Red
}
