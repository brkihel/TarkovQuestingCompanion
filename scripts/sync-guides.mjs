// Sync de LINKS DE GUIA das side quests (tarkov.dev -> guia no tarkov.help).
//
// A tarkov.dev é a fonte das side quests (tem coordenadas/markers), mas o
// tarkov.help tem guias escritos bons. Os IDs das duas fontes NÃO batem e os
// nomes em inglês divergem (traduções diferentes do russo). A sacada: casar
// pelos nomes em RUSSO, que são o original e coincidem (~95%).
//
// ATENÇÃO: o slug (seo_link) do tarkov.help MUDA por idioma. Casamos pelo nome
// russo, mas guardamos o seo_link do EN (juntando as listas en/ru por quest_id),
// porque o app abre os guias em /en/.
//
// Saída: public/data/quest-guides.json  =>  { taskId(dev): seoLink(EN, help) }
// Rodar: `npm run sync:guides`. Reexecutar após patch do jogo.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, atomicWrite as writeFile, json } from "./lib/http.mjs";
import { MODES, dataset } from "./lib/tarkov-data.mjs";

const HELP = "https://api.tarkov.help/api";

// trader (nome en na dev) -> tech name na .help
const TRADER_TECH = {
  Prapor: "prapor",
  Therapist: "therapist",
  Fence: "fence",
  Skier: "skier",
  Peacekeeper: "peacemaker",
  Mechanic: "mechanic",
  Ragman: "ragman",
  Jaeger: "jaeger",
  Lightkeeper: "lightkeeper",
  Ref: "ref",
  "BTR Driver": "btr_driver",
};

// normaliza nome russo: remove [PVP ZONE], pontuação, ё->е, espaços.
function normRu(s) {
  return (s || "")
    .replace(/\[pvp zone\]/gi, " ")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^а-я0-9a-z ]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function listTrader(loc, tech) {
  const j = await json(`${HELP}/${loc}/quests/trader/${tech}`);
  const list = Array.isArray(j) ? j : j.data;
  if (!Array.isArray(list) || !list.length) throw new Error(`Invalid trader list: ${loc}/${tech}`);
  return list;
}

async function run() {
  console.log("→ tarkov.dev JSON: tasks from all game modes (EN/RU)…");
  const byId = new Map();
  for (const mode of MODES) {
    const [en, ru, traders] = await Promise.all([
      dataset(mode, "tasks", "en"), dataset(mode, "tasks", "ru"), dataset(mode, "traders", "en"),
    ]);
    for (const t of Object.values(en.tasks)) byId.set(t.id, {
      id: t.id, ru: ru.tasks[t.id]?.name, trader: traders[t.trader]?.name,
    });
  }
  const dev = [...byId.values()];
  console.log(`  ✓ ${dev.length} unique tasks`);

  console.log("→ tarkov.help: quests por trader (en+ru, junta por quest_id)…");
  // mapa: `${tech} ${normRu(nomeRu)}` -> seoLink(EN)
  const helpMap = new Map();
  for (const tech of new Set(Object.values(TRADER_TECH))) {
    const [enList, ruList] = await Promise.all([listTrader("en", tech), listTrader("ru", tech)]);
    if (!enList || !ruList) {
      console.warn(`  ! ${tech}: falha ao listar`);
      continue;
    }
    const enSeoById = new Map(enList.map((q) => [q.quest_id, q.seo_link]));
    for (const q of ruList) {
      const enSeo = enSeoById.get(q.quest_id);
      if (enSeo) helpMap.set(`${tech} ${normRu(q.name)}`, enSeo);
    }
  }
  console.log(`  ✓ ${helpMap.size} quests indexadas`);

  // casa cada task da dev ao seo_link (EN) da help
  const guides = {};
  let matched = 0;
  let comparable = 0;
  for (const d of dev) {
    const tech = TRADER_TECH[d.trader];
    if (!tech) continue; // trader sem correspondência na .help
    comparable++;
    const seo = helpMap.get(`${tech} ${normRu(d.ru)}`);
    if (seo) {
      guides[d.id] = seo;
      matched++;
    }
  }
  console.log(`  ✓ casados ${matched}/${comparable} (${((100 * matched) / comparable).toFixed(1)}%)`);

  const out = {
    source: "tarkov.dev <-> tarkov.help (match por nome russo, seo EN)",
    syncedAt: new Date().toISOString(),
    guides,
  };
  const dataDir = join(ROOT, "public", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "quest-guides.json"), JSON.stringify(out));
  console.log(`  ✓ public/data/quest-guides.json (${matched} links)`);
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
