import { JSONPath } from "jsonpath-plus";
import { readFile } from "node:fs/promises";
const extractNotes = JSON.parse(await readFile(new URL("../data/extract-notes.json", import.meta.url), "utf8"));

import { json } from "./http.mjs";

export const MODES = ["regular", "pve", "pvp-season"];
export const LANGUAGES = ["en", "pt"];
export const JSON_API = "https://json.tarkov.dev";

export function translate(value, primary, fallback = {}, paths = []) {
  for (const path of paths) JSONPath({ path, json: value, resultType: "all", callback: ({ value: key, parent, parentProperty }) => {
    parent[parentProperty] = primary[key] ?? fallback[key] ?? key;
  } });
  return value;
}

export async function dataset(mode, name, lang = "en") {
  const path = `${JSON_API}/${mode}/${name}`;
  const [raw, primary, fallback] = await Promise.all([
    json(path), json(`${path}_${lang}`), lang === "en" ? { data: {} } : json(`${path}_en`),
  ]);
  if (!raw.data || !primary.data) throw new Error(`Invalid dataset: ${path}`);
  return translate(raw, primary.data, fallback.data, raw.translations ?? []).data;
}

export function normalizeTasks(data, maps, traders, itemNames = {}) {
  const mapRef = (id) => {
    if (!maps[id]) throw new Error(`Unknown map reference: ${id}`);
    return { normalizedName: maps[id].normalizedName };
  };
  const item = (id) => ({ id, name: itemNames[`${id} Name`] ?? id });
  return Object.values(data.tasks).map((task) => ({
    id: task.id, name: task.name, normalizedName: task.normalizedName,
    minPlayerLevel: task.minPlayerLevel, kappaRequired: task.kappaRequired ?? false,
    wikiLink: task.wikiLink ?? null,
    map: task.map ? mapRef(task.map) : null,
    neededKeys: (task.neededKeys ?? []).map((entry) => ({ map: mapRef(entry.map), keys: entry.keys.map(item) })),
    trader: traders[task.trader] ? { name: traders[task.trader].name } : null,
    taskRequirements: (task.taskRequirements ?? []).map((r) => ({ task: { id: r.task }, status: r.status })),
    objectives: (task.objectives ?? []).map((o) => ({
      id: o.id, type: o.type, description: o.description, optional: o.optional ?? false,
      count: o.count ?? null, foundInRaid: o.foundInRaid ?? false,
      items: (o.markerItem ? [o.markerItem] : o.items ?? o.useAny ?? []).map(item),
      maps: (o.maps ?? []).map(mapRef),
      zones: (o.zones ?? []).map((z) => ({ id: z.id, position: z.position, map: mapRef(z.map) })),
      ...(o.possibleLocations ? { possibleLocations: o.possibleLocations.map((l) => ({
        map: mapRef(l.map), positions: l.positions,
      })) } : {}),
    })),
  }));
}

export function spawnKind(spawn) {
  const cats = spawn.categories ?? [], sides = spawn.sides ?? [];
  if (cats.includes("boss")) return "boss";
  if (cats.includes("sniper")) return "sniper";
  if ((sides.includes("pmc") || sides.includes("all")) && cats.includes("player")) return "pmc";
  return sides.includes("scav") ? "scav" : null;
}

export function normalizeMarkers(data, catalog, itemNames, englishMaps = data.maps, lang = "en") {
  const byName = new Map(Object.values(data.maps).map((m) => [m.normalizedName, m]));
  const englishExtracts = new Map(Object.values(englishMaps).flatMap((m) => m.extracts ?? []).map((e) => [e.id, e.name]));
  const markers = {};
  for (const config of catalog) {
    const map = byName.get(config.key);
    if (!map) throw new Error(`Missing map: ${config.key}`);
    markers[config.key] = {
      extracts: (map.extracts ?? []).filter((e) => e.position).map((e) => ({
        ...e.position, name: e.name, faction: e.faction,
        requirements: extractNotes.notes[`${config.key}/${englishExtracts.get(e.id)}`]?.[lang] ?? [],
        cooperation: /co.?op/i.test(englishExtracts.get(e.id) ?? ""),
        ...(e.transferItem ? { payment: { item: itemNames[`${e.transferItem.item} Name`] ?? e.transferItem.item,
          count: e.transferItem.count, currency: ["5449016a4bdc2d6f028b456f", "5696686a4bdc2da3298b456a", "569668774bdc2da2298b4568"].includes(e.transferItem.item) } } : {}),
        ...(e.switches?.length ? { needsSwitch: true } : {}),
        ...(/flare|sinalizador/i.test(englishExtracts.get(e.id) ?? e.name) ? { flare: true } : {}),
      })),
      transits: (map.transits ?? []).filter((t) => t.position).map((t) => ({ ...t.position, description: t.description })),
      spawns: (map.spawns ?? []).filter((s) => s.position && spawnKind(s)).map((s) => ({ ...s.position, kind: spawnKind(s) })),
      loot: (map.lootContainers ?? []).filter((l) => l.position).map((l) => {
        const container = data.lootContainers[l.lootContainer];
        if (!container) throw new Error(`Unknown loot container: ${l.lootContainer}`);
        return { ...l.position, type: container.normalizedName };
      }),
    };
  }
  return markers;
}
