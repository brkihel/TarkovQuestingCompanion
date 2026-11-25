// Sync da MAIN STORYLINE (trader "Storyteller") a partir do tarkov.help.
//
// As quests de progressão de história do EFT 1.0 (trader Storyteller) NÃO estão
// na tarkov.dev. A fonte é a API REST do tarkov.help (Laravel). Elas não têm
// coordenadas de mapa — então aqui guardamos só o necessário para a seção de
// referência "Main Storyline" na sidebar: nome, ordem, nível e kappa.
//
// Rodar: `npm run sync:storyline`. Reexecutar após patch do jogo.
// Saída: public/data/storyline.json
//
// Obs.: tarkov.help só tem locale en/ru (sem pt) — os nomes ficam em inglês.

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, atomicWrite as writeFile, json, request } from "./lib/http.mjs";

const API = "https://api.tarkov.help/api";
const LOCALE = "en";

async function getJson(path) {
  const j = await json(`${API}${path}`);
  return j && j.data !== undefined ? j.data : j;
}

async function run() {
  console.log("→ Buscando quests da main storyline (Storyteller) no tarkov.help…");
  const list = await getJson(`/${LOCALE}/quests/trader/storyteller`);
  if (!Array.isArray(list)) throw new Error("resposta inesperada (lista não é array)");
  console.log(`  ✓ ${list.length} quests`);

  // enriquece cada quest com level_req / kappa_req (vêm só no detalhe)
  const quests = [];
  for (const q of list) {
    let levelReq = null;
    let kappaReq = null;
    try {
      const d = await getJson(`/${LOCALE}/quests/${q.seo_link}`);
      levelReq = typeof d.level_req === "number" ? d.level_req : null;
      kappaReq = typeof d.kappa_req === "boolean" ? d.kappa_req : null;
    } catch {
      // detalhe indisponível — segue só com os campos da lista
    }
    quests.push({
      id: q.quest_id,
      seoLink: q.seo_link,
      name: q.name,
      levelReq,
      kappaReq,
    });
  }

  const out = {
    source: "tarkov.help",
    syncedAt: new Date().toISOString(),
    quests,
  };

  const dataDir = join(ROOT, "public", "data");
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "storyline.json"), JSON.stringify(out));
  console.log(`  ✓ public/data/storyline.json gravado (${quests.length} quests)`);
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
