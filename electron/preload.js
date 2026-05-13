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
  readFile:     (filePath) => ipcRenderer.invoke('file:read', filePath),

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

  onUpdateAvailable:    (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:available',     h); return () => ipcRenderer.removeListener('update:available',     h); },
  onUpdateNotAvailable: (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:not-available', h); return () => ipcRenderer.removeListener('update:not-available', h); },
  onUpdateProgress:     (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:progress',      h); return () => ipcRenderer.removeListener('update:progress',      h); },
  onUpdateDownloaded:   (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:downloaded',    h); return () => ipcRenderer.removeListener('update:downloaded',    h); },
  onUpdateError:        (cb) => { const h = (_, d) => cb(d); ipcRenderer.on('update:error',         h); return () => ipcRenderer.removeListener('update:error',         h); },

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
});
