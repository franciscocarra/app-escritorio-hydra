const { app, BrowserWindow, session } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Hydra Project - Medical Desktop",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  // ── Content Security Policy ──
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' https://cdn.jsdelivr.net https://unpkg.com; " +
          "style-src 'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com 'unsafe-inline'; " +
          "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
          "img-src 'self' data: https://*.supabase.co; " +
          "connect-src 'self' https://api.hydra.cl; " +
          "frame-ancestors 'none'"
        ]
      }
    });
  });

  // ── Disable DevTools in production ──
  if (app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && (input.key.toLowerCase() === 'i' || input.key.toLowerCase() === 'j' || input.key.toLowerCase() === 'c')) {
        event.preventDefault();
      }
    });
  }

  win.loadFile('Vista/login.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('web-contents-created', (_, contents) => {
  // ── Block external navigation ──
  contents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // ── Block new windows ──
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
});
