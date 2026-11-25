// @vitest-environment jsdom
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { MAPS } from "../src/maps/mapsConfig";
import { floorsForMap } from "../src/maps/floors";
import { getCRS, gamePos } from "../src/maps/leafletCrs";
import { LOOT_GROUPS } from "../src/maps/layerDefs";
import L from "leaflet";

it("keeps configured SVG floors present in the downloaded maps", async () => {
  for (const map of MAPS.filter((m) => m.svgPath)) {
    const text = await readFile(`public${map.svgPath}`, "utf8");
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    for (const floor of floorsForMap(map.key) ?? []) expect(doc.getElementById(floor.svgGroup), `${map.key}/${floor.svgGroup}`).toBeTruthy();
  }
});

it("round-trips game coordinates through each map projection", () => {
  for (const config of MAPS) {
    const crs = getCRS(config);
    const source = L.latLng(gamePos(17.5, -44.25) as [number, number]);
    const result = crs.pointToLatLng(crs.latLngToPoint(source, 3), 3);
    expect(result.lat).toBeCloseTo(source.lat, 8);
    expect(result.lng).toBeCloseTo(source.lng, 8);
  }
});

it("does not silently drop any current loot container type", async () => {
  const groups = new Set(LOOT_GROUPS.flatMap((g) => g.types));
  const data = JSON.parse(await readFile("public/data/regular/map-markers.json", "utf8"));
  for (const map of Object.values(data) as { loot: { type: string }[] }[]) for (const loot of map.loot) expect(groups.has(loot.type), loot.type).toBe(true);
});
