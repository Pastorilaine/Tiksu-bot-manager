import { useState, useEffect } from "react";
import {
  X, Settings, Monitor, RefreshCw, Bell, FileText, Info,
  ExternalLink, Check, SunMoon,
} from "lucide-react";

const SECTIONS = [
  { id: "behavior",      label: "Käyttäytyminen", icon: Monitor },
  { id: "updates",       label: "Päivitykset",    icon: RefreshCw },
  { id: "notifications", label: "Ilmoitukset",    icon: Bell },
  { id: "logs",          label: "Lokit",          icon: FileText },
  { id: "about",         label: "Tietoja",        icon: Info },
];

const THEME_OPTIONS = [
  { value: "system", label: "Järjestelmä" },
  { value: "dark",   label: "Tumma" },
  { value: "light",  label: "Vaalea" },
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
      className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0 border ${
        value ? "bg-accent border-accent" : "bg-surface-2 border-line"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-accent-fg transition-all ${value ? "left-4.5" : "left-0.5"}`} />
    </div>
  );
}

function SettingRow({ title, description, children, subRow }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-md border mb-2 ${
      subRow ? "pl-9 border-line/50 bg-surface/30" : "border-line bg-surface-2/50"
    }`}>
      <div className="flex-1">
        <p className={`text-ui ${subRow ? "font-normal text-muted" : "font-medium text-text"}`}>{title}</p>
        {description && <p className="text-label text-subtle mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function SelectInput({ value, options, onChange, isString }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(isString ? e.target.value : Number(e.target.value))}
      className="field w-auto min-w-[130px]"
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

  // The main banner is hidden behind this modal, so report update results here too
  useEffect(() => {
    const done = (msg) => { setCheckingUpdate(false); setUpdateMsg(msg); };
    const off = [
      window.api.onUpdateNotAvailable?.(() => done("Sovellus on ajan tasalla")),
      window.api.onUpdateAvailable?.((d) => done(`Versio ${d.version} on saatavilla`)),
      window.api.onUpdateProgress?.((d) => setUpdateMsg(`Ladataan… ${d.percent} %`)),
      window.api.onUpdateDownloaded?.((d) => done(`Versio ${d.version} ladattu — asennetaan kun suljet sovelluksen`)),
      window.api.onUpdateError?.((d) => done(`Tarkistus epäonnistui${d?.message ? `: ${d.message}` : ""}`)),
      window.api.onUpdateInstallError?.((d) => done(`Asennus epäonnistui${d?.message ? `: ${d.message}` : ""}`)),
    ];
    return () => off.forEach((f) => f?.());
  }, []);

  const set = async (key, value) => {
    const updated = await window.api.setSetting?.(key, value);
    setSettings(updated);
    if (key === 'theme') {
      if (value === 'light') document.documentElement.setAttribute('data-theme', 'light');
      else if (value === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
      else document.documentElement.removeAttribute('data-theme');
    }
  };

  if (!settings) return null;

  const handleCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateMsg("Tarkistetaan…");
    try {
      const result = await window.api.checkForUpdate?.();
      // Dev mode emits no updater events — the reply is the only answer we get
      if (result?.status === "dev") {
        setCheckingUpdate(false);
        setUpdateMsg("Kehitystila — päivitykset eivät ole käytössä");
      }
    } catch {
      setCheckingUpdate(false);
      setUpdateMsg("Tarkistus epäonnistui");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/65 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div className="panel w-[680px] max-h-[85vh] flex flex-col shadow-float bg-surface border border-line rounded-lg overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-line shrink-0">
          <div className="w-8 h-8 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4 text-accent" />
          </div>
          <h2 className="flex-1 text-title font-semibold text-text">Asetukset</h2>
          <button onClick={onClose} className="btn btn-ghost btn-icon">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">

          {/* Sidebar nav */}
          <nav className="w-40 border-r border-line p-2 shrink-0 flex flex-col gap-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`flex items-center gap-2.5 px-3 h-8 rounded-md text-ui text-left font-medium transition-colors border-none bg-transparent cursor-pointer ${
                    active ? "bg-accent/15 text-accent" : "text-muted hover:text-text hover:bg-surface-2"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          <div className="flex-1 p-5 overflow-y-auto">

            {/* ── Käyttäytyminen ── */}
            {section === "behavior" && (
              <>
                <h3 className="section-label mb-3">Käyttäytyminen</h3>

                <SettingRow title="Teema" description="Valitse sovelluksen väritysteema">
                  <SelectInput
                    value={settings.theme || "system"}
                    options={THEME_OPTIONS}
                    onChange={(v) => set("theme", v)}
                    isString
                  />
                </SettingRow>

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
                <h3 className="section-label mb-3">Päivitykset</h3>

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

                <div className="mt-4">
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="btn btn-ghost border border-line"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />
                    Tarkista päivitykset nyt
                  </button>
                  {updateMsg && (
                    <p className="text-label text-subtle mt-2">{updateMsg}</p>
                  )}
                </div>
              </>
            )}

            {/* ── Ilmoitukset ── */}
            {section === "notifications" && (
              <>
                <h3 className="section-label mb-3">Ilmoitukset</h3>

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
                <h3 className="section-label mb-3">Lokit</h3>

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

                <div className="mt-3 p-3 rounded-md bg-accent/5 border border-line">
                  <p className="text-label text-subtle leading-relaxed">
                    Lokit säilyvät vain session ajan — sovelluksen uudelleenkäynnistys tyhjentää ne.
                    Voit viedä lokit tiedostoon lokipaneelin lataanapista.
                  </p>
                </div>
              </>
            )}

            {/* ── Tietoja ── */}
            {section === "about" && (
              <>
                <h3 className="section-label mb-3">Tietoja</h3>

                <div className="flex items-center gap-4 p-4 rounded-md border border-line bg-surface-2/40 mb-3">
                  <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
                    <Settings className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-title font-semibold text-text">Tiksu Bot Manager</p>
                    <p className="text-label text-subtle">Versio {appVersion || "…"}</p>
                    <p className="text-meta text-subtle">IT-Veljekset Group</p>
                  </div>
                </div>

                <a
                  href="https://github.com/Pastorilaine/Tiksu-bot-manager"
                  onClick={(e) => { e.preventDefault(); window.api.openExternal?.("https://github.com/Pastorilaine/Tiksu-bot-manager"); }}
                  className="btn btn-ghost w-full justify-start gap-2 border border-line text-accent mb-3"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  github.com/Pastorilaine/Tiksu-bot-manager
                </a>

                <div className="mt-4">
                  <button
                    onClick={handleCheckUpdate}
                    disabled={checkingUpdate}
                    className="btn btn-ghost border border-line"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? "animate-spin" : ""}`} />
                    Tarkista päivitykset
                  </button>
                  {updateMsg && (
                    <p className="text-label text-subtle mt-2">{updateMsg}</p>
                  )}
                </div>
              </>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 px-5 border-t border-line flex justify-end shrink-0">
          <button onClick={onClose} className="btn btn-primary">
            <Check className="w-4 h-4" /> Valmis
          </button>
        </div>

      </div>
    </div>
  );
}

