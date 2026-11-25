import { useMemo, useState } from "react";
import type { Position, QuestMarker, Task } from "../lib/tarkovApi";
import { isTaskComplete, planVisits, progressId } from "../lib/planner";
import { defaultFloor, floorForY, floorsForMap } from "../maps/floors";
import type { TarkovMapConfig } from "../maps/mapsConfig";
import { useSettings } from "../settings";

interface Props {
  tasks: Task[];
  config: TarkovMapConfig;
  markers: QuestMarker[];
  selected: Set<string>;
  completed: Set<string>;
  guides: Record<string, string>;
  player: Position | null;
  onToggle: (id: string) => void;
  onComplete: (id: string) => void;
  onFocus: (id: string) => void;
  onGuide: (seo: string) => void;
  onClear?: () => void;
}

export function QuestPanel({ tasks, config, markers, selected, completed, guides, player, onToggle, onComplete, onFocus, onGuide, onClear }: Props) {
  const { t } = useSettings();
  const [query, setQuery] = useState("");
  const [trader, setTrader] = useState("");
  const [level, setLevel] = useState("");
  const [kappa, setKappa] = useState(false);
  const [hideDone, setHideDone] = useState(true);
  const [allMaps, setAllMaps] = useState(false);
  const mapKeys = useMemo(() => new Set([config.key, ...(config.altKeys ?? [])]), [config]);
  const taskMarkers = useMemo(() => new Map(markers.map((m) => [m.taskId, m.zoneId])), [markers]);
  const matching = useMemo(() => tasks.filter((task) => {
    if (!allMaps && !taskMarkers.has(task.id) && !mapKeys.has(task.map?.normalizedName ?? "") &&
      !task.objectives.some((o) => o.maps.some((m) => mapKeys.has(m.normalizedName)))) return false;
    if (query && !`${task.name} ${task.trader?.name ?? ""} ${task.objectives.map((o) => o.description).join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) return false;
    if (trader && task.trader?.name !== trader) return false;
    if (level && task.minPlayerLevel > Number(level)) return false;
    if (kappa && !task.kappaRequired) return false;
    return !hideDone || !isTaskComplete(task, completed);
  }).sort((a, b) => a.minPlayerLevel - b.minPlayerLevel || a.name.localeCompare(b.name)),
  [tasks, taskMarkers, mapKeys, query, trader, level, kappa, hideDone, allMaps, completed]);
  const traders = useMemo(() => [...new Set(tasks.flatMap((task) => task.trader ? [task.trader.name] : []))].sort(), [tasks]);
  const activeTasks = tasks.filter((task) => selected.has(task.id) && !isTaskComplete(task, completed));
  const bring = new Map<string, { name: string; count: number }>();
  for (const task of activeTasks) {
    for (const entry of task.neededKeys ?? []) if (mapKeys.has(entry.map.normalizedName)) for (const key of entry.keys)
      bring.set(key.id, { name: key.name, count: 1 });
    for (const objective of task.objectives) {
      if (completed.has(progressId(task.id, objective.id)) || !["mark", "plantItem", "useItem"].includes(objective.type)) continue;
      if (objective.maps.length && !objective.maps.some((m) => mapKeys.has(m.normalizedName))) continue;
      const items = objective.items ?? [];
      if (items.length !== 1) continue; // Lists of alternatives must not become a shopping list.
      const item = items[0];
      const previous = bring.get(item.id);
      bring.set(item.id, { name: item.name, count: (previous?.count ?? 0) + (objective.count ?? 1) });
    }
  }
  const floors = floorsForMap(config.key);
  const floor = (y?: number) => floors ? (y == null ? defaultFloor(floors) : floorForY(floors, y)).name : "";
  const stops = planVisits(markers.filter((m) => selected.has(m.taskId) && !completed.has(progressId(m.taskId, m.objectiveId))), player, floor);

  return <div className="panel quest-panel">
    <h3 className="panel-title">{t("quests.title")} <span className="count">{matching.length}</span>
      {selected.size > 0 && onClear && <button className="panel-action" onClick={onClear}>{t("quests.clear")} ({selected.size})</button>}</h3>
    <input className="select" type="search" aria-label={t("quests.search")} placeholder={t("quests.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
    <div className="quest-filter-row">
      <select className="select" aria-label={t("quests.trader")} value={trader} onChange={(e) => setTrader(e.target.value)}>
        <option value="">{t("quests.allTraders")}</option>{traders.map((name) => <option key={name}>{name}</option>)}
      </select>
      <input className="select level-filter" type="number" min="1" max="100" aria-label={t("quests.maxLevel")} placeholder={t("quests.level")} value={level} onChange={(e) => setLevel(e.target.value)} />
    </div>
    <div className="quest-filter-options">
      <label><input type="checkbox" checked={kappa} onChange={(e) => setKappa(e.target.checked)} /> Kappa</label>
      <label><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} /> {t("quests.hideDone")}</label>
      <label><input type="checkbox" checked={allMaps} onChange={(e) => setAllMaps(e.target.checked)} /> {t("quests.allMaps")}</label>
    </div>
    {activeTasks.length > 0 && <details className="raid-plan" open>
      <summary>{t("plan.title")} · {stops.length} {t("plan.stops")}</summary>
      <p className="panel-empty">{t("plan.note")}</p>
      <strong>{t("plan.bring")}</strong>
      {bring.size ? <ul>{[...bring].map(([id, item]) => <li key={id}>{item.count}× {item.name}</li>)}</ul> : <p className="panel-empty">{t("plan.noItems")}</p>}
      <ol className="visit-list">{stops.map((stop) => <li key={stop.zoneId}>
        <button className="visit-stop" onClick={() => onFocus(stop.zoneId)}>{stop.taskName} · {floor(stop.y)}<small>{stop.description}</small></button>
      </li>)}</ol>
    </details>}
    {!matching.length && <p className="panel-empty">{t("quests.emptyFilter")}</p>}
    <ul className="quest-list">{matching.map((task) => {
      const on = selected.has(task.id);
      const done = task.objectives.filter((o) => completed.has(progressId(task.id, o.id))).length;
      const zone = taskMarkers.get(task.id);
      return <li key={task.id} className={`quest-card${isTaskComplete(task, completed) ? " completed" : ""}`}>
        <div className="quest-li">
          <button className={`quest-item${on ? " active" : ""}`} aria-pressed={on} onClick={() => { onToggle(task.id); if (!on && zone) onFocus(zone); }}>
            <span className="quest-name">{task.name}</span>
            <span className="quest-trader">{task.trader?.name} · {t("quests.level")} {task.minPlayerLevel} · {done}/{task.objectives.length}{task.kappaRequired ? " · Kappa" : ""}</span>
          </button>
          {guides[task.id] && <button className="quest-guide-btn" title={t("guide.open")} aria-label={`${t("guide.open")}: ${task.name}`} onClick={() => onGuide(guides[task.id])}>↗</button>}
        </div>
        {!zone && <small className="quest-no-coordinates">{t("quests.noCoordinates")}</small>}
        {on && <div className="objective-checklist">{task.objectives.map((objective) => <label key={objective.id}>
          <input type="checkbox" checked={completed.has(progressId(task.id, objective.id))} onChange={() => onComplete(progressId(task.id, objective.id))} />
          <span>{objective.description}{objective.optional && <small> · {t("quests.optional")}</small>}</span>
        </label>)}</div>}
      </li>;
    })}</ul>
  </div>;
}
