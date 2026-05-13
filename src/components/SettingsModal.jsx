import { useState, useEffect } from "react";
import {
  X, Settings, Monitor, RefreshCw, Bell, FileText, Info,
  ExternalLink, Check,
} from "lucide-react";

const SECTIONS = [
  { id: "behavior",      label: "Käyttäytyminen", icon: Monitor },
  { id: "updates",       label: "Päivitykset",    icon: RefreshCw },
  { id: "notifications", label: "Ilmoitukset",    icon: Bell },
  { id: "logs",          label: "Lokit",          icon: FileText },
  { id: "about",         label: "Tietoja",        icon: Info },
];

const UPDATE_INTERVALS = [
  { value: 15,  label: "15 minuuttia" },
  { value: 30,  label: "30 minuuttia" },
  { value: 60,  label: "1 tunti" },
  { value: 360, label: "6 tuntia" },
  { value: 720, label: "12 tuntia" },
  { value: 0,   label: "Vain manuaalisesti" },
];

const LOG_LINE_OPTIONS = [
  { value: 500,  label: "500 riviä" },
  { value: 1000, label: "1 000 riviä" },
  { value: 2000, label: "2 000 riviä" },
  { value: 5000, label: "5 000 riviä" },
  { value: 0,    label: "Ei rajoitusta" },
];

function Toggle({ value, onChange, disabled }) {
  return (
    <div
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 36, height: 20, borderRadius: 10, flexShrink: 0,
        background: value ? "#5865F2" : "#20202a",
        border: `1px solid ${value ? "#5865F2" : "#2a2a3a"}`,
        position: "relative", transition: "background 0.2s",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <div style={{
        position: "absolute", top: 2, left: value ? 17 : 2,
        width: 14, height: 14, borderRadius: "50%",
        background: "#fff", transition: "left 0.2s",
      }} />
    </div>
  );
}

function SettingRow({ title, description, children, subRow }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: subRow ? "10px 14px 10px 36px" : "12px 14px",
      borderRadius: 9,
      border: `1px solid ${subRow ? "#13131f" : "#1e1e35"}`,
      background: subRow ? "rgba(255,255,255,0.01)" : "rgba(88,101,242,0.03)",
      marginBottom: 8,
    }}>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: subRow ? 500 : 600, color: subRow ? "#9a9ab0" : "#e3e5e8" }}>{title}</p>
        {description && <p style={{ margin: "2px 0 0", fontSize: 11, color: "#4e5058" }}>{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{
        padding: "6px 10px", borderRadius: 7,
        background: "#0b0b14", border: "1px solid #1e1e35",
        color: "#e3e5e8", fontSize: 12, cursor: "pointer", outline: "none",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function SettingsModal({ onClose, appVersion }) {
  const [section, setSection] = useState("behavior");
  const [settings, setSettings] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMsg, setUpdateMsg] = useState(null);

  useEffect(() => {
    window.api.getSettings?.().then(setSettings);
  }, []);

  const set = async (key, value) => {
    const updated = await window.api.setSetting?.(key, value);
    setSettings(updated);
  };

  if (!settings) return null;

  const SectionIcon = SECTIONS.find((s) => s.id === section)?.icon ?? Settings;

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateMsg(null);
    try {
      const result = await window.api.checkForUpdate?.();
      if (result?.status === "dev") setUpdateMsg("Kehitystila — ei päivityksiä");
      else setUpdateMsg("Tarkistus käynnistetty…");
    } catch {
      setUpdateMsg("Tarkistus epäonnistui");
    } finally {
      setCheckingUpdate(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60,
    }}>
      <div style={{
        background: "#0f0f1c", border: "1px solid #1e1e35", borderRadius: 14,
        width: 680, maxHeight: "85vh", display: "flex", flexDirection: "column",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
      }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "18px 22px", borderBottom: "1px solid #17172a", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(88,101,242,0.15)", border: "1px solid rgba(88,101,242,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Settings size={16} color="#5865F2" />
          </div>
          <h2 style={{ flex: 1, margin: 0, fontSize: 16, fontWeight: 700, color: "#f2f3f5" }}>Asetukset</h2>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 7, border: "1px solid #1e1e2a", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#4e5058" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a3a"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e2a"}>
            <X size={14} />
          </button>
        </div>

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

          {/* Sidebar nav */}
          <nav style={{ width: 160, borderRight: "1px solid #17172a", padding: "12px 8px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button key={id} onClick={() => setSection(id)} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 10px", borderRadius: 7, border: "none",
                  background: active ? "rgba(88,101,242,0.15)" : "transparent",
                  color: active ? "#949cf7" : "#4e5058", cursor: "pointer",
                  fontSize: 13, fontWeight: active ? 600 : 400,
                  textAlign: "left", transition: "all 0.1s",
                }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "#9a9ab0"; } }}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4e5058"; } }}
                >
                  <Icon size={14} />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div style={{ flex: 1, padding: "18px 20px", overflowY: "auto" }}>

            {/* ── Käyttäytyminen ── */}
            {section === "behavior" && (
              <>
                <h3 style={sectionTitle}>Käyttäytyminen</h3>

                <SettingRow
                  title="Käynnisty Windowsin kanssa"
                  description="Sovellus avataan automaattisesti kun kirjaudut sisään"
                >
                  <Toggle value={settings.launchOnStartup} onChange={(v) => set("launchOnStartup", v)} />
                </SettingRow>

                <SettingRow
                  title="Pienennä lokeroon sulkiessa"
                  description="X-nappi piilottaa sovelluksen tehtäväpalkin lokeroon — botit jatkavat"
                >
                  <Toggle value={settings.minimizeToTrayOnClose} onChange={(v) => set("minimizeToTrayOnClose", v)} />
                </SettingRow>

                <SettingRow
                  title="Käynnisty minimoituna"
                  description="Sovellus avautuu suoraan lokeron kautta eikä näytä ikkunaa"
                >
                  <Toggle value={settings.startMinimized} onChange={(v) => set("startMinimized", v)} />
                </SettingRow>
              </>
            )}

            {/* ── Päivitykset ── */}
            {section === "updates" && (
              <>
                <h3 style={sectionTitle}>Päivitykset</h3>

                <SettingRow
                  title="Lataa päivitykset automaattisesti"
                  description="Uusi versio ladataan taustalla heti kun se on saatavilla"
                >
                  <Toggle value={settings.autoDownloadUpdates} onChange={(v) => set("autoDownloadUpdates", v)} />
                </SettingRow>

                <SettingRow title="Tarkistusväli" description="Kuinka usein sovellus tarkistaa uudet versiot">
                  <SelectInput
                    value={settings.updateCheckIntervalMin}
                    options={UPDATE_INTERVALS}
                    onChange={(v) => set("updateCheckIntervalMin", v)}
                  />
                </SettingRow>

                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 16px", borderRadius: 8,
                      border: "1px solid #1e1e35", background: "transparent",
                      color: checkingUpdate ? "#4e5058" : "#949cf7", cursor: checkingUpdate ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 500,
                    }}
                    onMouseEnter={e => { if (!checkingUpdate) e.currentTarget.style.borderColor = "#2a2a4a"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e35"; }}
                  >
                    <RefreshCw size={13} style={checkingUpdate ? { animation: "spin 1s linear infinite" } : {}} />
                    Tarkista päivitykset nyt
                  </button>
                  {updateMsg && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4e5058" }}>{updateMsg}</p>
                  )}
                </div>
              </>
            )}

            {/* ── Ilmoitukset ── */}
            {section === "notifications" && (
              <>
                <h3 style={sectionTitle}>Ilmoitukset</h3>

                <SettingRow
                  title="Windows-ilmoitukset käytössä"
                  description="Näyttää järjestelmäilmoituksia tapahtumista"
                >
                  <Toggle value={settings.notificationsEnabled} onChange={(v) => set("notificationsEnabled", v)} />
                </SettingRow>

                <SettingRow
                  title="Botti tuli online"
                  description="Ilmoitus kun botti käynnistyy onnistuneesti"
                  subRow
                >
                  <Toggle
                    value={settings.notifyOnBotOnline}
                    onChange={(v) => set("notifyOnBotOnline", v)}
                    disabled={!settings.notificationsEnabled}
                  />
                </SettingRow>

                <SettingRow
                  title="Botti kaatui"
                  description="Ilmoitus kun botti kohtaa virheen tai kaatuu"
                  subRow
                >
                  <Toggle
                    value={settings.notifyOnBotCrash}
                    onChange={(v) => set("notifyOnBotCrash", v)}
                    disabled={!settings.notificationsEnabled}
                  />
                </SettingRow>
              </>
            )}

            {/* ── Lokit ── */}
            {section === "logs" && (
              <>
                <h3 style={sectionTitle}>Lokit</h3>

                <SettingRow
                  title="Maksimilokirivit per botti"
                  description="Vanhimmat rivit poistetaan automaattisesti rajan täyttyessä"
                >
                  <SelectInput
                    value={settings.maxLogLines}
                    options={LOG_LINE_OPTIONS}
                    onChange={(v) => set("maxLogLines", v)}
                  />
                </SettingRow>

                <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 9, background: "rgba(88,101,242,0.05)", border: "1px solid #1a1a30" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#4e5058", lineHeight: 1.6 }}>
                    Lokit säilyvät vain session ajan — sovelluksen uudelleenkäynnistys tyhjentää ne.
                    Voit viedä lokit tiedostoon LogPanel-näkymän latauspainikkeesta.
                  </p>
                </div>
              </>
            )}

            {/* ── Tietoja ── */}
            {section === "about" && (
              <>
                <h3 style={sectionTitle}>Tietoja</h3>

                <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px", borderRadius: 10, border: "1px solid #1e1e35", background: "rgba(88,101,242,0.04)", marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(88,101,242,0.1)", border: "1px solid rgba(88,101,242,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Settings size={22} color="#5865F2" />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#f2f3f5" }}>Tiksu Bot Manager</p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4e5058" }}>Versio {appVersion ?? "…"}</p>
                    <p style={{ margin: "1px 0 0", fontSize: 11, color: "#2a2a4a" }}>IT-Veljekset Group</p>
                  </div>
                </div>

                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); /* shell.openExternal handled by main is not available directly; use a dedicated IPC or just show text */ }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 9, border: "1px solid #1e1e35", color: "#949cf7", fontSize: 13, textDecoration: "none", marginBottom: 8 }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a4a"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e1e35"}
                >
                  <ExternalLink size={13} />
                  github.com/Pastorilaine/Tiksu-bot-manager
                </a>

                <div style={{ marginTop: 16 }}>
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "9px 16px", borderRadius: 8,
                      border: "1px solid #1e1e35", background: "transparent",
                      color: checkingUpdate ? "#4e5058" : "#949cf7", cursor: checkingUpdate ? "not-allowed" : "pointer",
                      fontSize: 13, fontWeight: 500,
                    }}
                    onMouseEnter={e => { if (!checkingUpdate) e.currentTarget.style.borderColor = "#2a2a4a"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "#1e1e35"; }}
                  >
                    <RefreshCw size={13} style={checkingUpdate ? { animation: "spin 1s linear infinite" } : {}} />
                    Tarkista päivitykset
                  </button>
                  {updateMsg && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4e5058" }}>{updateMsg}</p>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid #17172a", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
          <button onClick={onClose} style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 20px", borderRadius: 8, border: "none",
            background: "#5865F2", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}
            onMouseEnter={e => e.currentTarget.style.background = "#4752C4"}
            onMouseLeave={e => e.currentTarget.style.background = "#5865F2"}
          >
            <Check size={14} /> Valmis
          </button>
        </div>

      </div>
    </div>
  );
}

const sectionTitle = {
  margin: "0 0 14px",
  fontSize: 13,
  fontWeight: 700,
  color: "#5865F2",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
