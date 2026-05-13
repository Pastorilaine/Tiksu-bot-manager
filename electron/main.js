'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// ─── Auto-updater config ─────────────────────────────────────────────────────
autoUpdater.autoDownload    = false;  // ask user first
autoUpdater.autoInstallOnAppQuit = true;

const store = new Store();

// Map: botId -> { process, manualStop }
const botProcesses = new Map();
let mainWindow = null;

// Suppress GPU shader cache errors (Windows permission issue, harmless)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f0f1a',
    frame: false,
    icon: path.join(__dirname, '../tiksu_bots_trans.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Tiksu Bot Manager',
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('maximize',   () => sendToRenderer('win:maximize-change', true));
  mainWindow.on('unmaximize', () => sendToRenderer('win:maximize-change', false));

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
  botProcesses.set(botId, { process: proc, manualStop: false, moduleError: false });
  sendToRenderer('bot:status', { botId, status: 'online' });
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
    botProcesses.delete(botId);
  });

  proc.on('close', (code) => {
    const info = botProcesses.get(botId);
    const wasManual = info ? info.manualStop : false;
    const hadModuleError = info ? info.moduleError : false;
    botProcesses.delete(botId);

    // Refresh bot to get latest autoRestart value
    const freshBot = getBots().find((b) => b.id === botId);
    const willRestart = !wasManual && !hadModuleError && freshBot && freshBot.autoRestart && code !== 0;

    // Human-readable exit message
    let exitMsg;
    if (wasManual) {
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
      type: wasManual || code === 0 ? 'system' : 'error',
      ts: Date.now(),
    });

    // Don't auto-restart if missing module — it would loop forever
    if (willRestart) {
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
  const allowed = {};
  if (typeof updates.name        === 'string')  allowed.name        = updates.name.trim().slice(0, 100);
  if (updates.autoRestart === true || updates.autoRestart === false)
                                                allowed.autoRestart = updates.autoRestart;
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
    info.manualStop = true;
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
  autoUpdater.quitAndInstall();
});

ipcMain.handle('update:get-version', () => app.getVersion());

// ─── Window controls ──────────────────────────────────────────────────────────
ipcMain.handle('win:minimize',     () => mainWindow?.minimize());
ipcMain.handle('win:maximize',     () => { if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize(); });
ipcMain.handle('win:close',        () => mainWindow?.close());
ipcMain.handle('win:is-maximized', () => mainWindow?.isMaximized() ?? false);

autoUpdater.on('update-available', (info) => {
  sendToRenderer('update:available', { version: info.version, releaseNotes: info.releaseNotes ?? null });
});

autoUpdater.on('update-not-available', () => {
  sendToRenderer('update:not-available', {});
});

autoUpdater.on('download-progress', ({ percent }) => {
  sendToRenderer('update:progress', { percent: Math.round(percent) });
});

autoUpdater.on('update-downloaded', (info) => {
  sendToRenderer('update:downloaded', { version: info.version });
});

autoUpdater.on('error', (err) => {
  sendToRenderer('update:error', { message: err.message });
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  // Check for updates 5 s after start, then every hour (only in packaged app)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
    setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 60 * 60 * 1000);
  }
});

app.on('window-all-closed', () => {
  // Clean up all child processes before quitting
  for (const [, info] of botProcesses) {
    try { info.process.kill('SIGTERM'); } catch (_) {}
  }
  botProcesses.clear();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  for (const [, info] of botProcesses) {
    try { info.process.kill('SIGTERM'); } catch (_) {}
  }
});
