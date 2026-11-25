import L from "leaflet";
import { getBounds } from "./leafletCrs";
import type { TarkovMapConfig } from "./mapsConfig";
import { defaultFloor, floorsForMap } from "./floors";

/** Shared artwork behavior for the main map and the separate minimap window. */
export function addMapArtwork(map: L.Map, config: TarkovMapConfig) {
  const bounds = getBounds(config.bounds);
  const floors = floorsForMap(config.key);
  let activeId = floors ? defaultFloor(floors).id : "";
  let svg: SVGSVGElement | null = null;
  let cancelled = false;
  let tiles: L.TileLayer | null = null;
  const setFloor = (id: string) => {
    activeId = id;
    const floor = floors?.find((f) => f.id === id);
    if (tiles && floor?.tilePath) tiles.setUrl(floor.tilePath);
    if (svg) for (const f of floors ?? []) {
      const group = svg.querySelector<SVGElement>(`[id="${f.svgGroup}"]`);
      if (group) group.style.opacity = f.id === id ? "1" : "0.16";
    }
  };
  if (config.svgPath && floors) {
    fetch(config.svgPath).then((r) => {
      if (!r.ok) throw new Error(`Map HTTP ${r.status}`);
      return r.text();
    }).then((text) => {
      if (cancelled) return;
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      if (doc.querySelector("parsererror")) throw new Error("Invalid map SVG");
      svg = doc.documentElement as unknown as SVGSVGElement;
      svg.setAttribute("preserveAspectRatio", "none");
      L.svgOverlay(svg, bounds, { interactive: false }).addTo(map);
      setFloor(activeId);
    }).catch(() => {
      if (!cancelled && config.svgPath) L.imageOverlay(config.svgPath, bounds).addTo(map);
    });
  } else if (config.svgPath) {
    L.imageOverlay(config.svgPath, bounds).addTo(map);
  } else if (config.tilePath) {
    tiles = L.tileLayer(config.tilePath, {
      tileSize: config.tileSize, bounds, minZoom: config.minZoom,
      maxZoom: Math.max(7, config.maxZoom), maxNativeZoom: config.maxNativeZoom ?? config.maxZoom,
      noWrap: true,
    }).addTo(map);
    setFloor(activeId);
  }
  return { setFloor, dispose: () => { cancelled = true; } };
}
