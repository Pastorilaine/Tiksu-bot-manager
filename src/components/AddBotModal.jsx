import { useState } from "react";
import { Plus, X, FolderOpen, FileCode2, Code2 } from "lucide-react";

export default function AddBotModal({ onAdd, onClose }) {
  const [name, setName]           = useState("");
  const [type, setType]           = useState("python");
  const [filePath, setFilePath]   = useState("");
  const [autoRestart, setAutoRestart] = useState(true);
  const [loading, setLoading]     = useState(false);

  const pickFile = async () => {
    const path = await window.api.pickFile();
    if (!path) return;
    setFilePath(path);
    if (!name) setName(path.split(/[\\/]/).pop().replace(/\.[^.]+$/, ""));
    const ext = path.split(".").pop().toLowerCase();
    if (ext === "py") setType("python");
    else if (["js","mjs","cjs"].includes(ext)) setType("js");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !filePath.trim()) return;
    setLoading(true);
    await onAdd({ name: name.trim(), type, filePath: filePath.trim(), autoRestart, envVars: {} });
    setLoading(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#0f0f1c", border: "1px solid #1e1e35", borderRadius: 14, width: 420, boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #17172a" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(88,101,242,0.15)", border: "1px solid rgba(88,101,242,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Plus size={16} color="#5865F2" />
          </div>
          <h2 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700, color: "#f2f3f5" }}>Lisää uusi botti</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #1e1e2a", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4e5058" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2a"}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={submit} style={{ padding: "22px 22px 18px" }}>

          {/* Name */}
          <label style={{ display: "block", marginBottom: 16 }}>
            <span style={labelStyle}>Botin nimi</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Esim. Moderaattori" required
              style={inputStyle} onFocus={e => e.target.style.borderColor = "#5865F2"} onBlur={e => e.target.style.borderColor = "#1e1e35"} />
          </label>

          {/* Type */}
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Tyyppi</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              {[["python","Python","#5b8dd9"], ["js","JavaScript","#c8a800"]].map(([val, lbl, color]) => (
                <button type="button" key={val} onClick={() => setType(val)}
                  style={{ padding: "11px", borderRadius: 9, border: `1px solid ${type === val ? color + "55" : "#1e1e35"}`, background: type === val ? color + "15" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.1s" }}>
                  {val === "python" ? <FileCode2 size={15} color={color} /> : <Code2 size={15} color={color} />}
                  <span style={{ fontSize: 13, fontWeight: 600, color: type === val ? color : "#4e5058" }}>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File picker */}
          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Tiedostopolku</span>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder={type === "python" ? "bot.py" : "bot.js"} required
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => e.target.style.borderColor = "#5865F2"} onBlur={e => e.target.style.borderColor = "#1e1e35"} />
              <button type="button" onClick={pickFile}
                style={{ padding: "0 14px", borderRadius: 9, border: "1px solid #1e1e35", background: "transparent", color: "#949cf7", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a4a"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}
              >
                <FolderOpen size={14} /> Selaa
              </button>
            </div>
          </div>

          {/* Auto-restart */}
          <label style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 9, border: "1px solid #1e1e35", background: "rgba(88,101,242,0.04)", cursor: "pointer", marginBottom: 22, userSelect: "none" }}>
            <div onClick={() => setAutoRestart(!autoRestart)}
              style={{ width: 36, height: 20, borderRadius: 10, background: autoRestart ? "#5865F2" : "#20202a", border: `1px solid ${autoRestart ? "#5865F2" : "#2a2a3a"}`, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: autoRestart ? 17 : 2, width: 14, height: 14, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#e3e5e8" }}>Automaattinen uudelleenkäynnistys</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4e5058" }}>Botti käynnistyy uudelleen kaatumisen jälkeen</p>
            </div>
          </label>

          {/* Footer */}
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1px solid #1e1e35", background: "transparent", color: "#b5bac1", fontSize: 14, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}
            >Peruuta</button>
            <button type="submit" disabled={loading}
              style={{ flex: 2, padding: "11px", borderRadius: 9, border: "none", background: loading ? "#3a3a5a" : "#5865F2", color: "#fff", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", transition: "background 0.1s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#4752C4"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#5865F2"; }}
            >
              {loading ? "Lisätään…" : <><Plus size={15} /> Lisää botti</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, color: "#b5bac1", marginBottom: 6 };
const inputStyle = {
  display: "block", width: "100%", padding: "10px 13px", borderRadius: 9,
  background: "#0b0b14", border: "1px solid #1e1e35", color: "#e3e5e8", fontSize: 13,
  outline: "none", transition: "border-color 0.1s", boxSizing: "border-box",
};
