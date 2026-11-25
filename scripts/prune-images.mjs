import { readFile, readdir, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ROOT } from "./lib/http.mjs";

const directory = resolve(ROOT, "public/quest-images");
const guides = JSON.parse(await readFile(join(ROOT, "public/data/guide-content.json"), "utf8")).guides;
const images = JSON.parse(await readFile(join(ROOT, "public/data/quest-images.json"), "utf8"));
const used = new Set(Object.values(guides).flatMap((guide) => [...guide.html.matchAll(/src="(\/quest-images\/[^"]+)"/g)].map((m) => decodeURI(m[1]))));
for (const collection of [images.byTask, images.byObjective]) for (const entries of Object.values(collection)) for (const src of entries) used.add(decodeURI(src));
let removed = 0;
for (const file of await readdir(directory, { withFileTypes: true })) {
  if (!file.isFile() || used.has(`/quest-images/${file.name}`)) continue;
  const path = resolve(directory, file.name);
  if (!path.startsWith(directory + "/") && !path.startsWith(directory + "\\")) throw new Error("Invalid image path");
  await unlink(path); removed++;
}
console.log(`✓ Removed ${removed} unreferenced quest images from the staged bundle.`);
