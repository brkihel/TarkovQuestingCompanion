import { describe, expect, it } from "vitest";
import { markersForMap, type QuestMarker, type Task } from "../src/lib/tarkovApi";
import { isTaskComplete, planVisits, progressId } from "../src/lib/planner";

const marker = (id: string, x: number, y = 0, alternative = false): QuestMarker => ({
  taskId: "task", taskName: "Task", objectiveId: alternative ? "item" : id, zoneId: id,
  type: "visit", description: id, optional: false, trader: null, x, y, z: 0,
  objectiveIndex: 1, objectiveCount: 1, alternative,
});

describe("raid planning", () => {
  it("visits the current floor first and chooses one alternative item spawn", () => {
    const stops = planVisits([marker("upper", 1, 10), marker("far", 50), marker("near", 10), marker("item-a", 8, 0, true), marker("item-b", 80, 0, true)],
      { x: 0, y: 0, z: 0 }, (y) => y === 10 ? "upper" : "ground");
    expect(stops.map((m) => m.zoneId)).toEqual(["item-a", "near", "far", "upper"]);
  });
  it("is stable without a player fix and handles empty selections", () => {
    expect(planVisits([], null, () => "")).toEqual([]);
    expect(planVisits([marker("b", 1), marker("a", 10)], null, () => "")[0].zoneId).toBe("a");
  });
  it("does not require optional objectives to finish a task", () => {
    const task = { id: "t", objectives: [{ id: "required", optional: false }, { id: "optional", optional: true }] } as Task;
    expect(isTaskComplete(task, new Set([progressId("t", "required")]))).toBe(true);
    expect(isTaskComplete(task, new Set([progressId("other", "required")]))).toBe(false);
  });
  it("deduplicates equivalent map variants without merging different objectives", () => {
    const pos = { x: 1, y: 2, z: 3 };
    const task = { id: "t", name: "Task", trader: null, objectives: [
      { id: "a", type: "visit", zones: [{ id: "zone", position: pos, map: { normalizedName: "factory" } }, { id: "zone", position: pos, map: { normalizedName: "night-factory" } }] },
      { id: "b", type: "visit", zones: [{ id: "zone", position: pos, map: { normalizedName: "factory" } }] },
    ] } as unknown as Task;
    const points = markersForMap([task], ["factory", "night-factory"]);
    expect(points).toHaveLength(2);
    expect(new Set(points.map((m) => m.zoneId)).size).toBe(2);
    expect(points.map((m) => [m.objectiveIndex, m.objectiveCount])).toEqual([[1, 2], [2, 2]]);
  });
});
