const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('kioskAPI', {
    close: () => ipcRenderer.send('close-kiosk')
});
