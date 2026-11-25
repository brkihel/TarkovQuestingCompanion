import assert from "node:assert/strict";
import { readFile, access, readdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT } from "./lib/http.mjs";
import { MODES, LANGUAGES } from "./lib/tarkov-data.mjs";

const read = async (path) => JSON.parse(await readFile(join(ROOT, path), "utf8"));
const catalog = await read("src/maps/catalog.json");
const keys = new Set(catalog.flatMap((m) => [m.key, ...m.altKeys]));
const allTasks = new Set(), allObjectives = new Set();
const position = (p) => assert(p && [p.x, p.y, p.z].every(Number.isFinite), "Invalid coordinates");
const report = {};
for (const mode of MODES) {
  let englishIds;
  for (const lang of LANGUAGES) {
    const suffix = lang === "en" ? "" : `-${lang}`;
    const tasks = await read(`public/data/${mode}/tasks${suffix}.json`);
    const markers = await read(`public/data/${mode}/map-markers${suffix}.json`);
    assert(tasks.length >= 100, "Incomplete task catalog");
    const ids = tasks.map((t) => t.id).sort();
    assert.equal(new Set(ids).size, ids.length, "Duplicate task IDs");
    if (englishIds) assert.deepEqual(ids, englishIds, "Language editions disagree"); else englishIds = ids;
    let geolocated = 0;
    for (const task of tasks) {
      assert(task.name && !/^[a-f0-9]{24} name$/.test(task.name), `Untranslated task: ${task.id}`);
      allTasks.add(task.id);
      let hasPosition = false;
      for (const objective of task.objectives) {
        allObjectives.add(objective.id);
        assert(objective.description && objective.description !== objective.id, `Untranslated objective: ${objective.id}`);
        for (const zone of objective.zones ?? []) {
          if (!zone.position) continue;
          assert(keys.has(zone.map.normalizedName), `Unsupported map: ${zone.map.normalizedName}`);
          position(zone.position); hasPosition = true;
        }
        for (const location of objective.possibleLocations ?? []) {
          assert(keys.has(location.map.normalizedName), `Unsupported item map: ${location.map.normalizedName}`);
          for (const pos of location.positions) { position(pos); hasPosition = true; }
        }
      }
      if (hasPosition) geolocated++;
    }
    for (const map of catalog) {
      assert(markers[map.key], `Missing markers for ${map.key}`);
      for (const entries of Object.values(markers[map.key])) for (const marker of entries) position(marker);
    }
    report[mode] = { tasks: tasks.length, withCoordinates: geolocated };
  }
}

for (const map of catalog) {
  if (map.svgPath) {
    const svg = await readFile(join(ROOT, "public", map.svgPath), "utf8");
    assert(svg.includes("<svg"), `Invalid SVG: ${map.key}`);
  } else for (const floor of map.floors ?? [map]) {
    for (let z = map.minZoom; z <= map.maxNativeZoom; z++) {
      const folder = join(ROOT, "public", floor.tilePath.split("/{z}")[0], String(z));
      const xs = await readdir(folder, { withFileTypes: true });
      assert(xs.length, `Missing tiles: ${map.key}/${floor.id ?? "main"}/z${z}`);
      let count = 0;
      for (const x of xs.filter((x) => x.isDirectory())) for (const name of await readdir(join(folder, x.name))) {
        const bytes = await readFile(join(folder, x.name, name));
        assert(bytes.length >= 8 && bytes.readUInt32BE(0) === 0x89504e47, `Invalid PNG: ${name}`); count++;
      }
      assert(count, `Empty zoom: ${folder}`);
    }
  }
}
const links = (await read("public/data/quest-guides.json")).guides;
for (const id of Object.keys(links)) assert(allTasks.has(id), `Guide for removed task: ${id}`);
const content = (await read("public/data/guide-content.json")).guides;
let images = 0;
for (const guide of Object.values(content)) {
  assert(!/<script\b|\son[a-z]+=|javascript:/i.test(guide.html), "Unsafe guide HTML");
  for (const [, src] of guide.html.matchAll(/<img[^>]+src="([^"]*)"/g)) {
    assert(src.startsWith("/quest-images/") && !src.split("/").includes(".."), `Non-local image: ${src}`);
    await access(join(ROOT, "public", decodeURI(src))); images++;
  }
}
const questImages = await read("public/data/quest-images.json");
for (const [key, entries] of Object.entries(questImages.byTask)) {
  assert(allTasks.has(key), `Images for removed task: ${key}`);
  for (const src of entries) await access(join(ROOT, "public", decodeURI(src)));
}
for (const [id, entries] of Object.entries(questImages.byObjective)) {
  assert(allObjectives.has(id), `Images for removed objective: ${id}`);
  for (const src of entries) await access(join(ROOT, "public", decodeURI(src)));
}
console.log(JSON.stringify({ modes: report, maps: catalog.length, guides: Object.keys(content).length, guideImages: images }, null, 2));
console.log("✓ Offline data, references, coordinates and map assets validated.");
