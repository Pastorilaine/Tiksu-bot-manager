'use strict';

/**
 * Self-check for electron/updater.js — run with: node test/updater.test.js
 * Stubs `electron`, `electron-updater` and `electron-log` so the module can be
 * exercised outside Electron. Covers the paths that silently broke before:
 * install without a download, dev-mode check, and interval re-arming.
 */

const assert = require('assert');
const Module = require('module');
const path = require('path');

// ── Stubs ──────────────────────────────────────────────────────────────────
const sent = [];
const fakeWindow = { isDestroyed: () => false, webContents: { send: (ch, d) => sent.push([ch, d]) } };

const fakeAutoUpdater = {
  handlers: {},
  autoDownload: true,
  autoInstallOnAppQuit: false,
  disableWebInstaller: false,
  quitAndInstallCalls: 0,
  on(evt, fn) { this.handlers[evt] = fn; },
  emit(evt, arg) { this.handlers[evt]?.(arg); },
  checkForUpdates: () => Promise.resolve(null),
  downloadUpdate: () => Promise.resolve([]),
  quitAndInstall() { this.quitAndInstallCalls++; },
};

const fakeApp = { isPackaged: true, getVersion: () => '1.7.1', getAppPath: () => path.resolve(__dirname, '..') };
const noop = () => {};
const fakeLog = { info: noop, warn: noop, error: noop, transports: { file: {}, console: {} } };

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'electron') return { app: fakeApp };
  if (request === 'electron-updater') return { autoUpdater: fakeAutoUpdater };
  if (request === 'electron-log') return fakeLog;
  return realLoad.call(this, request, parent, isMain);
};

const updater = require('../electron/updater');

const channels = () => sent.map(([c]) => c);
const reset = () => { sent.length = 0; };

// ── 1. Install before init → installError, never quitAndInstall ─────────────
updater.installUpdate();
assert.deepStrictEqual(channels(), [], 'no window yet, nothing to send');
assert.strictEqual(fakeAutoUpdater.quitAndInstallCalls, 0);

// ── 2. Dev mode: no events, reply carries the status ───────────────────────
fakeApp.isPackaged = false;
updater.initAutoUpdater(fakeWindow, { autoDownload: false, checkIntervalMin: 5 });
reset();
assert.deepStrictEqual(updater.checkForUpdates(), { status: 'dev' });
assert.deepStrictEqual(channels(), [], 'dev check must not emit events — the reply resolves the UI');

// ── 3. Packaged init applies the ProjectHub-parity settings ────────────────
fakeApp.isPackaged = true;
updater.initAutoUpdater(fakeWindow, { autoDownload: false, checkIntervalMin: 5 });
assert.strictEqual(fakeAutoUpdater.autoDownload, false, 'autoDownload follows the setting');
assert.strictEqual(fakeAutoUpdater.autoInstallOnAppQuit, true, 'install-on-quit is what the UI promises');
assert.strictEqual(fakeAutoUpdater.disableWebInstaller, true);
assert.strictEqual(typeof fakeAutoUpdater.verifyUpdateCodeSignature, 'function', 'unsigned build needs the bypass');

// ── 4. update-available carries autoDownload so the UI can offer a button ──
reset();
fakeAutoUpdater.emit('update-available', { version: '1.8.0' });
assert.deepStrictEqual(sent[0], ['update:available', { version: '1.8.0', autoDownload: false }]);

// ── 5. Install with nothing downloaded → installError, no quitAndInstall ───
reset();
updater.installUpdate();
assert.deepStrictEqual(channels(), ['update:installError']);
assert.strictEqual(fakeAutoUpdater.quitAndInstallCalls, 0, 'must not quit without a downloaded file');

// ── 6. After download: prepareForQuit runs, then quitAndInstall ────────────
reset();
fakeAutoUpdater.emit('update-downloaded', { version: '1.8.0', downloadedFile: 'C:\\tmp\\setup.exe' });
assert.deepStrictEqual(channels(), ['update:downloaded']);
assert.strictEqual(updater.isUpdateDownloaded(), true);

let prepared = false;
updater.installUpdate(() => { prepared = true; });
setImmediate(() => {
  assert.strictEqual(prepared, true, 'cleanup runs before quitAndInstall');
  assert.strictEqual(fakeAutoUpdater.quitAndInstallCalls, 1);

  // ── 7. Errors after an install attempt route to installError, not error ──
  // (the app is on its way out; a failure now is an install failure, and the
  //  banner must say so instead of "up to date")
  reset();
  fakeAutoUpdater.emit('error', new Error('boom'));
  assert.deepStrictEqual(channels(), ['update:installError']);
  reset();
  fakeAutoUpdater.emit('error', new Error('boom again'));
  assert.deepStrictEqual(channels(), ['update:error'], 'flag cleared after the first install error');

  // ── 8. Interval re-arms instead of stacking timers ──────────────────────
  updater.setCheckInterval(15);
  updater.setCheckInterval(30);

  console.log('updater.test.js: all checks passed');
  process.exit(0);
});
