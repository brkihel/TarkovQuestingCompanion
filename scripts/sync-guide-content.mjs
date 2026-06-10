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

import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import sanitizeHtml from "sanitize-html";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HELP = "https://api.tarkov.help/api";
const OUT_DIR = join(ROOT, "public", "quest-images");
const PUBLIC_PREFIX = "/quest-images";
const MAX_WIDTH = 900;
const WEBP_QUALITY = 72;

async function getDetail(seo) {
  const r = await fetch(`${HELP}/en/quests/${seo}`, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.data !== undefined ? j.data : j;
}

const isMinio = (u) => /^https?:\/\/[^/]*minio\.tarkov\.help/i.test(u);
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
async function downloadResized(url, dest) {
  if (await exists(dest)) return true;
  const r = await fetch(url);
  if (!r.ok) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  await sharp(buf).resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_QUALITY }).toFile(dest);
  return true;
}

// sanitização: só tags seguras; <a> perde o href (vira texto estilizado);
// <img src> já reescrito para caminho local antes de chamar aqui.
function clean(html) {
  return sanitizeHtml(html, {
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
  for (const seo of seos) {
    i++;
    const d = await getDetail(seo).catch(() => null);
    if (!d || !d.guide || !d.guide.trim()) continue;

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
      const ok = await downloadResized(abs, join(OUT_DIR, name)).catch(() => false);
      if (ok) imgOk++;
      html = html.replaceAll(src, `${PUBLIC_PREFIX}/${name}`);
    }

    content[seo] = { name: d.name || seo, html: clean(html) };
    withHtml++;
    if (i % 100 === 0) console.log(`  ...${i}/${seos.length}  guias c/ html: ${withHtml}, imgs ok: ${imgOk}`);
  }

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
