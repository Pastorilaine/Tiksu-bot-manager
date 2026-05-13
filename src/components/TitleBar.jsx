import { useState, useEffect } from "react";
import { Minus, X } from "lucide-react";
import logo from "../assets/tiksu_bots_trans.png";

const BTN_BASE = {
  width: 46,
  height: 34,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  border: "none",
  background: "transparent",
  cursor: "pointer",
  color: "#4a4a5e",
  flexShrink: 0,
  transition: "background 0.1s, color 0.1s",
};

// Restore icon (two overlapping squares) — shown when window is maximized
function RestoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 1.5H9.5V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1.5" y="3.5" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

// Maximize icon (single square)
function MaximizeIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="8" height="8" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

export default function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    window.api.isMaximized?.().then(setMaximized);
    const cleanup = window.api.onMaximizeChange?.((v) => setMaximized(v));
    return () => cleanup?.();
  }, []);

  return (
    <div style={{
      height: 34,
      background: "#0a0a12",
      display: "flex",
      alignItems: "center",
      WebkitAppRegion: "drag",
      flexShrink: 0,
      userSelect: "none",
      position: "relative",
      borderBottom: "1px solid #13131f",
    }}
      onDoubleClick={() => window.api.maximizeWindow()}
    >
      {/* Top gradient accent line */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: "linear-gradient(90deg, #3ba55d 0%, #5865F2 55%, #7289da 100%)",
      }} />

      {/* Logo + title */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 14, flex: 1 }}>
        <img src={logo} alt="Tiksu Bots" style={{ height: 18, objectFit: "contain", opacity: 0.85 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "#40405a", letterSpacing: "0.01em" }}>
          Tiksu Bot Manager
        </span>
      </div>

      {/* Window controls — no-drag so clicks work */}
      <div style={{ display: "flex", WebkitAppRegion: "no-drag" }}>

        {/* Minimize */}
        <button
          style={BTN_BASE}
          onClick={() => window.api.minimizeWindow()}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#9a9ab0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a4a5e"; }}
          title="Pienennä"
        >
          <Minus size={12} />
        </button>

        {/* Maximize / Restore */}
        <button
          style={BTN_BASE}
          onClick={() => window.api.maximizeWindow()}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.07)"; e.currentTarget.style.color = "#9a9ab0"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a4a5e"; }}
          title={maximized ? "Palauta" : "Suurenna"}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        {/* Close */}
        <button
          style={BTN_BASE}
          onClick={() => window.api.closeWindow()}
          onMouseEnter={e => { e.currentTarget.style.background = "#c42b1c"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4a4a5e"; }}
          title="Sulje"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
