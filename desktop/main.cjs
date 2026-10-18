const { app, BrowserWindow, ipcMain, safeStorage, shell } = require('electron');
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createSessionStore } = require('./sessionStore.cjs');

let sessionStore;
let packagedUiServer;
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const isTrustedFrame = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(parsed.hostname);
  } catch {
    return false;
  }
};

const registerArchiveIpc = () => {
  const register = (channel, handler) => {
    ipcMain.handle(channel, async (event, ...args) => {
      if (event.senderFrame !== event.sender.mainFrame || !isTrustedFrame(event.senderFrame.url)) {
        throw new Error('Untrusted desktop app frame.');
      }
      return handler(...args);
    });
  };

  register('mgps:archives:list', () => sessionStore.list());
  register('mgps:archives:create', (name, classSetup) =>
    sessionStore.createPastSession(name, classSetup)
  );
  register('mgps:archives:create-snapshot', (name, payload, recordCount) =>
    sessionStore.createSnapshot(name, payload, recordCount)
  );
  register('mgps:archives:read', (id) => sessionStore.read(id));
  register('mgps:archives:save', (id, payload) => sessionStore.save(id, payload));
  register('mgps:archives:read-collection', (id, namespace) =>
    sessionStore.readCollection(id, namespace)
  );
  register('mgps:archives:save-collection', (id, namespace, value) =>
    sessionStore.saveCollection(id, namespace, value)
  );
  register('mgps:archives:get-active', () => sessionStore.getActiveSession());
  register('mgps:archives:set-active', (id) => sessionStore.setActiveSession(id));
  register('mgps:archives:rename', (id, name) => sessionStore.rename(id, name));
  register('mgps:archives:delete-draft', (id) => sessionStore.deleteDraft(id));
};

const servePackagedUi = async () => {
  const root = path.resolve(__dirname, '..', 'frontend', 'dist');
  packagedUiServer = createServer(async (request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    } catch {
      response.writeHead(400).end('Bad request');
      return;
    }

    const filePath = path.resolve(root, pathname === '/' ? './index.html' : `.${pathname}`);
    if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, 'index.html')) {
      response.writeHead(403).end('Forbidden');
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, {
        'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': path.basename(filePath) === 'index.html' ? 'no-store' : 'public, max-age=31536000, immutable',
      });
      response.end(body);
    } catch (error) {
      if (path.extname(pathname)) {
        response.writeHead(404).end('Not found');
        return;
      }
      try {
        const body = await readFile(path.join(root, 'index.html'));
        response.writeHead(200, {
          'Content-Type': contentTypes['.html'],
          'X-Content-Type-Options': 'nosniff',
          'Cache-Control': 'no-store',
        });
        response.end(body);
      } catch (indexError) {
        console.error('Unable to serve packaged Clerk UI:', indexError);
        response.writeHead(500).end('Application files are unavailable.');
      }
      if (error.code !== 'ENOENT') console.error('Packaged UI request failed:', error);
    }
  });
  await new Promise((resolve, reject) => {
    packagedUiServer.once('error', reject);
    packagedUiServer.listen(0, '127.0.0.1', resolve);
  });
  return packagedUiServer.address().port;
};

const createWindow = async () => {
  if (process.platform !== 'win32') {
    throw new Error('The MGPS Clerk desktop app is supported on Windows only.');
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable; local student data cannot be safely stored.');
  }

  sessionStore = createSessionStore({
    databasePath: path.join(app.getPath('userData'), 'session-archive.sqlite'),
    keyPath: path.join(app.getPath('userData'), 'archive-key.bin'),
    safeStorage,
  });

  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'school-logo.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedFrame(url)) event.preventDefault();
  });

  if (app.isPackaged) {
    const port = await servePackagedUi();
    await window.loadURL(`http://127.0.0.1:${port}`);
  } else {
    await window.loadURL(process.env.MGPS_DESKTOP_DEV_URL || 'http://127.0.0.1:5173');
  }
};

app.whenReady().then(() => {
  registerArchiveIpc();
  return createWindow();
}).catch((error) => {
  console.error('MGPS Clerk desktop startup failed:', error);
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  sessionStore?.close();
  packagedUiServer?.close();
});
