import { useState, useEffect, useCallback, useRef } from "react";
import { Bot, Plus, Activity, Server, AlertCircle, Download, RefreshCw, X, ChevronLeft, ChevronRight, Play, Square, RotateCw, Settings } from "lucide-react";
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
  const [editBot, setEditBot]             = useState(null);  // bot object to edit
  const [confirmDelete, setConfirmDelete] = useState(null); // bot id to delete
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings]         = useState(false);
  const [appSettings, setAppSettings]           = useState({ maxLogLines: 2000 });
  const maxLogLinesRef = useRef(2000);

  // keep ref in sync with settings so log handler always has the current value
  useEffect(() => { maxLogLinesRef.current = appSettings.maxLogLines || 2000; }, [appSettings.maxLogLines]);

  // ── Update state ──────────────────────────────────────────────────────────────
  // States: null | 'available' | 'downloading' | 'ready' | 'error'
  const [update, setUpdate] = useState(null);   // { state, version?, percent?, message? }
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);

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
    window.api.getSettings?.().then((s) => { if (s) setAppSettings(s); });

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
        return { ...p, [botId]: [...trimmed, { message, type, ts }] };
      });
    });
    return () => { cleanStatus(); cleanLog(); };
  }, [loadBots]);

  // ── Updater event listeners ──────────────────────────────────────────────────
  useEffect(() => {
    // update:available now means download has started automatically
    const a = window.api.onUpdateAvailable?.   ((d) => { setCheckingUpdate(false); setUpdate({ state: 'downloading', percent: 0, version: d.version }); });
    const b = window.api.onUpdateProgress?.    ((d) => setUpdate((u) => ({ ...u, state: 'downloading', percent: d.percent })));
    const c = window.api.onUpdateDownloaded?.  ((d) => setUpdate({ state: 'ready', version: d.version }));
    const nu = window.api.onUpdateNotAvailable?.(() => setCheckingUpdate(false));
    const e = window.api.onUpdateError?.       ((d) => { setCheckingUpdate(false); setUpdate({ state: 'error', message: d.message }); });
    return () => { a?.(); b?.(); c?.(); nu?.(); e?.(); };
  }, []);

  const handleAdd    = async (data) => { const b = await window.api.addBot(data); if (b?.error) { alert(b.error); return; } setBots((p) => [...p, b]); setStatuses((p) => ({ ...p, [b.id]: "offline" })); setShowAddModal(false); };
  const handleEdit   = async (id, data) => { const b = await window.api.updateBot(id, data); if (!b) return; setBots((p) => p.map((x) => x.id === id ? b : x)); setEditBot(null); };
  const handleDelete = async (id)   => { await window.api.deleteBot(id); setBots((p) => p.filter((b) => b.id !== id)); if (selectedBotId === id) setSelectedBotId(null); setConfirmDelete(null); };
  const handleStart  = async (id)   => { setStatuses((p) => ({ ...p, [id]: "starting" }));   await window.api.startBot(id); };
  const handleStop   = async (id)   => { await window.api.stopBot(id); };
  const handleRestart= async (id)   => { setStatuses((p) => ({ ...p, [id]: "restarting" })); await window.api.restartBot(id); };
  const handleSaveEnv= async (id, envVars) => { await window.api.updateBot(id, { envVars }); setBots((p) => p.map((b) => b.id === id ? { ...b, envVars } : b)); setShowEnvModal(null); };
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
    if (checkingUpdate || update?.state === 'downloading') return;
    setCheckingUpdate(true);
    await window.api.checkForUpdate?.();
  };

  const runningCount = Object.values(statuses).filter((s) => s === "online").length;
  const errorCount   = Object.values(statuses).filter((s) => s === "error").length;
  const selectedBot  = bots.find((b) => b.id === selectedBotId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: "#0b0b14", color: "#b5bac1" }}>
      <TitleBar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside style={{ width: sidebarCollapsed ? 48 : 260, flexShrink: 0, background: "#0d0d1a", borderRight: "1px solid #17172a", display: "flex", flexDirection: "column", transition: "width 0.2s ease", overflow: "hidden" }}>

        {/* Brand */}
        <div style={{ padding: "14px 14px 12px", borderBottom: "1px solid #17172a", flexShrink: 0 }}>
          {!sidebarCollapsed && (
            <>
              {/* Logo + name */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#5865F2 0%,#4752C4 100%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 8px rgba(88,101,242,0.3)" }}>
                  <Bot size={17} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#f2f3f5", margin: 0, lineHeight: 1.2 }}>Tiksu Bot Manager</p>
                  <p style={{ fontSize: 10, color: "#2a2a3a", margin: 0, marginTop: 1 }}>IT-Veljekset Group</p>
                </div>
              </div>

              {/* Compact inline stats */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: 10, padding: "6px 10px", borderRadius: 7, background: "rgba(255,255,255,0.02)", border: "1px solid #17172a" }}>
                <SidebarStat icon={<Server size={11} />} value={bots.length} label="bottia" />
                <div style={{ width: 1, height: 12, background: "#1e1e35", flexShrink: 0 }} />
                <SidebarStat icon={<Activity size={11} />} value={runningCount} label="online" color={runningCount > 0 ? "#3ba55d" : undefined} />
                {errorCount > 0 && (
                  <>
                    <div style={{ width: 1, height: 12, background: "#1e1e35", flexShrink: 0 }} />
                    <SidebarStat icon={<AlertCircle size={11} />} value={errorCount} label={errorCount === 1 ? "virhe" : "virhettä"} color="#ed4245" />
                  </>
                )}
              </div>

              {/* Add bot button */}
              <button onClick={() => setShowAddModal(true)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#5865F2", color: "#fff", border: "none", cursor: "pointer", transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "#4752C4"}
                onMouseLeave={e => e.currentTarget.style.background = "#5865F2"}
              >
                <Plus size={14} /> Lisää botti
              </button>
            </>
          )}
        </div>

        {/* Bot list label + start/stop all */}
        {bots.length > 0 && !sidebarCollapsed && (
          <div style={{ padding: "10px 16px 4px", display: "flex", alignItems: "center", gap: 6 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#4a4a62", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0, flex: 1 }}>
              Botit — {bots.length}
            </p>
            <button onClick={handleStartAll} title="Käynnistä kaikki"
              style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(59,165,93,0.3)", background: "rgba(59,165,93,0.08)", color: "#3ba55d", cursor: "pointer", fontSize: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(59,165,93,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(59,165,93,0.08)"}
            ><Play size={9} fill="#3ba55d" /></button>
            <button onClick={handleStopAll} title="Pysäytä kaikki"
              style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 7px", borderRadius: 5, border: "1px solid rgba(237,66,69,0.3)", background: "rgba(237,66,69,0.08)", color: "#ed4245", cursor: "pointer", fontSize: 10 }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(237,66,69,0.18)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(237,66,69,0.08)"}
            ><Square size={9} fill="#ed4245" /></button>
          </div>
        )}

        {/* Bot list */}
        <div style={{ flex: 1, overflowY: "auto", padding: sidebarCollapsed ? "8px 0" : "4px 8px 12px" }}>
          {bots.length === 0 && !sidebarCollapsed ? (
            <div style={{ textAlign: "center", padding: "48px 20px 0", color: "#20202a" }}>
              <Bot size={32} style={{ margin: "0 auto 12px" }} />
              <p style={{ fontSize: 13, color: "#2a2a3a", marginBottom: 6 }}>Ei botteja vielä</p>
              <p style={{ fontSize: 11, lineHeight: 1.5 }}>Lisää ensimmäinen botti yllä olevalla napilla.</p>
            </div>
          ) : sidebarCollapsed ? (
            // Collapsed: show status dots only
            bots.map((bot) => {
              const s = statuses[bot.id] || "offline";
              const dotColor = s === "online" ? "#3ba55d" : s === "error" ? "#ed4245" : s === "restarting" || s === "starting" ? "#faa81a" : "#4e5058";
              return (
                <button key={bot.id} onClick={() => { setSelectedBotId(bot.id); setSidebarCollapsed(false); }} title={bot.name}
                  style={{ width: 48, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: selectedBotId === bot.id ? "rgba(88,101,242,0.15)" : "transparent", cursor: "pointer" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                </button>
              );
            })
          ) : (
            bots.map((bot) => (
              <BotCard key={bot.id} bot={bot}
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

        <div style={{ padding: "8px 10px", borderTop: "1px solid #12121f", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
          {/* Version */}
          {!sidebarCollapsed && (
            <span style={{ fontSize: 10, color: "#2a2a3a", flex: 1, paddingLeft: 4 }}>
              {appVersion ? `v${appVersion}` : ''}
            </span>
          )}

          {/* Update download progress */}
          {!sidebarCollapsed && update?.state === 'downloading' && (
            <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ flex: 1, height: 3, borderRadius: 2, background: "#1e1e35", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${update.percent ?? 0}%`, background: "#5865F2", transition: "width 0.4s", borderRadius: 2 }} />
              </div>
              <span style={{ fontSize: 9, color: "#3a3a5a", whiteSpace: "nowrap" }}>{update.percent ?? 0}%</span>
            </div>
          )}

          {/* Check update */}
          {!sidebarCollapsed && update?.state !== 'downloading' && (
            <SbIconBtn onClick={handleCheckUpdate} disabled={checkingUpdate}
              title={checkingUpdate ? "Tarkistetaan…" : "Tarkista päivitykset"}>
              <RefreshCw size={12} style={checkingUpdate ? { animation: "spin 1s linear infinite" } : {}} />
            </SbIconBtn>
          )}

          {/* Settings */}
          {!sidebarCollapsed && (
            <SbIconBtn onClick={() => setShowSettings(true)} title="Asetukset">
              <Settings size={13} />
            </SbIconBtn>
          )}

          {/* Collapse */}
          <SbIconBtn
            onClick={() => setSidebarCollapsed(v => !v)}
            title={sidebarCollapsed ? "Laajenna sivupalkki" : "Pienennä sivupalkki"}
            extraStyle={{ marginLeft: sidebarCollapsed ? "auto" : 0, marginRight: sidebarCollapsed ? "auto" : 0 }}
          >
            {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </SbIconBtn>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Update banner — only shown when ready to install or error */}
        {update && (update.state === 'ready' || update.state === 'error') && (
          <UpdateBanner update={update}
            onInstall={() => window.api.installUpdate()}
            onDismiss={() => setUpdate(null)}
          />
        )}

        <div style={{ flex: 1, overflow: "hidden" }}>
        {selectedBot ? (
          <LogPanel
            key={selectedBot.id}
            bot={selectedBot}
            status={statuses[selectedBot.id] || "offline"}
            startedAt={uptimes[selectedBot.id] ?? null}
            logs={logs[selectedBot.id] || []}
            onStart={() => handleStart(selectedBot.id)}
            onStop={() => handleStop(selectedBot.id)}
            onRestart={() => handleRestart(selectedBot.id)}
            onClearLogs={() => setLogs((p) => ({ ...p, [selectedBot.id]: [] }))}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "#20202a" }}>
            <Bot size={40} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p style={{ fontSize: 14, color: "#2a2a3a", fontWeight: 600, margin: "0 0 6px" }}>Valitse botti sivupalkista</p>
            <p style={{ fontSize: 12 }}>Nähdäksesi lokit ja hallitaksesi bottia</p>
            {bots.length > 0 && (
              <div style={{ marginTop: 32, width: "100%", maxWidth: 700, padding: "0 32px" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#30303d", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Kaikki botit</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {bots.map((b) => {
                    const s = statuses[b.id] || "offline";
                    const dotColor = s === "online" ? "#3ba55d" : s === "error" ? "#ed4245" : s === "restarting" || s === "starting" ? "#faa81a" : "#4e5058";
                    const isBusy = s === "starting" || s === "restarting";
                    return (
                      <div key={b.id}
                        onClick={() => setSelectedBotId(b.id)}
                        style={{ background: "#0f0f1c", border: "1px solid #1e1e2a", borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "border-color 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = "#5865F2"}
                        onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2a"}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#e3e5e8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: b.type === "python" ? "rgba(59,130,246,0.15)" : "rgba(250,204,21,0.15)", color: b.type === "python" ? "#60a5fa" : "#fbbf24" }}>
                            {b.type === "python" ? "PY" : "JS"}
                          </span>
                        </div>
                        <p style={{ fontSize: 11, color: dotColor, margin: "0 0 8px", paddingLeft: 15 }}>{s.charAt(0).toUpperCase() + s.slice(1)}</p>
                        <div style={{ display: "flex", gap: 6, paddingLeft: 15 }}>
                          {s !== "online" && !isBusy ? (
                            <button onClick={e => { e.stopPropagation(); handleStart(b.id); }}
                              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, background: "rgba(59,165,93,0.12)", color: "#3ba55d", border: "1px solid rgba(59,165,93,0.25)", cursor: "pointer" }}>
                              <Play size={10} /> Käynnistä
                            </button>
                          ) : (
                            <button onClick={e => { e.stopPropagation(); handleStop(b.id); }} disabled={isBusy}
                              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 6, background: isBusy ? "transparent" : "rgba(237,66,69,0.12)", color: isBusy ? "#30303d" : "#ed4245", border: `1px solid ${isBusy ? "#1a1a2a" : "rgba(237,66,69,0.25)"}`, cursor: isBusy ? "default" : "pointer" }}>
                              <Square size={10} /> Pysäytä
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

function SidebarStat({ icon, value, label, color = "#4a4a62" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color, flex: 1, justifyContent: "center" }}>
      {icon}
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span style={{ fontSize: 10, opacity: 0.7 }}>{label}</span>
    </div>
  );
}

function SbIconBtn({ onClick, title, disabled, children, extraStyle = {} }) {
  return (
    <button onClick={disabled ? undefined : onClick} title={title}
      style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "1px solid transparent", background: "transparent", color: "#30303d", cursor: disabled ? "default" : "pointer", transition: "all 0.1s", flexShrink: 0, ...extraStyle }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = "#949cf7"; e.currentTarget.style.borderColor = "rgba(88,101,242,0.3)"; } }}
      onMouseLeave={e => { e.currentTarget.style.color = "#30303d"; e.currentTarget.style.borderColor = "transparent"; }}>
      {children}
    </button>
  );
}

function UpdateBanner({ update, onInstall, onDismiss }) {
  const isReady = update.state === 'ready';
  const isError = update.state === 'error';

  if (isError) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", background: "rgba(237,66,69,0.08)", borderBottom: "1px solid rgba(237,66,69,0.2)", flexShrink: 0 }}>
      <span style={{ flex: 1, fontSize: 12, color: "#ed4245" }}>Päivityksen tarkistus epäonnistui — tarkista internetyhteys</span>
      <button onClick={onDismiss} style={{ padding: 4, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "#4e5058" }}><X size={13} /></button>
    </div>
  );

  if (!isReady) return null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 20px",
      background: "rgba(59,165,93,0.12)",
      borderBottom: "1px solid rgba(59,165,93,0.25)",
      flexShrink: 0,
    }}>
      <Download size={14} color="#3ba55d" style={{ flexShrink: 0 }} />
      <span style={{ flex: 1, fontSize: 12, color: "#3ba55d" }}>
        Versio {update.version} ladattu — sulkemalla sovellus päivitys asennetaan automaattisesti
      </span>
      <button onClick={onInstall}
        style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
          background: "#3ba55d", color: "#fff" }}>
        Asenna nyt
      </button>
    </div>
  );
}
