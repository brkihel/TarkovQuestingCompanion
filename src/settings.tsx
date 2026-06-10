// Provider de configurações do app: idioma + tema, persistidos em localStorage
// e sincronizados entre as duas janelas (main/minimap) via evento `storage`
// (mesma origem). Expõe também o helper de tradução `t` já amarrado ao idioma.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { translate, type Lang } from "./i18n";

export type Theme = "tarkov" | "unheard";
export type IconSize = "s" | "m" | "l";

/** raio do circleMarker dos objetivos por tamanho (s = atual/padrão). */
export const OBJECTIVE_RADIUS: Record<IconSize, number> = { s: 6, m: 8, l: 11 };

export const THEMES: { id: Theme; nameKey: string; descKey: string; swatch: string }[] = [
  { id: "tarkov", nameKey: "theme.tarkov", descKey: "theme.tarkov.desc", swatch: "#c9b471" },
  { id: "unheard", nameKey: "theme.unheard", descKey: "theme.unheard.desc", swatch: "#b98cf0" },
];

const LANG_KEY = "tqc:lang:v1";
const THEME_KEY = "tqc:theme:v1";
const ICON_KEY = "tqc:iconSize:v1";

function loadLang(): Lang {
  const v = localStorage.getItem(LANG_KEY);
  return v === "pt" || v === "en" ? v : "en";
}

function loadTheme(): Theme {
  const v = localStorage.getItem(THEME_KEY);
  return v === "unheard" || v === "tarkov" ? v : "tarkov";
}

function loadIconSize(): IconSize {
  const v = localStorage.getItem(ICON_KEY);
  return v === "m" || v === "l" || v === "s" ? v : "s";
}

/** Aplica o tema/idioma nos atributos do <html> (CSS reage a [data-theme]). */
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}
function applyLang(lang: Lang) {
  document.documentElement.lang = lang;
}

interface SettingsCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  iconSize: IconSize;
  setIconSize: (s: IconSize) => void;
  t: (key: string) => string;
}

const Ctx = createContext<SettingsCtx | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(loadLang);
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [iconSize, setIconSizeState] = useState<IconSize>(loadIconSize);

  // aplica no boot e sempre que mudar
  useEffect(() => applyLang(lang), [lang]);
  useEffect(() => applyTheme(theme), [theme]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(LANG_KEY, l);
    setLangState(l);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  }, []);

  const setIconSize = useCallback((s: IconSize) => {
    localStorage.setItem(ICON_KEY, s);
    setIconSizeState(s);
  }, []);

  // sincroniza com a outra janela (mesma origem): quando o minimap troca o tema,
  // a janela principal recebe o evento `storage` e atualiza, e vice-versa.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LANG_KEY) setLangState(loadLang());
      else if (e.key === THEME_KEY) setThemeState(loadTheme());
      else if (e.key === ICON_KEY) setIconSizeState(loadIconSize());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const t = useCallback((key: string) => translate(lang, key), [lang]);

  const value = useMemo<SettingsCtx>(
    () => ({ lang, setLang, theme, setTheme, iconSize, setIconSize, t }),
    [lang, setLang, theme, setTheme, iconSize, setIconSize, t],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}

/** Atalho para componentes que só precisam traduzir. */
export function useT(): (key: string) => string {
  return useSettings().t;
}
