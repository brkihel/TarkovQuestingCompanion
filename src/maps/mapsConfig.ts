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
  bounds: [[number, number], [number, number]];
  transform: [number, number, number, number];
  coordinateRotation: number;
}

export const MAPS: TarkovMapConfig[] = [
  {
    key: "customs",
    name: "Customs",
    svgPath: "/maps/svg/customs.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[698, -307], [-372, 237]],
    transform: [0.239, 168.65, 0.239, 136.35],
    coordinateRotation: 180,
  },
  {
    key: "factory",
    altKeys: ["night-factory"],
    name: "Factory",
    svgPath: "/maps/svg/factory.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 1,
    maxZoom: 6,
    bounds: [[77, -64.5], [-65.5, 67.4]],
    transform: [1.629, 119.9, 1.629, 139.3],
    coordinateRotation: 90,
  },
  {
    key: "ground-zero",
    altKeys: ["ground-zero-21"],
    name: "Ground Zero",
    svgPath: "/maps/svg/ground-zero.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 1,
    maxZoom: 6,
    bounds: [[249, -124], [-99, 364]],
    transform: [0.524, 167.3, 0.524, 65.1],
    coordinateRotation: 180,
  },
  {
    key: "interchange",
    name: "Interchange",
    svgPath: "/maps/svg/interchange.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 1,
    maxZoom: 6,
    bounds: [[598, -442], [-433, 426]],
    transform: [0.265, 150.6, 0.265, 134.6],
    coordinateRotation: 180,
  },
  {
    key: "lighthouse",
    name: "Lighthouse",
    svgPath: "/maps/svg/lighthouse.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 1,
    maxZoom: 6,
    bounds: [[515, -998], [-545, 725]],
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
  },
  {
    key: "reserve",
    name: "Reserve",
    svgPath: "/maps/svg/reserve.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[289, -293], [-303, 244]],
    transform: [0.395, 122.0, 0.395, 137.65],
    coordinateRotation: 180,
  },
  {
    key: "shoreline",
    name: "Shoreline",
    svgPath: "/maps/svg/shoreline.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[504, -415], [-1056, 618]],
    transform: [0.16, 83.2, 0.16, 111.1],
    coordinateRotation: 180,
  },
  {
    key: "streets-of-tarkov",
    name: "Streets of Tarkov",
    svgPath: "/maps/svg/streets-of-tarkov.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 1,
    maxZoom: 5,
    bounds: [[323, -295], [-280, 532]],
    transform: [0.38, 0, 0.38, 0],
    coordinateRotation: 180,
  },
  {
    key: "woods",
    name: "Woods",
    svgPath: "/maps/svg/woods.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[646, -914], [-761, 442]],
    transform: [0.1855, 112.95, 0.1855, 167.85],
    coordinateRotation: 180,
  },
  {
    key: "terminal",
    name: "Terminal",
    svgPath: "/maps/svg/terminal.svg",
    tilePath: null,
    tileSize: 256,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[463, -580], [-433, 475]],
    transform: [0.2, 0, 0.2, 0],
    coordinateRotation: 180,
  },
  {
    key: "the-lab",
    name: "The Lab",
    svgPath: "/maps/svg/the-lab.svg",
    tilePath: null,
    tileSize: 175,
    minZoom: 2,
    maxZoom: 6,
    bounds: [[-80, -477], [-287, -193]],
    transform: [0.575, 281.2, 0.575, 193.7],
    coordinateRotation: 270,
  },
  {
    key: "the-labyrinth",
    name: "The Labyrinth",
    svgPath: null,
    tilePath: "/maps/tiles/the-labyrinth/{z}/{x}/{y}.png",
    tileSize: 256,
    minZoom: 1,
    maxZoom: 5,
    bounds: [[-52, -37], [53, 76]],
    transform: [2.115, 85.5, 2.115, 128.0],
    coordinateRotation: 270,
  },
];

export const DEFAULT_MAP_KEY = "customs";

export function getMapByKey(key: string): TarkovMapConfig {
  return MAPS.find((m) => m.key === key) ?? MAPS[0];
}
