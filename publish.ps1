# publish.ps1 - Script de publication pour Nexus Hub
# Usage: .\publish.ps1

Write-Host "=== Nexus Hub - Publication ===" -ForegroundColor Cyan

# Charge le token depuis .env
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match "GH_TOKEN=(\S+)") {
        $env:GH_TOKEN = $matches[1]
        Write-Host "✓ Token GitHub chargé depuis .env" -ForegroundColor Green
    } else {
        Write-Host "✗ Token non trouvé dans .env" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✗ Fichier .env introuvable" -ForegroundColor Red
    exit 1
}

# Affiche la version actuelle
$packageJson = Get-Content "package.json" | ConvertFrom-Json
Write-Host "Version actuelle: $($packageJson.version)" -ForegroundColor Yellow

# Build et publie
Write-Host "`nLancement du build..." -ForegroundColor Cyan
npm run build -- --publish always

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Publication réussie!" -ForegroundColor Green
    Write-Host "La release v$($packageJson.version) est disponible sur GitHub Releases" -ForegroundColor Green
} else {
    Write-Host "`n✗ Erreur lors de la publication" -ForegroundColor Red
}
