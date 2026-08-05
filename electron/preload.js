'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Bot management ────────────────────────────────────────────────────────
  listBots:      ()               => ipcRenderer.invoke('bot:list'),
  addBot:        (data)           => ipcRenderer.invoke('bot:add', data),
  updateBot:     (id, updates)    => ipcRenderer.invoke('bot:update', { id, updates }),
  deleteBot:     (id)             => ipcRenderer.invoke('bot:delete', id),
  startBot:      (id)             => ipcRenderer.invoke('bot:start', id),
  stopBot:       (id)             => ipcRenderer.invoke('bot:stop', id),
  restartBot:    (id)             => ipcRenderer.invoke('bot:restart', id),
  getBotStatus:  (id)             => ipcRenderer.invoke('bot:status', id),

  // ── File dialog ───────────────────────────────────────────────────────────
  pickFile:     () => ipcRenderer.invoke('dialog:pick-file'),
  pickEnvFile:  () => ipcRenderer.invoke('dialog:pick-env'),
  // Reads the .env next to a bot script — main derives the path, not the renderer
  readBotEnv:   (botFilePath) => ipcRenderer.invoke('env:read-for-bot', botFilePath),
  exportLogs:   (opts) => ipcRenderer.invoke('logs:export', opts),

  // ── Events from main process ──────────────────────────────────────────────
  onBotStatus: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('bot:status', handler);
    return () => ipcRenderer.removeListener('bot:status', handler);
  },
  onBotLog: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('bot:log', handler);
    return () => ipcRenderer.removeListener('bot:log', handler);
  },

  // ── Auto-updater ──────────────────────────────────────────────────────────
  getVersion:       ()   => ipcRenderer.invoke('update:get-version'),
  checkForUpdate:   ()   => ipcRenderer.invoke('update:check'),
  downloadUpdate:   ()   => ipcRenderer.invoke('update:download'),
  installUpdate:    ()   => ipcRenderer.invoke('update:install'),

  onUpdateChecking:     (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:checking',     h); return () => ipcRenderer.removeListener('update:checking',     h); },
  onUpdateAvailable:    (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:available',    h); return () => ipcRenderer.removeListener('update:available',    h); },
  onUpdateNotAvailable: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:notAvailable', h); return () => ipcRenderer.removeListener('update:notAvailable', h); },
  onUpdateProgress:     (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:progress',     h); return () => ipcRenderer.removeListener('update:progress',     h); },
  onUpdateDownloaded:   (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:downloaded',   h); return () => ipcRenderer.removeListener('update:downloaded',   h); },
  onUpdateInstallError: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:installError', h); return () => ipcRenderer.removeListener('update:installError', h); },
  onUpdateError:        (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:error',        h); return () => ipcRenderer.removeListener('update:error',        h); },

  // ── Window controls ───────────────────────────────────────────────────────
  minimizeWindow:   () => ipcRenderer.invoke('win:minimize'),
  maximizeWindow:   () => ipcRenderer.invoke('win:maximize'),
  closeWindow:      () => ipcRenderer.invoke('win:close'),
  isMaximized:      () => ipcRenderer.invoke('win:is-maximized'),
  onMaximizeChange: (cb) => {
    const h = (_, v) => cb(v);
    ipcRenderer.on('win:maximize-change', h);
    return () => ipcRenderer.removeListener('win:maximize-change', h);
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  getSettings: ()              => ipcRenderer.invoke('settings:get'),
  setSetting:  (key, value)   => ipcRenderer.invoke('settings:set', { key, value }),

  // ── External ──────────────────────────────────────────────────────────────
  openExternal: (url)         => ipcRenderer.invoke('shell:open-external', url),
});
