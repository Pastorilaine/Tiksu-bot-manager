import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ title, message, confirmLabel = "Vahvista", dangerLabel, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0f0f1c", border: "1px solid #1e1e35", borderRadius: 14, width: 380, boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #17172a" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(237,66,69,0.12)", border: "1px solid rgba(237,66,69,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={16} color="#ed4245" />
          </div>
          <h2 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700, color: "#f2f3f5" }}>{title}</h2>
          <button onClick={onCancel} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #1e1e2a", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4e5058" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2a"}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "20px 22px 22px" }}>
          <p style={{ margin: "0 0 22px", fontSize: 13, color: "#b5bac1", lineHeight: 1.6 }}>{message}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel}
              style={{ flex: 1, padding: "11px", borderRadius: 9, border: "1px solid #1e1e35", background: "transparent", color: "#b5bac1", fontSize: 14, cursor: "pointer", transition: "border-color 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}
            >Peruuta</button>
            <button onClick={onConfirm}
              style={{ flex: 1, padding: "11px", borderRadius: 9, border: "none", background: "#ed4245", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "background 0.1s" }}
              onMouseEnter={e => e.currentTarget.style.background = "#c03537"}
              onMouseLeave={e => e.currentTarget.style.background = "#ed4245"}
            >{dangerLabel ?? confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
