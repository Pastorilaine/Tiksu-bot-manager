import { useRef, useEffect, useState, useCallback } from "react";
import { Play, Square, RotateCw, Trash2, Clock, FileCode2, KeyRound, Terminal,
         AlertCircle, ChevronDown, Search, X, Download, Copy, Check, Clock3 } from "lucide-react";
import { useUptime, formatUptime } from "../hooks/useUptime.js";

const STATUS_CFG = {
  online:     { color: "rgb(var(--c-success))", label: "Online",     textCls: "text-success" },
  offline:    { color: "rgb(var(--c-subtle))",  label: "Offline",    textCls: "text-subtle"  },
  error:      { color: "rgb(var(--c-danger))",  label: "Hälytys",    textCls: "text-danger"  },
  restarting: { color: "rgb(var(--c-warn))",    label: "Käynnistyy", textCls: "text-warn"    },
  starting:   { color: "rgb(var(--c-accent))",  label: "Käynnistyy", textCls: "text-accent"  },
};

const LOG_STYLE = {
  stdout: { color: "rgb(var(--c-text))" },
  stderr: { color: "rgb(var(--c-danger))" },
  error:  { color: "rgb(var(--c-danger))", fontWeight: 600 },
  system: { color: "rgb(var(--c-accent))" },
};

const FILTERS = [
  { id: "all",    label: "Kaikki" },
  { id: "errors", label: "Virheet" },
];

function Ts({ ts }) {
  return (
    <span className="text-subtle text-meta font-mono min-w-[58px] shrink-0 tabular-nums select-none">
      {new Date(ts).toLocaleTimeString("fi-FI", { hour12: false })}
    </span>
  );
}

function highlightText(text, query) {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-warn/20 text-warn rounded-sm px-0.5">{part}</mark>
      : part
  );
}

export default function LogPanel({ bot, status, startedAt, logs, shortcutsEnabled = true, onStart, onStop, onRestart, onClearLogs }) {
  const scrollRef         = useRef(null);
  const searchInputRef    = useRef(null);
  const isAtBottomRef     = useRef(true);
  const prevLogsLengthRef = useRef(0);
  const [newCount, setNewCount]             = useState(0);
  const [filter, setFilter]                 = useState("all");
  const [searchOpen, setSearchOpen]         = useState(false);
  const [searchQuery, setSearchQuery]       = useState("");
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [copiedId, setCopiedId]             = useState(null);

  const elapsed   = useUptime(startedAt);
  const uptime    = formatUptime(elapsed);
  const cfg       = STATUS_CFG[status] ?? STATUS_CFG.offline;
  const isRunning = status === "online";
  const isBusy    = status === "starting" || status === "restarting";

  const filtered = filter === "errors"
    ? logs.filter((e) => e.type === "stderr" || e.type === "error")
    : logs;
  const visible = searchQuery.trim()
    ? filtered.filter((e) => e.message.toLowerCase().includes(searchQuery.toLowerCase()))
    : filtered;
  const errorCount = logs.filter((e) => e.type === "stderr" || e.type === "error").length;

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (atBottom) { isAtBottomRef.current = true; setNewCount(0); }
    else           { isAtBottomRef.current = false; }
  }, []);

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

  useEffect(() => {
    setNewCount(0);
    isAtBottomRef.current = true;
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 0);
  }, [filter]);

  useEffect(() => {
    if (!shortcutsEnabled) return;   // a modal is open — it owns the keyboard
    const handler = (e) => {
      if (e.ctrlKey && e.key === "f") { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }
      if (e.key === "Escape") { setSearchOpen(false); setSearchQuery(""); }
      if (e.ctrlKey && e.key === "l") { e.preventDefault(); onClearLogs(); }
      if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); if (!isBusy) { isRunning ? onStop() : onStart(); } }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcutsEnabled, isRunning, isBusy, onStart, onStop, onClearLogs]);

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    isAtBottomRef.current = true;
    setNewCount(0);
  };

  const copyLine = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const exportLogs = async () => {
    const content = logs.map((e) =>
      `[${new Date(e.ts).toLocaleTimeString("fi-FI", { hour12: false })}] [${e.type.toUpperCase().padEnd(6)}] ${e.message}`
    ).join("\n");
    await window.api.exportLogs?.({ botName: bot.name, content });
  };

  return (
    <div className="page">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-head flex-col items-stretch gap-3">

        {/* Title row */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-title font-semibold text-text">{bot.name}</h2>
            <span className={`chip text-meta font-medium ${cfg.textCls}`}>
              {cfg.label}
            </span>
            {isRunning && uptime && (
              <span className="text-label text-success flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {uptime}
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {!isRunning && !isBusy ? (
              <button onClick={onStart} className="btn text-success border-success/30 bg-success/10 hover:bg-success/20" title="Ctrl+Enter">
                <Play className="w-3.5 h-3.5 fill-current" /> Käynnistä
              </button>
            ) : (
              <>
                <button onClick={onStop} disabled={isBusy} className="btn btn-danger" title="Ctrl+Enter">
                  <Square className="w-3.5 h-3.5 fill-current" /> Pysäytä
                </button>
                <button onClick={onRestart} disabled={isBusy} className="btn text-warn border-warn/30 bg-warn/10 hover:bg-warn/20">
                  <RotateCw className="w-3.5 h-3.5" /> Uudelleen
                </button>
              </>
            )}
            <button onClick={() => setShowTimestamps((v) => !v)} className={`btn btn-icon ${showTimestamps ? "btn-ghost text-accent" : "btn-ghost"}`} title="Näytä/piilota aikaleimat">
              <Clock3 className="w-4 h-4" />
            </button>
            <button onClick={() => { setSearchOpen((v) => !v); setTimeout(() => searchInputRef.current?.focus(), 50); }} className={`btn btn-icon ${searchOpen ? "btn-ghost text-accent" : "btn-ghost"}`} title="Hae (Ctrl+F)">
              <Search className="w-4 h-4" />
            </button>
            <button onClick={exportLogs} className="btn btn-icon btn-ghost" title="Vie lokit tiedostoon">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClearLogs} className="btn btn-ghost" title="Tyhjennä lokit (Ctrl+L)">
              <Trash2 className="w-3.5 h-3.5 text-muted" />
              <span>Tyhjennä</span>
            </button>
          </div>
        </div>

        {/* Stats + filter row */}
        <div className="flex items-center justify-between gap-4 flex-wrap pt-1 border-t border-line/50">
          {/* Stats */}
          <div className="flex items-center gap-4 text-label text-muted">
            <span className="flex items-center gap-1.5"><FileCode2 className="w-3.5 h-3.5" /> {bot.type === "python" ? "Python" : "JavaScript"}</span>
            <span className="flex items-center gap-1.5"><Terminal className="w-3.5 h-3.5" /> {logs.length} riviä</span>
            <span className="flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> {Object.keys(bot.envVars || {}).length} env vars</span>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1.5">
            {FILTERS.map(({ id, label }) => {
              const isActive = filter === id;
              const hasErrors = id === "errors" && errorCount > 0;
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`chip ${isActive ? "chip-active" : ""}`}
                >
                  {label}
                  {hasErrors && (
                    <span className="bg-danger text-accent-fg text-meta font-bold rounded px-1 animate-pulse">
                      {errorCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Search bar */}
        {searchOpen && (
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 relative flex items-center">
              <Search className="w-3.5 h-3.5 text-accent absolute left-2.5" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Hae lokeista…"
                className="field pl-8"
              />
              {searchQuery && (
                <span className="text-meta text-subtle absolute right-3 whitespace-nowrap">
                  {visible.length} / {filtered.length} riviä
                </span>
              )}
            </div>
            <button onClick={() => { setSearchOpen(false); setSearchQuery(""); }} className="btn btn-ghost btn-icon">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ── Log body ────────────────────────────────────────────────── */}
      <div className="relative flex-1 overflow-hidden bg-bg">
        <div ref={scrollRef} onScroll={handleScroll} className="h-full overflow-y-auto py-2 font-mono text-ui leading-5">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full select-none gap-2 text-subtle">
              <Terminal className="w-8 h-8" />
              <p className="text-ui font-medium">
                {searchQuery ? `Ei tuloksia haulle "${searchQuery}"` : filter === "errors" ? "Ei virheitä — hienoa!" : "Odottaa lokeja…"}
              </p>
              <p className="text-label">
                {searchQuery ? "Kokeile eri hakusanaa." : filter === "errors" ? "Vaihda 'Kaikki'-näkymään nähdäksesi kaikki lokit." : "Käynnistä botti nähdäksesi tulosteet."}
              </p>
            </div>
          ) : (
            <>
              {visible.map((entry, i) => {
                const isSystem = entry.type === "system";
                const style = LOG_STYLE[entry.type] ?? LOG_STYLE.stdout;
                const rowId = entry.id ?? i;
                const isCopied = copiedId === rowId;
                return (
                  <div key={rowId} className="log-row flex items-start px-5 py-0.5 border-l-2 border-transparent hover:bg-surface-2 cursor-pointer transition-colors"
                    onClick={() => copyLine(entry.message, rowId)}
                    style={{ borderLeftColor: isSystem ? "rgb(var(--c-accent))" : "transparent" }}
                  >
                    {showTimestamps && <Ts ts={entry.ts} />}
                    <span className={`flex-1 whitespace-pre-wrap break-all ${showTimestamps ? "pl-2.5" : ""}`} style={style}>
                      {searchQuery ? highlightText(entry.message, searchQuery) : entry.message}
                    </span>
                    <span className="ml-2 shrink-0 text-subtle text-meta flex items-center min-w-[13px]">
                      {isCopied ? <Check className="w-3 h-3 text-success" /> : <Copy className="w-3 h-3 copy-icon" />}
                    </span>
                  </div>
                );
              })}
              {/* End-of-log indicator */}
              <div className="px-5 py-3 flex items-center gap-2.5">
                <div className="flex-1 h-[1px] bg-line" />
                <span className="text-meta text-subtle whitespace-nowrap">lokin loppu · {logs.length} riviä</span>
                <div className="flex-1 h-[1px] bg-line" />
              </div>
            </>
          )}
        </div>

        {/* Scroll-to-bottom pill */}
        {newCount > 0 && !isAtBottomRef.current && (
          <button onClick={scrollToBottom} className="btn btn-primary rounded-full absolute bottom-4 left-1/2 -translate-x-1/2 shadow-float z-10 animate-fadeIn">
            <ChevronDown className="w-4 h-4" /> {newCount} uutta riviä
          </button>
        )}
      </div>
    </div>
  );
}

