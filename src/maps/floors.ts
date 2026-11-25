import catalog from "./catalog.json";

// Andares (níveis) dos mapas.
//
// Cada andar = um grupo <g> de topo do SVG do mapa (padrão tarkov.dev:
// Ground_Level, First_Floor, Second_Floor, Underground_Level, etc.) + uma faixa
// de altura `y` para classificar marcadores. Assim o seletor, a IMAGEM do mapa
// (o andar ativo fica opaco, os outros em alpha) e o filtro de marcadores usam
// a MESMA definição de andar. As faixas cobrem toda a reta (−∞..+∞); marcador
// sem `y` => visível em todos os andares. Ordem: de cima para baixo (seletor).

export interface FloorDef {
  id: string;
  name: string;
  /** id do grupo <g> no SVG (para controlar a opacidade da imagem do andar) */
  svgGroup: string;
  /** faixa [min, max) em unidades de altura do jogo */
  min: number;
  max: number;
  /** andar padrão ao abrir o mapa (o térreo, onde fica a maioria dos marcadores) */
  default?: boolean;
  tilePath?: string;
}

const INF = Infinity;

export const MAP_FLOORS: Record<string, FloorDef[]> = {
  factory: [
    { id: "Third_Floor", name: "3rd Floor", svgGroup: "Third_Floor", min: 6, max: INF },
    { id: "Second_Floor", name: "2nd Floor", svgGroup: "Second_Floor", min: 3, max: 6 },
    { id: "Ground_Floor", name: "Ground", svgGroup: "Ground_Floor", min: -1, max: 3, default: true },
    { id: "Basement", name: "Tunnels", svgGroup: "Basement", min: -INF, max: -1 },
  ],
  interchange: [
    { id: "Second_Floor", name: "3rd Floor", svgGroup: "Second_Floor", min: 34, max: INF },
    { id: "First_Floor", name: "2nd Floor", svgGroup: "First_Floor", min: 25, max: 34 },
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: -INF, max: 25, default: true },
  ],
  customs: [
    { id: "Third_Floor", name: "3rd Floor", svgGroup: "Third_Floor", min: 11.2, max: INF },
    { id: "Second_Floor", name: "2nd Floor", svgGroup: "Second_Floor", min: 6.5, max: 11.2 },
    { id: "First_Floor", name: "1st Floor", svgGroup: "First_Floor", min: 2.7, max: 6.5 },
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: 0.5, max: 2.7, default: true },
    { id: "Underground_Level", name: "Underground", svgGroup: "Underground_Level", min: -INF, max: 0.5 },
  ],
  reserve: [
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: -7.27, max: INF, default: true },
    { id: "Bunkers", name: "Bunkers", svgGroup: "Bunkers", min: -INF, max: -7.27 },
  ],
  "the-lab": [
    { id: "Second_Level", name: "2nd Level", svgGroup: "Second_Level", min: 3, max: INF },
    { id: "First_Level", name: "Ground", svgGroup: "First_Level", min: -0.9, max: 3, default: true },
    { id: "Technical_Level", name: "Technical", svgGroup: "Technical_Level", min: -INF, max: -0.9 },
  ],
  shoreline: [
    { id: "Third_Floor", name: "3rd Floor", svgGroup: "Third_Floor", min: 6, max: INF },
    { id: "Second_Floor", name: "2nd Floor", svgGroup: "Second_Floor", min: 2, max: 6 },
    { id: "First_Floor", name: "1st Floor", svgGroup: "First_Floor", min: -1, max: 2 },
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: -5, max: -1, default: true },
    { id: "Underground_Level", name: "Underground", svgGroup: "Underground_Level", min: -INF, max: -5 },
  ],
  "streets-of-tarkov": [
    { id: "Fifth_Floor", name: "5th Floor", svgGroup: "Fifth_Floor", min: 30, max: INF },
    { id: "Fourth_Floor", name: "4th Floor", svgGroup: "Fourth_Floor", min: 25, max: 30 },
    { id: "Third_Floor", name: "3rd Floor", svgGroup: "Third_Floor", min: 20, max: 25 },
    { id: "Second_Floor", name: "2nd Floor", svgGroup: "Second_Floor", min: 15, max: 20 },
    { id: "First_Floor", name: "1st Floor", svgGroup: "First_Floor", min: 10, max: 15 },
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: -6, max: 10, default: true },
    { id: "Underground_Level", name: "Underground", svgGroup: "Underground_Level", min: -INF, max: -6 },
  ],
  "ground-zero": [
    { id: "Third_Floor", name: "3rd Floor", svgGroup: "Third_Floor", min: 32.3, max: INF },
    { id: "Second_Floor", name: "2nd Floor", svgGroup: "Second_Floor", min: 28, max: 32.3 },
    { id: "Ground_Level", name: "Ground", svgGroup: "Ground_Level", min: 21, max: 28, default: true },
    { id: "Underground_Level", name: "Underground", svgGroup: "Underground_Level", min: -INF, max: 21 },
  ],
};

/** Andares de um mapa (ou undefined se ele tem um nível só). */
export function floorsForMap(mapKey: string): FloorDef[] | undefined {
  const synced = catalog.find((m) => m.key === mapKey)?.floors;
  return synced?.map((f) => ({ ...f, min: f.min ?? -Infinity, max: f.max ?? Infinity })) ?? MAP_FLOORS[mapKey];
}

/** Andar que contém a altura `y` (as bandas cobrem toda a reta). */
export function floorForY(floors: FloorDef[], y: number): FloorDef {
  return floors.find((f) => y >= f.min && y < f.max) ?? defaultFloor(floors);
}

/** Andar inicial (o marcado como `default`, senão o último/térreo). */
export function defaultFloor(floors: FloorDef[]): FloorDef {
  return floors.find((f) => f.default) ?? floors[floors.length - 1] ?? floors[0];
}

/**
 * Um marcador deve aparecer no andar ativo? Sem `y` (dados antigos / marca
 * customizada) => sempre visível, para nada sumir por falta de dado.
 */
export function showOnFloor(
  floors: FloorDef[],
  activeFloorId: string,
  y: number | undefined,
): boolean {
  if (y == null) return true;
  return floorForY(floors, y).id === activeFloorId;
}

/**
 * Em que direção está o andar do marcador em relação ao ativo?
 * "up" = acima, "down" = abaixo, null = mesmo andar (ou sem dado de altura).
 * O array de andares é ordenado de cima p/ baixo, então índice menor = mais alto.
 */
export function floorArrow(
  floors: FloorDef[],
  activeFloorId: string,
  y: number | undefined,
): "up" | "down" | null {
  if (y == null) return null;
  const markerFloor = floorForY(floors, y).id;
  const mi = floors.findIndex((f) => f.id === markerFloor);
  const ai = floors.findIndex((f) => f.id === activeFloorId);
  if (mi < 0 || ai < 0 || mi === ai) return null;
  return mi < ai ? "up" : "down";
}
