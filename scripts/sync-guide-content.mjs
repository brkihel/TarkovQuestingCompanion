// Sync do CONTEÚDO dos guias (para mostrar nativamente dentro do app).
//
// Por quest (side quests via quest-guides.json + main storyline via
// storyline.json), baixa o HTML do guia do tarkov.help, baixa+redimensiona as
// imagens referenciadas (reusa public/quest-images/), reescreve os src para
// local, sanitiza o HTML (whitelist) e neutraliza os links internos (vira texto)
// — assim o guia é renderizado 100% nativo, sem abrir navegador.
//
// Saída: public/data/guide-content.json  =>  { seoLink: { name, html } }
// Rodar: `npm run sync:guide-content` (depois de sync:guides e sync:storyline).

import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, atomicWrite as writeFile, request, pool } from "./lib/http.mjs";
import { outName, downloadQuestImage } from "./lib/quest-images.mjs";
import sanitizeHtml from "sanitize-html";

const HELP = "https://api.tarkov.help/api";
const OUT_DIR = join(ROOT, "public", "quest-images");
const PUBLIC_PREFIX = "/quest-images";

async function getDetail(seo) {
  const bytes = await request(`${HELP}/en/quests/${seo}`, { missing: true });
  if (!bytes) return null;
  const j = JSON.parse(bytes.toString("utf8"));
  return j.data !== undefined ? j.data : j;
}

const isMinio = (u) => /^https?:\/\/[^/]*minio\.tarkov\.help/i.test(u);

// sanitização: só tags seguras; <a> perde o href (vira texto estilizado);
// <img src> já reescrito para caminho local antes de chamar aqui.
function clean(html) {
  return sanitizeHtml(html, {
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    allowedTags: ["p", "div", "span", "br", "a", "img", "b", "strong", "i", "em", "u", "ul", "ol", "li", "h2", "h3", "h4", "blockquote"],
    allowedAttributes: { img: ["src", "alt", "class"], "*": ["class"] },
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["data"] },
    transformTags: {
      // remove href/target dos links internos -> viram texto (full nativo)
      a: (tagName, attribs) => ({ tagName: "span", attribs: { class: `guide-ref ${attribs.class || ""}`.trim() } }),
    },
  });
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  const guides = JSON.parse(await readFile(join(ROOT, "public", "data", "quest-guides.json"), "utf8")).guides;
  const seoSet = new Set(Object.values(guides));
  // storyline (opcional)
  try {
    const story = JSON.parse(await readFile(join(ROOT, "public", "data", "storyline.json"), "utf8")).quests;
    for (const q of story) seoSet.add(q.seoLink);
  } catch {
    /* sem storyline.json */
  }
  const seos = [...seoSet];
  console.log(`→ ${seos.length} guias para baixar`);

  const content = {};
  let withHtml = 0;
  let imgOk = 0;
  let i = 0;
  await pool(seos, async (seo) => {
    i++;
    const d = await getDetail(seo);
    if (!d || !d.guide || !d.guide.trim()) return;

    // baixa imagens e monta o mapa src->local
    let html = d.guide;
    const srcs = [...new Set([...html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
    for (const src of srcs) {
      const abs = src.replace(/([^:])\/\/+/g, "$1/");
      if (!isMinio(abs)) {
        // imagem externa desconhecida: remove o <img> pra não quebrar offline
        html = html.replaceAll(src, "");
        continue;
      }
      const name = outName(abs);
      const ok = await downloadQuestImage(abs, join(OUT_DIR, name));
      if (ok) imgOk++;
      html = html.replaceAll(src, ok ? `${PUBLIC_PREFIX}/${name}` : "");
    }

    content[seo] = { name: d.name || seo, html: clean(html) };
    withHtml++;
    if (i % 100 === 0) console.log(`  ...${i}/${seos.length}  guias c/ html: ${withHtml}, imgs ok: ${imgOk}`);
  }, 4);

  await writeFile(
    join(ROOT, "public", "data", "guide-content.json"),
    JSON.stringify({ source: "tarkov.help (guias)", syncedAt: new Date().toISOString(), guides: content }),
  );
  console.log(`  ✓ public/data/guide-content.json (${withHtml} guias, ${imgOk} imagens processadas)`);
}

run().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
