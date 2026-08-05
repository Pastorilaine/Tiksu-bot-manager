'use strict';

const { app, BrowserWindow, ipcMain, dialog, Menu, Tray, nativeImage, Notification, shell, nativeTheme, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const Store = require('electron-store');
const updater = require('./updater');
const { decryptBots, encryptBots } = require('./secrets');
const { nextRestart, MAX_RESTARTS } = require('./restart-policy');

const store = new Store();

// ─── Settings ────────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  theme:                    'system', // 'system' | 'dark' | 'light'
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

// Map: botId -> { process, manualStop, isRestarting, moduleError, startedAt }
const botProcesses = new Map();
// Map: botId -> consecutive auto-restarts, cleared by a manual start
const restartCounts = new Map();
let mainWindow = null;
let tray = null;
app.isQuitting = false;

const THEME_BACKGROUND = { light: '#F6F7F9', dark: '#0D0F12' };

function applyTheme(theme = 'system') {
  nativeTheme.themeSource = ['light', 'dark'].includes(theme) ? theme : 'system';
  const resolved = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setBackgroundColor(THEME_BACKGROUND[resolved]);
  }
}

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
  if (key === 'theme') {
    applyTheme(value);
  }
  if (key === 'launchOnStartup' || key === 'startMinimized') {
    const s = getSettings();
    app.setLoginItemSettings({
      openAtLogin: s.launchOnStartup,
      openAsHidden: s.startMinimized,
    });
  }
  if (key === 'autoDownloadUpdates') {
    updater.setAutoDownload(value);
  }
  if (key === 'updateCheckIntervalMin') {
    updater.setCheckInterval(value);
  }
}

// Apply stored settings immediately (before windows are created)
{
  applyTheme(getSettings().theme);
}


// Suppress GPU shader cache errors (Windows permission issue, harmless)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');

// ─── Window ──────────────────────────────────────────────────────────────────

function saveBounds() {
  if (mainWindow && !mainWindow.isMaximized() && !mainWindow.isMinimized()) {
    store.set('windowBounds', mainWindow.getBounds());
  }
}

function buildTrayMenu(updateVersion = null) {
  if (!tray || tray.isDestroyed()) return;
  const items = [
    { label: 'Avaa hallintapaneeli', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: 'separator' },
  ];
  if (updateVersion) {
    items.push(
      { label: `⬆ Asenna päivitys v${updateVersion} nyt`, click: () => installDownloadedUpdate() },
      { type: 'separator' },
    );
  }
  items.push({ label: 'Lopeta (pysäyttää botit)', click: () => { app.isQuitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function createTray() {
  const iconPath = path.join(__dirname, '../assets/tiksu_bots_trans.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Tiksu Bot Manager');
  buildTrayMenu();
  tray.on('double-click', () => { mainWindow?.show(); mainWindow?.focus(); });
}

function installDownloadedUpdate() {
  updater.installUpdate(() => {
    app.isQuitting = true;
    for (const [, info] of botProcesses) {
      try { info.process.kill('SIGTERM'); } catch (_) {}
      killTree(info.process);
    }
    if (tray && !tray.isDestroyed()) { tray.destroy(); tray = null; }
  });
}

function createWindow() {
  const { screen } = require('electron');
  const savedBounds    = store.get('windowBounds', { width: 1280, height: 800 });
  const savedMaximized = store.get('windowMaximized', false);
  const settings       = getSettings();
  const resolvedTheme  = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';

  // ── Validate saved bounds are on a visible display ────────────────────────
  let bounds = { ...savedBounds };
  const displays = screen.getAllDisplays();
  const isOnScreen = displays.some((d) => {
    const { x, y, width, height } = d.workArea;
    return (
      (bounds.x ?? 0) >= x - 100 &&
      (bounds.y ?? 0) >= y - 100 &&
      (bounds.x ?? 0) < x + width - 50 &&
      (bounds.y ?? 0) < y + height - 50
    );
  });
  if (!isOnScreen || bounds.x === undefined || bounds.y === undefined) {
    // Reset to centered on primary display
    const primary = screen.getPrimaryDisplay().workArea;
    bounds = {
      width:  Math.min(bounds.width  || 1280, primary.width),
      height: Math.min(bounds.height || 800,  primary.height),
      x: Math.round(primary.x + (primary.width  - (bounds.width  || 1280)) / 2),
      y: Math.round(primary.y + (primary.height - (bounds.height || 800))  / 2),
    };
    console.log('[main] Saved bounds off-screen, centering window');
  }

  console.log('[main] Creating window with bounds:', JSON.stringify(bounds));

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: THEME_BACKGROUND[resolvedTheme],
    frame: false,
    icon: path.join(__dirname, '../assets/tiksu_bots_trans.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    title: 'Tiksu Bot Manager',
    show: true,   // show immediately — no flicker risk worth blocking the window
  });

  console.log('[main] BrowserWindow created, show=true');

  if (savedMaximized) {
    mainWindow.maximize();
  }

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

  // Block any navigation away from the app (prevents renderer-initiated redirects).
  // The dev-server origin is only allowed while actually running from it.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = url.startsWith('file://') ||
      (!app.isPackaged && url.startsWith('http://127.0.0.1:5173'));
    if (!allowed) event.preventDefault();
  });

  // Block new window / popup creation from renderer
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // Dev: load from Vite dev server with retry. Production: load built files.
  if (!app.isPackaged) {
    let retryCount = 0;
    const MAX_RETRIES = 30;  // 15 seconds max wait
    const loadDevServer = () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.loadURL('http://127.0.0.1:5173').then(() => {
        console.log('[main] Vite dev server loaded successfully');
      }).catch(() => {
        retryCount++;
        if (retryCount <= MAX_RETRIES) {
          console.log(`[main] Vite not ready, retry ${retryCount}/${MAX_RETRIES}...`);
          setTimeout(loadDevServer, 500);
        } else {
          console.error('[main] Could not connect to Vite dev server after max retries');
        }
      });
    };
    loadDevServer();

    // Open DevTools in dev mode for easier debugging
    mainWindow.webContents.openDevTools({ mode: 'detach' });
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

// Env vars (Discord tokens) live encrypted on disk — see electron/secrets.js.
// Legacy plaintext entries are migrated the next time the list is written.
function getBots() {
  return decryptBots(safeStorage, store.get('bots', []));
}

function saveBots(bots) {
  store.set('bots', encryptBots(safeStorage, bots));
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

/**
 * @param {string} botId
 * @param {boolean} [isAutoRestart] true when called by the crash-restart chain;
 *   a manual start clears the restart budget.
 */
function startBotProcess(botId, isAutoRestart = false) {
  const bot = getBots().find((b) => b.id === botId);
  if (!bot) return { ok: false, error: 'Bottia ei löydy' };
  if (botProcesses.has(botId)) return { ok: false, error: 'Botti on jo käynnissä' };
  if (!isAutoRestart) restartCounts.delete(botId);

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
  botProcesses.set(botId, { process: proc, manualStop: false, isRestarting: false, moduleError: false, startedAt: Date.now() });
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
    const ranMs = info ? Date.now() - info.startedAt : 0;
    botProcesses.delete(botId);

    // Refresh bot to get latest autoRestart value
    const freshBot = getBots().find((b) => b.id === botId);
    const crashed = !wasManual && !hadModuleError && freshBot && freshBot.autoRestart && code !== 0;
    // Backoff + cap so a bot that dies on startup can't loop forever
    const policy = crashed
      ? nextRestart(restartCounts.get(botId) ?? 0, ranMs)
      : { restart: false, count: 0, delayMs: 0, attempt: 0 };

    let exitMsg;
    if (isRestarting) {
      exitMsg = '↻ Käynnistetään uudelleen...';
    } else if (wasManual) {
      exitMsg = '■ Botti pysäytetty';
    } else if (code === 0) {
      exitMsg = '■ Botti sulkeutui normaalisti';
    } else if (policy.restart) {
      exitMsg = `■ Botti kaatui — käynnistetään uudelleen ${Math.round(policy.delayMs / 1000)} s kuluttua (yritys ${policy.attempt}/${MAX_RESTARTS})`;
    } else if (crashed) {
      exitMsg = `■ Botti kaatui ${MAX_RESTARTS} kertaa peräkkäin — automaattinen uudelleenkäynnistys keskeytetty. Korjaa virhe ja käynnistä käsin.`;
    } else {
      exitMsg = '■ Botti kaatui · tarkista lokit virheistä';
    }

    sendToRenderer('bot:log', {
      botId,
      message: exitMsg,
      type: isRestarting || wasManual || code === 0 ? 'system' : 'error',
      ts: Date.now(),
    });

    if (isRestarting) {
      // Status stays 'restarting' (set by App.jsx); startBotProcess runs via setTimeout in restart IPC
    } else if (policy.restart) {
      restartCounts.set(botId, policy.count);
      sendToRenderer('bot:status', { botId, status: 'restarting' });
      setTimeout(() => startBotProcess(botId, true), policy.delayMs);
    } else {
      restartCounts.delete(botId);
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

  // Force kill after 5 s if the process hasn't exited. On Windows a bot that
  // spawned children (python -> subprocess) leaves them running when only the
  // direct child is killed, so take the whole tree with taskkill /T.
  setTimeout(() => killTree(info.process), 5000);

  return { ok: true };
}

function killTree(proc) {
  if (!proc || proc.exitCode !== null || proc.signalCode !== null) return;
  if (process.platform === 'win32') {
    try { spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F']); } catch (_) {}
  } else {
    // ponytail: kills the bot only. Grandchildren need detached:true + a process
    // group; add that if a bot ever spawns workers on Linux/macOS.
    try { proc.kill('SIGKILL'); } catch (_) {}
  }
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

// Reads the .env sitting next to a bot script. Main derives the path itself —
// the renderer cannot name an arbitrary file to read.
ipcMain.handle('env:read-for-bot', (_, botFilePath) => {
  try {
    if (typeof botFilePath !== 'string') return null;
    const envPath = path.join(path.dirname(path.normalize(botFilePath)), '.env');
    const stat = fs.statSync(envPath);
    if (!stat.isFile() || stat.size > 65536) return null;
    return fs.readFileSync(envPath, 'utf8');
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

ipcMain.handle('update:check',    () => updater.checkForUpdates());
ipcMain.handle('update:download', () => updater.downloadUpdate());

ipcMain.handle('update:install', () => installDownloadedUpdate());

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

// ─── Shell / External ─────────────────────────────────────────────────────────
ipcMain.handle('shell:open-external', (_, url) => {
  if (typeof url === 'string' && /^https?:\/\//i.test(url)) {
    return shell.openExternal(url);
  }
  return Promise.resolve(false);
});

// ─── App lifecycle ────────────────────────────────────────────────────────────

// The app launches at login and hides in the tray, so clicking the desktop icon
// would otherwise start a second manager: duplicate bot processes for the same
// bot and two writers on the same config.json. Hand the click to the running
// instance instead.
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // One-time migration: rewrite any legacy plaintext env vars encrypted.
  // Without this they would sit in config.json until the user edits a bot.
  try { saveBots(getBots()); } catch (err) { console.error('[main] Env migration failed:', err.message); }

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

  // Auto-updater (no-op in dev unless DEV_UPDATER_ENABLED=true)
  updater.initAutoUpdater(mainWindow, {
    autoDownload:     appSettings.autoDownloadUpdates,
    checkIntervalMin: appSettings.updateCheckIntervalMin,
    onDownloaded: (info) => {
      buildTrayMenu(info.version);
      try {
        new Notification({
          title: 'Tiksu Bot Manager — Päivitys valmis',
          body: `Versio ${info.version} on ladattu. Asennetaan automaattisesti kun suljet sovelluksen.`,
        }).show();
      } catch (_) {}
    },
  });
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
    killTree(info.process);  // don't orphan the bot's own children
  }
  // A downloaded update installs itself on quit — electron-updater handles it
  // via autoInstallOnAppQuit. Calling quitAndInstall() here would re-enter this
  // handler, so don't.
});
