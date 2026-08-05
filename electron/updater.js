'use strict';

/**
 * Auto-updater module.
 * Checks GitHub Releases, downloads in the background, and notifies the
 * renderer when ready to install. Mirrors ProjectHub's src/main/updater.js.
 *
 * In dev this is a no-op unless DEV_UPDATER_ENABLED=true (then it reads
 * dev-app-update.yml from the project root).
 * Requires: package.json → build.publish → { provider: "github", owner, repo }
 *
 * Logs: %APPDATA%/Tiksu Bot Manager/logs/main.log (Windows)
 */

const { autoUpdater } = require('electron-updater');
const { app } = require('electron');
const path = require('path');
const log = require('electron-log');

let mainWindow = null;
let ready = false;           // true once init has run and the updater is live
let downloadedInfo = null;   // cached info after `update-downloaded` fires
let installStarted = false;  // true after the user clicks "Asenna"
let intervalTimer = null;
let downloadedCb = null;     // main.js hook (tray menu + notification)

log.transports.file.level = 'info';
log.transports.console.level = 'info';
autoUpdater.logger = log;

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

/**
 * @param {BrowserWindow} win
 * @param {{ autoDownload?: boolean, checkIntervalMin?: number,
 *           onDownloaded?: (info) => void }} opts
 */
function initAutoUpdater(win, opts = {}) {
  mainWindow = win;
  downloadedCb = opts.onDownloaded ?? null;

  const devOverride = process.env.DEV_UPDATER_ENABLED === 'true';
  const isDev = !app.isPackaged;

  log.info(`[updater] App version: ${app.getVersion()} | dev: ${isDev} | override: ${devOverride}`);

  if (isDev && !devOverride) {
    log.info('[updater] Dev mode — auto-updater disabled (set DEV_UPDATER_ENABLED=true to override)');
    return;
  }

  if (devOverride) {
    // In dev, getAppPath() is the project root — dev-app-update.yml sits there.
    autoUpdater.updateConfigPath = path.join(app.getAppPath(), 'dev-app-update.yml');
    log.info(`[updater] DEV_UPDATER_ENABLED — using ${autoUpdater.updateConfigPath}`);
  }

  ready = true;

  autoUpdater.autoDownload = opts.autoDownload !== false;
  // Install on quit is what the tray notification and banner promise.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.disableWebInstaller = true;
  // App is not code-signed — bypass the Windows Authenticode verification that
  // electron-updater runs against publisherName. Without this, the update fails
  // with "not digitally signed" even though the file downloaded correctly.
  autoUpdater.verifyUpdateCodeSignature = () => Promise.resolve(null);

  autoUpdater.on('checking-for-update', () => {
    log.info('[updater] Checking for update…');
    send('update:checking', {});
  });

  autoUpdater.on('update-available', (info) => {
    log.info(`[updater] Update available: ${info.version} (current: ${app.getVersion()})`);
    send('update:available', { version: info.version, autoDownload: autoUpdater.autoDownload });
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info(`[updater] App is up to date (latest on server: ${info?.version})`);
    send('update:notAvailable', {});
  });

  autoUpdater.on('download-progress', (progress) => {
    send('update:progress', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info(`[updater] Update downloaded: ${info.version} → ${info.downloadedFile}`);
    downloadedInfo = info;
    send('update:downloaded', { version: info.version });
    if (downloadedCb) {
      try { downloadedCb(info); } catch (err) { log.error('[updater] onDownloaded hook failed:', err?.message); }
    }
  });

  autoUpdater.on('error', (err) => {
    const msg = err?.message || String(err);
    log.error('[updater] Error:', msg, err?.stack);
    // If the user just clicked "install" and we hit an error, route it to the
    // install-error banner — NOT the generic check-failed one.
    if (installStarted) {
      send('update:installError', { message: msg });
      installStarted = false;
    } else {
      send('update:error', { message: msg });
    }
  });

  // First check 5 s after start, then on the configured interval
  setTimeout(() => runCheck(), 5000);
  setCheckInterval(opts.checkIntervalMin ?? 60);
}

function runCheck() {
  return autoUpdater.checkForUpdates().catch((err) => {
    log.error('[updater] checkForUpdates failed:', err?.message);
  });
}

/** Manual check from the renderer. Returns a status the UI can act on. */
function checkForUpdates() {
  if (!ready) {
    // No events are emitted in dev — the renderer resolves its spinner from this reply
    log.info('[updater] checkForUpdates called but updater not initialised (dev mode)');
    return { status: 'dev' };
  }
  runCheck();
  return { status: 'checking' };
}

/** Start downloading when autoDownload is off and the user opts in. */
function downloadUpdate() {
  if (!ready) return { ok: false, error: 'Päivittäjä ei ole käytössä (dev-tila?)' };
  autoUpdater.downloadUpdate().catch((err) => {
    log.error('[updater] downloadUpdate failed:', err?.message);
    send('update:error', { message: err?.message || 'Lataus epäonnistui' });
  });
  return { ok: true };
}

/**
 * Install the downloaded update: quits the app and relaunches after installing.
 * @param {() => void} [prepareForQuit] cleanup (tray, bot processes, …) run
 *   only once the install actually starts.
 */
function installUpdate(prepareForQuit) {
  if (!ready) {
    log.warn('[updater] installUpdate called but updater not initialised');
    send('update:installError', { message: 'Päivittäjä ei ole alustettu (dev-tila?)' });
    return;
  }
  if (!downloadedInfo) {
    log.warn('[updater] installUpdate called but no update has been downloaded yet');
    send('update:installError', { message: 'Päivitystä ei ole ladattu — odota latauksen valmistumista' });
    return;
  }

  installStarted = true;
  log.info(`[updater] Installing update ${downloadedInfo.version} from ${downloadedInfo.downloadedFile}`);

  // Defer one tick so the IPC reply is sent before we start quitting
  setImmediate(() => {
    try {
      if (typeof prepareForQuit === 'function') prepareForQuit();
      // isSilent=true → NSIS runs with /S, no wizard. isForceRunAfter=true → relaunch.
      autoUpdater.quitAndInstall(true, true);
    } catch (err) {
      log.error('[updater] quitAndInstall failed:', err?.message, err?.stack);
      installStarted = false;
      send('update:installError', { message: err?.message || 'Asennus epäonnistui' });
    }
  });
}

function setAutoDownload(value) {
  autoUpdater.autoDownload = value !== false;
}

/** Re-arm the periodic check so the setting applies without a restart. */
function setCheckInterval(minutes) {
  if (intervalTimer) clearInterval(intervalTimer);
  intervalTimer = null;
  if (!ready) return;
  const min = Number(minutes) > 0 ? Number(minutes) : 60;
  intervalTimer = setInterval(() => runCheck(), min * 60 * 1000);
  log.info(`[updater] Check interval set to ${min} min`);
}

function isUpdateDownloaded() {
  return downloadedInfo !== null;
}

module.exports = {
  initAutoUpdater,
  checkForUpdates,
  downloadUpdate,
  installUpdate,
  setAutoDownload,
  setCheckInterval,
  isUpdateDownloaded,
};
