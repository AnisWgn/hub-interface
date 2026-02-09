@echo off
chcp 65001 >nul
title Nexus Hub Launcher (Mode Debug)
echo ========================================
echo   Nexus Hub - Mode Debug
echo ========================================
echo.

REM Vérifier si Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installé
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

echo [INFO] Répertoire actuel:
cd
echo.

echo [INFO] Vérification des fichiers...
if exist "src\main\main.js" (
    echo [OK] src\main\main.js trouvé
) else (
    echo [ERREUR] src\main\main.js introuvable
)

if exist "src\renderer\index.html" (
    echo [OK] src\renderer\index.html trouvé
) else (
    echo [ERREUR] src\renderer\index.html introuvable
)

if exist "node_modules" (
    echo [OK] node_modules trouvé
) else (
    echo [ATTENTION] node_modules introuvable - exécutez npm install
)

echo.
echo Lancement avec logs détaillés...
echo.

REM Lancer avec variables d'environnement de debug
set ELECTRON_ENABLE_LOGGING=1
set DEBUG=*
npx electron . --enable-logging

pause
