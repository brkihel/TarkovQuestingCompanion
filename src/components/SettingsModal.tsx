import { useEffect, useState, type CSSProperties } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { LANGS } from "../i18n";
import { THEMES, useSettings, type IconSize } from "../settings";

const ICON_SIZES: IconSize[] = ["s", "m", "l"];

type Tab = "general" | "themes";

interface ScreenshotDirInfo {
  dir: string;
  isCustom: boolean;
  defaultDir: string;
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { t, lang, setLang, theme, setTheme, iconSize, setIconSize } = useSettings();
  const [tab, setTab] = useState<Tab>("general");
  const [shots, setShots] = useState<ScreenshotDirInfo | null>(null);

  // carrega a pasta de screenshots atual (só existe rodando dentro do Tauri)
  useEffect(() => {
    invoke<ScreenshotDirInfo>("get_screenshots_dir")
      .then(setShots)
      .catch(() => setShots(null));
  }, []);

  async function browseScreenshots() {
    try {
      const picked = await open({ directory: true, multiple: false, defaultPath: shots?.dir });
      if (typeof picked === "string") {
        setShots(await invoke<ScreenshotDirInfo>("set_screenshots_dir", { dir: picked }));
      }
    } catch {
      /* cancelado ou fora do Tauri */
    }
  }

  async function resetScreenshots() {
    try {
      setShots(await invoke<ScreenshotDirInfo>("set_screenshots_dir", { dir: null }));
    } catch {
      /* fora do Tauri */
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t("settings.title")}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{t("settings.title")}</h2>
          <button className="modal-x" title={t("settings.close")} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="modal-body">
          <nav className="modal-tabs">
            <button
              className={`modal-tab${tab === "general" ? " active" : ""}`}
              onClick={() => setTab("general")}
            >
              {t("settings.tab.general")}
            </button>
            <button
              className={`modal-tab${tab === "themes" ? " active" : ""}`}
              onClick={() => setTab("themes")}
            >
              {t("settings.tab.themes")}
            </button>
          </nav>

          <section className="modal-panel">
            {tab === "general" && (
              <div className="setting-stack">
                <div className="setting-row">
                  <label className="setting-label" htmlFor="lang-select">
                    {t("settings.language")}
                  </label>
                  <select
                    id="lang-select"
                    className="select"
                    value={lang}
                    onChange={(e) => setLang(e.target.value as typeof lang)}
                  >
                    {LANGS.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                  <p className="setting-hint">{t("settings.language.hint")}</p>
                </div>

                <div className="setting-row">
                  <span className="setting-label">{t("settings.iconSize")}</span>
                  <div className="seg-control">
                    {ICON_SIZES.map((s) => (
                      <button
                        key={s}
                        className={`seg-btn${iconSize === s ? " active" : ""}`}
                        onClick={() => setIconSize(s)}
                      >
                        <span className={`seg-dot seg-dot-${s}`} />
                        {t(`size.${s}`)}
                      </button>
                    ))}
                  </div>
                  <p className="setting-hint">{t("settings.iconSize.hint")}</p>
                </div>

                {shots && (
                  <div className="setting-row">
                    <span className="setting-label">{t("settings.screenshots")}</span>
                    <code className="path-display" title={shots.dir}>
                      {shots.dir}
                      {!shots.isCustom && (
                        <span className="path-tag">{t("settings.screenshots.default")}</span>
                      )}
                    </code>
                    <div className="setting-actions">
                      <button className="btn" onClick={browseScreenshots}>
                        {t("settings.screenshots.browse")}
                      </button>
                      <button
                        className="btn btn-ghost"
                        onClick={resetScreenshots}
                        disabled={!shots.isCustom}
                      >
                        {t("settings.screenshots.reset")}
                      </button>
                    </div>
                    <p className="setting-hint">{t("settings.screenshots.hint")}</p>
                  </div>
                )}
              </div>
            )}

            {tab === "themes" && (
              <div className="theme-grid">
                {THEMES.map((th) => {
                  const active = theme === th.id;
                  return (
                    <button
                      key={th.id}
                      className={`theme-card${active ? " active" : ""}`}
                      aria-pressed={active}
                      onClick={() => setTheme(th.id)}
                    >
                      <span
                        className={`theme-preview theme-preview-${th.id}`}
                        style={{ "--sw": th.swatch } as CSSProperties}
                      >
                        <span className="theme-swatch" />
                      </span>
                      <span className="theme-name">{t(th.nameKey)}</span>
                      <span className="theme-desc">{t(th.descKey)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
