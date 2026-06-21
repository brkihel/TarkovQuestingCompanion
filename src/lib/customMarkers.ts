// Marcadores customizados do usuário: alfinetes coloridos com nota e ícone,
// criados/removidos por clique direito no mapa. Persistidos POR MAPA no
// localStorage, independentes dos dados da API (quests/extracts/etc).

export interface CustomMarker {
  id: string;
  /** posição no CRS do Leaflet (já é estável por mapa; não precisa converter). */
  lat: number;
  lng: number;
  color: string;
  icon: string; // emoji
  note: string;
}

/** Campos editáveis (sem id/posição) usados ao criar uma marca. */
export type CustomMarkerDraft = Pick<CustomMarker, "color" | "icon" | "note"> & {
  lat: number;
  lng: number;
};

const KEY = "tqc:customMarkers:v1";

/** Paleta de cores dos alfinetes. */
export const PIN_COLORS = [
  "#e23b3b", // vermelho
  "#e8862e", // laranja
  "#ecc94b", // amarelo
  "#54c45e", // verde
  "#3aa0e0", // azul
  "#9a6ce0", // roxo
  "#ec5ba8", // rosa
  "#d6d3cb", // claro
];

/** Ícones (emoji) sugeridos para as marcas. */
export const PIN_ICONS = ["📍", "💀", "🎯", "📦", "🔑", "💰", "⚠️", "🩹", "🚪", "⭐"];

type Store = Record<string, CustomMarker[]>; // mapKey -> markers

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* ignore */
  }
  return {};
}

function writeStore(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

export function loadCustomMarkers(mapKey: string): CustomMarker[] {
  return readStore()[mapKey] ?? [];
}

export function saveCustomMarkers(mapKey: string, markers: CustomMarker[]): void {
  const store = readStore();
  if (markers.length) store[mapKey] = markers;
  else delete store[mapKey];
  writeStore(store);
}

export function newMarkerId(): string {
  return `cm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
