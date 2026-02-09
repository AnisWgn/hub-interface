@echo off
chcp 65001 >nul
title Nexus Hub Launcher
echo ========================================
echo   Lancement de Nexus Hub...
echo ========================================
echo.

REM Vérifier si Node.js est installé
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installé ou n'est pas dans le PATH
    echo Veuillez installer Node.js depuis https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Node.js détecté
node --version

REM Vérifier si node_modules existe
if not exist "node_modules" (
    echo.
    echo [ATTENTION] Les dépendances ne sont pas installées
    echo Installation des dépendances...
    echo.
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERREUR] Échec de l'installation des dépendances
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dépendances installées
    echo.
)

REM Vérifier si le fichier principal existe
if not exist "src\main\main.js" (
    echo [ERREUR] Le fichier src\main\main.js est introuvable
    pause
    exit /b 1
)

echo [OK] Fichiers vérifiés
echo.
echo Lancement de l'application...
echo.

REM Lancer Electron
npx electron .

REM Si l'application se ferme avec une erreur
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] L'application s'est fermée avec une erreur
    echo Code d'erreur: %ERRORLEVEL%
    echo.
    echo Vérifiez la console pour plus de détails
)

pause
