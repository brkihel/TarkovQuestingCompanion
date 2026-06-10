// Script de sincronização de dados e assets (rodar: `npm run sync`).
//
// Baixa TUDO da tarkov.dev uma vez e grava localmente, para o app rodar 100%
// offline / sem depender de terceiros em runtime:
//   - public/data/tasks.json        quests (para marcadores + lista)
//   - public/data/map-markers.json  extracts/transits/spawns/loot por mapa
//   - public/data/meta.json         timestamp + atribuição
//   - public/maps/svg/<key>.svg     imagem de cada mapa (11 mapas)
//   - public/maps/tiles/the-labyrinth/{z}/{x}/{y}.png  (único mapa só-tiles)
//
// Fonte: tarkov.dev (the-hideout, open-source). Atribuição preservada no meta.
// Reexecute após patch do jogo para atualizar.

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const ENDPOINT = "https://api.tarkov.dev/graphql";
const CDN_SVG = "https://assets.tarkov.dev/maps/svg";

// Mapas: key (= normalizedName das quests) -> nome na API + asset de origem.
const MAPS = [
  { key: "customs", api: "Customs", svg: "Customs.svg" },
  { key: "factory", api: "Factory", svg: "Factory.svg" },
  { key: "ground-zero", api: "Ground Zero", svg: "GroundZero.svg" },
  { key: "interchange", api: "Interchange", svg: "Interchange.svg" },
  { key: "lighthouse", api: "Lighthouse", svg: "Lighthouse.svg" },
  { key: "reserve", api: "Reserve", svg: "Reserve.svg" },
  { key: "shoreline", api: "Shoreline", svg: "Shoreline.svg" },
  { key: "streets-of-tarkov", api: "Streets of Tarkov", svg: "StreetsOfTarkov.svg" },
  { key: "woods", api: "Woods", svg: "Woods.svg" },
  { key: "terminal", api: "Terminal", svg: "Terminal.svg" },
  { key: "the-lab", api: "The Lab", svg: "Labs.svg" },
  {
    key: "the-labyrinth",
    api: "The Labyrinth",
    tiles: {
      url: "https://assets.tarkov.dev/maps/labyrinth/main/{z}/{x}/{y}.png",
      tileSize: 256,
      minZoom: 1,
      maxZoom: 5,
      bounds: [[-52, -37], [53, 76]],
      transform: [2.115, 85.5, 2.115, 128.0],
      rotation: 270,
    },
  },
];

async function gql(query) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

// --- categorização de spawn ---
function spawnKind(s) {
  const cats = s.categories ?? [];
  const sides = s.sides ?? [];
  if (cats.includes("boss")) return "boss";
  if (cats.includes("sniper")) return "sniper";
  if ((sides.includes("pmc") || sides.includes("all")) && cats.includes("player")) return "pmc";
  if (sides.includes("scav")) return "scav";
  return null;
}

// --- projeção (porta da matemática do tarkov.dev) p/ enumerar tiles ---
function projectPixel(xLng, yLat, rotation, transform, scale) {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  // applyRotation -> latLng(ry, rx); LonLat.project -> Point(lng=rx, lat=ry)
  const rx = xLng * cos - yLat * sin;
  const ry = xLng * sin + yLat * cos;
  const a = transform[0], b = transform[1], c = transform[2] * -1, d = transform[3];
  return { x: scale * (a * rx + b), y: scale * (c * ry + d) };
}

function tileRange(t, z) {
  const scale = Math.pow(2, z);
  // 4 cantos do retângulo em latLng: lat=y, lng=x
  const xs = [t.bounds[0][0], t.bounds[1][0]];
  const ys = [t.bounds[0][1], t.bounds[1][1]];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const lng of xs) {
    for (const lat of ys) {
      const p = projectPixel(lng, lat, t.rotation, t.transform, scale);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
  }
  return {
    x0: Math.floor(minX / t.tileSize), x1: Math.floor(maxX / t.tileSize),
    y0: Math.floor(minY / t.tileSize), y1: Math.floor(maxY / t.tileSize),
  };
}

async function downloadBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

async function run() {
  console.log("→ Buscando dados de mapa da tarkov.dev…");
  const mapData = await gql(`{
    maps(lang: en) {
      normalizedName
      extracts { name faction position { x z } }
      transits { description position { x z } }
      spawns { sides categories position { x z } }
      lootContainers { lootContainer { normalizedName } position { x z } }
    }
  }`);
  const byName = new Map(mapData.maps.map((m) => [m.normalizedName, m]));

  const markers = {};
  for (const cfg of MAPS) {
    const m = byName.get(cfg.key);
    if (!m) { console.warn(`  ! sem dados para ${cfg.key}`); continue; }
    markers[cfg.key] = {
      extracts: (m.extracts ?? [])
        .filter((e) => e.position)
        .map((e) => ({ x: e.position.x, z: e.position.z, name: e.name, faction: e.faction })),
      transits: (m.transits ?? [])
        .filter((t) => t.position)
        .map((t) => ({ x: t.position.x, z: t.position.z, description: t.description })),
      spawns: (m.spawns ?? [])
        .filter((s) => s.position)
        .map((s) => ({ x: s.position.x, z: s.position.z, kind: spawnKind(s) }))
        .filter((s) => s.kind),
      loot: (m.lootContainers ?? [])
        .filter((l) => l.position && l.lootContainer)
        .map((l) => ({ x: l.position.x, z: l.position.z, type: l.lootContainer.normalizedName })),
    };
    const c = markers[cfg.key];
    console.log(`  ✓ ${cfg.key}: ext=${c.extracts.length} tr=${c.transits.length} spawn=${c.spawns.length} loot=${c.loot.length}`);
  }

  console.log("→ Buscando quests…");
  const taskData = await gql(`{
    tasks(lang: en) {
      id name normalizedName minPlayerLevel kappaRequired wikiLink
      trader { name }
      taskRequirements { task { id } status }
      objectives {
        __typename id type description optional
        maps { normalizedName }
        ... on TaskObjectiveBasic { zones { id position { x z } map { normalizedName } } }
        ... on TaskObjectiveQuestItem {
          zones { id position { x z } map { normalizedName } }
          possibleLocations { map { normalizedName } positions { x z } }
        }
        ... on TaskObjectiveItem { zones { id position { x z } map { normalizedName } } }
        ... on TaskObjectiveMark { zones { id position { x z } map { normalizedName } } }
      }
    }
  }`);
  console.log(`  ✓ ${taskData.tasks.length} quests`);

  // grava JSONs
  const dataDir = join(PUBLIC, "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "map-markers.json"), JSON.stringify(markers));
  await writeFile(join(dataDir, "tasks.json"), JSON.stringify(taskData.tasks));
  await writeFile(
    join(dataDir, "meta.json"),
    JSON.stringify({
      syncedAt: new Date().toISOString(),
      source: "tarkov.dev (the-hideout, open-source)",
      attribution: "Dados e mapas SVG por tarkov.dev e autores da comunidade (Shebuka et al.)",
    }, null, 2),
  );
  console.log("  ✓ data/*.json gravados");

  // baixa SVGs
  console.log("→ Baixando imagens SVG dos mapas…");
  const svgDir = join(PUBLIC, "maps", "svg");
  await mkdir(svgDir, { recursive: true });
  for (const cfg of MAPS) {
    if (!cfg.svg) continue;
    const buf = await downloadBuffer(`${CDN_SVG}/${cfg.svg}`);
    if (!buf) { console.warn(`  ! falhou SVG ${cfg.key}`); continue; }
    await writeFile(join(svgDir, `${cfg.key}.svg`), buf);
    console.log(`  ✓ ${cfg.key}.svg (${(buf.length / 1024).toFixed(0)} KB)`);
  }

  // baixa tiles do the-labyrinth
  const tCfg = MAPS.find((m) => m.tiles);
  if (tCfg) {
    console.log("→ Baixando tiles do the-labyrinth…");
    let ok = 0, miss = 0;
    for (let z = tCfg.tiles.minZoom; z <= tCfg.tiles.maxZoom; z++) {
      const r = tileRange(tCfg.tiles, z);
      for (let x = r.x0; x <= r.x1; x++) {
        for (let y = r.y0; y <= r.y1; y++) {
          const url = tCfg.tiles.url.replace("{z}", z).replace("{x}", x).replace("{y}", y);
          const buf = await downloadBuffer(url);
          if (!buf) { miss++; continue; }
          const out = join(PUBLIC, "maps", "tiles", tCfg.key, String(z), String(x), `${y}.png`);
          await mkdir(dirname(out), { recursive: true });
          await writeFile(out, buf);
          ok++;
        }
      }
      console.log(`  z${z}: ${ok} tiles (até agora)`);
    }
    console.log(`  ✓ the-labyrinth: ${ok} tiles baixados (${miss} 404 ignorados)`);
  }

  console.log("\n✅ Sync completo. App pronto para rodar offline.");
}

run().catch((e) => { console.error("ERRO:", e); process.exit(1); });
