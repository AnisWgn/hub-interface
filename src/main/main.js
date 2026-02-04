const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Auto-update reactivated
const { autoUpdater } = require('electron-updater');
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Fix for "Unable to move the cache: Access Denied (0x5)"
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-gpu'); // Force software rendering if GPU cache fails
// En dev seulement : userData dans le dossier du projet. En .exe : laisser le défaut (AppData) pour éviter erreurs d'écriture.
if (!app.isPackaged) {
    app.setPath('userData', path.join(app.getAppPath(), 'data'));
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    let mainWindow;

    function createWindow() {
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false, // For simplicity in this hub app
            },
            frame: false, // Premium feel
            transparent: true,
            backgroundColor: '#00000000',
            show: false,
        });

        // Chemin qui fonctionne en dev (electron .) et en .exe packagé
        const htmlPath = path.join(app.getAppPath(), 'src', 'renderer', 'index.html');
        mainWindow.loadFile(htmlPath);
        mainWindow.once('ready-to-show', () => {
            mainWindow.maximize();
            mainWindow.show();
            console.log('Hub Interface initialized successfully.');
            if (!app.isPackaged) {
                mainWindow.webContents.openDevTools();
            }
        });

        mainWindow.on('enter-full-screen', () => {
            mainWindow.webContents.send('fullscreen-state', true);
        });

        mainWindow.on('leave-full-screen', () => {
            mainWindow.webContents.send('fullscreen-state', false);
        });

        mainWindow.on('maximize', () => {
            mainWindow.webContents.send('fullscreen-state', true);
        });

        mainWindow.on('unmaximize', () => {
            mainWindow.webContents.send('fullscreen-state', false);
        });

        mainWindow.on('closed', () => {
            mainWindow = null;
        });
    }

    app.whenReady().then(() => {
        createWindow();
        autoUpdater.checkForUpdatesAndNotify();
    });

    // Auto Updater Events
    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version);
        if (mainWindow) {
            mainWindow.webContents.send('update-status', { status: 'downloading', version: info.version });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version);
        dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'Mise à jour disponible',
            message: `La version ${info.version} a été téléchargée. L'application va redémarrer pour installer la mise à jour.`,
            buttons: ['Redémarrer maintenant', 'Plus tard']
        }).then((result) => {
            if (result.response === 0) {
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (err) => {
        console.error('Auto-updater error:', err);
    });

    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    ipcMain.on('launch-app', (event, url) => {
        console.log(`Launching app with URL: ${url}`);

        const tempUserData = path.join(app.getPath('temp'), `hub-kiosk-${Date.now()}`);
        const psScript = `
$url = "${url}"
$userData = "${tempUserData}"
$chromePath = "\${env:ProgramFiles(x86)}\\Google\\Chrome\\Application\\chrome.exe"
if (-not (Test-Path $chromePath)) {
    $chromePath = "\${env:ProgramFiles}\\Google\\Chrome\\Application\\chrome.exe"
}

$arguments = "--kiosk \`"$url\`" --user-data-dir=\`"$userData\`" --new-window --incognito --disable-pinch --overscroll-history-navigation=0 --disable-notifications --no-first-run --disable-features=TouchpadPinch --force-device-scale-factor=1"

if (Test-Path $chromePath) {
    Start-Process -FilePath $chromePath -ArgumentList $arguments
} else {
    Start-Process "msedge.exe" -ArgumentList "--kiosk $url --edge-kiosk-type=fullscreen --user-data-dir=$userData --inprivate"
}
  `;

        const tempPs1 = path.join(app.getPath('temp'), 'launcher.ps1');
        fs.writeFileSync(tempPs1, psScript);

        exec(`powershell.exe -ExecutionPolicy Bypass -File "${tempPs1}"`, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
        });
    });

    ipcMain.on('close-app', () => {
        app.exit(0); // Force exit to ensure process is killed
    });

    ipcMain.on('minimize-app', () => {
        mainWindow.minimize();
    });

    ipcMain.on('maximize-app', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    });
    ipcMain.on('open-guide', (event, guideUrl) => {
        if (guideUrl) {
            console.log(`Opening guide: ${guideUrl}`);
            shell.openExternal(guideUrl).catch(err => {
                console.error('Error opening guide:', err);
            });
        }
    });
}
