import { useState, useEffect } from "react";
import { Minus, X } from "lucide-react";
import logo from "../assets/tiksu_bots_trans.png";

function RestoreIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3.5 1.5H9.5V7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <rect x="1.5" y="3.5" width="6" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.3"/>
    </svg>
  );
}

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
    <div
      className="h-[var(--titlebar-height)] bg-surface border-b border-line flex items-center shrink-0 select-none relative"
      style={{ WebkitAppRegion: "drag" }}
      onDoubleClick={() => window.api.maximizeWindow()}
    >
      {/* Top accent border line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-accent" />

      {/* Logo + title */}
      <div className="flex items-center gap-2.5 px-3.5 flex-1">
        <img src={logo} alt="Tiksu Bots" className="h-4 object-contain opacity-90" />
        <span className="text-ui font-medium text-muted tracking-tight">
          Tiksu Bot Manager
        </span>
      </div>

      {/* Window controls */}
      <div className="flex h-full" style={{ WebkitAppRegion: "no-drag" }}>
        {/* Minimize */}
        <button
          className="w-11 h-full flex items-center justify-center border-none bg-transparent text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          onClick={() => window.api.minimizeWindow()}
          title="Pienennä"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          className="w-11 h-full flex items-center justify-center border-none bg-transparent text-muted hover:text-text hover:bg-surface-2 transition-colors cursor-pointer"
          onClick={() => window.api.maximizeWindow()}
          title={maximized ? "Palauta" : "Suurenna"}
        >
          {maximized ? <RestoreIcon /> : <MaximizeIcon />}
        </button>

        {/* Close */}
        <button
          className="w-11 h-full flex items-center justify-center border-none bg-transparent text-muted hover:text-accent-fg hover:bg-danger transition-colors cursor-pointer"
          onClick={() => window.api.closeWindow()}
          title="Sulje"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

