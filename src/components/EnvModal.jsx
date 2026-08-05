import { useState } from "react";
import { Settings, X, Plus, Trash2, ShieldAlert, Inbox, FolderOpen } from "lucide-react";

const SENSITIVE_RE = /token|secret|password|key|api|auth/i;

export default function EnvModal({ bot, onSave, onClose }) {
  const [rows, setRows] = useState(() => Object.entries(bot?.envVars ?? {}).map(([k, v]) => ({ k, v })));

  const addRow   = () => setRows((p) => [...p, { k: "", v: "" }]);
  const delRow   = (i) => setRows((p) => p.filter((_, j) => j !== i));
  const upd      = (i, field, val) => setRows((p) => p.map((r, j) => j === i ? { ...r, [field]: val } : r));
  const save = () => {
    const env = {};
    for (const { k, v } of rows) if (k.trim()) env[k.trim()] = v;
    onSave(env);
  };

  const importEnv = async () => {
    const result = await window.api.pickEnvFile?.();
    if (!result) return;
    const parsed = parseEnvContent(result.content);
    setRows(prev => {
      const existing = new Set(prev.map(r => r.k.trim()).filter(Boolean));
      const newRows = Object.entries(parsed)
        .filter(([k]) => !existing.has(k))
        .map(([k, v]) => ({ k, v }));
      return [...prev, ...newRows];
    });
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel w-[520px] max-h-[80vh] flex flex-col shadow-float bg-surface border border-line rounded-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 text-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-title font-semibold text-text">Ympäristömuuttujat</h2>
            <p className="text-meta text-subtle">{bot?.name}</p>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security note */}
        <div className="flex items-start gap-2.5 mx-5 mt-4 p-3 rounded-md bg-warn/10 border border-warn/20 text-warn text-label shrink-0">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Arvot tallennetaan salattuina Windowsin käyttäjätiliisi sidottuna.
            Ne välitetään botille sellaisenaan — älä jaa bottitiedostoa tuntemattomille.
          </p>
        </div>

        {/* Row list */}
        <div className="overflow-y-auto p-5 flex-1 flex flex-col gap-2">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-subtle gap-2">
              <Inbox className="w-7 h-7" />
              <p className="text-ui font-medium text-text">Ei ympäristömuuttujia</p>
              <p className="text-label">Lisää esim. DISCORD_TOKEN alla olevalla napilla.</p>
            </div>
          ) : (
            <>
              {/* Column labels */}
              <div className="grid grid-cols-[1fr_1fr_32px] gap-2 mb-1 text-section text-subtle font-semibold uppercase">
                <span>Avain (KEY)</span>
                <span>Arvo (VALUE)</span>
                <span />
              </div>
              {rows.map((row, i) => {
                const isSensitive = SENSITIVE_RE.test(row.k);
                return (
                  <div key={i} className="grid grid-cols-[1fr_1fr_32px] gap-2 items-center">
                    <input
                      value={row.k}
                      onChange={e => upd(i, "k", e.target.value)}
                      placeholder="DISCORD_TOKEN"
                      className="field font-mono"
                    />
                    <input
                      type={isSensitive ? "password" : "text"}
                      value={row.v}
                      onChange={e => upd(i, "v", e.target.value)}
                      placeholder="arvo"
                      className="field font-mono"
                    />
                    <button
                      onClick={() => delRow(i)}
                      className="btn btn-ghost btn-icon btn-sm text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </>
          )}

          <div className="flex gap-2 mt-2">
            <button onClick={addRow} className="btn btn-ghost border border-dashed border-line flex-1 text-muted hover:text-text">
              <Plus className="w-4 h-4" /> Lisää muuttuja
            </button>
            <button onClick={importEnv} className="btn btn-ghost border border-dashed border-line flex-1 text-muted hover:text-text">
              <FolderOpen className="w-4 h-4" /> Tuo .env-tiedostosta
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-line shrink-0">
          <button onClick={onClose} className="btn btn-ghost flex-1">Peruuta</button>
          <button onClick={save} className="btn btn-primary flex-2">Tallenna muutokset</button>
        </div>
      </div>
    </div>
  );
}

function parseEnvContent(content) {
  const vars = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) vars[key] = val;
  }
  return vars;
}

