import { useState, useEffect, useCallback, useRef } from "react";
import { Bot, Plus, Activity, Server, AlertCircle, CheckCircle2, Download, RefreshCw, X, ChevronLeft, ChevronRight, Play, Square, RotateCw, Settings } from "lucide-react";
import BotCard from "./components/BotCard.jsx";
import AddBotModal from "./components/AddBotModal.jsx";
import LogPanel from "./components/LogPanel.jsx";
import EnvModal from "./components/EnvModal.jsx";
import TitleBar from "./components/TitleBar.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import SettingsModal from "./components/SettingsModal.jsx";
import { formatUptime } from "./hooks/useUptime.js";

export default function App() {
  const [bots, setBots]             = useState([]);
  const [statuses, setStatuses]     = useState({});
  const [uptimes, setUptimes]       = useState({});
  const [logs, setLogs]             = useState({});
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [showEnvModal, setShowEnvModal]   = useState(null);
  const [editBot, setEditBot]             = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [appSettings, setAppSettings]           = useState({ maxLogLines: 2000 });
  const maxLogLinesRef = useRef(2000);
  const logIdRef = useRef(0);

  useEffect(() => { maxLogLinesRef.current = appSettings.maxLogLines || 2000; }, [appSettings.maxLogLines]);

  // Update state machine: null → checking → notAvailable | dev | available →
  //                       downloading → ready | error | installError
  const [update, setUpdate] = useState(null);
  const [appVersion, setAppVersion] = useState('');
  const updTimer = useRef(null);

  const clearUpdTimer = useCallback(() => {
    if (updTimer.current) { clearTimeout(updTimer.current); updTimer.current = null; }
  }, []);
  const autoCloseUpdate = useCallback((ms) => {
    clearUpdTimer();
    updTimer.current = setTimeout(() => setUpdate(null), ms);
  }, [clearUpdTimer]);

  const loadBots = useCallback(async () => {
    const list = await window.api.listBots();
    setBots(list);
    const statusMap = {};
    for (const bot of list) statusMap[bot.id] = await window.api.getBotStatus(bot.id);
    setStatuses(statusMap);
  }, []);

  useEffect(() => {
    loadBots();
    window.api.getVersion?.().then((v) => setAppVersion(v));
    window.api.getSettings?.().then((s) => {
      if (s) {
        setAppSettings(s);
        if (s.theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
        else if (s.theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.removeAttribute('data-theme');
      }
    });

    const cleanStatus = window.api.onBotStatus(({ botId, status }) => {
      setStatuses((p) => ({ ...p, [botId]: status }));
      if (status === "online")
        setUptimes((p) => ({ ...p, [botId]: Date.now() }));
      else if (status === "offline" || status === "error")
        setUptimes((p) => { const n = { ...p }; delete n[botId]; return n; });
    });
    const cleanLog = window.api.onBotLog(({ botId, message, type, ts }) => {
      setLogs((p) => {
        const ex = p[botId] || [];
        const maxLines = maxLogLinesRef.current;
        const trimmed = maxLines > 0 && ex.length >= maxLines ? ex.slice(ex.length - maxLines + 1) : ex;
        // Stable id — the array is trimmed from the front, so indexes shift
        return { ...p, [botId]: [...trimmed, { id: ++logIdRef.current, message, type, ts }] };
      });
    });
    return () => { cleanStatus(); cleanLog(); };
  }, [loadBots]);

  useEffect(() => {
    const off = [
      window.api.onUpdateChecking?.(() => { setUpdate({ state: 'checking' }); autoCloseUpdate(12000); }),
      window.api.onUpdateNotAvailable?.(() => { setUpdate({ state: 'notAvailable' }); autoCloseUpdate(3000); }),
      // autoDownload off → stay on 'available' so the banner can offer a Lataa button
      window.api.onUpdateAvailable?.((d) => {
        clearUpdTimer();
        setUpdate({ state: d.autoDownload === false ? 'available' : 'downloading', version: d.version, percent: 0 });
      }),
      window.api.onUpdateProgress?.((d) => setUpdate((u) => (
        u?.state === 'ready' ? u : { ...u, state: 'downloading', percent: d.percent }
      ))),
      window.api.onUpdateDownloaded?.((d) => { clearUpdTimer(); setUpdate({ state: 'ready', version: d.version }); }),
      window.api.onUpdateInstallError?.((d) => { setUpdate({ state: 'installError', message: d?.message }); autoCloseUpdate(10000); }),
      window.api.onUpdateError?.((d) => { setUpdate({ state: 'error', message: d?.message }); autoCloseUpdate(8000); }),
    ];
    return () => { off.forEach((f) => f?.()); clearUpdTimer(); };
  }, [autoCloseUpdate, clearUpdTimer]);

  const handleAdd    = async (data) => { const b = await window.api.addBot(data); if (b?.error) { return b; } setBots((p) => [...p, b]); setStatuses((p) => ({ ...p, [b.id]: "offline" })); setShowAddModal(false); return b; };
  const handleEdit   = async (id, data) => { const b = await window.api.updateBot(id, data); if (!b) return null; setBots((p) => p.map((x) => x.id === id ? b : x)); setEditBot(null); return b; };
  const handleDelete = async (id)   => { await window.api.deleteBot(id); setBots((p) => p.filter((b) => b.id !== id)); if (selectedBotId === id) setSelectedBotId(null); setConfirmDelete(null); };
  const handleStart  = async (id)   => { setStatuses((p) => ({ ...p, [id]: "starting" }));   await window.api.startBot(id); };
  const handleStop   = async (id)   => { await window.api.stopBot(id); };
  const handleRestart= async (id)   => { setStatuses((p) => ({ ...p, [id]: "restarting" })); await window.api.restartBot(id); };
  const handleSaveEnv= async (id, envVars) => {
    try {
      await window.api.updateBot(id, { envVars });
      setBots((p) => p.map((b) => b.id === id ? { ...b, envVars } : b));
    } catch (err) {
      console.error('Ympäristömuuttujien tallennus epäonnistui:', err);
    } finally {
      setShowEnvModal(null);
    }
  };
  const handleStartAll = () => {
    bots.forEach((b) => {
      const s = statuses[b.id] || "offline";
      if (s !== "online" && s !== "starting" && s !== "restarting") handleStart(b.id);
    });
  };
  const handleStopAll = () => {
    bots.forEach((b) => { if (statuses[b.id] === "online") handleStop(b.id); });
  };
  const handleCheckUpdate = async () => {
    if (update?.state === 'checking' || update?.state === 'downloading') return;
    setUpdate({ state: 'checking' });
    autoCloseUpdate(12000);
    const res = await window.api.checkForUpdate?.();
    // Dev mode never emits updater events — resolve the spinner from the reply
    if (res?.status === 'dev') { setUpdate({ state: 'dev' }); autoCloseUpdate(3000); }
  };

  // A modal owns the keyboard while it is open — Ctrl+L must not wipe the log
  // from under a form the user is typing in.
  const modalOpen = showAddModal || showSettings || !!editBot || !!showEnvModal || !!confirmDelete;

  const runningCount = Object.values(statuses).filter((s) => s === "online").length;
  const errorCount   = Object.values(statuses).filter((s) => s === "error").length;
  const selectedBot  = bots.find((b) => b.id === selectedBotId) ?? null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-bg text-text">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside
        className={`flex flex-col shrink-0 bg-surface border-r border-line transition-all duration-200 overflow-hidden ${
          sidebarCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]"
        }`}
      >
        {/* Brand */}
        <div className="p-3.5 border-b border-line shrink-0">
          {!sidebarCollapsed && (
            <>
              {/* Logo + name */}
              <div className="flex items-center gap-2.5 mb-2.5">
                <div className="w-8 h-8 rounded-md bg-accent text-accent-fg flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-ui font-semibold text-text leading-tight">Tiksu Bot Manager</p>
                  <p className="text-meta text-subtle">IT-Veljekset Group</p>
                </div>
              </div>

              {/* Compact inline stats */}
              <div className="flex items-center mb-2.5 p-1.5 px-2.5 rounded-md bg-surface-2 border border-line">
                <SidebarStat icon={<Server className="w-3 h-3 text-subtle" />} value={bots.length} label="bottia" />
                <div className="w-[1px] h-3 bg-line shrink-0" />
                <SidebarStat icon={<Activity className="w-3 h-3 text-success" />} value={runningCount} label="online" />
                {errorCount > 0 && (
                  <>
                    <div className="w-[1px] h-3 bg-line shrink-0" />
                    <SidebarStat icon={<AlertCircle className="w-3 h-3 text-danger" />} value={errorCount} label={errorCount === 1 ? "virhe" : "virhettä"} />
                  </>
                )}
              </div>

              {/* Add bot button */}
              <button
                onClick={() => setShowAddModal(true)}
                className="btn btn-primary w-full"
              >
                <Plus className="w-4 h-4" /> Lisää botti
              </button>
            </>
          )}
        </div>

        {/* Bot list label + start/stop all */}
        {bots.length > 0 && !sidebarCollapsed && (
          <div className="px-4 py-2 flex items-center gap-1.5">
            <p className="text-section uppercase tracking-wider flex-1">
              Botit — {bots.length}
            </p>
            <button onClick={handleStartAll} title="Käynnistä kaikki" className="btn btn-sm btn-ghost text-success hover:bg-success/10">
              <Play className="w-3 h-3 fill-current" />
            </button>
            <button onClick={handleStopAll} title="Pysäytä kaikki" className="btn btn-sm btn-ghost text-danger hover:bg-danger/10">
              <Square className="w-3 h-3 fill-current" />
            </button>
          </div>
        )}

        {/* Bot list */}
        <div className={`flex-1 overflow-y-auto ${sidebarCollapsed ? "py-2" : "p-2 pb-3"}`}>
          {bots.length === 0 && !sidebarCollapsed ? (
            <div className="text-center pt-12 px-4 text-subtle">
              <Bot className="w-8 h-8 mx-auto mb-3 text-subtle/50" />
              <p className="text-ui font-medium text-muted mb-1">Ei botteja vielä</p>
              <p className="text-label text-subtle">Lisää ensimmäinen botti yllä olevalla napilla.</p>
            </div>
          ) : sidebarCollapsed ? (
            bots.map((bot) => {
              const s = statuses[bot.id] || "offline";
              const dotColor = s === "online" ? "bg-success" : s === "error" ? "bg-danger" : s === "restarting" || s === "starting" ? "bg-warn" : "bg-subtle";
              return (
                <button
                  key={bot.id}
                  onClick={() => { setSelectedBotId(bot.id); setSidebarCollapsed(false); }}
                  title={bot.name}
                  className={`w-14 h-10 flex items-center justify-center border-none bg-transparent cursor-pointer ${
                    selectedBotId === bot.id ? "bg-accent/15" : "hover:bg-surface-2"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                </button>
              );
            })
          ) : (
            bots.map((bot) => (
              <BotCard
                key={bot.id}
                bot={bot}
                status={statuses[bot.id] || "offline"}
                startedAt={uptimes[bot.id] ?? null}
                isSelected={selectedBotId === bot.id}
                onSelect={() => setSelectedBotId(bot.id)}
                onStart={() => handleStart(bot.id)}
                onStop={() => handleStop(bot.id)}
                onRestart={() => handleRestart(bot.id)}
                onDelete={() => setConfirmDelete(bot.id)}
                onEnv={() => setShowEnvModal(bot.id)}
                onEdit={() => setEditBot(bot)}
              />
            ))
          )}
        </div>

        {/* Sidebar footer */}
        <div className="p-2 border-t border-line flex items-center gap-1 shrink-0">
          {!sidebarCollapsed && (
            <span className="text-meta text-subtle flex-1 pl-1">
              {appVersion ? `v${appVersion}` : ''}
            </span>
          )}

          {!sidebarCollapsed && update?.state === 'downloading' && (
            <div className="flex-1 flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded bg-surface-2 overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${update.percent ?? 0}%` }} />
              </div>
              <span className="text-meta text-subtle whitespace-nowrap">{update.percent ?? 0}%</span>
            </div>
          )}

          {!sidebarCollapsed && update?.state !== 'downloading' && (
            <button
              onClick={handleCheckUpdate}
              disabled={update?.state === 'checking'}
              title={update?.state === 'checking' ? "Tarkistetaan…" : "Tarkista päivitykset"}
              className="btn btn-ghost btn-icon btn-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${update?.state === 'checking' ? "animate-spin" : ""}`} />
            </button>
          )}

          {!sidebarCollapsed && (
            <button onClick={() => setShowSettings(true)} title="Asetukset" className="btn btn-ghost btn-icon btn-sm">
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Laajenna sivupalkki" : "Pienennä sivupalkki"}
            className="btn btn-ghost btn-icon btn-sm mx-auto"
          >
            {sidebarCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col bg-bg">

        {/* Update banner — 'downloading' shows as a progress bar in the sidebar footer */}
        {update && update.state !== 'downloading' && (
          <UpdateBanner
            update={update}
            onInstall={() => window.api.installUpdate()}
            onDownload={() => window.api.downloadUpdate?.()}
            onDismiss={() => { clearUpdTimer(); setUpdate(null); }}
          />
        )}

        <div className="flex-1 overflow-hidden">
        {selectedBot ? (
          <LogPanel
            key={selectedBot.id}
            bot={selectedBot}
            status={statuses[selectedBot.id] || "offline"}
            startedAt={uptimes[selectedBot.id] ?? null}
            logs={logs[selectedBot.id] || []}
            shortcutsEnabled={!modalOpen}
            onStart={() => handleStart(selectedBot.id)}
            onStop={() => handleStop(selectedBot.id)}
            onRestart={() => handleRestart(selectedBot.id)}
            onClearLogs={() => setLogs((p) => ({ ...p, [selectedBot.id]: [] }))}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full select-none text-subtle p-6">
            <Bot className="w-12 h-12 mb-4 text-subtle/40" />
            <p className="text-ui font-semibold text-muted mb-1">Valitse botti sivupalkista</p>
            <p className="text-label text-subtle">Nähdäksesi lokit ja hallitaksesi bottia</p>
            {bots.length > 0 && (
              <div className="mt-8 w-full max-w-2xl">
                <p className="text-section uppercase tracking-wider mb-3">Kaikki botit</p>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
                  {bots.map((b) => {
                    const s = statuses[b.id] || "offline";
                    const isBusy = s === "starting" || s === "restarting";
                    const dotColor = s === "online" ? "bg-success" : s === "error" ? "bg-danger" : isBusy ? "bg-warn" : "bg-subtle";
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBotId(b.id)}
                        className="card-interactive p-3 flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            <span className="text-ui font-medium text-text flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{b.name}</span>
                            <span className="chip text-meta font-medium px-1.5 py-0.5">
                              {b.type === "python" ? "PY" : "JS"}
                            </span>
                          </div>
                          <p className="text-label text-subtle mb-3 pl-4">
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </p>
                        </div>
                        <div className="flex gap-2 pl-4">
                          {s !== "online" && !isBusy ? (
                            <button
                              onClick={e => { e.stopPropagation(); handleStart(b.id); }}
                              className="btn btn-sm text-success border-success/30 bg-success/10 hover:bg-success/20"
                            >
                              <Play className="w-3 h-3 fill-current" /> Käynnistä
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); handleStop(b.id); }}
                              disabled={isBusy}
                              className="btn btn-sm btn-danger"
                            >
                              <Square className="w-3 h-3 fill-current" /> Pysäytä
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      </div>

      {showAddModal && <AddBotModal onAdd={handleAdd} onClose={() => setShowAddModal(false)} />}
      {editBot && <AddBotModal initialBot={editBot} onAdd={handleAdd} onEdit={(data) => handleEdit(editBot.id, data)} onClose={() => setEditBot(null)} />}
      {showEnvModal && (
        <EnvModal
          key={showEnvModal}
          bot={bots.find((b) => b.id === showEnvModal)}
          onSave={(env) => handleSaveEnv(showEnvModal, env)}
          onClose={() => setShowEnvModal(null)}
        />
      )}
      {confirmDelete && (
        <ConfirmModal
          title="Poista botti"
          message={`Haluatko varmasti poistaa "${bots.find(b => b.id === confirmDelete)?.name ?? ''}"? Tätä toimintoa ei voi peruuttaa.`}
          dangerLabel="Poista pysyvästi"
          onConfirm={() => handleDelete(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          appVersion={appVersion}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SidebarStat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1 text-label flex-1 justify-center">
      {icon}
      <span className="font-semibold text-text">{value}</span>
      <span className="text-meta text-subtle">{label}</span>
    </div>
  );
}

const UPDATE_BANNER = {
  checking:     { tone: 'accent',  icon: RefreshCw,  text: () => 'Tarkistetaan päivityksiä…' },
  notAvailable: { tone: 'success', icon: CheckCircle2, text: () => 'Sovellus on ajan tasalla' },
  dev:          { tone: 'accent',  icon: AlertCircle, text: () => 'Kehitystila — päivitykset eivät ole käytössä' },
  available:    { tone: 'accent',  icon: Download,   text: (u) => `Versio ${u.version} on saatavilla` },
  ready:        { tone: 'success', icon: Download,   text: (u) => `Versio ${u.version} ladattu — sulkemalla sovellus päivitys asennetaan automaattisesti` },
  installError: { tone: 'danger',  icon: AlertCircle, text: (u) => `Asennus epäonnistui${u.message ? `: ${u.message}` : ''}` },
  error:        { tone: 'danger',  icon: AlertCircle, text: (u) => `Päivityksen tarkistus epäonnistui${u.message ? `: ${u.message}` : ''}` },
};

const BANNER_TONE = {
  accent:  'bg-accent/10 border-accent/25 text-accent',
  success: 'bg-success/15 border-success/30 text-success',
  danger:  'bg-danger/10 border-danger/20 text-danger',
};

function UpdateBanner({ update, onInstall, onDownload, onDismiss }) {
  const cfg = UPDATE_BANNER[update.state];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div className={`flex items-center gap-3 px-5 py-2.5 border-b shrink-0 text-ui ${BANNER_TONE[cfg.tone]}`}>
      <Icon className={`w-4 h-4 shrink-0 ${update.state === 'checking' ? 'animate-spin' : ''}`} />
      <span className="flex-1">{cfg.text(update)}</span>

      {update.state === 'available' && (
        <button onClick={onDownload} className="btn btn-primary">Lataa nyt</button>
      )}
      {update.state === 'ready' && (
        <button onClick={onInstall} className="btn btn-primary bg-success text-accent-fg hover:brightness-110">
          Asenna nyt
        </button>
      )}

      <button onClick={onDismiss} className="btn btn-ghost btn-icon btn-sm">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

