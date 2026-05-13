import { useState } from "react";
import { Settings, X, Plus, Trash2, ShieldAlert, Inbox } from "lucide-react";

const SENSITIVE_RE = /token|secret|password|key|api|auth/i;

export default function EnvModal({ bot, onSave, onClose }) {
  const [rows, setRows] = useState(() => Object.entries(bot?.envVars ?? {}).map(([k, v]) => ({ k, v })));

  const addRow   = () => setRows((p) => [...p, { k: "", v: "" }]);
  const delRow   = (i) => setRows((p) => p.filter((_, j) => j !== i));
  const upd      = (i, field, val) => setRows((p) => p.map((r, j) => j === i ? { ...r, [field]: val } : r));
  const save     = () => {
    const env = {};
    for (const { k, v } of rows) if (k.trim()) env[k.trim()] = v;
    onSave(env);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ background: "#0f0f1c", border: "1px solid #1e1e35", borderRadius: 14, width: 520, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #17172a", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(88,101,242,0.15)", border: "1px solid rgba(88,101,242,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={16} color="#5865F2" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f2f3f5" }}>Ympäristömuuttujat</h2>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4e5058" }}>{bot?.name}</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #1e1e2a", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4e5058" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2a"}
          >
            <X size={14} />
          </button>
        </div>

        {/* Security note */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, margin: "14px 22px 0", padding: "11px 14px", borderRadius: 9, background: "rgba(250,168,26,0.07)", border: "1px solid rgba(250,168,26,0.18)" }}>
          <ShieldAlert size={14} color="#faa81a" style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 11, color: "#b08d1a", lineHeight: 1.6 }}>
            Arvot tallennetaan paikallisesti selväkielisinä. Älä jaa asetustiedostoa muille.
          </p>
        </div>

        {/* Row list */}
        <div style={{ overflowY: "auto", padding: "14px 22px", flex: 1 }}>
          {rows.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", color: "#20202a", gap: 10 }}>
              <Inbox size={28} />
              <p style={{ fontSize: 13, color: "#2a2a3a", margin: 0 }}>Ei ympäristömuuttujia</p>
              <p style={{ fontSize: 11, margin: 0 }}>Lisää esim. DISCORD_TOKEN alla olevalla napilla.</p>
            </div>
          ) : (
            <>
              {/* Column labels */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 28px", gap: 8, marginBottom: 6 }}>
                <span style={colLabel}>Avain (KEY)</span>
                <span style={colLabel}>Arvo (VALUE)</span>
                <span />
              </div>
              {rows.map((row, i) => {
                const isSensitive = SENSITIVE_RE.test(row.k);
                return (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 28px", gap: 8, marginBottom: 7 }}>
                    <input value={row.k} onChange={e => upd(i, "k", e.target.value)} placeholder="DISCORD_TOKEN"
                      style={cellInput} onFocus={e => e.target.style.borderColor = "#5865F2"} onBlur={e => e.target.style.borderColor = "#1e1e35"} />
                    <input type={isSensitive ? "password" : "text"} value={row.v} onChange={e => upd(i, "v", e.target.value)} placeholder="arvo"
                      style={cellInput} onFocus={e => e.target.style.borderColor = "#5865F2"} onBlur={e => e.target.style.borderColor = "#1e1e35"} />
                    <button onClick={() => delRow(i)}
                      style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, border: "1px solid #1e1e35", background: "transparent", color: "#4e5058", cursor: "pointer" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#ed4245"; e.currentTarget.style.borderColor = "rgba(237,66,69,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#4e5058"; e.currentTarget.style.borderColor = "#1e1e35"; }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          <button onClick={addRow}
            style={{ marginTop: rows.length > 0 ? 10 : 0, display: "flex", alignItems: "center", gap: 8, padding: "9px 14px", borderRadius: 9, border: "1px dashed #252535", background: "transparent", color: "#4e5058", fontSize: 13, cursor: "pointer", width: "100%", transition: "all 0.1s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#5865F2"; e.currentTarget.style.color = "#949cf7"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "#252535"; e.currentTarget.style.color = "#4e5058"; }}
          >
            <Plus size={14} /> Lisää muuttuja
          </button>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, padding: "14px 22px", borderTop: "1px solid #17172a", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1px solid #1e1e35", background: "transparent", color: "#b5bac1", fontSize: 14, cursor: "pointer" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}
          >Peruuta</button>
          <button onClick={save}
            style={{ flex: 2, padding: "11px", borderRadius: 9, border: "none", background: "#5865F2", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.1s" }}
            onMouseEnter={e => e.currentTarget.style.background = "#4752C4"}
            onMouseLeave={e => e.currentTarget.style.background = "#5865F2"}
          >Tallenna muutokset</button>
        </div>
      </div>
    </div>
  );
}

const colLabel = { fontSize: 10, fontWeight: 700, color: "#30303d", textTransform: "uppercase", letterSpacing: "0.06em" };
const cellInput = {
  padding: "8px 11px", borderRadius: 8, background: "#0b0b14", border: "1px solid #1e1e35",
  color: "#e3e5e8", fontSize: 12, outline: "none", transition: "border-color 0.1s",
  fontFamily: "'Consolas','Cascadia Code',monospace",
};
