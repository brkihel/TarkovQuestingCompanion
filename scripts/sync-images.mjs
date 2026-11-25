// Sync das IMAGENS de localização das quests (guias do tarkov.help, offline).
//
// As side quests (tarkov.dev) não têm imagens; os guias do tarkov.help têm
// screenshots de localização (em /img/articles/). Usamos o mapeamento
// task->seoLink (quest-guides.json) para, por quest, extrair essas imagens do
// HTML do guia e BAIXAR para public/quest-images/ (o app é offline em runtime).
//
// Cada <img> do guia traz um `alt`/legenda descrevendo o PONTO (ex.: "Note near
// the door"). Casamos cada imagem ao OBJETIVO da quest cuja descrição tem maior
// overlap de tokens com o alt/legenda — assim o app mostra só a imagem daquele
// ponto (estilo Tarkov Pilot), com fallback para o carrossel da quest inteira.
//
// Saída:
//   public/quest-images/<arquivo>            imagens baixadas (dedupe por nome)
//   public/data/quest-images.json            { byObjective: {objId:[...]}, byTask: {taskId:[...]} }
//
// Rodar: `npm run sync:images` (depois de `npm run sync` e `npm run sync:guides`).

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, atomicWrite as writeFile, request } from "./lib/http.mjs";
import { outName, downloadQuestImage } from "./lib/quest-images.mjs";
import { MODES } from "./lib/tarkov-data.mjs";

// O viewer mostra no máximo ~760px; redimensionamos pra ~900px webp para o app
// ficar offline sem inchar (full-res seriam ~214 MB; assim cai pra ~30 MB).

const HELP = "https://api.tarkov.help/api";
const OUT_DIR = join(ROOT, "public", "quest-images");
const PUBLIC_PREFIX = "/quest-images";

async function getDetail(seo) {
  const bytes = await request(`${HELP}/en/quests/${seo}`, { missing: true });
  if (!bytes) return null;
  const j = JSON.parse(bytes.toString("utf8"));
  return j.data !== undefined ? j.data : j;
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// blocos de imagem do guia: { url, text } onde text = alt + legenda do ponto.
// Só imagens de localização (/img/articles/); a legenda é o <p class="bb-image__text">
// imediatamente após a imagem.
function parseBlocks(html) {
  const s = String(html || "");
  const imgs = [...s.matchAll(/<img[^>]*>/gi)].map((m) => ({ tag: m[0], idx: m.index }));
  const caps = [...s.matchAll(/<p class="bb-image__text">([\s\S]*?)<\/p>/gi)].map((m) => ({
    text: stripTags(m[1]),
    idx: m.index,
  }));
  const blocks = [];
  for (let i = 0; i < imgs.length; i++) {
    const { tag, idx } = imgs[i];
    const srcM = /src="([^"]+)"/.exec(tag);
    if (!srcM) continue;
    const url = srcM[1].replace(/([^:])\/\/+/g, "$1/");
    // imagens de localização: do guia (/img/articles/) ou já locais (/quest-images/)
    if (!/\/img\/articles\/|\/quest-images\//i.test(url)) continue;
    const altM = /alt="([^"]*)"/.exec(tag);
    const alt = altM ? altM[1] : "";
    const nextIdx = i + 1 < imgs.length ? imgs[i + 1].idx : Infinity;
    const cap = caps.find((c) => c.idx > idx && c.idx < nextIdx);
    blocks.push({ url, text: `${alt} ${cap ? cap.text : ""}`.trim() });
  }
  return blocks;
}

// nome de saída: sempre .webp (re-encodamos), a partir do nome original.


const STOP = new Set([
  "the", "and", "for", "with", "near", "from", "your", "you", "find", "place",
  "locate", "this", "that", "have", "into", "onto", "over", "under", "about",
  "area", "spot", "view", "distance", "inside", "first", "second", "third",
  "left", "right", "quest", "item", "items", "marker", "mark", "eliminate",
  "kill", "survive", "extract", "during", "while", "must", "make", "using",
  "located", "location", "next", "between", "behind", "front", "where", "there",
  "needs", "need", "will", "they", "them", "then", "some", "also", "than",
]);

function tokenize(s) {
  return new Set(
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

function overlap(aSet, bSet) {
  let n = 0;
  for (const w of aSet) if (bSet.has(w)) n++;
  return n;
}

// objetivos geolocalizados da task (os que viram marcador no mapa).
function geoObjectives(task) {
  return (task.objectives ?? []).filter((o) => {
    const hasZone = (o.zones ?? []).some((z) => z.position);
    const hasLoc = (o.possibleLocations ?? []).length > 0;
    return hasZone || hasLoc;
  });
}

// casa cada imagem do guia a um objetivo geolocalizado da task -> { objId: [url] }.
// Ambiguous images remain in the task carousel; never guess by image order.
function matchImagesToObjectives(task, blocks) {
  const geo = geoObjectives(task);
  const out = {};
  if (!geo.length || !blocks.length) return out;

  // caso comum e confiável: 1 só objetivo geolocalizado -> todas as imagens dele.
  if (geo.length === 1) {
    out[geo[0].id] = blocks.map((b) => b.url);
    return out;
  }

  const objTokens = geo.map((o) => ({ id: o.id, set: tokenize(o.description) }));
  const assigned = new Array(blocks.length).fill(null); // imgIdx -> objId

  // (1) token match: melhor objetivo por imagem (empate -> o primeiro).
  blocks.forEach((b, bi) => {
    const bTok = tokenize(b.text);
    if (!bTok.size) return;
    let best = null;
    let bestScore = 0;
    let tied = false;
    for (const o of objTokens) {
      const sc = overlap(bTok, o.set);
      if (sc > bestScore) {
        bestScore = sc;
        best = o.id;
        tied = false;
      } else if (sc === bestScore) {
        tied = true;
      }
    }
    if (best && bestScore >= 2 && !tied) assigned[bi] = best;
  });

  blocks.forEach((b, bi) => {
    if (assigned[bi]) (out[assigned[bi]] ??= []).push(b.url);
  });
  return out;
}

async function run() {
  const guides = JSON.parse(await readFile(join(ROOT, "public", "data", "quest-guides.json"), "utf8")).guides;
  const tasks = (await Promise.all(MODES.map(async (mode) => JSON.parse(
    await readFile(join(ROOT, "public", "data", mode, "tasks.json"), "utf8"),
  )))).flat();
  const taskById = new Map();
  for (const task of tasks) {
    const existing = taskById.get(task.id);
    if (!existing) taskById.set(task.id, { ...task, objectives: [...task.objectives] });
    else {
      const known = new Set(existing.objectives.map((o) => o.id));
      existing.objectives.push(...task.objectives.filter((o) => !known.has(o.id)));
    }
  }

  const taskIds = Object.keys(guides);
  const seoToTasks = new Map();
  for (const id of taskIds) {
    const seo = guides[id];
    if (!seoToTasks.has(seo)) seoToTasks.set(seo, []);
    seoToTasks.get(seo).push(id);
  }
  console.log(`→ ${seoToTasks.size} quests (guia) para ${taskIds.length} tasks`);

  await mkdir(OUT_DIR, { recursive: true });

  // Modo LOCAL (LOCAL=1): reconstrói o JSON a partir do guide-content.json já
  // baixado (sem rede; imagens já estão em public/quest-images/). Útil para
  // reprocessar o casamento imagem<->objetivo sem re-raspar o tarkov.help.
  const LOCAL = process.env.LOCAL !== "0";
  const seoBlocks = new Map(); // seo -> [{url(public), text}]

  if (LOCAL) {
    const gc = JSON.parse(
      await readFile(join(ROOT, "public", "data", "guide-content.json"), "utf8"),
    ).guides;
    for (const seo of seoToTasks.keys()) {
      const g = gc[seo];
      if (!g) continue;
      const blocks = parseBlocks(g.html); // urls já são /quest-images/...
      if (blocks.length) seoBlocks.set(seo, blocks);
    }
    console.log(`  ✓ (local) ${seoBlocks.size} quests com imagens (sem rede)`);
  } else {
    // 1) coleta blocos (url+texto) por seoLink (rede tarkov.help)
    const toDownload = new Map(); // basename -> url original
    let i = 0;
    for (const seo of seoToTasks.keys()) {
      i++;
      const d = await getDetail(seo);
      if (!d) continue;
      const blocks = parseBlocks(d.guide);
      if (!blocks.length) continue;
      const pub = [];
      for (const b of blocks) {
        const name = outName(b.url);
        toDownload.set(name, b.url);
        pub.push({ url: `${PUBLIC_PREFIX}/${name}`, text: b.text });
      }
      seoBlocks.set(seo, pub);
      if (i % 100 === 0) console.log(`  ...${i}/${seoToTasks.size}  imgs únicas: ${toDownload.size}`);
    }
    console.log(`  ✓ ${toDownload.size} imagens únicas em ${seoBlocks.size} quests`);

    // 2) baixa (concorrência pequena)
    const entries = [...toDownload.entries()];
    let ok = 0,
      fail = 0;
    const CONC = 8;
    for (let k = 0; k < entries.length; k += CONC) {
      const batch = entries.slice(k, k + CONC);
      const res = await Promise.all(
        batch.map(([name, url]) => downloadQuestImage(url, join(OUT_DIR, name)).catch(() => false)),
      );
      for (const r of res) r ? ok++ : fail++;
      if ((k / CONC) % 10 === 0) console.log(`  baixadas ${ok}/${toDownload.size} (${fail} falhas)`);
    }
    console.log(`  ✓ baixadas ${ok}, falhas ${fail}`);
  }

  // 3) byTask (todas as imagens da quest) + byObjective (imagem do ponto)
  const byTask = {};
  const byObjective = {};
  let objWithImg = 0;
  for (const [seo, blocks] of seoBlocks) {
    const paths = blocks.map((b) => b.url);
    const dedup = (arr) => [...new Set(arr)];
    for (const id of seoToTasks.get(seo)) {
      if (!taskById.has(id)) continue;
      byTask[id] = dedup(paths);
      const task = taskById.get(id);
      if (!task) continue;
      const matched = matchImagesToObjectives(task, blocks);
      for (const [objId, urls] of Object.entries(matched)) {
        byObjective[objId] = dedup(urls);
        objWithImg++;
      }
    }
  }

  await writeFile(
    join(ROOT, "public", "data", "quest-images.json"),
    JSON.stringify({
      source: "tarkov.help (guias)",
      syncedAt: new Date().toISOString(),
      byObjective,
      byTask,
    }),
  );
  console.log(
    `  ✓ public/data/quest-images.json (${Object.keys(byTask).length} tasks, ${objWithImg} objetivos com imagem do ponto)`,
  );
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
