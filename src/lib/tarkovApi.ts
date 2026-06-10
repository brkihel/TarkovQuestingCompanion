// Camada de dados — lê os JSONs empacotados localmente (public/data/*),
// gerados por `npm run sync`. Em runtime o app NÃO chama a tarkov.dev:
// tudo é servido do próprio bundle (offline / sem terceiros).

export interface Position {
  x: number;
  z: number;
}

export interface ObjectiveZone {
  id: string;
  position: Position | null;
  map: { normalizedName: string } | null;
}

export interface PossibleLocation {
  map: { normalizedName: string } | null;
  positions: Position[];
}

export interface Objective {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  maps: { normalizedName: string }[];
  zones: ObjectiveZone[];
  // Objetivos de item de quest (findQuestItem/giveQuestItem) não usam `zones`:
  // os pontos onde o item aparece ficam aqui.
  possibleLocations?: PossibleLocation[];
}

export interface TaskRequirement {
  task: { id: string };
  status: string[];
}

export interface Task {
  id: string;
  name: string;
  normalizedName: string;
  minPlayerLevel: number;
  kappaRequired: boolean;
  wikiLink: string | null;
  trader: { name: string } | null;
  taskRequirements: TaskRequirement[];
  objectives: Objective[];
}

// --- marcadores estáticos por mapa (extracts/transits/spawns/loot) ---
export type Faction = "pmc" | "scav" | "shared";
export type SpawnKind = "boss" | "sniper" | "pmc" | "scav";

export interface ExtractMarker { x: number; z: number; name: string; faction: Faction }
export interface TransitMarker { x: number; z: number; description: string }
export interface SpawnMarker { x: number; z: number; kind: SpawnKind }
export interface LootMarker { x: number; z: number; type: string }

export interface MapMarkers {
  extracts: ExtractMarker[];
  transits: TransitMarker[];
  spawns: SpawnMarker[];
  loot: LootMarker[];
}

export type AllMapMarkers = Record<string, MapMarkers>;

async function loadJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Falha ao ler ${path} (${res.status})`);
  return (await res.json()) as T;
}

export function fetchTasks(): Promise<Task[]> {
  return loadJson<Task[]>("/data/tasks.json");
}

export function fetchMapMarkers(): Promise<AllMapMarkers> {
  return loadJson<AllMapMarkers>("/data/map-markers.json");
}

// --- main storyline (trader Storyteller) ---
// Quests de progressão de história do EFT 1.0. NÃO estão na tarkov.dev nem têm
// coordenadas de mapa; vêm do tarkov.help (ver scripts/sync-storyline.mjs).
export interface StorylineQuest {
  id: number;
  seoLink: string;
  name: string;
  levelReq: number | null;
  kappaReq: boolean | null;
}

export interface Storyline {
  source: string;
  syncedAt: string;
  quests: StorylineQuest[];
}

export function fetchStoryline(): Promise<Storyline> {
  return loadJson<Storyline>("/data/storyline.json");
}

// --- links de guia das side quests (taskId da tarkov.dev -> seoLink no tarkov.help) ---
interface QuestGuidesFile {
  source: string;
  syncedAt: string;
  guides: Record<string, string>;
}

export async function fetchQuestGuides(): Promise<Record<string, string>> {
  const f = await loadJson<QuestGuidesFile>("/data/quest-guides.json");
  return f.guides ?? {};
}

// --- imagens de localização por task (do guia tarkov.help, baixadas offline) ---
interface QuestImagesFile {
  source: string;
  syncedAt: string;
  images: Record<string, string[]>;
}

export async function fetchQuestImages(): Promise<Record<string, string[]>> {
  const f = await loadJson<QuestImagesFile>("/data/quest-images.json");
  return f.images ?? {};
}

// --- conteúdo dos guias (renderizado nativamente no app) ---
export interface GuideContent {
  name: string;
  html: string;
}
interface GuideContentFile {
  source: string;
  syncedAt: string;
  guides: Record<string, GuideContent>;
}

let guideCache: Record<string, GuideContent> | null = null;

/** Carrega (e cacheia) o mapa seoLink -> { name, html } dos guias. */
export async function fetchGuideContent(): Promise<Record<string, GuideContent>> {
  if (guideCache) return guideCache;
  const f = await loadJson<GuideContentFile>("/data/guide-content.json");
  guideCache = f.guides ?? {};
  return guideCache;
}

// --- marcadores de quest (achatados a partir das tasks) ---
export interface QuestMarker {
  taskId: string;
  taskName: string;
  objectiveId: string;
  zoneId: string;
  type: string;
  description: string;
  optional: boolean;
  trader: string | null;
  x: number;
  z: number;
}

/**
 * Extrai os marcadores de quest de um mapa. `mapKeys` aceita o key do mapa e
 * seus altKeys (ex.: ["factory", "night-factory"]).
 */
export function markersForMap(tasks: Task[], mapKeys: string[]): QuestMarker[] {
  const accepted = new Set(mapKeys);
  const markers: QuestMarker[] = [];
  for (const task of tasks) {
    for (const obj of task.objectives) {
      for (const zone of obj.zones ?? []) {
        if (!zone.position) continue;
        if (!zone.map || !accepted.has(zone.map.normalizedName)) continue;
        markers.push({
          taskId: task.id,
          taskName: task.name,
          objectiveId: obj.id,
          zoneId: zone.id,
          type: obj.type,
          description: obj.description,
          optional: obj.optional,
          trader: task.trader?.name ?? null,
          x: zone.position.x,
          z: zone.position.z,
        });
      }
      // Itens de quest (findQuestItem): cada local possível de coleta vira um
      // marcador. Não têm `zone`, então sintetizamos um id estável.
      for (const loc of obj.possibleLocations ?? []) {
        if (!loc.map || !accepted.has(loc.map.normalizedName)) continue;
        loc.positions.forEach((pos, i) => {
          markers.push({
            taskId: task.id,
            taskName: task.name,
            objectiveId: obj.id,
            zoneId: `${obj.id}-loc-${i}`,
            type: obj.type,
            description: obj.description,
            optional: obj.optional,
            trader: task.trader?.name ?? null,
            x: pos.x,
            z: pos.z,
          });
        });
      }
    }
  }
  return markers;
}
