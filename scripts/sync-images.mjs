// Sync das IMAGENS de localização das quests (guias do tarkov.help, offline).
//
// As side quests (tarkov.dev) não têm imagens; os guias do tarkov.help têm
// screenshots de localização (em /img/articles/). Usamos o mapeamento
// task->seoLink (quest-guides.json) para, por quest, extrair essas imagens do
// HTML do guia e BAIXAR para public/quest-images/ (o app é offline em runtime).
//
// Saída:
//   public/quest-images/<arquivo>            imagens baixadas (dedupe por nome)
//   public/data/quest-images.json            { taskId(dev): ["/quest-images/x.webp", ...] }
//
// Rodar: `npm run sync:images` (depois de `npm run sync:guides`).

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// O viewer mostra no máximo ~760px; redimensionamos pra ~900px webp para o app
// ficar offline sem inchar (full-res seriam ~214 MB; assim cai pra ~30 MB).
const MAX_WIDTH = 900;
const WEBP_QUALITY = 72;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HELP = "https://api.tarkov.help/api";
const OUT_DIR = join(ROOT, "public", "quest-images");
const PUBLIC_PREFIX = "/quest-images";

async function getDetail(seo) {
  const r = await fetch(`${HELP}/en/quests/${seo}`, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.data !== undefined ? j.data : j;
}

// imagens de localização do guia (exclui ícones de trader etc.)
function articleImages(html) {
  return [...String(html || "").matchAll(/<img[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => /\/img\/articles\//i.test(u))
    .map((u) => u.replace(/([^:])\/\/+/g, "$1/")); // normaliza // duplicadas
}

// nome de saída: sempre .webp (re-encodamos), a partir do nome original.
function outName(u) {
  const base = u.split("/").pop().split("?")[0];
  return base.replace(/\.[a-z0-9]+$/i, "") + ".webp";
}

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  if (await exists(dest)) return true;
  const r = await fetch(url);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dest);
  return true;
}

async function run() {
  const guides = JSON.parse(await readFile(join(ROOT, "public", "data", "quest-guides.json"), "utf8")).guides;
  const taskIds = Object.keys(guides);
  const seoToTasks = new Map();
  for (const id of taskIds) {
    const seo = guides[id];
    if (!seoToTasks.has(seo)) seoToTasks.set(seo, []);
    seoToTasks.get(seo).push(id);
  }
  console.log(`→ ${seoToTasks.size} quests (guia) para ${taskIds.length} tasks`);

  await mkdir(OUT_DIR, { recursive: true });

  // 1) coleta imagens por seoLink
  const seoImages = new Map(); // seo -> [publicPath]
  const toDownload = new Map(); // basename -> url
  let i = 0;
  for (const seo of seoToTasks.keys()) {
    i++;
    const d = await getDetail(seo).catch(() => null);
    if (!d) continue;
    const urls = [...new Set(articleImages(d.guide))];
    if (!urls.length) continue;
    const paths = [];
    for (const u of urls) {
      const name = outName(u);
      toDownload.set(name, u);
      paths.push(`${PUBLIC_PREFIX}/${name}`);
    }
    seoImages.set(seo, paths);
    if (i % 100 === 0) console.log(`  ...${i}/${seoToTasks.size}  imgs únicas: ${toDownload.size}`);
  }
  console.log(`  ✓ ${toDownload.size} imagens únicas em ${seoImages.size} quests`);

  // 2) baixa (concorrência pequena)
  const entries = [...toDownload.entries()];
  let ok = 0,
    fail = 0;
  const CONC = 8;
  for (let k = 0; k < entries.length; k += CONC) {
    const batch = entries.slice(k, k + CONC);
    const res = await Promise.all(
      batch.map(([name, url]) => download(url, join(OUT_DIR, name)).catch(() => false)),
    );
    for (const r of res) r ? ok++ : fail++;
    if ((k / CONC) % 10 === 0) console.log(`  baixadas ${ok}/${toDownload.size} (${fail} falhas)`);
  }
  console.log(`  ✓ baixadas ${ok}, falhas ${fail}`);

  // 3) quest-images.json por taskId
  const byTask = {};
  for (const [seo, paths] of seoImages) {
    for (const id of seoToTasks.get(seo)) byTask[id] = paths;
  }
  await writeFile(
    join(ROOT, "public", "data", "quest-images.json"),
    JSON.stringify({ source: "tarkov.help (guias)", syncedAt: new Date().toISOString(), images: byTask }),
  );
  console.log(`  ✓ public/data/quest-images.json (${Object.keys(byTask).length} tasks com imagens)`);
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
