import { useState } from "react";
import { Plus, X, FolderOpen, FileCode2, Code2, Pencil, AlertCircle } from "lucide-react";

export default function AddBotModal({ initialBot, onAdd, onEdit, onClose }) {
  const isEditMode = !!initialBot;
  const [name, setName]           = useState(initialBot?.name ?? "");
  const [type, setType]           = useState(initialBot?.type ?? "python");
  const [filePath, setFilePath]   = useState(initialBot?.filePath ?? "");
  const [autoRestart, setAutoRestart] = useState(initialBot?.autoRestart ?? true);
  const [autoStart,   setAutoStart]   = useState(initialBot?.autoStart   ?? false);
  const [loading, setLoading]     = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [envVars, setEnvVars]     = useState(initialBot?.envVars ?? {});
  const [envFile, setEnvFile]     = useState(
    initialBot && Object.keys(initialBot.envVars ?? {}).length > 0 ? '(tallennettu)' : ''
  );

  const pickFile = async () => {
    const p = await window.api.pickFile();
    if (!p) return;
    setFilePath(p);
    if (!name) setName(p.split(/[\\/]/).pop().replace(/\.[^.]+$/, ""));
    const ext = p.split(".").pop().toLowerCase();
    if (ext === "py") setType("python");
    else if (["js","mjs","cjs"].includes(ext)) setType("js");

    const content = await window.api.readBotEnv?.(p);
    if (content) {
      const parsed = parseEnvContent(content);
      const lastSlash = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'));
      if (Object.keys(parsed).length > 0) { setEnvVars(parsed); setEnvFile(p.slice(0, lastSlash + 1) + '.env'); }
    }
  };

  const importEnv = async () => {
    const result = await window.api.pickEnvFile?.();
    if (!result) return;
    const parsed = parseEnvContent(result.content);
    setEnvVars(parsed);
    setEnvFile(result.filePath);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    if (!name.trim() || !filePath.trim()) return;
    setLoading(true);
    let res;
    if (isEditMode) {
      res = await onEdit({ name: name.trim(), type, filePath: filePath.trim(), autoRestart, autoStart, envVars });
    } else {
      res = await onAdd({ name: name.trim(), type, filePath: filePath.trim(), autoRestart, autoStart, envVars });
    }
    setLoading(false);
    if (res?.error) {
      setErrorMessage(res.error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel w-[440px] shadow-float bg-surface border border-line rounded-lg overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
          <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            {isEditMode ? <Pencil className="w-4 h-4 text-accent" /> : <Plus className="w-4 h-4 text-accent" />}
          </div>
          <h2 className="flex-1 text-title font-semibold text-text">{isEditMode ? "Muokkaa bottia" : "Lisää uusi botti"}</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 flex flex-col gap-4">

          {errorMessage && (
            <div className="flex items-center gap-2 p-2.5 rounded-md bg-danger/10 border border-danger/30 text-danger text-label">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="field-label">Botin nimi</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Esim. Moderaattori" required className="field" />
          </div>

          {/* Type */}
          <div>
            <label className="field-label">Tyyppi</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {[["python","Python"], ["js","JavaScript"]].map(([val, lbl]) => (
                <button
                  type="button"
                  key={val}
                  onClick={() => setType(val)}
                  className={`btn ${type === val ? "btn-primary" : "btn-ghost border-line"}`}
                >
                  {val === "python" ? <FileCode2 className="w-4 h-4" /> : <Code2 className="w-4 h-4" />}
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File picker */}
          <div>
            <label className="field-label">Tiedostopolku</label>
            <div className="flex gap-2 mt-1">
              <input value={filePath} onChange={e => setFilePath(e.target.value)} placeholder={type === "python" ? "bot.py" : "bot.js"} required className="field flex-1" />
              <button type="button" onClick={pickFile} className="btn shrink-0">
                <FolderOpen className="w-4 h-4" /> Selaa
              </button>
            </div>
          </div>

          {/* .env file */}
          <div>
            <label className="field-label">Ympäristömuuttujat <span className="font-normal text-subtle">(valinnainen)</span></label>
            {envFile ? (
              <div className="flex items-center gap-2 p-2.5 rounded-md bg-success/10 border border-success/30 text-success text-label mt-1">
                <FileCode2 className="w-4 h-4 shrink-0" />
                <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                  {Object.keys(envVars).length} muuttujaa tuotu · {envFile.split(/[\\/]/).pop()}
                </span>
                <button type="button" onClick={() => { setEnvVars({}); setEnvFile(''); }} className="btn btn-ghost btn-icon w-6 h-6">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button type="button" onClick={importEnv} className="btn btn-ghost w-full border border-dashed border-line text-muted hover:text-text mt-1">
                <FolderOpen className="w-4 h-4" /> Tuo .env-tiedostosta
              </button>
            )}
          </div>

          {/* Auto-restart */}
          <label className="flex items-center gap-3 p-3 rounded-md border border-line bg-surface-2 cursor-pointer select-none">
            <input type="checkbox" checked={autoRestart} onChange={e => setAutoRestart(e.target.checked)} className="accent-accent w-4 h-4" />
            <div>
              <p className="text-ui font-medium text-text">Automaattinen uudelleenkäynnistys</p>
              <p className="text-label text-subtle">Botti käynnistyy uudelleen kaatumisen jälkeen</p>
            </div>
          </label>

          {/* Auto-start */}
          <label className="flex items-center gap-3 p-3 rounded-md border border-line bg-surface-2 cursor-pointer select-none">
            <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} className="accent-accent w-4 h-4" />
            <div>
              <p className="text-ui font-medium text-text">Käynnisty automaattisesti</p>
              <p className="text-label text-subtle">Botti käynnistyy kun sovellus avataan</p>
            </div>
          </label>

          {/* Footer */}
          <div className="flex gap-2 pt-2 border-t border-line">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Peruuta</button>
            <button type="submit" disabled={loading} className="btn btn-primary flex-2">
              {loading ? "Tallennetaan…" : isEditMode ? <><Pencil className="w-4 h-4" /> Tallenna muutokset</> : <><Plus className="w-4 h-4" /> Lisää botti</>}
            </button>
          </div>
        </form>
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

