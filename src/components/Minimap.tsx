import { useQuestProgress } from "../lib/useQuestProgress";
import { progressId } from "../lib/planner";
import { addMapArtwork } from "../maps/artwork";
import { floorsForMap, floorForY, showOnFloor } from "../maps/floors";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getMapByKey } from "../maps/mapsConfig";
import { getCRS, getBounds, gamePos } from "../maps/leafletCrs";
import { fetchTasks, markersForMap, type Task } from "../lib/tarkovApi";
import { displayAngle, playerIcon, headingOffsetFor, type PlayerPose } from "../lib/player";
import { useSettings } from "../settings";
import "./minimap.css";

export function Minimap() {
  const { t, gameMode, lang } = useSettings();
  const { completed } = useQuestProgress(gameMode);
  const completedRef = useRef(completed);
  completedRef.current = completed;
  const artworkRef = useRef<ReturnType<typeof addMapArtwork> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const playerRef = useRef<L.Marker | null>(null);
  const lastPoseRef = useRef<PlayerPose | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const tasksRef = useRef<Task[] | null>(null);
  const [mapKey, setMapKey] = useState("customs");
  const [selectedQuests, setSelectedQuests] = useState<Set<string>>(new Set());
  const [positionAge, setPositionAge] = useState<number | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const observed = lastPoseRef.current?.observedAt;
      setPositionAge(observed ? Math.max(0, Math.floor((Date.now() - observed) / 1000)) : null);
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const [clickThrough, setClickThrough] = useState(false);

  const config = getMapByKey(mapKey);
  const configRef = useRef(config);
  configRef.current = config;
  const selectedRef = useRef(selectedQuests);
  selectedRef.current = selectedQuests;

  // (re)desenha os marcadores das quests marcadas no mapa atual.
  function renderQuestMarkers() {
    const layer = markerLayerRef.current;
    const tasks = tasksRef.current;
    if (!layer || !tasks) return;
    layer.clearLayers();
    const sel = selectedRef.current;
    const cfg = configRef.current;
    for (const m of markersForMap(tasks, [cfg.key, ...(cfg.altKeys ?? [])])) {
      if (!sel.has(m.taskId) || completedRef.current.has(progressId(m.taskId, m.objectiveId))) continue;
      const floors = floorsForMap(cfg.key);
      const pose = lastPoseRef.current;
      if (floors && pose && !showOnFloor(floors, floorForY(floors, pose.y).id, m.y)) continue;
      L.circleMarker(gamePos(m.x, m.z) as L.LatLngExpression, {
        radius: 4,
        color: "#c9b471",
        weight: 1,
        fillColor: "#9a8c5c",
        fillOpacity: 0.9,
      }).addTo(layer);
    }
  }

  function updatePlayer(pose: PlayerPose) {
    lastPoseRef.current = pose;
    const map = mapRef.current;
    if (!map) return;
    const floors = floorsForMap(configRef.current.key);
    if (floors) artworkRef.current?.setFloor(floorForY(floors, pose.y).id);
    renderQuestMarkers();
    const angle = displayAngle(pose, configRef.current.coordinateRotation, headingOffsetFor(configRef.current));
    const latlng = gamePos(pose.x, pose.z) as L.LatLngExpression;
    if (!playerRef.current) {
      playerRef.current = L.marker(latlng, { icon: playerIcon(angle), zIndexOffset: 1000 }).addTo(map);
    } else {
      playerRef.current.setLatLng(latlng);
      playerRef.current.setIcon(playerIcon(angle));
    }
    map.setView(latlng, map.getZoom(), { animate: true });
  }

  // (re)constrói o mapa quando o mapa selecionado muda.
  useEffect(() => {
    lastPoseRef.current = null;
    const el = ref.current;
    if (!el) return;
    const bounds = getBounds(config.bounds);

    const map = L.map(el, {
      crs: getCRS(config),
      minZoom: config.minZoom,
      maxZoom: Math.max(7, config.maxZoom),
      zoomControl: false,
      attributionControl: false,
      zoomSnap: 0.25,
    });

    artworkRef.current = addMapArtwork(map, config);
    map.setView(bounds.getCenter(), Math.max(config.minZoom, config.maxZoom - 2));

    // a janela do minimap começa escondida (tamanho 0); ao exibir, o Leaflet
    // precisa recalcular o tamanho, senão o centro/marcador saem do lugar.
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      if (lastPoseRef.current) {
        map.setView(gamePos(lastPoseRef.current.x, lastPoseRef.current.z) as L.LatLngExpression, map.getZoom());
      }
    });
    ro.observe(el);

    markerLayerRef.current = L.layerGroup().addTo(map);
    renderQuestMarkers();

    mapRef.current = map;
    playerRef.current = null; // marcador some com o mapa antigo
    if (lastPoseRef.current) updatePlayer(lastPoseRef.current);

    return () => {
      ro.disconnect();
      artworkRef.current?.dispose();
      artworkRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapKey]);

  // estado inicial + escuta de eventos.
  useEffect(() => {
    invoke<string>("get_selected_map")
      .then((k) => setMapKey(k))
      .catch(() => {});
    invoke<string[]>("get_selected_quests")
      .then((ids) => setSelectedQuests(new Set(ids)))
      .catch(() => {});
    const unMap = listen<string>("map-selected", (e) => setMapKey(e.payload));
    const unPos = listen<PlayerPose>("player-position", (e) => updatePlayer(e.payload));
    const unQuests = listen<string[]>("quests-selected", (e) =>
      setSelectedQuests(new Set(e.payload)),
    );

    return () => {
      unMap.then((f) => f()).catch(() => {});
      unPos.then((f) => f()).catch(() => {});
      unQuests.then((f) => f()).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    tasksRef.current = null;
    markerLayerRef.current?.clearLayers();
    fetchTasks(gameMode, lang).then((tasks) => {
      if (!alive) return;
      tasksRef.current = tasks;
      renderQuestMarkers();
    }).catch(() => {});
    return () => { alive = false; };
  }, [gameMode, lang]);

  // re-desenha quando a seleção (ou o mapa) muda.
  useEffect(() => {
    renderQuestMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuests, mapKey, completed]);

  async function toggleClickThrough() {
    try {
      setClickThrough(await invoke<boolean>("toggle_click_through"));
    } catch {
      /* fora do Tauri */
    }
  }

  async function hide() {
    try {
      await invoke("toggle_minimap");
    } catch {
      /* fora do Tauri */
    }
  }

  return (
    <div className="minimap-root">
      <div className="minimap-bar" data-tauri-drag-region>
        <span className="minimap-title" data-tauri-drag-region>
          {config.name} <small title={t("data.position")}>{positionAge == null ? "—" : `${positionAge}s`}</small>
        </span>
        <div className="minimap-actions">
          <button
            className="minimap-btn"
            title={clickThrough ? t("minimap.clickThroughOn") : t("minimap.clickThroughOff")}
            onClick={toggleClickThrough}
          >
            {clickThrough ? "🔒" : "🖱"}
          </button>
          <button className="minimap-btn" title={t("minimap.hide")} onClick={hide}>
            ✕
          </button>
        </div>
      </div>
      <div className="minimap-map" ref={ref} />
    </div>
  );
}
