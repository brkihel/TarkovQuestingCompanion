// A failed download or validation never replaces the installed offline bundle.
import { spawnSync } from "node:child_process";
import { cp, mkdir, rename, rm, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ROOT, atomicWrite } from "./lib/http.mjs";

const stage = join(ROOT, ".sync-cache", "staging");
const backup = join(ROOT, ".sync-cache", "previous-public");
// These are fixed, resolved paths inside this repository's ignored cache.
for (const target of [stage, backup]) {
  if (!resolve(target).startsWith(resolve(ROOT, ".sync-cache") + "/") &&
      !resolve(target).startsWith(resolve(ROOT, ".sync-cache") + "\\")) throw new Error("Invalid staging path");
}
if (!process.argv.includes("--publish-staged")) {
  await rm(stage, { recursive: true, force: true });
  await mkdir(stage, { recursive: true });
  await cp(join(ROOT, "public"), join(stage, "public"), { recursive: true });
}
try {
  for (const script of process.argv.includes("--publish-staged") ? ["validate-data"] : ["sync-data", "sync-storyline", "sync-guides", "sync-guide-content", "sync-images", "prune-images", "validate-data"]) {
    const result = spawnSync(process.execPath, [join(ROOT, "scripts", `${script}.mjs`)], {
      stdio: "inherit", env: { ...process.env, SYNC_ROOT: stage, LOCAL: "1" },
    });
    if (result.status !== 0) throw new Error(`${script} failed; published bundle unchanged.`);
  }
  await rm(backup, { recursive: true, force: true });
  try { await rename(join(ROOT, "public"), backup); }
  catch (error) {
    if (error.code === "EPERM" || error.code === "EBUSY") throw new Error(
      "Stop the development server/app, then run npm run sync:all -- --publish-staged. The published bundle is unchanged.",
    );
    throw error;
  }
  try {
    await rename(join(stage, "public"), join(ROOT, "public"));
    await atomicWrite(join(ROOT, "src/maps/catalog.json"), await readFile(join(stage, "src/maps/catalog.json")));
  } catch (error) {
    // Roll back the directory swap if publishing either part fails.
    try { await rename(join(ROOT, "public"), join(stage, "failed-public")); } catch { /* swap did not finish */ }
    await rename(backup, join(ROOT, "public"));
    throw new Error("Publication failed; previous public bundle restored.", { cause: error });
  }
  console.log("✓ Validated content published. Previous bundle retained in .sync-cache/previous-public.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
