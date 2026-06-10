import { useState } from "react";
import {
  EXTRACT_FACTIONS,
  SPAWN_KINDS,
  LOOT_GROUPS,
  QUEST_LAYER_ID,
  TRANSIT_LAYER_ID,
} from "../maps/layerDefs";
import { useT } from "../settings";

interface FilterItem {
  id: string;
  label: string;
  color: string;
}

interface FilterPanelProps {
  visible: Set<string>;
  counts: Record<string, number>;
  onSet: (ids: string[], on: boolean) => void;
}

const QUEST_ITEM: FilterItem = { id: QUEST_LAYER_ID, label: "Quests", color: "#c9b471" };
const TRANSIT_ITEM: FilterItem = { id: TRANSIT_LAYER_ID, label: "Transits", color: "#b07fd0" };
const EXTRACT_ITEMS: FilterItem[] = EXTRACT_FACTIONS.map((e) => ({ id: e.id, label: e.label, color: e.color }));
const SPAWN_ITEMS: FilterItem[] = SPAWN_KINDS.map((s) => ({ id: s.id, label: s.label, color: s.color }));
const LOOT_ITEMS: FilterItem[] = LOOT_GROUPS.map((l) => ({ id: l.id, label: l.label, color: l.color }));

export function FilterPanel({ visible, counts, onSet }: FilterPanelProps) {
  const t = useT();
  return (
    <div className="filters">
      <Section title={t("filter.quests")} items={[QUEST_ITEM]} visible={visible} counts={counts} onSet={onSet} />
      <Section title={t("filter.extracts")} items={EXTRACT_ITEMS} visible={visible} counts={counts} onSet={onSet} />
      <Section title={t("filter.transits")} items={[TRANSIT_ITEM]} visible={visible} counts={counts} onSet={onSet} />
      <Section title={t("filter.spawns")} items={SPAWN_ITEMS} visible={visible} counts={counts} onSet={onSet} />
      <Section title={t("filter.loot")} items={LOOT_ITEMS} visible={visible} counts={counts} onSet={onSet} collapsed />
    </div>
  );
}

interface SectionProps {
  title: string;
  items: FilterItem[];
  visible: Set<string>;
  counts: Record<string, number>;
  onSet: (ids: string[], on: boolean) => void;
  collapsed?: boolean;
}

function Section({ title, items, visible, counts, onSet, collapsed = false }: SectionProps) {
  const t = useT();
  const [open, setOpen] = useState(!collapsed);
  const ids = items.map((i) => i.id);
  const onCount = ids.filter((id) => visible.has(id)).length;
  const allOn = onCount === ids.length;
  const single = items.length === 1;

  return (
    <div className="filter-section">
      <div className="filter-head">
        <button
          className="filter-caret"
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? t("filter.collapse") : t("filter.expand")}
        >
          {single ? "" : open ? "▾" : "▸"}
        </button>
        <label className="filter-master">
          <input
            type="checkbox"
            checked={onCount > 0}
            ref={(el) => {
              if (el) el.indeterminate = onCount > 0 && !allOn;
            }}
            onChange={() => onSet(ids, !(onCount > 0))}
          />
          <span className="filter-title">{title}</span>
        </label>
      </div>

      {open && !single && (
        <ul className="filter-items">
          {items.map((it) => {
            const n = counts[it.id] ?? 0;
            return (
              <li key={it.id}>
                <label className={"filter-item" + (n === 0 ? " is-empty" : "")}>
                  <input
                    type="checkbox"
                    checked={visible.has(it.id)}
                    disabled={n === 0}
                    onChange={() => onSet([it.id], !visible.has(it.id))}
                  />
                  <span className="swatch" style={{ background: it.color }} />
                  <span className="filter-label">{it.label}</span>
                  <span className="filter-count">{n}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
