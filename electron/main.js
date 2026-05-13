'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// ─── Auto-updater config ─────────────────────────────────────────────────────
autoUpdater.autoInstallOnAppQuit = false;  // we handle this ourselves (silent mode)

const store = new Store();

// ─── Settings ────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  launchOnStartup:          false,
  minimizeToTrayOnClose:    true,
  startMinimized:           false,
  autoDownloadUpdates:      true,
  updateCheckIntervalMin:   60,   // minutes
  notificationsEnabled:     true,
  notifyOnBotOnline:        true,
  notifyOnBotCrash:         true,
  maxLogLines:              2000,
};

function getSettings() {
  return { ...DEFAULT_SETTINGS, ...store.get('settings', {}) };
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  store.set('settings', s);
  return s;
}

function applySettingLive(key, value) {
  if (key === 'launchOnStartup' || key === 'startMinimized') {
    const s = getSettings();
    app.setLoginItemSettings({
      openAtLogin: s.launchOnStartup,
      openAsHidden: s.startMinimized,
    });
  }
  if (key === 'autoDownloadUpdates') {
    autoUpdater.autoDownload = value;
  }
}

// Apply stored settings immediately (before windows are created)
{
  const s = getSettings();
  autoUpdater.autoDownload = s.autoDownloadUpdates;
}

// Map: botId -> { process, manualStop, isRestarting, moduleError }
const botProcesses = new Map();
let mainWindow = null;
let tray = null;
let updateReady = false;  // set to true when an update has been downloaded
app.isQuitting = false;

// Suppress GPU shader cache errors (Windows permission issue, harmless)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');

// ─── Window ──────────────────────────────────────────────────────────────────

function saveBounds() {
  if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tiksu_bots_trans.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Tiksu Bot Manager');
  const menu = Menu.buildFromTemplate([
    { label: 'Avaa hallintapaneeli', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
    { label: 'Lopeta (pysäyttää botit)', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function createWindow() {
  const savedBounds    = store.get('windowBounds', { width: 1280, height: 800 });
  const savedMaximized = store.get('windowMaximized', false);

  mainWindow = new BrowserWindow({
    ...savedBounds,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f0f1a',
    frame: false,
    icon: path.join(__dirname, '../assets/tiksu_bots_trans.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Tiksu Bot Manager',
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    if (savedMaximized) mainWindow.maximize();
    if (getSettings().startMinimized) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });
  mainWindow.on('maximize',   () => { store.set('windowMaximized', true);  sendToRenderer('win:maximize-change', true); });
  mainWindow.on('unmaximize', () => { store.set('windowMaximized', false); sendToRenderer('win:maximize-change', false); });
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move',   saveBounds);

  // Minimize to tray instead of closing (if setting is on)
  mainWindow.on('close', (event) => {
    if (!app.isQuitting && getSettings().minimizeToTrayOnClose) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Block any navigation away from the app (prevents renderer-initiated redirects)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = 'http://localhost:5173';
    if (!url.startsWith(devUrl) && !url.startsWith('file://')) {
      event.preventDefault();
    }
  });

  // Block new window / popup creation from renderer
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Dev: load from Vite dev server. Production: load built files.
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function getBots() {
  return store.get('bots', []);
}

function saveBots(bots) {
  store.set('bots', bots);
}

// ─── Venv detection ──────────────────────────────────────────────────────────

/**
 * Walk up the directory tree from `startDir` looking for a virtual
 * environment folder (venv / .venv / env / .env).  Returns the full path
 * to the Python executable inside the venv, or null if none is found.
 */
function findVenvPython(startDir) {
  const isWindows = process.platform === 'win32';
  const venvNames = ['venv', '.venv', 'env', '.env'];
  const pythonBin = isWindows ? path.join('Scripts', 'python.exe') : path.join('bin', 'python');

  let dir = startDir;
  // Walk at most 4 levels up
  for (let i = 0; i < 4; i++) {
    for (const name of venvNames) {
      const candidate = path.join(dir, name, pythonBin);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Common module → pip package name mapping ────────────────────────────────

const MODULE_TO_PIP = {
  discord:       'discord.py',
  nextcord:      'nextcord',
  disnake:       'disnake',
  interactions:  'discord-py-interactions',
  dotenv:        'python-dotenv',
  aiohttp:       'aiohttp',
  aiofiles:      'aiofiles',
  requests:      'requests',
  pymongo:       'pymongo',
  motor:         'motor',
  sqlalchemy:    'SQLAlchemy',
  PIL:           'Pillow',
  cv2:           'opencv-python',
  numpy:         'numpy',
  pandas:        'pandas',
  yaml:          'PyYAML',
  bs4:           'beautifulsoup4',
};

/**
 * Ensures a venv exists in `botDir`, then runs `python -m pip install <pkg>`.
 * Streams output back to the renderer log.  Returns true on success.
 */
async function autoInstallModule(botId, botDir, moduleName) {
  const isWindows = process.platform === 'win32';
  const pipPkg = MODULE_TO_PIP[moduleName] || moduleName;

  const log = (message, type = 'system') =>
    sendToRenderer('bot:log', { botId, message, type, ts: Date.now() });

  log(`🔧 Asennetaan paketti "${pipPkg}" automaattisesti...`);

  // ── 1. Create venv if it doesn't exist ────────────────────────────────────
  let venvPython = findVenvPython(botDir);

  if (!venvPython) {
    const venvDir = path.join(botDir, 'venv');
    const sysPython = isWindows ? 'python' : 'python3';
    log(`📦 Luodaan virtualenv: ${venvDir}`);

    const ok = await new Promise((resolve) => {
      const proc = spawn(sysPython, ['-m', 'venv', venvDir], { cwd: botDir });
      proc.stdout.on('data', (d) => log(d.toString()));
      proc.stderr.on('data', (d) => log(d.toString(), 'stderr'));
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });

    if (!ok) {
      log('✗ Virtualenvin luonti epäonnistui. Asenna paketti manuaalisesti.', 'error');
      return false;
    }

    venvPython = findVenvPython(botDir);
    if (!venvPython) {
      log('✗ Python-suoritustiedostoa ei löydy luodusta venvistä.', 'error');
      return false;
    }
    log('✓ Virtualenv luotu');
  }

  // ── 2. pip install via the venv Python ────────────────────────────────────
  log(`⬇ pip install ${pipPkg}`);
  const success = await new Promise((resolve) => {
    const proc = spawn(venvPython, ['-m', 'pip', 'install', '--upgrade', pipPkg], { cwd: botDir });
    proc.stdout.on('data', (d) => log(d.toString()));
    proc.stderr.on('data', (d) => log(d.toString(), 'stderr'));
    proc.on('close', (code) => resolve(code === 0));
    proc.on('error', () => resolve(false));
  });

  if (success) {
    log(`✓ Paketti "${pipPkg}" asennettu!`);
  } else {
    log(`✗ Paketin "${pipPkg}" asennus epäonnistui.`, 'error');
  }
  return success;
}

// ─── Bot process management ──────────────────────────────────────────────────

function startBotProcess(botId) {
  const bot = getBots().find((b) => b.id === botId);
  if (!bot) return { ok: false, error: 'Bottia ei löydy' };
  if (botProcesses.has(botId)) return { ok: false, error: 'Botti on jo käynnissä' };

  const isWindows = process.platform === 'win32';
  const botDir = path.dirname(bot.filePath);
  let cmd, args;

  if (bot.type === 'python') {
    // Prefer venv Python so that installed packages (discord.py etc.) are available
    const venvPython = findVenvPython(botDir);
    if (venvPython) {
      cmd = venvPython;
    } else {
      cmd = isWindows ? 'python' : 'python3';
    }
    args = [bot.filePath];
  } else {
    cmd = 'node';
    args = [bot.filePath];
  }

  // Merge environment variables
  const env = { ...process.env, ...(bot.envVars || {}) };
  const cwd = botDir;

  let proc;
  try {
    proc = spawn(cmd, args, { cwd, env });
  } catch (err) {
    return { ok: false, error: err.message };
  }

  const hasVenv = bot.type === 'python' && findVenvPython(botDir) !== null;
  const runtimeLabel = bot.type === 'python'
    ? (hasVenv ? 'Python (venv)' : 'Python')
    : 'Node.js';
  botProcesses.set(botId, { process: proc, manualStop: false, isRestarting: false, moduleError: false });
  sendToRenderer('bot:status', { botId, status: 'online' });
  const _s1 = getSettings();
  if (_s1.notificationsEnabled && _s1.notifyOnBotOnline) {
    try { new Notification({ title: 'Tiksu Bot Manager', body: `✅ ${bot.name} on nyt online` }).show(); } catch (_) {}
  }
  sendToRenderer('bot:log', {
    botId,
    message: `▶ Botti käynnistetty · ${runtimeLabel}`,
    type: 'system',
    ts: Date.now(),
  });

  proc.stdout.on('data', (data) => {
    sendToRenderer('bot:log', { botId, message: data.toString(), type: 'stdout', ts: Date.now() });
  });

  proc.stderr.on('data', (data) => {
    const msg = data.toString();
    sendToRenderer('bot:log', { botId, message: msg, type: 'stderr', ts: Date.now() });

    // Detect known fatal Discord errors that should NOT trigger auto-restart
    const fatalPatterns = [
      {
        re: /PrivilegedIntentsRequired/,
        tip: '⚠ Privileged Intents ei ole käytössä Discord Developer Portalissa.\n' +
             '   1. Avaa: https://discord.com/developers/applications/\n' +
             '   2. Valitse sovelluksesi → Bot\n' +
             '   3. Kytke päälle: "Server Members Intent" ja/tai "Message Content Intent"\n' +
             '   4. Tallenna ja käynnistä botti uudelleen.',
      },
      {
        re: /LoginFailure|Improper token|401/,
        tip: '⚠ Virheellinen tai vanhentunut Discord-token.\n' +
             '   Tarkista token: Discord Developer Portal → Bot → Reset Token',
      },
      {
        re: /aiohttp\.ClientConnectorError|Cannot connect to host/,
        tip: '⚠ Ei yhteyttä Discordiin. Tarkista internetyhteys.',
      },
    ];

    for (const { re, tip } of fatalPatterns) {
      if (re.test(msg)) {
        const procInfo = botProcesses.get(botId);
        if (procInfo) procInfo.moduleError = true;  // reuse flag to block auto-restart
        sendToRenderer('bot:log', { botId, message: `💡 ${tip}`, type: 'error', ts: Date.now() });
        break;
      }
    }

    // Detect missing Python module → auto-install then restart
    const moduleMatch = msg.match(/ModuleNotFoundError: No module named '(.+?)'/);
    if (moduleMatch) {
      // Mark so auto-restart (crash loop) is suppressed while we handle it
      const procInfo = botProcesses.get(botId);
      if (procInfo) procInfo.moduleError = true;

      // Use only the top-level package name (e.g. "discord.ext" → "discord")
      // Validate: only alphanumeric + underscore/hyphen, max 80 chars (prevents injection)
      const rawModule = moduleMatch[1].split('.')[0];
      const moduleName = /^[a-zA-Z0-9_-]{1,80}$/.test(rawModule) ? rawModule : null;
      if (!moduleName) return; // ignore suspicious module names

      // Run install after a short delay so the process has time to exit cleanly
      setTimeout(async () => {
        const success = await autoInstallModule(botId, path.dirname(bot.filePath), moduleName);
        if (success) {
          sendToRenderer('bot:log', {
            botId,
            message: '↻ Käynnistetään botti uudelleen asennuksen jälkeen...',
            type: 'system',
            ts: Date.now(),
          });
          setTimeout(() => startBotProcess(botId), 1000);
        }
      }, 1500);
    }
  });

  proc.on('error', (err) => {
    sendToRenderer('bot:log', { botId, message: `Virhe: ${err.message}`, type: 'error', ts: Date.now() });
    sendToRenderer('bot:status', { botId, status: 'error' });
    const _s2 = getSettings();
    if (_s2.notificationsEnabled && _s2.notifyOnBotCrash) {
      try { const nb = getBots().find(b => b.id === botId); new Notification({ title: 'Tiksu Bot Manager', body: `⚠ ${nb?.name ?? botId} kaatui` }).show(); } catch (_) {}
    }
    botProcesses.delete(botId);
  });

  proc.on('close', (code) => {
    const info = botProcesses.get(botId);
    const wasManual     = info ? info.manualStop   : false;
    const isRestarting  = info ? info.isRestarting : false;
    const hadModuleError = info ? info.moduleError : false;
    botProcesses.delete(botId);

    // Refresh bot to get latest autoRestart value
    const freshBot = getBots().find((b) => b.id === botId);
    const willRestart = !wasManual && !hadModuleError && freshBot && freshBot.autoRestart && code !== 0;

    // Human-readable exit message
    let exitMsg;
    if (isRestarting) {
      exitMsg = '↻ Käynnistetään uudelleen...';
    } else if (wasManual) {
      exitMsg = '■ Botti pysäytetty';
    } else if (code === 0) {
      exitMsg = '■ Botti sulkeutui normaalisti';
    } else if (willRestart) {
      exitMsg = `■ Botti kaatui — käynnistetään uudelleen 3 s kuluttua…`;
    } else {
      exitMsg = `■ Botti kaatui · tarkista lokit virheistä`;
    }

    sendToRenderer('bot:log', {
      botId,
      message: exitMsg,
      type: isRestarting || wasManual || code === 0 ? 'system' : 'error',
      ts: Date.now(),
    });

    if (isRestarting) {
      // Status stays 'restarting' (set by App.jsx); startBotProcess runs via setTimeout in restart IPC
    } else if (willRestart) {
      sendToRenderer('bot:status', { botId, status: 'restarting' });
      setTimeout(() => startBotProcess(botId), 3000);
    } else {
      sendToRenderer('bot:status', { botId, status: 'offline' });
    }
  });

  return { ok: true };
}

function stopBotProcess(botId) {
  const info = botProcesses.get(botId);
  if (!info) return { ok: false, error: 'Botti ei ole käynnissä' };

  info.manualStop = true;
  info.process.kill('SIGTERM');

  // Force kill after 5 s if process hasn't exited
  setTimeout(() => {
    try { info.process.kill('SIGKILL'); } catch (_) {}
  }, 5000);

  return { ok: true };
}

// ─── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('bot:list', () => getBots());

ipcMain.handle('bot:add', (_, data) => {
  // ── Input validation ───────────────────────────────────────────────────────
  const ALLOWED_TYPES = ['python', 'js'];
  const ALLOWED_EXTS  = ['.py', '.js', '.mjs', '.cjs', '.ts'];

  const name     = typeof data.name     === 'string' ? data.name.trim().slice(0, 100)   : '';
  const type     = ALLOWED_TYPES.includes(data.type) ? data.type                         : null;
  const filePath = typeof data.filePath === 'string' ? path.normalize(data.filePath)    : '';
  const ext      = path.extname(filePath).toLowerCase();

  if (!name)                           return { error: 'Nimi puuttuu' };
  if (!type)                           return { error: 'Virheellinen tyyppi' };
  if (!filePath)                       return { error: 'Tiedostopolku puuttuu' };
  if (!ALLOWED_EXTS.includes(ext))     return { error: 'Vain .py / .js -tiedostot sallittu' };
  if (!fs.existsSync(filePath))        return { error: 'Tiedostoa ei löydy: ' + filePath };

  // Sanitise envVars: only string key=value pairs
  const rawEnv = data.envVars && typeof data.envVars === 'object' ? data.envVars : {};
  const envVars = {};
  for (const [k, v] of Object.entries(rawEnv)) {
    if (typeof k === 'string' && typeof v === 'string' && k.trim()) {
      envVars[k.trim().slice(0, 256)] = v.slice(0, 4096);
    }
  }

  const bots = getBots();
  const newBot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    type,
    filePath,
    autoRestart: data.autoRestart === true || data.autoRestart === false ? data.autoRestart : true,
    autoStart:   data.autoStart   === true,
    envVars,
    createdAt: Date.now(),
  };
  bots.push(newBot);
  saveBots(bots);
  return newBot;
});

ipcMain.handle('bot:update', (_, { id, updates }) => {
  const bots = getBots();
  const idx = bots.findIndex((b) => b.id === id);
  if (idx === -1) return null;

  // Whitelist — renderer can only change these fields, nothing else
  const ALLOWED_TYPES = ['python', 'js'];
  const ALLOWED_EXTS  = ['.py', '.js', '.mjs', '.cjs', '.ts'];
  const allowed = {};
  if (typeof updates.name        === 'string')  allowed.name        = updates.name.trim().slice(0, 100);
  if (updates.autoRestart === true || updates.autoRestart === false)
                                                allowed.autoRestart = updates.autoRestart;
  if (updates.autoStart   === true || updates.autoStart   === false)
                                                allowed.autoStart   = updates.autoStart;
  if (ALLOWED_TYPES.includes(updates.type))     allowed.type        = updates.type;
  if (typeof updates.filePath === 'string') {
    const fp  = path.normalize(updates.filePath);
    const ext = path.extname(fp).toLowerCase();
    if (ALLOWED_EXTS.includes(ext) && fs.existsSync(fp)) allowed.filePath = fp;
  }
  if (updates.envVars && typeof updates.envVars === 'object') {
    const envVars = {};
    for (const [k, v] of Object.entries(updates.envVars)) {
      if (typeof k === 'string' && typeof v === 'string' && k.trim()) {
        envVars[k.trim().slice(0, 256)] = v.slice(0, 4096);
      }
    }
    allowed.envVars = envVars;
  }

  bots[idx] = { ...bots[idx], ...allowed };
  saveBots(bots);
  return bots[idx];
});

ipcMain.handle('bot:delete', (_, botId) => {
  if (botProcesses.has(botId)) stopBotProcess(botId);
  saveBots(getBots().filter((b) => b.id !== botId));
  return true;
});

ipcMain.handle('bot:start', (_, botId) => startBotProcess(botId));
ipcMain.handle('bot:stop', (_, botId) => stopBotProcess(botId));

ipcMain.handle('bot:restart', (_, botId) => {
  const info = botProcesses.get(botId);
  if (info) {
    info.manualStop  = true;
    info.isRestarting = true;
    info.process.kill('SIGTERM');
    setTimeout(() => startBotProcess(botId), 1500);
  } else {
    startBotProcess(botId);
  }
  return { ok: true };
});

ipcMain.handle('bot:status', (_, botId) =>
  botProcesses.has(botId) ? 'online' : 'offline'
);

ipcMain.handle('dialog:pick-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Valitse bottitiedosto',
    properties: ['openFile'],
    filters: [
      { name: 'Bot-tiedostot', extensions: ['py', 'js', 'ts'] },
      { name: 'Kaikki tiedostot', extensions: ['*'] },
    ],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('file:read', (_, filePath) => {
  try {
    if (typeof filePath !== 'string') return null;
    const normalized = path.normalize(filePath);
    const stat = fs.statSync(normalized);
    if (!stat.isFile() || stat.size > 65536) return null;
    return fs.readFileSync(normalized, 'utf8');
  } catch { return null; }
});

ipcMain.handle('dialog:pick-env', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Valitse .env-tiedosto',
    properties: ['openFile'],
    filters: [
      { name: '.env-tiedostot', extensions: ['env', 'txt'] },
      { name: 'Kaikki tiedostot', extensions: ['*'] },
    ],
  });
  if (result.canceled) return null;
  try {
    const stat = fs.statSync(result.filePaths[0]);
    if (!stat.isFile() || stat.size > 65536) return null;
    return { filePath: result.filePaths[0], content: fs.readFileSync(result.filePaths[0], 'utf8') };
  } catch { return null; }
});

// ─── Log export ──────────────────────────────────────────────────────────────

ipcMain.handle('logs:export', async (_, { botName, content }) => {
  if (typeof botName !== 'string' || typeof content !== 'string') return false;
  const safeName = botName.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 80) || 'lokit';
  const date = new Date().toISOString().slice(0, 10);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Tallenna lokit',
    defaultPath: `${safeName}-${date}.log`,
    filters: [
      { name: 'Log-tiedostot', extensions: ['log'] },
      { name: 'Tekstitiedostot', extensions: ['txt'] },
    ],
  });
  if (result.canceled || !result.filePath) return false;
  try { fs.writeFileSync(result.filePath, content, 'utf8'); return true; } catch { return false; }
});

// ─── Update IPC handlers ─────────────────────────────────────────────────────

ipcMain.handle('update:check', async () => {
  if (!app.isPackaged) return { status: 'dev' };  // skip in dev mode
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking', version: result?.updateInfo?.version ?? null };
  } catch (e) {
    return { status: 'error', message: e.message };
  }
});

ipcMain.handle('update:download', () => {
  autoUpdater.downloadUpdate();
  return true;
});

ipcMain.handle('update:install', () => {
  // isSilent=true: no installer UI, isForceRunAfter=true: relaunch app after install
  autoUpdater.quitAndInstall(true, true);
});

ipcMain.handle('update:get-version', () => app.getVersion());

// ─── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', () => getSettings());
ipcMain.handle('settings:set', (_, { key, value }) => {
  const updated = saveSetting(key, value);
  applySettingLive(key, value);
  return updated;
});

// ─── Window controls ──────────────────────────────────────────────────────────
ipcMain.handle('win:minimize',     () => mainWindow?.minimize());
ipcMain.handle('win:maximize',     () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('win:close',        () => mainWindow?.close());
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false);

autoUpdater.on('update-available', (info) => {
  // Download starts automatically — just notify renderer so it can show progress
  sendToRenderer('update:available', { version: info.version });
});

autoUpdater.on('update-not-available', () => {
  sendToRenderer('update:not-available', {});
});

autoUpdater.on('download-progress', ({ percent }) => {
  sendToRenderer('update:progress', { percent: Math.round(percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  updateReady = true;
  sendToRenderer('update:downloaded', { version: info.version });
  // Show tray notification so user knows even if window is hidden
  try {
    new Notification({
      title: 'Tiksu Bot Manager — Päivitys valmis',
      body: `Versio ${info.version} on ladattu. Asennuu automaattisesti kun suljet sovelluksen.`,
    }).show();
  } catch (_) {}
  // Add install option to tray menu
  if (tray) {
    const menu = Menu.buildFromTemplate([
      { label: 'Avaa hallintapaneeli', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
      { type: 'separator' },
      { label: `\u2b06 Asenna p\u00e4ivitys v${info.version} nyt`, click: () => { autoUpdater.quitAndInstall(true, true); } },
      { type: 'separator' },
      { label: 'Lopeta (pysäyttää botit)', click: () => { app.isQuitting = true; app.quit(); } },
    ]);
    tray.setContextMenu(menu);
  }
});

autoUpdater.on('error', (err) => {
  sendToRenderer('update:error', { message: err.message });
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  // Apply startup login-item setting
  const appSettings = getSettings();
  app.setLoginItemSettings({
    openAtLogin: appSettings.launchOnStartup,
    openAsHidden: appSettings.startMinimized,
  });

  // Auto-start bots that have autoStart enabled
  const autoStartBots = getBots().filter((b) => b.autoStart);
  if (autoStartBots.length > 0) {
    setTimeout(() => {
      for (const bot of autoStartBots) {
        if (!botProcesses.has(bot.id)) startBotProcess(bot.id);
      }
    }, 2500);
  }

  // Check for updates 5 s after start, then on the configured interval (only in packaged app)
  if (app.isPackaged) {
    const intervalMs = (getSettings().updateCheckIntervalMin || 60) * 60 * 1000;
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), intervalMs);
  }
});

app.on('window-all-closed', () => {
  // Only quit when explicitly requested (e.g. from tray menu)
  // Normally the window is just hidden, bots keep running.
  if (app.isQuitting && process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  for (const [, info] of botProcesses) {
    try { info.process.kill('SIGTERM'); } catch (_) {}
  }
  // If update downloaded, install silently on quit — no installer UI, app restarts automatically
  if (updateReady) {
    try { autoUpdater.quitAndInstall(true, true); } catch (_) {}
  }
});
