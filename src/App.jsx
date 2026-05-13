import { useState, useEffect, useCallback } from "react";
import { Bot, Plus, Activity, Server, Download, RefreshCw, X, ChevronLeft, ChevronRight, Play, Square, RotateCw } from "lucide-react";
import BotCard from "./components/BotCard.jsx";
import AddBotModal from "./components/AddBotModal.jsx";
import LogPanel from "./components/LogPanel.jsx";
import EnvModal from "./components/EnvModal.jsx";
import TitleBar from "./components/TitleBar.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import { formatUptime } from "./hooks/useUptime.js";

const MAX_LOG_LINES = 2000;

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
        const trimmed = ex.length >= MAX_LOG_LINES ? ex.slice(ex.length - MAX_LOG_LINES + 1) : ex;
        return { ...p, [botId]: [...trimmed, { message, type, ts }] };
      });
    });
    return () => { cleanStatus(); cleanLog(); };
  }, [loadBots]);

  // ── Updater event listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const a = window.api.onUpdateAvailable?.   ((d) => { setCheckingUpdate(false); setUpdate({ state: 'available', version: d.version }); });
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
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #17172a", flexShrink: 0 }}>
          {!sidebarCollapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#5865F2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Bot size={18} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#f2f3f5", margin: 0, lineHeight: 1.2 }}>Tiksu Bot Manager</p>
              <p style={{ fontSize: 10, color: "#30303d", margin: 0, marginTop: 2 }}>IT-Veljekset Group</p>
            </div>
          </div>
          )}

          {/* Stats */}
          {!sidebarCollapsed && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <StatTile icon={<Server size={13} />} value={bots.length} label="Bottia" />
            <StatTile icon={<Activity size={13} />} value={runningCount} label="Online" highlight={runningCount > 0} />
          </div>
          )}

          {!sidebarCollapsed && errorCount > 0 && (
            <div style={{ fontSize: 11, padding: "7px 11px", borderRadius: 8, background: "rgba(237,66,69,0.08)", color: "#ed4245", border: "1px solid rgba(237,66,69,0.2)", marginBottom: 12 }}>
              ⚠ {errorCount} botti{errorCount > 1 ? "a" : ""} virhetilassa
            </div>
          )}

          {!sidebarCollapsed && (
          <button
            onClick={() => setShowAddModal(true)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "9px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: "#5865F2", color: "#fff", border: "none", cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#4752C4"}
            onMouseLeave={e => e.currentTarget.style.background = "#5865F2"}
          >
            <Plus size={15} /> Lisää botti
          </button>
          )}
        </div>

        {/* Bot list label */}
        {bots.length > 0 && !sidebarCollapsed && (
          <div style={{ padding: "14px 16px 6px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#30303d", textTransform: "uppercase", letterSpacing: "0.08em", margin: 0 }}>
              Botit — {bots.length}
            </p>
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

        <div style={{ padding: "10px 16px", borderTop: "1px solid #12121f", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          {!sidebarCollapsed && <p style={{ fontSize: 10, color: "#2a2a3a", margin: 0 }}>{appVersion ? `v${appVersion}` : 'v1.0.0'}</p>}
          {!sidebarCollapsed && (
          <button onClick={handleCheckUpdate} disabled={checkingUpdate || update?.state === 'downloading'}
            title="Tarkista päivitykset"
            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, background: "transparent", border: "none",
              cursor: (checkingUpdate || update?.state === 'downloading') ? "default" : "pointer",
              color: checkingUpdate ? "#2a2a3a" : "#3a3a5a", padding: "2px 5px", borderRadius: 4, transition: "color 0.1s" }}
            onMouseEnter={e => { if (!checkingUpdate) e.currentTarget.style.color = "#5865F2"; }}
            onMouseLeave={e => { e.currentTarget.style.color = checkingUpdate ? "#2a2a3a" : "#3a3a5a"; }}
          >
            <RefreshCw size={10} style={checkingUpdate ? { animation: "spin 1s linear infinite" } : {}} />
            <span>{checkingUpdate ? "Tarkistetaan…" : "Tarkista"}</span>
          </button>
          )}
          <button onClick={() => setSidebarCollapsed((v) => !v)} title={sidebarCollapsed ? "Laajenna sivupalkki" : "Pienennä sivupalkki"}
            style={{ marginLeft: sidebarCollapsed ? "auto" : 0, marginRight: sidebarCollapsed ? "auto" : 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "1px solid #1e1e2a", background: "transparent", color: "#30303d", cursor: "pointer", transition: "all 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#949cf7"; e.currentTarget.style.borderColor = "rgba(88,101,242,0.35)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#30303d"; e.currentTarget.style.borderColor = "#1e1e2a"; }}>
            {sidebarCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

        {/* Update banner */}
        {update && (
          <UpdateBanner update={update}
            onDownload={() => { setUpdate((u) => ({ ...u, state: 'downloading', percent: 0 })); window.api.downloadUpdate(); }}
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
    </div>
  );
}

function StatTile({ icon, value, label, highlight }) {
  return (
    <div style={{ background: "#0b0b14", borderRadius: 8, padding: "10px", border: "1px solid #17172a", textAlign: "center" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: highlight ? "#3ba55d" : "#30303d", marginBottom: 4 }}>
        {icon}
      </div>
      <p style={{ fontSize: 18, fontWeight: 700, color: highlight ? "#3ba55d" : "#b5bac1", margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 10, color: "#30303d", margin: "4px 0 0" }}>{label}</p>
    </div>
  );
}

function UpdateBanner({ update, onDownload, onInstall, onDismiss }) {
  const isReady       = update.state === 'ready';
  const isDownloading = update.state === 'downloading';
  const isError       = update.state === 'error';

  if (isError) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 20px", background: "rgba(237,66,69,0.08)", borderBottom: "1px solid rgba(237,66,69,0.2)", flexShrink: 0 }}>
      <span style={{ flex: 1, fontSize: 12, color: "#ed4245" }}>Päivityksen tarkistus epäonnistui — tarkista internetyhteys</span>
      <button onClick={onDismiss} style={{ padding: 4, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "#4e5058" }}><X size={13} /></button>
    </div>
  );

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "10px 20px",
      background: isReady ? "rgba(59,165,93,0.12)" : "rgba(88,101,242,0.12)",
      borderBottom: `1px solid ${isReady ? "rgba(59,165,93,0.25)" : "rgba(88,101,242,0.25)"}`,
      flexShrink: 0,
    }}>
      {isDownloading
        ? <RefreshCw size={14} color="#949cf7" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
        : <Download size={14} color={isReady ? "#3ba55d" : "#949cf7"} style={{ flexShrink: 0 }} />
      }

      <span style={{ flex: 1, fontSize: 12, color: isReady ? "#3ba55d" : "#949cf7" }}>
        {isReady
          ? `Versio ${update.version} ladattu — käynnistä uudelleen asentaaksesi`
          : isDownloading
          ? `Ladataan päivitystä… ${update.percent ?? 0}%`
          : `Uusi versio saatavilla: ${update.version}`
        }
      </span>

      {isDownloading && (
        <div style={{ width: 120, height: 4, borderRadius: 2, background: "#1e1e35", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${update.percent ?? 0}%`, background: "#5865F2", transition: "width 0.3s", borderRadius: 2 }} />
        </div>
      )}

      {!isDownloading && (
        <button onClick={isReady ? onInstall : onDownload}
          style={{ padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
            background: isReady ? "#3ba55d" : "#5865F2", color: "#fff" }}>
          {isReady ? "Asenna ja käynnistä uudelleen" : "Lataa päivitys"}
        </button>
      )}

      {!isDownloading && !isReady && (
        <button onClick={onDismiss} style={{ padding: 4, borderRadius: 5, border: "none", background: "transparent", cursor: "pointer", color: "#4e5058" }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}
