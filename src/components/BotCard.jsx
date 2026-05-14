import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Square, RotateCw, Settings, Trash2, AlertCircle, Loader2, Pencil, MoreHorizontal } from "lucide-react";
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

  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ bottom: 0, right: 0 });
  const menuRef   = useRef(null);
  const btnRef    = useRef(null);
  const portalRef = useRef(null);
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  const openMenu = (e) => {
    e.stopPropagation();
    if (menuOpen) { setMenuOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        bottom: window.innerHeight - rect.top + 6,
        right:  window.innerWidth  - rect.right,
      });
    }
    setMenuOpen(true);
  };

  // Close menu on outside click — portalRef ensures clicks inside the portal
  // don't close the menu before the item's onClick fires.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target) &&
        btnRef.current  && !btnRef.current.contains(e.target) &&
        (!portalRef.current || !portalRef.current.contains(e.target))
      ) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

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

        {/* ⋯ overflow menu */}
        <div ref={menuRef} style={{ position: "relative" }}>
          <button ref={btnRef} onClick={openMenu} title="Lisää toimintoja" style={{ ...iconBtn(), ...(menuOpen ? { color: "#949cf7", borderColor: "rgba(88,101,242,0.35)" } : {}) }}
            onMouseEnter={e => { if (!menuOpen) { e.currentTarget.style.color = "#949cf7"; e.currentTarget.style.borderColor = "rgba(88,101,242,0.35)"; } }}
            onMouseLeave={e => { if (!menuOpen) { e.currentTarget.style.color = "#4e5058"; e.currentTarget.style.borderColor = "#1e1e2a"; } }}>
            <MoreHorizontal size={13} />
          </button>

          {menuOpen && createPortal(
            <div ref={portalRef} style={{
              position: "fixed", bottom: menuPos.bottom, right: menuPos.right, zIndex: 9999,
              background: "#0f0f1c", border: "1px solid #1e1e35", borderRadius: 9,
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)", minWidth: 148, overflow: "hidden",
            }}>
              <MenuItem icon={<Pencil size={12} />} label="Muokkaa" onClick={stop(() => { setMenuOpen(false); onEdit(); })} />
              <MenuItem icon={<Settings size={12} />} label="Ympäristömuuttujat" onClick={stop(() => { setMenuOpen(false); onEnv(); })} />
              <div style={{ height: 1, background: "#17172a", margin: "3px 0" }} />
              <MenuItem icon={<Trash2 size={12} />} label="Poista botti" onClick={stop(() => { setMenuOpen(false); onDelete(); })} danger />
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }) {
  const [hover, setHover] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 9, width: "100%", padding: "9px 13px",
        background: hover ? (danger ? "rgba(237,66,69,0.08)" : "rgba(88,101,242,0.08)") : "transparent",
        border: "none", cursor: "pointer", textAlign: "left",
        color: danger ? (hover ? "#ed4245" : "#6b3030") : (hover ? "#949cf7" : "#b5bac1"),
        fontSize: 12, fontWeight: 500, transition: "all 0.1s",
      }}>
      {icon}{label}
    </button>
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
