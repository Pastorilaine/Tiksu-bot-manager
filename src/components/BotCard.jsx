import { Play, Square, RotateCw, Settings, Trash2, AlertCircle, Loader2, Pencil } from "lucide-react";
import { useUptime, formatUptime } from "../hooks/useUptime.js";

const STATUS = {
  online:     { color: "#3ba55d", label: "Online",      pulse: false },
  offline:    { color: "#4e5058", label: "Offline",     pulse: false },
  error:      { color: "#ed4245", label: "Hälytys",     pulse: true  },
  restarting: { color: "#faa81a", label: "Käynnistyy",  pulse: true  },
  starting:   { color: "#5865F2", label: "Käynnistyy",  pulse: true  },
};

const TYPE_COLORS = {
  python: { bg: "rgba(58,108,190,0.12)", color: "#5b8dd9", border: "rgba(58,108,190,0.22)" },
  js:     { bg: "rgba(247,208,2,0.08)",  color: "#c8a800", border: "rgba(247,208,2,0.18)"  },
};

export default function BotCard({ bot, status, startedAt, isSelected, onSelect, onStart, onStop, onRestart, onDelete, onEnv, onEdit }) {
  const elapsed = useUptime(startedAt);
  const uptime  = formatUptime(elapsed);
  const cfg     = STATUS[status] ?? STATUS.offline;
  const tc      = TYPE_COLORS[bot.type] ?? TYPE_COLORS.js;
  const isRunning = status === "online";
  const isBusy    = status === "starting" || status === "restarting";
  const isError   = status === "error";

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: "14px",
        borderRadius: 10,
        cursor: "pointer",
        border: isSelected ? "1px solid rgba(88,101,242,0.6)" : "1px solid transparent",
        background: isSelected ? "rgba(88,101,242,0.08)" : "transparent",
        transition: "all 0.1s",
      }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Row 1: dot + name + type badge */}
      <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
          background: cfg.color,
          boxShadow: isRunning || isError ? `0 0 0 2px ${cfg.color}33` : "none",
          animation: cfg.pulse ? "statusPulse 2s ease-in-out infinite" : "none",
        }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#e3e5e8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {bot.name}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, flexShrink: 0, letterSpacing: "0.03em" }}>
          {bot.type === "python" ? "PY" : "JS"}
        </span>
      </div>

      {/* Row 2: status/uptime */}
      <div style={{ fontSize: 11, color: "#4e5058", marginBottom: 10, paddingLeft: 16, height: 15 }}>
        {isRunning && uptime
          ? <span style={{ color: "#3ba55d" }}>{uptime} uptime</span>
          : isBusy
          ? <span style={{ color: cfg.color, display: "flex", alignItems: "center", gap: 5 }}>
              <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />
              {cfg.label}
            </span>
          : isError
          ? <span style={{ color: "#ed4245", display: "flex", alignItems: "center", gap: 5 }}><AlertCircle size={10} /> Virhe – tarkista lokit</span>
          : <span>{cfg.label}</span>
        }
      </div>

      {/* Row 3: action buttons */}
      <div className="flex gap-1.5">
        {!isRunning && !isBusy ? (
          <button onClick={stop(onStart)} style={actionBtn("#3ba55d")}>
            <Play size={11} /> <span>Käynnistä</span>
          </button>
        ) : (
          <>
            <button onClick={stop(onStop)} disabled={isBusy} style={actionBtn("#ed4245", isBusy)}>
              <Square size={11} />
            </button>
            <button onClick={stop(onRestart)} disabled={isBusy} style={actionBtn("#faa81a", isBusy)}>
              <RotateCw size={11} />
            </button>
          </>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={stop(onEdit)} title="Muokkaa bottia" style={iconBtn()}
          onMouseEnter={e => { e.currentTarget.style.color = "#949cf7"; e.currentTarget.style.borderColor = "rgba(88,101,242,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#4e5058"; e.currentTarget.style.borderColor = "#1e1e2a"; }}>
          <Pencil size={12} />
        </button>
        <button onClick={stop(onEnv)} title="Ympäristömuuttujat" style={iconBtn()}
          onMouseEnter={e => { e.currentTarget.style.color = "#949cf7"; e.currentTarget.style.borderColor = "rgba(88,101,242,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#4e5058"; e.currentTarget.style.borderColor = "#1e1e2a"; }}>
          <Settings size={12} />
        </button>
        <button onClick={stop(onDelete)} title="Poista botti" style={iconBtn(true)}
          onMouseEnter={e => { e.currentTarget.style.color = "#ed4245"; e.currentTarget.style.borderColor = "rgba(237,66,69,0.35)"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#6b3030"; e.currentTarget.style.borderColor = "#1e1e2a"; }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

function actionBtn(color, disabled = false) {
  return {
    display: "flex", alignItems: "center", gap: 5,
    padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600,
    background: disabled ? "transparent" : `${color}22`,
    color: disabled ? "#2a2a3a" : color,
    border: `1px solid ${disabled ? "#1e1e2a" : `${color}44`}`,
    cursor: disabled ? "not-allowed" : "pointer",
    transition: "all 0.1s",
  };
}

function iconBtn(isDanger = false) {
  return {
    width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center",
    borderRadius: 7, border: "1px solid #1e1e2a",
    background: "transparent", color: isDanger ? "#6b3030" : "#4e5058",
    cursor: "pointer", transition: "all 0.1s", flexShrink: 0,
  };
}
