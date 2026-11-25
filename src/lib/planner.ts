import type { Position, QuestMarker, Task } from "./tarkovApi";

export const progressId = (taskId: string, objectiveId: string) => `${taskId}:${objectiveId}`;

export function isTaskComplete(task: Task, completed: Set<string>): boolean {
  const required = task.objectives.filter((o) => !o.optional);
  return required.length > 0 && required.every((o) => completed.has(progressId(task.id, o.id)));
}

/** A visit sequence, not pathfinding. Choose one spawn for alternative quest items. */
export function planVisits(markers: QuestMarker[], origin: Position | null, floorId: (y?: number) => string): QuestMarker[] {
  const distance = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);
  const alternatives = new Set<string>();
  const ordered = [...markers].sort((a, b) => origin ? distance(a, origin) - distance(b, origin) : a.zoneId.localeCompare(b.zoneId));
  const remaining = ordered.filter((m) => {
    if (!m.alternative) return true;
    const id = progressId(m.taskId, m.objectiveId);
    if (alternatives.has(id)) return false;
    alternatives.add(id);
    return true;
  });
  const result: QuestMarker[] = [];
  let previous: { x: number; y?: number; z: number } | null = origin;
  while (remaining.length) {
    const current = previous;
    remaining.sort((a, b) => {
      if (!current) return a.zoneId.localeCompare(b.zoneId);
      const sameA = floorId(a.y) === floorId(current.y), sameB = floorId(b.y) === floorId(current.y);
      return Number(sameB) - Number(sameA) || distance(a, current) - distance(b, current);
    });
    const next = remaining.shift()!;
    result.push(next);
    previous = next;
  }
  return result;
}
