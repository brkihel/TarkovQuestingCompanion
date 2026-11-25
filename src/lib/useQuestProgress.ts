import { useEffect, useState } from "react";
import { GAME_MODES, type GameMode } from "./tarkovApi";

const key = (mode: GameMode) => `tqc:progress:v1:${mode}`;
function load(mode: GameMode): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(key(mode)) ?? "[]")); }
  catch { return new Set(); }
}

export function useQuestProgress(mode: GameMode) {
  const [profiles, setProfiles] = useState(() => Object.fromEntries(GAME_MODES.map((m) => [m, load(m)])));
  useEffect(() => {
    const listener = (event: StorageEvent) => {
      for (const m of GAME_MODES) if (event.key === key(m)) setProfiles((p) => ({ ...p, [m]: load(m) }));
    };
    window.addEventListener("storage", listener);
    return () => window.removeEventListener("storage", listener);
  }, []);
  const toggle = (id: string) => {
    const next = new Set(profiles[mode]);
    if (next.has(id)) next.delete(id); else next.add(id);
    localStorage.setItem(key(mode), JSON.stringify([...next]));
    setProfiles((previous) => ({ ...previous, [mode]: next }));
  };
  return { completed: profiles[mode], toggle };
}
