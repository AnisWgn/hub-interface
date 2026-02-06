const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const fs = require('fs');

// Auto-update (optionnel : ne pas crasher si le module n'est pas bundlé)
let autoUpdater = null;
try {
    autoUpdater = require('electron-updater').autoUpdater;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
    console.warn('electron-updater non disponible, désactivation de l\'auto-update:', e.message);
}

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
            icon: path.join(app.getAppPath(), 'build', 'icon.ico'),
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
        if (autoUpdater) autoUpdater.checkForUpdatesAndNotify();
    });

    // Auto Updater Events
    if (autoUpdater) {
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
    }

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
        console.log(`Launching kiosk app: ${url}`);

        if (url) {
            const kioskWindow = new BrowserWindow({
                fullscreen: true,
                alwaysOnTop: false, // Let user alt-tab if needed, or set true for strict kiosk
                frame: false,
                webPreferences: {
                    nodeIntegration: false,
                    contextIsolation: true,
                    preload: path.join(__dirname, 'kiosk-preload.js')
                }
            });

            // Handle new windows (popups) by blocking them or opening in same window
            kioskWindow.webContents.setWindowOpenHandler(() => {
                return { action: 'deny' };
            });

            kioskWindow.loadURL(url);

            // Inject Back Button
            kioskWindow.webContents.on('dom-ready', () => {
                const css = `
                    #nexus-kiosk-back-btn {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 2147483647; /* Max Z-Index */
                        background: rgba(255, 0, 0, 0.8);
                        color: white;
                        border: 2px solid white;
                        border-radius: 50px;
                        padding: 10px 20px;
                        font-family: sans-serif;
                        font-weight: bold;
                        font-size: 16px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                        transition: transform 0.2s, background 0.2s;
                        text-decoration: none;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    #nexus-kiosk-back-btn:hover {
                        transform: scale(1.05);
                        background: rgba(255, 0, 0, 1);
                    }
                `;
                kioskWindow.webContents.insertCSS(css);

                const js = `
                    const btn = document.createElement('button');
                    btn.id = 'nexus-kiosk-back-btn';
                    btn.innerHTML = '<span>❌</span> Retour au Hub';
                    btn.onclick = () => {
                        window.kioskAPI.close();
                    };
                    document.body.appendChild(btn);
                `;
                kioskWindow.webContents.executeJavaScript(js);
            });
        }
    });

    ipcMain.on('close-kiosk', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (win) {
            win.close();
        }
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
    ipcMain.on('open-external-link', (event, link) => {
        if (link) {
            console.log(`Opening link: ${link}`);
            // Check if it's a local file path or URL
            if (link.startsWith('http') || link.startsWith('https')) {
                shell.openExternal(link).catch(err => console.error('Error opening external link:', err));
            } else {
                // Assume local path
                shell.openPath(link).then(err => {
                    if (err) console.error('Error opening path:', err);
                });
            }
        }
    });

    ipcMain.handle('show-open-dialog', async (event, filters) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: filters
        });
        return result;
    });
}
