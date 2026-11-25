import { createHash } from "node:crypto";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { request, atomicWrite } from "./http.mjs";

const converted = join(dirname(fileURLToPath(import.meta.url)), "../../.sync-cache/converted");
const pending = new Map();

export function outName(url) {
  const base = decodeURIComponent(new URL(url).pathname.split("/").pop())
    .replace(/\.[a-z0-9]+$/i, "").replace(/[<>:"/\\|?*\x00-\x1f]/g, "-").slice(0, 75);
  return `${base}--${createHash("sha256").update(url).digest("hex").slice(0, 12)}.webp`;
}

/** Revalidate original bytes, deduplicate concurrent references, update changed images. */
export function downloadQuestImage(url, destination) {
  if (!pending.has(destination)) pending.set(destination, (async () => {
    const bytes = await request(url, { missing: true });
    if (!bytes) return false;
    const hash = createHash("sha256").update(bytes).digest("hex");
    const hashFile = join(converted, `${outName(url)}.sha256`);
    try {
      if ((await readFile(hashFile, "utf8")) === hash) { await access(destination); return true; }
    } catch { /* first conversion or missing staged file */ }
    const output = await sharp(bytes).resize({ width: 900, withoutEnlargement: true }).webp({ quality: 72 }).toBuffer();
    await atomicWrite(destination, output);
    await atomicWrite(hashFile, hash);
    return true;
  })());
  return pending.get(destination);
}
