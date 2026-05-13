import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Square, RotateCw, Trash2, Clock, FileCode2, KeyRound, Terminal, AlertCircle, ChevronDown } from "lucide-react";
import { useUptime, formatUptime } from "../hooks/useUptime.js";

const STATUS_CFG = {
  online:     { color: "#3ba55d", label: "Online",     bg: "rgba(59,165,93,0.1)",  border: "rgba(59,165,93,0.3)"  },
  offline:    { color: "#4e5058", label: "Offline",    bg: "rgba(78,80,88,0.1)",   border: "rgba(78,80,88,0.25)"  },
  error:      { color: "#ed4245", label: "Hälytys",    bg: "rgba(237,66,69,0.1)",  border: "rgba(237,66,69,0.3)"  },
  restarting: { color: "#faa81a", label: "Käynnistyy", bg: "rgba(250,168,26,0.1)", border: "rgba(250,168,26,0.3)" },
  starting:   { color: "#5865F2", label: "Käynnistyy", bg: "rgba(88,101,242,0.1)", border: "rgba(88,101,242,0.3)" },
};

const LOG_STYLE = {
  stdout: { color: "#c9d1d9" },
  stderr: { color: "#f47067" },
  error:  { color: "#ff6b6b", fontWeight: 600 },
  system: { color: "#5b7db1", fontStyle: "italic" },
};

const FILTERS = [
  { id: "all",    label: "Kaikki" },
  { id: "errors", label: "Virheet" },
];

function Ts({ ts }) {
  return (
    <span style={{ color: "#2a2a3a", minWidth: 58, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
      {new Date(ts).toLocaleTimeString("fi-FI", { hour12: false })}
    </span>
  );
}

export default function LogPanel({ bot, status, startedAt, logs, onStart, onStop, onRestart, onClearLogs }) {
  const scrollRef = useRef(null);
  const isAtBottomRef = useRef(true);
  const prevLogsLengthRef = useRef(0);
  const [newCount, setNewCount] = useState(0);
  const [filter, setFilter]     = useState("all");

  const elapsed   = useUptime(startedAt);
  const uptime    = formatUptime(elapsed);
  const cfg       = STATUS_CFG[status] ?? STATUS_CFG.offline;
  const isRunning = status === "online";
  const isBusy    = status === "starting" || status === "restarting";

  // Filtered log lines
  const visible = filter === "errors"
    ? logs.filter((e) => e.type === "stderr" || e.type === "error")
    : logs;
  const errorCount = logs.filter((e) => e.type === "stderr" || e.type === "error").length;

  // Track whether user is at the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (atBottom) { isAtBottomRef.current = true; setNewCount(0); }
    else           { isAtBottomRef.current = false; }
  }, []);

  // Auto-scroll; track actual number of new lines
  useEffect(() => {
    const newLines = logs.length - prevLogsLengthRef.current;
    prevLogsLengthRef.current = logs.length;
    if (newLines <= 0) return;
    if (isAtBottomRef.current) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      setNewCount(0);
    } else {
      setNewCount((n) => n + newLines);
    }
  }, [logs]);

  // Reset scroll and counter when filter changes
  useEffect(() => {
    setNewCount(0);
    isAtBottomRef.current = true;
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 0);
  }, [filter]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    isAtBottomRef.current = true;
    setNewCount(0);
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#0b0b14" }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{ background: "#0d0d1a", borderBottom: "1px solid #17172a", padding: "16px 24px 12px" }}>

        {/* Title row */}
        <div className="flex items-center gap-4" style={{ marginBottom: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 3 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#f2f3f5", margin: 0 }}>{bot.name}</h2>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
              }}>{cfg.label}</span>
              {isRunning && uptime && (
                <span style={{ fontSize: 11, color: "#3ba55d", display: "flex", alignItems: "center", gap: 4 }}>
                  <Clock size={11} /> {uptime}
                </span>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {!isRunning && !isBusy ? (
              <HeaderBtn onClick={onStart} color="#3ba55d" icon={<Play size={13} />}>Käynnistä</HeaderBtn>
            ) : (
              <>
                <HeaderBtn onClick={onStop} color="#ed4245" icon={<Square size={13} />} disabled={isBusy}>Pysäytä</HeaderBtn>
                <HeaderBtn onClick={onRestart} color="#faa81a" icon={<RotateCw size={13} />} disabled={isBusy}>Restart</HeaderBtn>
              </>
            )}
            <button onClick={onClearLogs} style={ghostBtn()}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#17172a"}>
              <Trash2 size={13} style={{ color: "#4e5058" }} />
              <span style={{ fontSize: 12, color: "#4e5058" }}>Tyhjennä</span>
            </button>
          </div>
        </div>

        {/* Stats + filter row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          {/* Stats */}
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <Stat icon={<FileCode2 size={12} />} label={bot.type === "python" ? "Python" : "JavaScript"} />
            <Stat icon={<Terminal size={12} />}  label={`${logs.length} riviä`} />
            <Stat icon={<KeyRound size={12} />}  label={`${Object.keys(bot.envVars || {}).length} env vars`} />
            {isRunning && uptime && <Stat icon={<Clock size={12} />} label={uptime} highlight />}
            {status === "error" && <Stat icon={<AlertCircle size={12} />} label="Virhe" danger />}
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4 }}>
            {FILTERS.map(({ id, label }) => {
              const isActive = filter === id;
              const hasErrors = id === "errors" && errorCount > 0;
              return (
                <button key={id} onClick={() => setFilter(id)}
                  style={{
                    padding: "4px 12px", borderRadius: 6, fontSize: 11, fontWeight: isActive ? 700 : 500,
                    background: isActive ? "rgba(88,101,242,0.18)" : "transparent",
                    color: isActive ? "#949cf7" : "#3a3a5a",
                    border: `1px solid ${isActive ? "rgba(88,101,242,0.35)" : "transparent"}`,
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.1s",
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = "#6c6e8a"; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = "#3a3a5a"; }}
                >
                  {label}
                  {hasErrors && (
                    <span style={{ background: "#ed4245", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "1px 5px", lineHeight: "14px" }}>
                      {errorCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Log body ────────────────────────────────────────────────── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        <div ref={scrollRef} onScroll={handleScroll}
          className="selectable"
          style={{ height: "100%", overflowY: "auto", padding: "14px 20px", background: "#070710", fontFamily: "'Consolas','Cascadia Code','Fira Mono',monospace", fontSize: 12, lineHeight: "20px" }}>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full select-none" style={{ gap: 10, color: "#20202a" }}>
              <Terminal size={32} />
              <p style={{ fontSize: 13 }}>
                {filter === "errors" ? "Ei virheitä — hienoa!" : "Odottaa lokeja…"}
              </p>
              <p style={{ fontSize: 11 }}>
                {filter === "errors" ? "Vaihda 'Kaikki'-näkymään nähdäksesi kaikki lokit." : "Käynnistä botti nähdäksesi tulosteet."}
              </p>
            </div>
          ) : (
            visible.map((entry, i) => (
              <div key={i} className="flex gap-3" style={{ padding: "1px 0", ...(LOG_STYLE[entry.type] ?? LOG_STYLE.stdout) }}>
                <Ts ts={entry.ts} />
                <span className="whitespace-pre-wrap break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Scroll-to-bottom pill */}
        {newCount > 0 && !isAtBottomRef.current && (
          <button onClick={scrollToBottom}
            style={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
              display: "flex", alignItems: "center", gap: 6,
              padding: "7px 16px", borderRadius: 20,
              background: "#5865F2", color: "#fff",
              border: "none", fontSize: 12, fontWeight: 600, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(88,101,242,0.4)", zIndex: 10,
              animation: "fadeIn 0.15s ease",
            }}>
            <ChevronDown size={14} /> {newCount} uutta riviä
          </button>
        )}
      </div>
    </div>
  );
}

function HeaderBtn({ onClick, color, icon, disabled, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 600,
        background: disabled ? "transparent" : `${color}18`,
        color: disabled ? "#30303d" : color,
        border: `1px solid ${disabled ? "#1a1a2a" : `${color}44`}`,
        cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.1s",
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = `${color}28`; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = `${color}18`; }}>
      {icon}{children}
    </button>
  );
}

function ghostBtn() {
  return {
    display: "flex", alignItems: "center", gap: 7,
    padding: "8px 14px", borderRadius: 8, fontSize: 12,
    background: "transparent", border: "1px solid #17172a", cursor: "pointer", transition: "border-color 0.1s",
  };
}

function Stat({ icon, label, highlight, danger }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: danger ? "#ed4245" : highlight ? "#3ba55d" : "#30303d" }}>{icon}</span>
      <span style={{ fontSize: 11, color: danger ? "#ed4245" : highlight ? "#3ba55d" : "#3a3a4a", fontWeight: highlight || danger ? 600 : 400 }}>
        {label}
      </span>
    </div>
  );
}
