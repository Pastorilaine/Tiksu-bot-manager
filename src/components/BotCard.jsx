import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Play, Square, RotateCw, Settings, Trash2, AlertCircle, Loader2, Pencil, MoreHorizontal } from "lucide-react";
import { useUptime, formatUptime } from "../hooks/useUptime.js";

const STATUS = {
  online:     { color: "rgb(var(--c-success))", label: "Online",      pulse: false, textCls: "text-success" },
  offline:    { color: "rgb(var(--c-subtle))",  label: "Offline",     pulse: false, textCls: "text-subtle"  },
  error:      { color: "rgb(var(--c-danger))",  label: "Hälytys",     pulse: true,  textCls: "text-danger"  },
  restarting: { color: "rgb(var(--c-warn))",    label: "Käynnistyy",  pulse: true,  textCls: "text-warn"    },
  starting:   { color: "rgb(var(--c-accent))",  label: "Käynnistyy",  pulse: true,  textCls: "text-accent"  },
};

export default function BotCard({ bot, status, startedAt, isSelected, onSelect, onStart, onStop, onRestart, onDelete, onEnv, onEdit }) {
  const elapsed = useUptime(startedAt);
  const uptime  = formatUptime(elapsed);
  const cfg     = STATUS[status] ?? STATUS.offline;
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
      className={`p-3.5 rounded-md cursor-pointer transition-colors border mb-1.5 ${
        isSelected
          ? "bg-surface-2 border-accent text-text"
          : "bg-surface border-line hover:border-line-strong hover:bg-surface-2 text-text"
      }`}
    >
      {/* Row 1: dot + name + type badge */}
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{
            backgroundColor: cfg.color,
            boxShadow: isRunning || isError ? `0 0 0 2px ${cfg.color}33` : "none",
            animation: cfg.pulse ? "statusPulse 2s ease-in-out infinite" : "none",
          }}
        />
        <span className="flex-1 text-ui font-medium text-text overflow-hidden text-ellipsis whitespace-nowrap">
          {bot.name}
        </span>
        <span className="chip border border-line bg-surface-2 text-subtle text-meta font-medium px-2 py-0.5 rounded-sm">
          {bot.type === "python" ? "PY" : "JS"}
        </span>
      </div>

      {/* Row 2: status/uptime */}
      <div className="text-label text-subtle mb-2.5 pl-4 h-4 flex items-center">
        {isRunning && uptime ? (
          <span className="text-success">{uptime} käynnissä</span>
        ) : isBusy ? (
          <span className={`${cfg.textCls} flex items-center gap-1.5`}>
            <Loader2 className="w-3 h-3 animate-spin" />
            {cfg.label}
          </span>
        ) : isError ? (
          <span className="text-danger flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> Virhe – tarkista lokit
          </span>
        ) : (
          <span>{cfg.label}</span>
        )}
      </div>

      {/* Row 3: action buttons */}
      <div className="flex gap-1.5 items-center">
        {!isRunning && !isBusy ? (
          <button onClick={stop(onStart)} className="btn btn-sm text-success border-success/30 bg-success/10 hover:bg-success/20">
            <Play className="w-3 h-3 fill-current" /> <span>Käynnistä</span>
          </button>
        ) : (
          <>
            <button onClick={stop(onStop)} disabled={isBusy} className="btn btn-sm btn-danger">
              <Square className="w-3 h-3 fill-current" />
            </button>
            <button onClick={stop(onRestart)} disabled={isBusy} className="btn btn-sm text-warn border-warn/30 bg-warn/10 hover:bg-warn/20">
              <RotateCw className="w-3 h-3" />
            </button>
          </>
        )}
        <div className="flex-1" />

        {/* ⋯ overflow menu */}
        <div ref={menuRef} className="relative">
          <button
            ref={btnRef}
            onClick={openMenu}
            title="Lisää toimintoja"
            className="btn btn-ghost btn-sm btn-icon"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && createPortal(
            <div
              ref={portalRef}
              className="menu min-w-[150px] fixed z-50"
              style={{ bottom: menuPos.bottom, right: menuPos.right }}
            >
              <button className="menu-item" onClick={stop(() => { setMenuOpen(false); onEdit(); })}>
                <Pencil className="w-3.5 h-3.5" /> Muokkaa
              </button>
              <button className="menu-item" onClick={stop(() => { setMenuOpen(false); onEnv(); })}>
                <Settings className="w-3.5 h-3.5" /> Ympäristömuuttujat
              </button>
              <div className="h-[1px] bg-line my-1" />
              <button className="menu-item text-danger hover:bg-danger/10" onClick={stop(() => { setMenuOpen(false); onDelete(); })}>
                <Trash2 className="w-3.5 h-3.5" /> Poista botti
              </button>
            </div>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}

