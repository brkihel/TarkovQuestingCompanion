import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { TarkovMap } from "./components/TarkovMap";
import { FilterPanel } from "./components/FilterPanel";
import { SettingsModal } from "./components/SettingsModal";
import { QuestGuideModal } from "./components/QuestGuideModal";
import { useSettings } from "./settings";
import type { PlayerPose } from "./lib/player";
import { MAPS, DEFAULT_MAP_KEY, getMapByKey } from "./maps/mapsConfig";
import { buildLayers, defaultVisibleIds } from "./maps/layerDefs";
import {
  fetchTasks,
  fetchMapMarkers,
  fetchStoryline,
  fetchQuestGuides,
  fetchQuestImages,
  markersForMap,
  type Task,
  type AllMapMarkers,
  type StorylineQuest,
} from "./lib/tarkovApi";
import "./App.css";

const VISIBLE_KEY = "tqc:visible:v1";
const SELECTED_QUESTS_KEY = "tqc:selectedQuests:v1";
const AUTO_MAP_KEY = "tqc:autoMap:v1";

function loadAutoMap(): boolean {
  return localStorage.getItem(AUTO_MAP_KEY) !== "0";
}

function loadVisible(): Set<string> {
  try {
    const raw = localStorage.getItem(VISIBLE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set(defaultVisibleIds());
}

function loadSelectedQuests(): Set<string> {
  try {
    const raw = localStorage.getItem(SELECTED_QUESTS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function App() {
  const [mapKey, setMapKey] = useState(DEFAULT_MAP_KEY);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mapMarkers, setMapMarkers] = useState<AllMapMarkers>({});
  const [storyline, setStoryline] = useState<StorylineQuest[]>([]);
  const [guides, setGuides] = useState<Record<string, string>>({});
  const [questImages, setQuestImages] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const [visible, setVisible] = useState<Set<string>>(loadVisible);
  const [selectedQuests, setSelectedQuests] = useState<Set<string>>(loadSelectedQuests);
  const [player, setPlayer] = useState<PlayerPose | null>(null);
  const [autoMap, setAutoMap] = useState<boolean>(loadAutoMap);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideSeo, setGuideSeo] = useState<string | null>(null);
  const [questTab, setQuestTab] = useState<"map" | "storyline">("map");
  const { t, iconSize } = useSettings();

  const config = useMemo(() => getMapByKey(mapKey), [mapKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([fetchTasks(), fetchMapMarkers()])
      .then(([t, mm]) => {
        if (!alive) return;
        setTasks(t);
        setMapMarkers(mm);
        setError(null);
      })
      .catch((e) => alive && setError(String(e)))
      .finally(() => alive && setLoading(false));
    // storyline é opcional: se faltar o arquivo, a seção só não aparece
    fetchStoryline()
      .then((s) => alive && setStoryline(s.quests))
      .catch(() => {});
    // links de guia (tarkov.help) por taskId — opcional
    fetchQuestGuides()
      .then((g) => alive && setGuides(g))
      .catch(() => {});
    // imagens de localização por task — opcional
    fetchQuestImages()
      .then((im) => alive && setQuestImages(im))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // fecha a splash e mostra a janela principal quando o load inicial termina
  useEffect(() => {
    if (loading) return;
    const id = window.setTimeout(() => {
      invoke("finish_splash").catch(() => {});
    }, 400);
    return () => clearTimeout(id);
  }, [loading]);

  // persiste filtros
  useEffect(() => {
    try {
      localStorage.setItem(VISIBLE_KEY, JSON.stringify([...visible]));
    } catch {
      /* ignore */
    }
  }, [visible]);

  // persiste as quests marcadas e sincroniza com o minimap (via estado no Rust)
  useEffect(() => {
    const ids = [...selectedQuests];
    try {
      localStorage.setItem(SELECTED_QUESTS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    invoke("set_selected_quests", { ids }).catch(() => {});
  }, [selectedQuests]);

  // sincroniza o mapa selecionado com o minimap (via estado no Rust)
  useEffect(() => {
    invoke("set_selected_map", { key: mapKey }).catch(() => {});
  }, [mapKey]);

  // posição/direção do jogador (mesmo evento do minimap)
  useEffect(() => {
    const un = listen<PlayerPose>("player-position", (e) => setPlayer(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  // persiste a preferência de autodetecção
  useEffect(() => {
    localStorage.setItem(AUTO_MAP_KEY, autoMap ? "1" : "0");
  }, [autoMap]);

  // autodetecção: o Rust lê os logs do EFT e avisa qual mapa carregou in-game.
  // Trocar `mapKey` já sincroniza o minimap (via set_selected_map -> map-selected).
  const autoMapRef = useRef(autoMap);
  autoMapRef.current = autoMap;
  useEffect(() => {
    const un = listen<string>("map-detected", (e) => {
      if (autoMapRef.current) {
        setMapKey((cur) => (cur === e.payload ? cur : e.payload));
      }
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  const questMarkers = useMemo(
    () => markersForMap(tasks, [config.key, ...(config.altKeys ?? [])]),
    [tasks, config],
  );

  // só vão pro mapa os marcadores das quests marcadas na lista
  const visibleQuestMarkers = useMemo(
    () => questMarkers.filter((m) => selectedQuests.has(m.taskId)),
    [questMarkers, selectedQuests],
  );

  const layers = useMemo(
    () => buildLayers(visibleQuestMarkers, mapMarkers[config.key]),
    [visibleQuestMarkers, mapMarkers, config],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of layers) c[l.id] = l.markers.length;
    return c;
  }, [layers]);

  const setLayerVisible = (ids: string[], on: boolean) => {
    setVisible((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  // marca/desmarca uma quest: marcada => marcadores no mapa (+ foca nela)
  const toggleQuest = (q: { id: string; zoneId: string }) => {
    const turningOn = !selectedQuests.has(q.id);
    setSelectedQuests((prev) => {
      const next = new Set(prev);
      if (turningOn) next.add(q.id);
      else next.delete(q.id);
      return next;
    });
    if (turningOn) setFocusZoneId(q.zoneId);
  };

  // abre o guia da quest nativamente (modal dentro do app)
  const openGuide = (seoLink: string) => setGuideSeo(seoLink);

  // lista de quests únicas do mapa (para marcar/focar)
  const questsOnMap = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; trader: string | null; zoneId: string }>();
    for (const m of questMarkers) {
      if (!seen.has(m.taskId)) {
        seen.set(m.taskId, { id: m.taskId, name: m.taskName, trader: m.trader, zoneId: m.zoneId });
      }
    }
    return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [questMarkers]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <img className="brand-mark" src="/brand/logo.png" alt="Tarkov Questing Companion" />
            <div className="brand-text">
              <strong>Tarkov Questing</strong>
              <span>{t("brand.companion")}</span>
            </div>
            <button
              className="settings-btn"
              title={t("settings.open")}
              aria-label={t("settings.open")}
              onClick={() => setSettingsOpen(true)}
            >
              ⚙
            </button>
          </div>

          <label className="field">
            <span className="field-label">{t("nav.map")}</span>
            <select className="select" value={mapKey} onChange={(e) => setMapKey(e.target.value)}>
              {MAPS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="auto-map" title={t("autoMap.title")}>
            <input
              type="checkbox"
              checked={autoMap}
              onChange={(e) => setAutoMap(e.target.checked)}
            />
            <span>{t("autoMap.label")}</span>
          </label>

          <button
            className="overlay-btn"
            onClick={() => invoke("toggle_minimap").catch(() => {})}
            title={t("minimap.toggleTitle")}
          >
            🗺 {t("minimap.overlayBtn")} <kbd>Shift+N</kbd>
          </button>

          <div className="hotkeys">
            <span><kbd>Shift+M</kbd> {t("hotkeys.mapFront")}</span>
            <span><kbd>Shift+N</kbd> {t("hotkeys.minimap")} · <kbd>F9</kbd> {t("hotkeys.clickThrough")}</span>
          </div>
        </div>

        <div className="sidebar-scroll">
          {loading && <p className="panel-empty">{t("state.loading")}</p>}
          {error && <p className="panel-error">{t("state.error")}: {error}</p>}

          {!loading && !error && (
            <>
              {storyline.length > 0 && (
                <div className="quest-tabs" role="tablist">
                  <button
                    role="tab"
                    aria-selected={questTab === "map"}
                    className={`quest-tab${questTab === "map" ? " active" : ""}`}
                    onClick={() => setQuestTab("map")}
                  >
                    🗺 {t("tab.map")}
                  </button>
                  <button
                    role="tab"
                    aria-selected={questTab === "storyline"}
                    className={`quest-tab${questTab === "storyline" ? " active" : ""}`}
                    onClick={() => setQuestTab("storyline")}
                  >
                    📖 {t("tab.storyline")} <span className="tab-count">{storyline.length}</span>
                  </button>
                </div>
              )}

              {questTab === "map" && (
                <>
                  <FilterPanel visible={visible} counts={counts} onSet={setLayerVisible} />

                  <div className="panel">
                    <h3 className="panel-title">
                      {t("quests.title")} {questsOnMap.length > 0 && <span className="count">{questsOnMap.length}</span>}
                      {selectedQuests.size > 0 && (
                        <button className="panel-action" onClick={() => setSelectedQuests(new Set())}>
                          {t("quests.clear")} ({selectedQuests.size})
                        </button>
                      )}
                    </h3>
                    {questsOnMap.length === 0 && (
                      <p className="panel-empty">{t("quests.empty")}</p>
                    )}
                    <ul className="quest-list">
                      {questsOnMap.map((q) => {
                        const on = selectedQuests.has(q.id);
                        const guide = guides[q.id];
                        return (
                          <li key={q.id} className="quest-li">
                            <button
                              className={`quest-item${on ? " active" : ""}`}
                              aria-pressed={on}
                              onClick={() => toggleQuest(q)}
                            >
                              <span className="quest-name">{q.name}</span>
                              {q.trader && <span className="quest-trader">{q.trader}</span>}
                            </button>
                            {guide && (
                              <button
                                className="quest-guide-btn"
                                title={t("quests.viewGuide")}
                                aria-label={t("quests.viewGuide")}
                                onClick={() => openGuide(guide)}
                              >
                                ↗
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </>
              )}

              {questTab === "storyline" && storyline.length > 0 && (
                <div className="panel story-panel">
                  <p className="story-intro">{t("storyline.intro")}</p>
                  <ol className="story-list">
                    {storyline.map((q, i) => (
                      <li key={q.id} className="story-item">
                        <button className="story-btn" title={t("guide.open")} onClick={() => openGuide(q.seoLink)}>
                          <span className="story-num">{i + 1}</span>
                          <span className="story-name">{q.name}</span>
                          <span className="story-meta">
                            {q.kappaReq && <span className="badge badge-kappa">Kappa</span>}
                            <span className="quest-guide">↗</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="sidebar-footer">
          <span>{t("footer.offline")}</span>
        </footer>
      </aside>

      <main className="map-area">
        <TarkovMap
          config={config}
          layers={layers}
          visible={visible}
          focusZoneId={focusZoneId}
          player={player}
          questImages={questImages}
          questGuides={guides}
          onOpenGuide={setGuideSeo}
          objectiveSize={iconSize}
        />
      </main>

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {guideSeo && <QuestGuideModal seo={guideSeo} onClose={() => setGuideSeo(null)} />}
    </div>
  );
}

export default App;
