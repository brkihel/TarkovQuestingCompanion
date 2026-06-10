import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TarkovMapConfig } from "../maps/mapsConfig";
import { getCRS, getBounds, getScaledBounds, gamePos } from "../maps/leafletCrs";
import type { MapLayerData } from "../maps/layerDefs";
import { QUEST_LAYER_ID } from "../maps/layerDefs";
import { displayAngle, playerIcon, type PlayerPose } from "../lib/player";
import { extractIcon } from "../maps/markerIcons";
import { OBJECTIVE_RADIUS, type IconSize } from "../settings";
import { ObjectiveTooltip, Lightbox, type CarouselPoint, type ObjectiveInfo } from "./QuestImageViewer";

interface TarkovMapProps {
  config: TarkovMapConfig;
  layers: MapLayerData[];
  visible: Set<string>;
  focusZoneId?: string | null;
  player?: PlayerPose | null;
  /** taskId -> imagens de localização (do guia tarkov.help, offline) */
  questImages?: Record<string, string[]>;
  /** taskId -> seoLink do guia (para abrir o guia nativo) */
  questGuides?: Record<string, string>;
  /** abre o guia nativo de uma quest (pelo seoLink) */
  onOpenGuide?: (seo: string) => void;
  /** tamanho dos marcadores de objetivo (s/m/l) */
  objectiveSize?: IconSize;
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
}: TarkovMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupsRef = useRef<Map<string, L.LayerGroup>>(new Map());
  const focusIndex = useRef<Map<string, L.CircleMarker | L.Marker>>(new Map());
  const playerRef = useRef<L.Marker | null>(null);
  // renderer SVG num pane dedicado, para os objetivos ficarem ACIMA dos outros
  const questRendererRef = useRef<L.SVG | null>(null);

  // imagens / guias (hover) + lightbox
  const imagesRef = useRef<Record<string, string[]>>(questImages ?? {});
  imagesRef.current = questImages ?? {};
  const guidesRef = useRef<Record<string, string>>(questGuides ?? {});
  guidesRef.current = questGuides ?? {};
  const openGuideRef = useRef(onOpenGuide);
  openGuideRef.current = onOpenGuide;
  const [hover, setHover] = useState<HoverState | null>(null);
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const closeTimer = useRef<number | undefined>(undefined);

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

    if (config.svgPath) {
      L.imageOverlay(config.svgPath, bounds).addTo(map);
    } else if (config.tilePath) {
      L.tileLayer(config.tilePath, {
        tileSize: config.tileSize,
        bounds,
        minZoom: config.minZoom,
        maxZoom: Math.max(7, config.maxZoom),
        noWrap: true,
      }).addTo(map);
    }
    map.fitBounds(bounds);

    // fecha o carrossel ao mover/zoom (o ponto na tela fica obsoleto)
    const closeHover = () => {
      cancelClose();
      setHover(null);
    };
    map.on("movestart", closeHover);
    map.on("zoomstart", closeHover);

    mapRef.current = map;
    playerRef.current = null; // marcador do jogador some com o mapa antigo
    return () => {
      map.remove();
      mapRef.current = null;
      groupsRef.current.clear();
      focusIndex.current.clear();
    };
  }, [config]);

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
    const angle = displayAngle(player, config.coordinateRotation);
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
      for (const m of layer.markers) {
        const latlng = gamePos(m.x, m.z) as L.LatLngExpression;
        let marker: L.CircleMarker | L.Marker;
        if (layer.markerKind === "extract") {
          marker = L.marker(latlng, { icon: extractIcon(layer.style.color, m.label ?? "") });
        } else {
          marker = L.circleMarker(latlng, {
            radius: quest ? OBJECTIVE_RADIUS[objectiveSize] : layer.style.radius,
            color: layer.style.color,
            weight: 2,
            fillColor: layer.style.fill,
            fillOpacity: 0.85,
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
          const info = m.info;
          marker.on("mouseover", (e) => {
            const map = mapRef.current;
            if (!map) return;
            const p = map.latLngToContainerPoint((e.target as L.CircleMarker).getLatLng());
            cancelClose();
            setHover({
              taskId,
              info,
              images: imagesRef.current[taskId] ?? [],
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
  }, [layers, objectiveSize]);

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

  return (
    <>
      <div ref={containerRef} className="tarkov-map" />
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
