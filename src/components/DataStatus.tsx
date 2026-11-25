import { useEffect, useState } from "react";
import type { PlayerPose } from "../lib/player";
import type { QuestMarker, Task } from "../lib/tarkovApi";
import { useSettings } from "../settings";

interface Metadata { syncedAt: string; sources?: { url: string; lastModified: string | null }[] }

export function DataStatus({ tasks, markers, guides, player }: {
  tasks: Task[]; markers: QuestMarker[]; guides: Record<string, string>; player: PlayerPose | null;
}) {
  const { t, lang, gameMode } = useSettings();
  const [meta, setMeta] = useState<Metadata | null>(null);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let alive = true;
    fetch("/data/meta.json").then((r) => r.json()).then((value) => { if (alive) setMeta(value); }).catch(() => {});
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const date = (value: string) => new Date(value).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US");
  const source = meta?.sources?.find((s) => s.url.endsWith(`/${gameMode}/tasks`));
  const age = player?.observedAt ? Math.max(0, Math.floor((now - player.observedAt) / 1000)) : null;
  return <div className="data-status">
    <span>{t("footer.offline")}{meta && ` · ${t("data.updated")}: ${date(meta.syncedAt)}`}</span>
    <details><summary>{t("data.source")}</summary>
      <div>tarkov.dev JSON{source?.lastModified && ` · ${date(source.lastModified)}`}</div>
      <div>{new Set(markers.map((m) => m.taskId)).size} {t("data.coverage")}</div>
      <div>{tasks.filter((task) => guides[task.id]).length}/{tasks.length} {t("data.guides")}</div>
      <div>tarkov.help · EN</div>
    </details>
    <span className={age != null && age > 30 ? "stale" : ""}>
      {age == null ? t("data.noPosition") : `${t("data.position")}: ${age} ${t("data.age")}`}
    </span>
  </div>;
}
