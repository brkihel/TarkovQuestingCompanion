import catalog from "./catalog.json";

// Configuração dos mapas do Tarkov.
//
// Assets servidos LOCALMENTE (public/maps/*), baixados por `npm run sync`.
// Em runtime o app não depende de terceiros.
//
// - bounds:    formato tarkov.dev: pares [x, y] (-> [lat=y, lng=x] em getBounds)
// - transform: [scaleX, marginX, scaleZ, marginZ] do CRS customizado
// - coordinateRotation: rotação embutida na projeção do CRS (graus)
//
// `key` = normalizedName usado pela API/quests. `altKeys` = nomes-irmãos.

export interface TarkovMapConfig {
  key: string;
  altKeys?: string[];
  name: string;
  /** SVG local, ou null se o mapa só tiver tiles */
  svgPath: string | null;
  /** template de tiles local {z}/{x}/{y}, ou null */
  tilePath: string | null;
  tileSize: number;
  minZoom: number;
  maxZoom: number;
  maxNativeZoom?: number;
  author?: string;
  authorLink?: string;
  bounds: [[number, number], [number, number]];
  transform: [number, number, number, number];
  coordinateRotation: number;
  /** ajuste fino do ângulo da seta do jogador (graus), calibrado por mapa */
  headingOffset?: number;
}

// Generated from the maintained upstream map catalog by npm run sync.
export const MAPS = catalog as TarkovMapConfig[];

export const DEFAULT_MAP_KEY = "customs";

export function getMapByKey(key: string): TarkovMapConfig {
  return MAPS.find((m) => m.key === key || m.altKeys?.includes(key)) ?? MAPS.find((m) => m.key === DEFAULT_MAP_KEY)!;
}
