'use strict';

/**
 * CeBasic Agent — app de escritorio (Mac y Windows).
 * Es una ventana segura que carga el servidor de CeBasic Agent (LibreChat).
 * No guarda contraseñas: el login es el de CeBasic (OpenID Connect) dentro de la ventana.
 */

const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, Menu, shell, ipcMain, session, dialog } = require('electron');
const pkg = require('../package.json');

const APP_NAME = 'CeBasic Agent';
const isMac = process.platform === 'darwin';

// ---------- Configuración (userData/config.json) ----------

const configPath = () => path.join(app.getPath('userData'), 'config.json');

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  return next;
}

/** Prioridad: variable CEBASIC_AGENT_URL > config del usuario > valor por defecto del build. */
function serverUrl() {
  return (
    process.env.CEBASIC_AGENT_URL ||
    readConfig().serverUrl ||
    (pkg.cebasic && pkg.cebasic.defaultServerUrl) ||
    'http://localhost:3080'
  );
}

function normalizeUrl(raw) {
  const value = String(raw || '').trim();
  const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Solo http o https');
  return url.origin;
}

const originOf = (u) => {
  try {
    return new URL(u).origin;
  } catch {
    return '';
  }
};

const isHttp = (u) => /^https?:\/\//i.test(u);
const sameOrigin = (a, b) => {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
};

// ---------- Ventanas ----------

let mainWindow = null;
let settingsWindow = null;

function createMainWindow() {
  const bounds = readConfig().bounds || {};
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: bounds.width || 1280,
    height: bounds.height || 840,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      // El preload solo expone acciones que el proceso principal acepta desde páginas file:// locales.
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', () => {
    if (!mainWindow.isMaximized() && !mainWindow.isFullScreen()) {
      writeConfig({ bounds: mainWindow.getBounds() });
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const wc = mainWindow.webContents;

  // Ventanas nuevas (links con target=_blank): el servidor se queda en la app, lo demás al navegador.
  wc.setWindowOpenHandler(({ url }) => {
    if (sameOrigin(url, serverUrl())) {
      mainWindow.loadURL(url);
    } else if (isHttp(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navegación en la misma ventana: permitida para http(s) (el login OIDC redirige a otro dominio).
  wc.on('will-navigate', (event, url) => {
    if (!isHttp(url)) {
      event.preventDefault();
      if (/^mailto:|^tel:/i.test(url)) shell.openExternal(url);
    }
  });

  // Sin conexión con el servidor: página local con reintentar / cambiar servidor.
  wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = navegación cancelada (redirecciones)
    mainWindow.loadFile(path.join(__dirname, 'offline.html'), {
      query: { url: originOf(url) || serverUrl(), error: `${description} (${code})` },
    });
  });

  loadServer();
}

function loadServer() {
  if (mainWindow) mainWindow.loadURL(serverUrl());
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    title: 'Servidor de CeBasic Agent',
    width: 520,
    height: 280,
    resizable: false,
    minimizable: false,
    maximizable: false,
    parent: mainWindow || undefined,
    modal: Boolean(mainWindow) && !isMac,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ---------- IPC (solo desde las páginas locales) ----------

const isLocalPage = (event) => {
  try {
    return new URL(event.senderFrame.url).protocol === 'file:';
  } catch {
    return false;
  }
};

ipcMain.handle('settings:get', (event) => {
  if (!isLocalPage(event)) return null;
  return { serverUrl: serverUrl(), envOverride: Boolean(process.env.CEBASIC_AGENT_URL) };
});

ipcMain.handle('settings:save', (event, raw) => {
  if (!isLocalPage(event)) return { ok: false, error: 'No permitido' };
  try {
    const url = normalizeUrl(raw);
    writeConfig({ serverUrl: url });
    if (settingsWindow) settingsWindow.close();
    loadServer();
    return { ok: true, serverUrl: url };
  } catch {
    return { ok: false, error: 'URL inválida' };
  }
});

ipcMain.handle('app:retry', (event) => {
  if (isLocalPage(event)) loadServer();
});

ipcMain.handle('app:open-settings', (event) => {
  if (isLocalPage(event)) openSettings();
});

// ---------- Permisos ----------

function setupPermissions() {
  // Solo el servidor de CeBasic Agent puede pedir micrófono (dictado), notificaciones y portapapeles.
  const allowed = new Set(['media', 'notifications', 'clipboard-sanitized-write', 'fullscreen']);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    const origin = details.requestingUrl || wc.getURL();
    callback(allowed.has(permission) && sameOrigin(origin, serverUrl()));
  });
}

// ---------- Menú ----------

function buildMenu() {
  const template = [
    ...(isMac
      ? [
          {
            label: APP_NAME,
            submenu: [
              { role: 'about', label: `Acerca de ${APP_NAME}` },
              { type: 'separator' },
              { label: 'Servidor…', accelerator: 'Cmd+,', click: openSettings },
              { type: 'separator' },
              { role: 'hide', label: `Ocultar ${APP_NAME}` },
              { role: 'hideOthers', label: 'Ocultar otros' },
              { role: 'unhide', label: 'Mostrar todo' },
              { type: 'separator' },
              { role: 'quit', label: `Salir de ${APP_NAME}` },
            ],
          },
        ]
      : [
          {
            label: 'Archivo',
            submenu: [
              { label: 'Servidor…', accelerator: 'Ctrl+,', click: openSettings },
              { type: 'separator' },
              { role: 'quit', label: 'Salir' },
            ],
          },
        ]),
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'pasteAndMatchStyle', label: 'Pegar sin formato' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { label: 'Inicio', accelerator: 'CmdOrCtrl+Shift+H', click: loadServer },
        { role: 'reload', label: 'Recargar' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Tamaño real' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
        ...(app.isPackaged ? [] : [{ role: 'toggleDevTools', label: 'Herramientas de desarrollo' }]),
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac ? [{ type: 'separator' }, { role: 'front', label: 'Traer todo al frente' }] : [{ role: 'close', label: 'Cerrar' }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------- Ciclo de vida ----------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName(APP_NAME);
  app.setAboutPanelOptions({ applicationName: APP_NAME, applicationVersion: app.getVersion() });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    setupPermissions();
    buildMenu();
    createMainWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });

  process.on('uncaughtException', (err) => {
    dialog.showErrorBox(APP_NAME, String(err && err.message ? err.message : err));
  });
}
