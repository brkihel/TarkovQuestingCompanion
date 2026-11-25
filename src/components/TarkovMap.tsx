import { addMapArtwork } from "../maps/artwork";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TarkovMapConfig } from "../maps/mapsConfig";
import { getCRS, getBounds, getScaledBounds, gamePos } from "../maps/leafletCrs";
import type { MapLayerData } from "../maps/layerDefs";
import { QUEST_LAYER_ID, TRANSIT_LAYER_ID } from "../maps/layerDefs";
import {
  displayAngle,
  playerIcon,
  headingOffsetFor,
  saveHeadingOffset,
  type PlayerPose,
} from "../lib/player";
import { extractIcon, customPinIcon, lootIcon } from "../maps/markerIcons";
import { openMarkerEditor, type EditorLabels } from "../maps/markerEditor";
import { escapeHtml } from "../maps/layerDefs";
import type { CustomMarker, CustomMarkerDraft } from "../lib/customMarkers";
import type { QuestImages } from "../lib/tarkovApi";
import { floorsForMap, defaultFloor, floorForY, showOnFloor, floorArrow } from "../maps/floors";
import { FloorSwitcher } from "./FloorSwitcher";
import { OBJECTIVE_RADIUS, type IconSize } from "../settings";
import { ObjectiveTooltip, Lightbox, type CarouselPoint, type ObjectiveInfo } from "./QuestImageViewer";

interface TarkovMapProps {
  config: TarkovMapConfig;
  layers: MapLayerData[];
  visible: Set<string>;
  focusZoneId?: string | null;
  player?: PlayerPose | null;
  /** imagens de localização (do guia tarkov.help, offline): por objetivo + fallback por task */
  questImages?: QuestImages;
  /** taskId -> seoLink do guia (para abrir o guia nativo) */
  questGuides?: Record<string, string>;
  /** abre o guia nativo de uma quest (pelo seoLink) */
  onOpenGuide?: (seo: string) => void;
  /** tamanho dos marcadores de objetivo (s/m/l) */
  objectiveSize?: IconSize;
  /** marcas customizadas do usuário (alfinetes coloridos) do mapa atual */
  customMarkers?: CustomMarker[];
  /** cria uma marca (clique direito numa área vazia do mapa) */
  onAddCustomMarker?: (draft: CustomMarkerDraft) => void;
  /** remove uma marca (clique direito sobre o alfinete) */
  onRemoveCustomMarker?: (id: string) => void;
  /** labels traduzidos do editor de marca */
  markerLabels?: EditorLabels;
}

interface HoverState {
  taskId: string;
  info?: ObjectiveInfo;
  images: string[];
  seo?: string;
  point: CarouselPoint;
}

/**
 * Mapa interativo com camadas de marcadores filtráveis. Usa o CRS customizado
 * do tarkov.dev (leafletCrs.ts) para alinhar imagem e marcadores. Cada camada
 * é um LayerGroup; ligar/desligar só adiciona/remove o grupo (sem rebuild).
 */
export function TarkovMap({
  config,
  layers,
  visible,
  focusZoneId,
  player,
  questImages,
  questGuides,
  onOpenGuide,
  objectiveSize = "s",
  customMarkers,
  onAddCustomMarker,
  onRemoveCustomMarker,
  markerLabels,
}: TarkovMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const focusIndex = useRef<Map<string, L.CircleMarker | L.Marker>>(new Map());
  const playerRef = useRef<L.Marker | null>(null);
  // renderer SVG num pane dedicado, para os objetivos ficarem ACIMA dos outros
  const questRendererRef = useRef<L.SVG | null>(null);

  // imagens / guias (hover) + lightbox
  const emptyImages: QuestImages = { byObjective: {}, byTask: {} };
  const imagesRef = useRef<QuestImages>(questImages ?? emptyImages);
  imagesRef.current = questImages ?? emptyImages;
  const guidesRef = useRef<Record<string, string>>(questGuides ?? {});
  guidesRef.current = questGuides ?? {};
  const openGuideRef = useRef(onOpenGuide);
  openGuideRef.current = onOpenGuide;

  // marcas customizadas: grupo dedicado + callbacks/labels via ref (handlers
  // registrados uma vez na criação do mapa precisam ler sempre o valor atual).
  const customGroupRef = useRef<L.LayerGroup | null>(null);
  const addMarkerRef = useRef(onAddCustomMarker);
  addMarkerRef.current = onAddCustomMarker;
  const removeMarkerRef = useRef(onRemoveCustomMarker);
  removeMarkerRef.current = onRemoveCustomMarker;
  const markerLabelsRef = useRef(markerLabels);
  markerLabelsRef.current = markerLabels;

  const [hover, setHover] = useState<HoverState | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

  // andares (níveis): só existem em mapas multi-nível. `activeFloorId` filtra os
  // marcadores por altura; segue o andar do jogador quando ele troca de nível.
  const floors = floorsForMap(config.key);
  const [activeFloorId, setActiveFloorId] = useState<string>(() =>
    floors ? defaultFloor(floors).id : "",
  );
  const lastPlayerFloorRef = useRef<string | null>(null);
  const activeFloorIdRef = useRef(activeFloorId);
  activeFloorIdRef.current = activeFloorId;
  const artworkRef = useRef<ReturnType<typeof addMapArtwork> | null>(null);

  // calibração da seta do jogador (offset em graus, por mapa). Ajustável ao vivo
  // com [ e ] (e \ reseta) quando há jogador no mapa — útil pro Factory.
  const [headingOffset, setHeadingOffset] = useState<number>(() => headingOffsetFor(config));

  useEffect(() => {
    const f = floorsForMap(config.key);
    setActiveFloorId(f ? defaultFloor(f).id : "");
    lastPlayerFloorRef.current = null;
    setHeadingOffset(headingOffsetFor(config));
  }, [config]);

  const cancelClose = () => {
    if (closeTimer.current !== undefined) {
      clearTimeout(closeTimer.current);
      closeTimer.current = undefined;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setHover(null), 160);
  };

  // (A) cria o mapa por config (mapa selecionado).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const bounds = getBounds(config.bounds);
    const map = L.map(el, {
      crs: getCRS(config),
      minZoom: config.minZoom,
      maxZoom: Math.max(7, config.maxZoom),
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      wheelPxPerZoomLevel: 80,
      attributionControl: false,
      maxBounds: getScaledBounds(config.bounds, 1.5),
      maxBoundsViscosity: 0.7,
    });

    // panes de prioridade: objetivos de quest acima dos outros marcadores
    // (markerPane=600); jogador acima de tudo.
    map.createPane("questPane").style.zIndex = "620";
    map.createPane("playerPane").style.zIndex = "700";
    questRendererRef.current = L.svg({ pane: "questPane" });

    artworkRef.current = addMapArtwork(map, config);
    map.fitBounds(bounds);

    // fecha o carrossel ao mover/zoom (o ponto na tela fica obsoleto)
    const closeHover = () => {
      cancelClose();
      setHover(null);
    };
    map.on("movestart", closeHover);
    map.on("zoomstart", closeHover);

    // clique direito numa área vazia: abre o editor para criar uma marca.
    const onContext = (e: L.LeafletMouseEvent) => {
      L.DomEvent.preventDefault(e.originalEvent); // sem o menu nativo do browser
      const labels = markerLabelsRef.current;
      if (!labels || !addMarkerRef.current) return;
      openMarkerEditor(map, e.latlng, labels, (r) => {
        addMarkerRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng, ...r });
      });
    };
    map.on("contextmenu", onContext);

    mapRef.current = map;
    playerRef.current = null; // marcador do jogador some com o mapa antigo
    return () => {
      artworkRef.current?.dispose();
      artworkRef.current = null;
      map.remove();
      mapRef.current = null;
      groupsRef.current.clear();
      focusIndex.current.clear();
    };
  }, [config]);

  // (A2) acende o andar ativo e apaga (alpha) os outros no SVG inline.
  useEffect(() => {
    artworkRef.current?.setFloor(activeFloorId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloorId, config]);

  // (P) marcador do jogador (seta de direção).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!player) {
      if (playerRef.current) {
        playerRef.current.remove();
        playerRef.current = null;
      }
      return;
    }
    // o jogador troca o andar ativo ao mudar de nível (override manual segue até lá).
    if (floors) {
      const pf = floorForY(floors, player.y);
      if (pf.id !== lastPlayerFloorRef.current) {
        lastPlayerFloorRef.current = pf.id;
        setActiveFloorId(pf.id);
      }
    }
    const angle = displayAngle(player, config.coordinateRotation, headingOffset);
    const latlng = gamePos(player.x, player.z) as L.LatLngExpression;
    if (!playerRef.current) {
      playerRef.current = L.marker(latlng, {
        icon: playerIcon(angle, true),
        zIndexOffset: 1000,
        pane: "playerPane",
      }).addTo(map);
    } else {
      playerRef.current.setLatLng(latlng);
      playerRef.current.setIcon(playerIcon(angle, true));
    }
  }, [player, config, headingOffset]);

  // calibração ao vivo da seta: [ e ] giram, \ reseta. Só quando há jogador.
  useEffect(() => {
    if (!player) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "[" && e.key !== "]" && e.key !== "\\") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      setHeadingOffset((cur) => {
        const next =
          e.key === "\\" ? config.headingOffset ?? 0 : cur + (e.key === "]" ? 5 : -5);
        saveHeadingOffset(config.key, next);
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player, config]);

  // (B) (re)constrói os LayerGroups quando os dados das camadas mudam.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const g of groupsRef.current.values()) g.removeFrom(map);
    groupsRef.current.clear();
    focusIndex.current.clear();

    const isQuestLayer = (id: string) => id === QUEST_LAYER_ID;
    for (const layer of layers) {
      const group = L.layerGroup();
      const quest = isQuestLayer(layer.id);
      // camadas que aparecem SEMPRE (ofuscadas fora do andar): quests, extracts e
      // transits. As demais (loot/spawns, muito densas) somem nos outros níveis.
      const alwaysVisible =
        quest || layer.markerKind === "extract" || layer.id === TRANSIT_LAYER_ID;
      for (const m of layer.markers) {
        // filtro por andar (mapas multi-nível): some marcadores das camadas densas
        // de outros níveis. Os de `alwaysVisible` nunca somem.
        if (!alwaysVisible && floors && !showOnFloor(floors, activeFloorId, m.y)) continue;
        // marcador em outro andar: não some, fica ofuscado (alpha) + seta ▲/▼.
        const otherFloor =
          !!floors && m.y != null && floorForY(floors, m.y).id !== activeFloorId;
        const arrow = otherFloor && floors ? floorArrow(floors, activeFloorId, m.y) : null;
        const latlng = gamePos(m.x, m.z) as L.LatLngExpression;
        let marker: L.CircleMarker | L.Marker;
        if (layer.markerKind === "extract") {
          marker = L.marker(latlng, {
            icon: extractIcon(layer.style.color, m.label ?? "", {
              badge: m.extractBadge,
              faded: otherFloor,
              arrow: arrow ?? undefined,
            }),
          });
        } else if (layer.markerKind === "loot") {
          marker = L.marker(latlng, { icon: lootIcon(layer.style.color, m.iconKey ?? "") });
        } else {
          marker = L.circleMarker(latlng, {
            radius: quest ? OBJECTIVE_RADIUS[objectiveSize] : layer.style.radius,
            color: layer.style.color,
            weight: 2,
            fillColor: layer.style.fill,
            fillOpacity: otherFloor ? 0.18 : 0.85,
            opacity: otherFloor ? 0.3 : 1,
            // objetivos num pane de z maior, para ficarem acima dos outros
            ...(quest && questRendererRef.current ? { renderer: questRendererRef.current } : {}),
          });
        }
        if (m.tooltip) {
          marker.bindTooltip(m.tooltip, { direction: "top", offset: [0, -layer.style.radius] });
        }
        if (m.popupHtml) marker.bindPopup(m.popupHtml);

        // marcador de quest: tooltip unificado no hover (texto + imagens + guia).
        if (m.taskId) {
          const taskId = m.taskId;
          const objectiveId = m.objectiveId;
          const info = m.info;
          marker.on("mouseover", (e) => {
            const map = mapRef.current;
            if (!map) return;
            const p = map.latLngToContainerPoint((e.target as L.CircleMarker).getLatLng());
            cancelClose();
            // imagem do ponto específico (objetivo); cai pro carrossel da quest
            const imgs = imagesRef.current;
            const byObj = objectiveId ? imgs.byObjective[objectiveId] : undefined;
            const images = byObj && byObj.length ? byObj : imgs.byTask[taskId] ?? [];
            setHover({
              taskId,
              info,
              images,
              seo: guidesRef.current[taskId],
              point: { x: p.x, y: p.y },
            });
          });
          marker.on("mouseout", scheduleClose);
        }

        marker.addTo(group);
        if (m.focusId) focusIndex.current.set(m.focusId, marker);
      }
      groupsRef.current.set(layer.id, group);
      if (visible.has(layer.id)) group.addTo(map);
    }
    // visible é tratado na effect (C); aqui só respeitamos o estado inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, objectiveSize, activeFloorId]);

  // (C) liga/desliga camadas conforme o filtro (sem reconstruir).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, group] of groupsRef.current) {
      const on = visible.has(id);
      const has = map.hasLayer(group);
      if (on && !has) group.addTo(map);
      else if (!on && has) group.removeFrom(map);
    }
  }, [visible, layers]);

  // (D) foca numa zona de quest (clique na lista).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusZoneId) return;
    const cm = focusIndex.current.get(focusZoneId);
    if (!cm) return;
    map.setView(cm.getLatLng(), Math.max(map.getZoom(), config.minZoom + 1), { animate: true });
    cm.openPopup();
  }, [focusZoneId, config]);

  // (E) marcas customizadas do usuário (alfinetes coloridos). Grupo próprio,
  // recriado quando a lista muda. Clique direito no alfinete remove a marca.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    customGroupRef.current?.removeFrom(map);
    const group = L.layerGroup();
    for (const cm of customMarkers ?? []) {
      const marker = L.marker([cm.lat, cm.lng], { icon: customPinIcon(cm.color, cm.icon) });
      if (cm.note) marker.bindTooltip(escapeHtml(cm.note), { direction: "top" });
      marker.on("contextmenu", (e) => {
        L.DomEvent.stop(e); // não deixa abrir o editor de criação por baixo
        removeMarkerRef.current?.(cm.id);
      });
      marker.addTo(group);
    }
    group.addTo(map);
    customGroupRef.current = group;
    return () => {
      group.removeFrom(map);
      customGroupRef.current = null;
    };
  }, [customMarkers, config]);

  return (
    <>
      <div ref={containerRef} className="tarkov-map" />
      {floors && (
        <FloorSwitcher floors={floors} activeId={activeFloorId} onSelect={setActiveFloorId} />
      )}
      {player && (
        <div className="heading-cal" title="Calibrar a seta do jogador: [ e ] giram, \ reseta">
          ↻ {Math.round(headingOffset)}°<span className="heading-cal-hint"> [ ]</span>
        </div>
      )}
      {hover && (
        <ObjectiveTooltip
          key={hover.taskId}
          info={hover.info}
          images={hover.images}
          point={hover.point}
          hasGuide={!!hover.seo}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          onOpen={(index) => {
            cancelClose();
            setHover(null);
            setLightbox({ images: hover.images, index });
          }}
          onOpenGuide={() => {
            cancelClose();
            setHover(null);
            if (hover.seo) openGuideRef.current?.(hover.seo);
          }}
        />
      )}
      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndex={(index) => setLightbox((lb) => (lb ? { ...lb, index } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
