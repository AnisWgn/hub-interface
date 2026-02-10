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

// Gestion des erreurs non capturées AVANT tout
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('Another instance is already running, quitting...');
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        console.log('Second instance detected, focusing main window...');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    // Gestion des erreurs de rendu
    app.on('render-process-gone', (event, webContents, details) => {
        console.error('Render process gone:', details);
    });

    app.on('child-process-gone', (event, details) => {
        console.error('Child process gone:', details);
    });

    // Gestion de la fermeture de toutes les fenêtres
    app.on('window-all-closed', () => {
        console.log('All windows closed');
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // Gestion de l'activation (macOS)
    app.on('activate', () => {
        console.log('App activated');
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    let mainWindow;

    function createWindow() {
        console.log('createWindow() called');
        console.log('app.getAppPath():', app.getAppPath());
        console.log('app.isPackaged:', app.isPackaged);
        
        // Chemin de l'icône
        let iconPath;
        if (app.isPackaged) {
            iconPath = path.join(process.resourcesPath, 'app', 'build', 'icon.ico');
            if (!fs.existsSync(iconPath)) {
                iconPath = path.join(__dirname, '..', '..', 'build', 'icon.ico');
            }
        } else {
            iconPath = path.join(app.getAppPath(), 'build', 'icon.ico');
        }
        console.log('Icon path:', iconPath, 'exists:', fs.existsSync(iconPath));
        
        mainWindow = new BrowserWindow({
            width: 1200,
            height: 800,
            icon: iconPath,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false, // For simplicity in this hub app
                // Optimisations performance
                enableRemoteModule: false,
                backgroundThrottling: false, // Garder l'app performante même en arrière-plan
                offscreen: false,
                // Sécurité : désactiver les fonctionnalités web dangereuses
                webSecurity: true,
                allowRunningInsecureContent: false,
            },
            frame: false,
            transparent: false,
            backgroundColor: '#313338', // Discord dark theme
            show: false,
            // Optimisations performance
            paintWhenInitiallyHidden: false,
            // Forcer l'affichage même si le contenu ne charge pas
            skipTaskbar: false,
            // Forcer l'affichage même si le contenu n'est pas prêt
            alwaysOnTop: false,
        });

        // Chemin qui fonctionne en dev (electron .) et en .exe packagé
        // Comme asar: false, les fichiers sont directement accessibles
        let htmlPath;
        if (app.isPackaged) {
            // En mode packagé, __dirname pointe vers resources/app/src/main
            htmlPath = path.join(__dirname, '..', 'renderer', 'index.html');
        } else {
            // En mode dev, app.getAppPath() pointe vers le dossier racine du projet
            htmlPath = path.join(app.getAppPath(), 'src', 'renderer', 'index.html');
        }
        console.log('Loading HTML from:', htmlPath);
        console.log('File exists:', fs.existsSync(htmlPath));
        console.log('__dirname:', __dirname);
        console.log('app.getAppPath():', app.getAppPath());
        
        // Vérifier que le fichier existe
        if (!fs.existsSync(htmlPath)) {
            console.error('ERROR: HTML file not found at:', htmlPath);
            dialog.showErrorBox(
                'Fichier manquant',
                `Le fichier index.html est introuvable à:\n${htmlPath}\n\nVérifiez que tous les fichiers sont présents.`
            );
            return;
        }

        mainWindow.loadFile(htmlPath).then(() => {
            console.log('HTML file loaded successfully');
        }).catch((error) => {
            console.error('Error loading HTML file:', error);
            // Afficher la fenêtre même en cas d'erreur
            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
            }
            dialog.showErrorBox(
                'Erreur de chargement',
                `Impossible de charger l'interface:\n${error.message}`
            );
        });

        mainWindow.once('ready-to-show', () => {
            console.log('Window ready to show');
            mainWindow.maximize();
            mainWindow.show();
            console.log('Hub Interface initialized successfully.');
            if (!app.isPackaged) {
                mainWindow.webContents.openDevTools();
            }
        });

        // Fallback: Afficher la fenêtre après 2 secondes même si ready-to-show ne s'est pas déclenché
        setTimeout(() => {
            if (mainWindow && !mainWindow.isVisible()) {
                console.warn('Fallback: Showing window after timeout (ready-to-show may not have fired)');
                mainWindow.show();
                mainWindow.maximize();
                if (!app.isPackaged) {
                    mainWindow.webContents.openDevTools();
                }
            }
        }, 2000);

        // Fallback supplémentaire après 5 secondes
        setTimeout(() => {
            if (mainWindow && !mainWindow.isVisible()) {
                console.error('CRITICAL: Window still not visible after 5 seconds, forcing show');
                mainWindow.show();
                mainWindow.focus();
                mainWindow.maximize();
            }
        }, 5000);

        // Gestion des erreurs de chargement
        mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
            console.error('Failed to load:', {
                errorCode,
                errorDescription,
                validatedURL
            });
            // Afficher la fenêtre même en cas d'erreur pour voir le message
            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
            }
            dialog.showErrorBox(
                'Erreur de chargement',
                `Code: ${errorCode}\nDescription: ${errorDescription}\nURL: ${validatedURL}`
            );
        });

        // Log quand le DOM est prêt
        mainWindow.webContents.on('dom-ready', () => {
            console.log('DOM ready - page loaded');
        });

        // Log les erreurs de rendu
        mainWindow.webContents.on('render-process-gone', (event, details) => {
            console.error('Render process gone:', details);
            if (mainWindow && !mainWindow.isVisible()) {
                mainWindow.show();
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

    // Auto Updater Events (doit être avant app.whenReady)
    if (autoUpdater) {
        autoUpdater.on('update-available', (info) => {
            console.log('Update available:', info.version);
            if (mainWindow) {
                mainWindow.webContents.send('update-status', { status: 'downloading', version: info.version });
            }
        });

        autoUpdater.on('update-downloaded', (info) => {
            console.log('Update downloaded:', info.version);
            if (mainWindow) {
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
            }
        });

        autoUpdater.on('error', (err) => {
            console.error('Auto-updater error:', err);
        });
    }

    // Initialisation de l'application
    app.whenReady().then(() => {
        console.log('Electron app ready, creating window...');
        createWindow();
        // Délayer la vérification des mises à jour pour ne pas bloquer l'affichage
        setTimeout(() => {
            if (autoUpdater) {
                try {
                    console.log('Checking for updates...');
                    autoUpdater.checkForUpdatesAndNotify();
                } catch (e) {
                    console.warn('Auto-updater error (non-blocking):', e.message);
                }
            }
        }, 2000); // Attendre 2 secondes après l'affichage de la fenêtre
    }).catch((error) => {
        console.error('Error in app.whenReady():', error);
        dialog.showErrorBox(
            'Erreur au démarrage',
            `Impossible de démarrer l'application:\n${error.message}`
        );
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
                    #nexus-kiosk-container {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        z-index: 2147483647;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        font-family: sans-serif;
                    }

                    #nexus-kiosk-toggle-btn {
                        background: rgba(0, 0, 0, 0.6);
                        color: white;
                        border: 2px solid white;
                        border-radius: 50%;
                        width: 32px;
                        height: 32px;
                        font-size: 14px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    }

                    #nexus-kiosk-toggle-btn:hover {
                        background: rgba(0, 0, 0, 0.8);
                        transform: scale(1.1);
                    }

                    #nexus-kiosk-close-btn {
                        background: rgba(220, 38, 38, 0.9);
                        color: white;
                        border: 2px solid white;
                        border-radius: 50px;
                        padding: 10px 20px;
                        font-weight: bold;
                        font-size: 16px;
                        cursor: pointer;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        white-space: nowrap;
                        overflow: hidden;
                        max-width: 200px;
                        opacity: 1;
                    }

                    #nexus-kiosk-close-btn:hover {
                        background: rgba(255, 0, 0, 1);
                        transform: scale(1.05);
                    }

                    /* Minimized State */
                    #nexus-kiosk-container.minimized #nexus-kiosk-close-btn {
                        max-width: 0;
                        padding: 0;
                        opacity: 0;
                        border-width: 0;
                        margin: 0;
                    }
                `;
                kioskWindow.webContents.insertCSS(css);

                const js = `
                    const container = document.createElement('div');
                    container.id = 'nexus-kiosk-container';
                    
                    // Toggle Button
                    const toggleBtn = document.createElement('button');
                    toggleBtn.id = 'nexus-kiosk-toggle-btn';
                    toggleBtn.innerHTML = '➖';
                    toggleBtn.title = 'Réduire/Agrandir';
                    
                    // Close Button
                    const closeBtn = document.createElement('button');
                    closeBtn.id = 'nexus-kiosk-close-btn';
                    closeBtn.innerHTML = '<span>❌</span> Retour au Hub';
                    closeBtn.onclick = () => window.kioskAPI.close();
                    
                    // Toggle Logic
                    toggleBtn.onclick = () => {
                        const isMinimized = container.classList.toggle('minimized');
                        toggleBtn.innerHTML = isMinimized ? '➕' : '➖';
                    };

                    container.appendChild(toggleBtn);
                    container.appendChild(closeBtn);
                    document.body.appendChild(container);
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

    // Handler pour copier une image dans le dossier assets/images
    ipcMain.handle('copy-image-to-assets', async (event, sourcePath) => {
        try {
            // Vérifier si le fichier source existe
            if (!fs.existsSync(sourcePath)) {
                throw new Error('Le fichier source n\'existe pas');
            }

            // Créer le dossier assets/images s'il n'existe pas
            const assetsDir = path.join(app.getPath('userData'), 'assets', 'images');
            if (!fs.existsSync(assetsDir)) {
                fs.mkdirSync(assetsDir, { recursive: true });
            }

            // Vérifier si le fichier est déjà dans le dossier assets
            // Si c'est le cas, on le retourne tel quel
            if (sourcePath.startsWith(assetsDir)) {
                return sourcePath;
            }

            // Générer un nom de fichier unique basé sur le timestamp et le nom original
            const ext = path.extname(sourcePath);
            const timestamp = Date.now();
            const randomSuffix = Math.random().toString(36).substring(2, 8);
            const fileName = `img_${timestamp}_${randomSuffix}${ext}`;
            const destPath = path.join(assetsDir, fileName);

            // Copier le fichier
            fs.copyFileSync(sourcePath, destPath);

            // Retourner le chemin absolu pour le stockage
            return destPath;
        } catch (error) {
            console.error('Error copying image to assets:', error);
            throw error;
        }
    });

    // Handler pour obtenir l'URL d'une image depuis le chemin stocké
    ipcMain.handle('get-image-url', async (event, imagePath) => {
        try {
            // Si c'est déjà une URL HTTP/HTTPS, on la retourne telle quelle
            if (imagePath && (imagePath.startsWith('http://') || imagePath.startsWith('https://'))) {
                return imagePath;
            }

            // Si c'est un chemin de fichier local, vérifier s'il existe
            if (imagePath && fs.existsSync(imagePath)) {
                // Convertir le chemin en URL file:// pour Electron
                return `file:///${imagePath.replace(/\\/g, '/')}`;
            }

            // Si le fichier n'existe pas, retourner null ou une image par défaut
            return null;
        } catch (error) {
            console.error('Error getting image URL:', error);
            return null;
        }
    });

    // Handler pour lire un fichier et le retourner comme buffer/base64 pour l'upload Firebase
    ipcMain.handle('read-file-for-upload', async (event, filePath) => {
        try {
            if (!fs.existsSync(filePath)) {
                throw new Error('Le fichier n\'existe pas');
            }

            // Lire le fichier comme buffer
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);
            const ext = path.extname(filePath);
            
            // Déterminer le type MIME
            let mimeType = 'image/jpeg';
            switch (ext.toLowerCase()) {
                case '.png':
                    mimeType = 'image/png';
                    break;
                case '.gif':
                    mimeType = 'image/gif';
                    break;
                case '.webp':
                    mimeType = 'image/webp';
                    break;
                case '.jpg':
                case '.jpeg':
                default:
                    mimeType = 'image/jpeg';
            }

            // Convertir le Buffer en base64 pour la sérialisation IPC
            const base64Data = fileBuffer.toString('base64');

            // Retourner les données nécessaires
            return {
                base64: base64Data,
                fileName: fileName,
                mimeType: mimeType,
                ext: ext
            };
        } catch (error) {
            console.error('Error reading file for upload:', error);
            throw error;
        }
    });

    // Handler pour vérifier si un chemin est un fichier local existant
    ipcMain.handle('check-local-file', async (event, filePath) => {
        try {
            if (!filePath || filePath.startsWith('http://') || filePath.startsWith('https://')) {
                return { isLocal: false, exists: false };
            }
            const exists = fs.existsSync(filePath);
            return { isLocal: true, exists: exists };
        } catch (error) {
            console.error('Error checking local file:', error);
            return { isLocal: false, exists: false };
        }
    });
}
