// Definições das camadas de marcadores (filtros): ids, labels, cores e como
// construir os marcadores de cada camada a partir dos dados.

import type {
  MapMarkers,
  QuestMarker,
  SpawnKind,
  Faction,
} from "../lib/tarkovApi";

export interface LayerStyle {
  color: string;
  fill: string;
  radius: number;
}

export interface RenderMarker {
  x: number;
  /** altura (andar); ausente em dados antigos. Sem y => visível em todos os andares. */
  y?: number;
  z: number;
  tooltip?: string;
  popupHtml?: string;
  /** texto exibido no mapa (ex.: nome do extract) */
  label?: string;
  /** tipo especial da saída, para o badge do ícone: pago (taxi), flare ou switch */
  extractBadge?: "pay" | "flare" | "switch";
  /** id do grupo de loot, para escolher o glifo do ícone */
  iconKey?: string;
  /** zoneId da quest, para o "focar" pela lista */
  focusId?: string;
  /** taskId da quest (p/ buscar imagens/guia no hover) */
  taskId?: string;
  /** objectiveId da quest (p/ buscar a imagem do ponto específico) */
  objectiveId?: string;
  /** texto exibido no tooltip da quest (nome/trader/objetivo + "Objetivo i/N") */
  info?: { title: string; subtitle?: string; body?: string; index?: number; count?: number };
}

export interface MapLayerData {
  id: string;
  style: LayerStyle;
  /** "circle" (padrão), "extract" (bonequinho + nome) ou "loot" (badge + glifo) */
  markerKind?: "circle" | "extract" | "loot";
  markers: RenderMarker[];
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---- Extracts ----
export const EXTRACT_FACTIONS: {
  id: string;
  label: string;
  faction: Faction;
  color: string;
}[] = [
  { id: "extract-pmc", label: "PMC Extract", faction: "pmc", color: "#4caf6d" },
  { id: "extract-scav", label: "SCAV Extract", faction: "scav", color: "#d98b3a" },
  { id: "extract-coop", label: "Shared Extract", faction: "shared", color: "#5b9bd5" },
];

// ---- Spawns ----
export const SPAWN_KINDS: {
  id: string;
  label: string;
  kind: SpawnKind;
  color: string;
}[] = [
  { id: "spawn-boss", label: "Boss", kind: "boss", color: "#e05555" },
  { id: "spawn-sniper", label: "Sniper Scav", kind: "sniper", color: "#9a3b3b" },
  { id: "spawn-pmc", label: "PMC Spawn", kind: "pmc", color: "#6fa8dc" },
  { id: "spawn-scav", label: "Scav Spawn", kind: "scav", color: "#d9c84a" },
];

// ---- Loot (tipos de container -> grupos da UI) ----
export const LOOT_GROUPS: {
  id: string;
  label: string;
  types: string[];
  color: string;
}[] = [
  { id: "loot-cache", label: "Cache", types: ["buried-barrel-cache", "ground-cache"], color: "#8d6e63" },
  { id: "loot-ammo", label: "Ammo Box", types: ["wooden-ammo-box"], color: "#a1887f" },
  { id: "loot-grenade", label: "Grenade Box", types: ["grenade-box"], color: "#6d8b3a" },
  { id: "loot-weapon", label: "Weapon Box", types: ["weapon-box"], color: "#c98a3a" },
  { id: "loot-cash", label: "Cash Register", types: ["cash-register", "bank-cash-register"], color: "#3aa86b" },
  { id: "loot-safe", label: "Safe", types: ["safe", "bank-safe", "shturmans-stash"], color: "#9e9e9e" },
  { id: "loot-body", label: "Dead Body", types: ["pmc-body", "dead-scav", "scav-body", "civilian-body", "lab-technician-body"], color: "#b0413e" },
  { id: "loot-jacket", label: "Jacket", types: ["jacket"], color: "#7e8aa0" },
  { id: "loot-drawer", label: "Drawer", types: ["drawer"], color: "#a98b5a" },
  { id: "loot-sportsbag", label: "Sports Bag", types: ["duffle-bag", "plastic-suitcase"], color: "#5f8a8b" },
  { id: "loot-woodcrate", label: "Wooden Crate", types: ["wooden-crate"], color: "#b08454" },
  { id: "loot-techcrate", label: "Tech Supply Crate", types: ["technical-supply-crate"], color: "#4a7fa0" },
  { id: "loot-toolbox", label: "Toolbox", types: ["toolbox"], color: "#c0623a" },
  { id: "loot-pcblock", label: "PC Block", types: ["pc-block"], color: "#5d6bb0" },
  { id: "loot-medcrate", label: "Med Supply Crate", types: ["medical-supply-crate"], color: "#cf5b6f" },
  { id: "loot-medcase", label: "Medcase", types: ["medcase"], color: "#d77c8c" },
  { id: "loot-medbag", label: "Medbag", types: ["medbag-smu06", "medbag"], color: "#d99aa6" },
  { id: "loot-ration", label: "Ration Supply Crate", types: ["ration-supply-crate"], color: "#c2a34a" },
];

export const QUEST_LAYER_ID = "quests";
export const TRANSIT_LAYER_ID = "transits";

/** ids de todas as camadas, na ordem de empilhamento (de baixo p/ cima). */
export function allLayerIds(): string[] {
  return [
    ...LOOT_GROUPS.map((g) => g.id),
    ...SPAWN_KINDS.map((s) => s.id),
    TRANSIT_LAYER_ID,
    ...EXTRACT_FACTIONS.map((e) => e.id),
    QUEST_LAYER_ID,
  ];
}

/** camadas ligadas por padrão (loot/spawns ficam off por serem muitos). */
export function defaultVisibleIds(): string[] {
  return [QUEST_LAYER_ID, ...EXTRACT_FACTIONS.map((e) => e.id), TRANSIT_LAYER_ID];
}

/** Constrói os dados de todas as camadas para um mapa. */
export function buildLayers(
  questMarkers: QuestMarker[],
  mm: MapMarkers | undefined,
  t: (key: string) => string = (key) => key,
): MapLayerData[] {
  const layers: MapLayerData[] = [];

  // Quests
  layers.push({
    id: QUEST_LAYER_ID,
    style: { color: "#c9b471", fill: "#9a8c5c", radius: 6 },
    markers: questMarkers.map((m) => ({
      x: m.x,
      y: m.y,
      z: m.z,
      focusId: m.zoneId,
      taskId: m.taskId,
      objectiveId: m.objectiveId,
      info: {
        title: m.taskName,
        subtitle: m.trader ?? undefined,
        body: m.description,
        index: m.objectiveIndex,
        count: m.objectiveCount,
      },
    })),
  });

  // Extracts por facção (bonequinho + nome do extract)
  for (const ef of EXTRACT_FACTIONS) {
    layers.push({
      id: ef.id,
      style: { color: ef.color, fill: ef.color, radius: 6 },
      markerKind: "extract",
      markers: (mm?.extracts ?? [])
        .filter((e) => e.faction === ef.faction)
        .map((e) => {
          const badge = e.payment?.currency ? "pay" : e.flare ? "flare" : e.needsSwitch ? "switch" : undefined;
          const notes: string[] = [];
          if (e.payment)
            notes.push(`${t(e.payment.currency ? "extract.payment" : "extract.item")}: ${e.payment.count}× ${escapeHtml(e.payment.item)}`);
          if (e.flare) notes.push(t("extract.flare"));
          if (e.needsSwitch) notes.push(t("extract.switch"));
          if (e.cooperation) notes.push(t("extract.coop"));
          notes.push(...(e.requirements ?? []).map(escapeHtml));
          const extra = notes.length ? `<br/>${notes.join("<br/>")}` : "";
          return {
            x: e.x,
            y: e.y,
            z: e.z,
            label: e.name,
            extractBadge: badge,
            popupHtml: `<strong>${escapeHtml(e.name)}</strong><br/>${t(`extract.${e.faction}`)}${extra}<br/><small>${t("extract.check")}</small>`,
          };
        }),
    });
  }

  // Transits
  layers.push({
    id: TRANSIT_LAYER_ID,
    style: { color: "#b07fd0", fill: "#b07fd0", radius: 6 },
    markers: (mm?.transits ?? []).map((t) => ({
      x: t.x,
      y: t.y,
      z: t.z,
      tooltip: "Transit",
      popupHtml: `<strong>Transit</strong><br/>${escapeHtml(t.description)}`,
    })),
  });

  // Spawns por tipo
  for (const sk of SPAWN_KINDS) {
    layers.push({
      id: sk.id,
      style: { color: sk.color, fill: sk.color, radius: 5 },
      markers: (mm?.spawns ?? [])
        .filter((s) => s.kind === sk.kind)
        .map((s) => ({ x: s.x, y: s.y, z: s.z, tooltip: `${sk.label} spawn` })),
    });
  }

  // Loot por grupo
  for (const lg of LOOT_GROUPS) {
    const set = new Set(lg.types);
    layers.push({
      id: lg.id,
      style: { color: lg.color, fill: lg.color, radius: 4 },
      markerKind: "loot",
      markers: (mm?.loot ?? [])
        .filter((l) => set.has(l.type))
        .map((l) => ({ x: l.x, y: l.y, z: l.z, tooltip: lg.label, iconKey: lg.id })),
    });
  }

  return layers;
}
