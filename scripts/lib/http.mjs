import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const ROOT = process.env.SYNC_ROOT ?? REPOSITORY;
const CACHE = join(REPOSITORY, ".sync-cache", "http");
export const sources = new Map();

export async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, value);
  await rename(`${path}.tmp`, path);
}

/** Reuse cached bytes only after the origin confirms HTTP 304. */
export async function request(url, { missing = false } = {}) {
  const key = createHash("sha256").update(url).digest("hex");
  const path = join(CACHE, key);
  let cached;
  try { cached = JSON.parse(await readFile(`${path}.json`, "utf8")); } catch { /* first request */ }
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = cached?.etag ? { "If-None-Match": cached.etag } : {};
      if (cached?.lastModified && !cached.etag) headers["If-Modified-Since"] = cached.lastModified;
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(30_000) });
      if (response.status === 304 && cached) {
        const bytes = await readFile(path);
        sources.set(url, { url, ...cached });
        return bytes;
      }
      if (missing && response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const meta = { etag: response.headers.get("etag"), lastModified: response.headers.get("last-modified"),
        sha256: createHash("sha256").update(bytes).digest("hex") };
      await atomicWrite(path, bytes);
      await atomicWrite(`${path}.json`, JSON.stringify(meta));
      sources.set(url, { url, ...meta });
      return bytes;
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }
}

export async function json(url) {
  return JSON.parse((await request(url)).toString("utf8"));
}

export async function pool(values, fn, concurrency = 8) {
  let index = 0;
  const results = new Array(values.length);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (index < values.length) { const i = index++; results[i] = await fn(values[i], i); }
  }));
  return results;
}
