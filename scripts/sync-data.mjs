// Stage current JSON API data and assets before publishing the offline bundle.
import { join } from 'node:path';
import { ROOT, json, request, atomicWrite, pool, sources } from './lib/http.mjs';
import { MODES, LANGUAGES, JSON_API, dataset, normalizeTasks, normalizeMarkers } from './lib/tarkov-data.mjs';

const PUBLIC = join(ROOT, 'public');
const CATALOG_URL = 'https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/maps.json';

export function tileRange(config, zoom) {
  const rad = config.coordinateRotation * Math.PI / 180, scale = 2 ** zoom;
  const points = config.bounds.flatMap(([x]) => config.bounds.map(([, y]) => {
    const rx = x * Math.cos(rad) - y * Math.sin(rad), ry = x * Math.sin(rad) + y * Math.cos(rad);
    return [scale * (config.transform[0] * rx + config.transform[1]),
      scale * (-config.transform[2] * ry + config.transform[3])];
  }));
  return { x0: Math.floor(Math.min(...points.map(p => p[0])) / config.tileSize),
    x1: Math.ceil(Math.max(...points.map(p => p[0])) / config.tileSize) - 1,
    y0: Math.floor(Math.min(...points.map(p => p[1])) / config.tileSize),
    y1: Math.ceil(Math.max(...points.map(p => p[1])) / config.tileSize) - 1 };
}

export function buildCatalog(upstream) {
  return upstream.flatMap(group => {
    const m = group.maps.find(m => m.projection === 'interactive');
    if (!m) return [];
    const config = {
      key: m.key, name: group.name ?? ({ "streets-of-tarkov": "Streets of Tarkov" }[m.key]) ?? m.key.split('-').map(v => v[0].toUpperCase() + v.slice(1)).join(' '),
      altKeys: m.altMaps ?? [], svgPath: m.svgPath ? `/maps/svg/${m.key}.svg` : null,
      tilePath: m.svgPath ? null : `/maps/tiles/${m.key}/main/{z}/{x}/{y}.png`,
      tileSize: m.tileSize ?? 256, minZoom: m.minZoom, maxZoom: m.maxZoom,
      maxNativeZoom: m.key === 'icebreaker' ? 3 : m.key === 'the-lab' ? 4 : m.maxZoom,
      bounds: m.bounds, transform: m.transform, coordinateRotation: m.coordinateRotation,
      author: m.author, authorLink: m.authorLink, sourceSvg: m.svgPath, sourceTiles: m.tilePath,
    };
    if (!m.svgPath && m.layers?.length) {
      const layers = m.layers.some(l => l.tilePath === m.tilePath) ? m.layers : [
        { name: 'Ground', tilePath: m.tilePath, show: true, extents: [{ height: m.heightRange }] }, ...m.layers,
      ];
      config.floors = layers.map((l, index) => ({
        id: `floor-${index}`, name: l.name, svgGroup: '', default: !!l.show,
        min: Math.min(...l.extents.map(e => e.height[0])), max: Math.max(...l.extents.map(e => e.height[1])),
        tilePath: `/maps/tiles/${m.key}/floor-${index}/{z}/{x}/{y}.png`, sourceTiles: l.tilePath,
      })).sort((a, b) => b.min - a.min);
      config.floors[0].max = null;
      config.floors.at(-1).min = null;
      for (let i = 0; i < config.floors.length - 1; i++) {
        const boundary = (config.floors[i].min + config.floors[i + 1].max) / 2;
        config.floors[i].min = boundary; config.floors[i + 1].max = boundary;
      }
      config.tilePath = config.floors.find(f => f.default).tilePath;
    }
    return [config];
  });
}

async function run() {
  const catalog = buildCatalog(await json(CATALOG_URL));
  const pending = [], summary = {};
  for (const mode of MODES) {
    console.log(`→ ${mode}: tasks, maps, traders (EN/PT)…`);
    let englishMaps;
    for (const lang of LANGUAGES) {
      const [tasksData, mapData, traders, itemNames] = await Promise.all([
        dataset(mode, 'tasks', lang), dataset(mode, 'maps', lang), dataset(mode, 'traders', lang),
        json(`${JSON_API}/${mode}/items_${lang}`),
      ]);
      const tasks = normalizeTasks(tasksData, mapData.maps, traders, itemNames.data);
      if (lang === "en") englishMaps = mapData.maps;
      const markers = normalizeMarkers(mapData, catalog, itemNames.data, englishMaps, lang);
      if (tasks.length < 100) throw new Error(`Incomplete task dataset: ${mode}/${lang}`);
      for (const task of tasks) if (!task.name || /^[a-f0-9]{24} name$/.test(task.name))
        throw new Error(`Missing task translation: ${task.id}`);
      const suffix = lang === 'en' ? '' : `-${lang}`;
      pending.push([join(PUBLIC, 'data', mode, `tasks${suffix}.json`), JSON.stringify(tasks)],
        [join(PUBLIC, 'data', mode, `map-markers${suffix}.json`), JSON.stringify(markers)]);
      if (mode === 'regular' && lang === 'en') pending.push(
        [join(PUBLIC, 'data/tasks.json'), JSON.stringify(tasks)],
        [join(PUBLIC, 'data/map-markers.json'), JSON.stringify(markers)]);
      summary[mode] = { tasks: tasks.length, maps: catalog.length };
      console.log(`  ✓ ${lang}: ${tasks.length} tasks, ${catalog.length} maps`);
    }
  }
  for (const config of process.argv.includes("--data-only") ? [] : catalog) {
    if (config.sourceSvg) {
      const bytes = await request(config.sourceSvg);
      if (!bytes.toString('utf8').includes('<svg')) throw new Error(`Invalid SVG: ${config.key}`);
      pending.push([join(PUBLIC, config.svgPath), bytes]);
      console.log(`  ✓ ${config.key}: SVG`);
    } else {
      for (const floor of config.floors ?? [config]) {
        const urls = [];
        for (let z = config.minZoom; z <= config.maxNativeZoom; z++) {
          const r = tileRange(config, z);
          for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++) {
            const replace = path => path.replace('{z}', z).replace('{x}', x).replace('{y}', y);
            urls.push({ url: replace(floor.sourceTiles), path: join(PUBLIC, replace(floor.tilePath)), z });
          }
        }
        const found = new Set();
        await pool(urls, async ({ url, path, z }) => {
          const bytes = await request(url, { missing: true });
          if (bytes) {
            if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) throw new Error(`Invalid tile: ${url}`);
            await atomicWrite(path, bytes); found.add(z);
          }
        });
        for (let z = config.minZoom; z <= config.maxNativeZoom; z++) if (!found.has(z))
          throw new Error(`No tiles at zoom ${z}: ${config.key}/${floor.id ?? 'main'}`);
        console.log(`  ✓ ${config.key}/${floor.name ?? 'main'}: tiles z${config.minZoom}–${config.maxNativeZoom}`);
      }
    }
  }
  const publicCatalog = catalog.map(({ sourceSvg, sourceTiles, ...m }) => ({ ...m,
    ...(m.floors ? { floors: m.floors.map(({ sourceTiles, ...f }) => f) } : {}),
  }));
  const meta = { syncedAt: new Date().toISOString(), source: 'tarkov.dev JSON API',
    attribution: 'Quest data and map artwork by tarkov.dev and credited community authors.', modes: summary,
    sources: [...sources.values()].sort((a, b) => a.url.localeCompare(b.url)).filter(s => !/\/\d+\/[-\d]+\/[-\d]+\.png$/.test(s.url)),
  };
  pending.push([join(ROOT, 'src/maps/catalog.json'), JSON.stringify(publicCatalog, null, 2)],
    [join(PUBLIC, 'data/meta.json'), JSON.stringify(meta, null, 2)]);
  for (const [path, bytes] of pending) await atomicWrite(path, bytes);
  console.log('✓ All modes and maps refreshed. Offline bundle ready.');
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/sync-data.mjs')) {
  run().catch(error => { console.error(error); process.exitCode = 1; });
}
