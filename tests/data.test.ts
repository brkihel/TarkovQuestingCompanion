import { expect, it } from "vitest";
// @ts-ignore Synchronization scripts are plain JavaScript.
import { normalizeTasks, normalizeMarkers, translate } from "../scripts/lib/tarkov-data.mjs";
// @ts-ignore Synchronization scripts are plain JavaScript.
import { buildCatalog } from "../scripts/sync-data.mjs";

it("resolves JSON API references and keeps loadout requirements", () => {
  const data = { tasks: { t: { id: "t", name: "Task", trader: "tr", map: "m", neededKeys: [{ map: "m", keys: ["key"] }], taskRequirements: [{ task: "other", status: ["failed"] }], objectives: [{ id: "o", type: "mark", markerItem: "marker", count: 2, maps: ["m"], zones: [{ id: "zone", map: "m", position: { x: 0, y: 1, z: 2 } }] }] } } };
  const tasks = normalizeTasks(data, { m: { normalizedName: "customs" } }, { tr: { name: "Prapor" } }, { "key Name": "Dorm key", "marker Name": "MS2000" });
  expect(tasks[0].neededKeys[0].keys[0].name).toBe("Dorm key");
  expect(tasks[0].objectives[0].items[0].name).toBe("MS2000");
  expect(tasks[0].taskRequirements[0]).toEqual({ task: { id: "other" }, status: ["failed"] });
  expect(() => normalizeTasks(data, {}, {})).toThrow("Unknown map reference");
});

it("translates only declared fields, preserving objective IDs and English fallback", () => {
  expect(translate({ name: "key", objectives: [{ id: "description", description: "description" }] },
    { key: "Nome" }, { description: "English description" }, ["$.name", "$.objectives[*].description"]))
    .toEqual({ name: "Nome", objectives: [{ id: "description", description: "English description" }] });
});

it("distinguishes shared extracts, cooperation, money and required items in both languages", () => {
  const extracts = [{ id: "train", name: "Trem", faction: "shared", position: { x: 0, y: 0, z: 0 } },
    { id: "coop", name: "Cooperação", faction: "shared", position: { x: 0, y: 0, z: 0 } },
    { id: "flare", name: "Saída", faction: "pmc", position: { x: 0, y: 0, z: 0 }, transferItem: { item: "map", count: 1 } }];
  const data = { maps: { m: { normalizedName: "customs", extracts } }, lootContainers: {} };
  const english = { m: { extracts: [{ id: "train", name: "Armored Train" }, { id: "coop", name: "Exit (Co-Op)" }, { id: "flare", name: "Exit (Flare)" }] } };
  const result = normalizeMarkers(data, [{ key: "customs" }], { "map Name": "Map" }, english, "pt").customs.extracts;
  expect(result[0].cooperation).toBe(false);
  expect(result[1].cooperation).toBe(true);
  expect(result[2].flare).toBe(true);
  expect(result[2].payment.currency).toBe(false);
});

it("builds contiguous floor bands for tile maps", () => {
  const [map] = buildCatalog([{ normalizedName: "icebreaker", maps: [{ key: "icebreaker", projection: "interactive", tilePath: "base", minZoom: 1, maxZoom: 5, bounds: [[0, 0], [1, 1]], transform: [1, 0, 1, 0], coordinateRotation: 0, layers: [
    { name: "Low", tilePath: "base", show: true, extents: [{ height: [0, 5] }] }, { name: "High", tilePath: "high", extents: [{ height: [6, 10] }] },
  ] }] }]);
  expect(map.floors[0].max).toBeNull();
  expect(map.floors[1].min).toBeNull();
  expect(map.floors[0].min).toBe(map.floors[1].max);
});


it("keeps different source images with the same filename separate", async () => {
  // @ts-ignore Synchronization scripts are plain JavaScript.
  const { outName } = await import("../scripts/lib/quest-images.mjs");
  expect(outName("https://minio.tarkov.help/a/image.jpg")).not.toBe(outName("https://minio.tarkov.help/b/image.jpg"));
  expect(outName("https://minio.tarkov.help/a/image.jpg")).toBe(outName("https://minio.tarkov.help/a/image.jpg"));
});
