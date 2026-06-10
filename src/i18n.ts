// Sistema de tradução (i18n) leve, sem dependências.
//
// `en` é o idioma padrão/fallback. Cada idioma é um mapa plano de chave -> texto.
// A escolha do usuário é persistida e exposta via o provider em `settings.tsx`.
// NOTA: por enquanto isto cobre o "chrome" do app (botões, labels, tooltips).
// Nomes/descrições de quests virão dos dados sincronizados (ver Fase de dados).

export type Lang = "en" | "pt";

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
];

type Dict = Record<string, string>;

const en: Dict = {
  "brand.companion": "Companion",

  "nav.map": "Map",

  "autoMap.title": "Automatically switch maps when entering a raid (reads EFT logs)",
  "autoMap.label": "Auto-switch map (detect in-game)",

  "minimap.toggleTitle": "Toggle minimap overlay",
  "minimap.overlayBtn": "Minimap overlay",
  "minimap.hide": "Hide (Shift+N)",
  "minimap.clickThroughOn": "Click-through ON (F9)",
  "minimap.clickThroughOff": "Click-through OFF (F9)",

  "hotkeys.mapFront": "map in front of game",
  "hotkeys.minimap": "minimap",
  "hotkeys.clickThrough": "click-through",

  "state.loading": "Loading local data…",
  "state.error": "Error",

  "quests.title": "Quests",
  "quests.clear": "clear",
  "quests.empty": "No geolocated quests on this map.",
  "quests.mainStoryline": "Main Storyline",
  "quests.sideQuests": "Side Quests",
  "tab.map": "Map",
  "tab.storyline": "Storyline",
  "storyline.intro": "Story progression quests, in order. They have no map markers — open a quest to read its guide.",
  "quests.viewGuide": "Open guide on tarkov.help",
  "quests.level": "Lvl",
  "image.open": "Click to enlarge",
  "image.close": "Close",
  "image.prev": "Previous",
  "image.next": "Next",
  "guide.open": "Open guide",
  "guide.title": "Quest guide",
  "guide.loading": "Loading guide…",
  "guide.empty": "No guide available for this quest yet.",
  "guide.source": "Guide content from tarkov.help",

  "footer.offline": "Offline · data synced from tarkov.dev",

  "filter.quests": "Quests",
  "filter.extracts": "Extracts",
  "filter.transits": "Transits",
  "filter.spawns": "Spawns",
  "filter.loot": "Loot",
  "filter.collapse": "collapse",
  "filter.expand": "expand",

  "settings.title": "Settings",
  "settings.open": "Settings",
  "settings.close": "Close",
  "settings.tab.general": "General",
  "settings.tab.themes": "Themes",
  "settings.language": "Language",
  "settings.language.hint": "App language. Quest names follow the synced data.",
  "settings.iconSize": "Objective marker size",
  "settings.iconSize.hint": "Size of the quest objective markers on the map.",
  "size.s": "Small",
  "size.m": "Medium",
  "size.l": "Large",
  "settings.screenshots": "Screenshots folder",
  "settings.screenshots.hint":
    "Where Tarkov saves screenshots, used to track your position. Leave empty for the default.",
  "settings.screenshots.browse": "Browse…",
  "settings.screenshots.reset": "Use default",
  "settings.screenshots.default": "Default (Documents\\Escape from Tarkov\\Screenshots)",

  "theme.tarkov": "Tarkov",
  "theme.tarkov.desc": "The classic olive/khaki look.",
  "theme.unheard": "Unheard Edition",
  "theme.unheard.desc": "Violet palette inspired by the Unheard Edition.",
};

const pt: Dict = {
  "brand.companion": "Companion",

  "nav.map": "Mapa",

  "autoMap.title": "Troca o mapa automaticamente ao entrar numa raid (lê os logs do EFT)",
  "autoMap.label": "Auto-trocar mapa (detectar in-game)",

  "minimap.toggleTitle": "Liga/desliga o minimap overlay",
  "minimap.overlayBtn": "Minimap overlay",
  "minimap.hide": "Esconder (Shift+N)",
  "minimap.clickThroughOn": "Click-through LIGADO (F9)",
  "minimap.clickThroughOff": "Click-through DESLIGADO (F9)",

  "hotkeys.mapFront": "mapa na frente do jogo",
  "hotkeys.minimap": "minimap",
  "hotkeys.clickThrough": "click-through",

  "state.loading": "Carregando dados locais…",
  "state.error": "Erro",

  "quests.title": "Quests",
  "quests.clear": "limpar",
  "quests.empty": "Nenhuma quest georreferenciada neste mapa.",
  "quests.mainStoryline": "História Principal",
  "quests.sideQuests": "Quests Secundárias",
  "tab.map": "Mapa",
  "tab.storyline": "Storyline",
  "storyline.intro": "Quests de progressão da história, em ordem. Não têm marcador no mapa — abra uma quest para ler o guia.",
  "quests.viewGuide": "Abrir guia no tarkov.help",
  "quests.level": "Nv",
  "image.open": "Clique para ampliar",
  "image.close": "Fechar",
  "image.prev": "Anterior",
  "image.next": "Próxima",
  "guide.open": "Abrir guia",
  "guide.title": "Guia da quest",
  "guide.loading": "Carregando guia…",
  "guide.empty": "Ainda não há guia para esta quest.",
  "guide.source": "Conteúdo do guia: tarkov.help",

  "footer.offline": "Offline · dados sincronizados da tarkov.dev",

  "filter.quests": "Quests",
  "filter.extracts": "Extrações",
  "filter.transits": "Trânsitos",
  "filter.spawns": "Spawns",
  "filter.loot": "Loot",
  "filter.collapse": "recolher",
  "filter.expand": "expandir",

  "settings.title": "Configurações",
  "settings.open": "Configurações",
  "settings.close": "Fechar",
  "settings.tab.general": "Geral",
  "settings.tab.themes": "Temas",
  "settings.language": "Idioma",
  "settings.language.hint": "Idioma do app. Nomes de quests seguem os dados sincronizados.",
  "settings.iconSize": "Tamanho dos marcadores",
  "settings.iconSize.hint": "Tamanho dos marcadores de objetivo das quests no mapa.",
  "size.s": "Pequeno",
  "size.m": "Médio",
  "size.l": "Grande",
  "settings.screenshots": "Pasta de screenshots",
  "settings.screenshots.hint":
    "Onde o Tarkov salva os prints, usados para rastrear sua posição. Deixe vazio para o padrão.",
  "settings.screenshots.browse": "Procurar…",
  "settings.screenshots.reset": "Usar padrão",
  "settings.screenshots.default": "Padrão (Documentos\\Escape from Tarkov\\Screenshots)",

  "theme.tarkov": "Tarkov",
  "theme.tarkov.desc": "O visual clássico oliva/cáqui.",
  "theme.unheard": "Unheard Edition",
  "theme.unheard.desc": "Paleta violeta inspirada na Unheard Edition.",
};

const DICTS: Record<Lang, Dict> = { en, pt };

/** Traduz `key` no idioma dado, com fallback para inglês e depois a própria key. */
export function translate(lang: Lang, key: string): string {
  return DICTS[lang][key] ?? DICTS.en[key] ?? key;
}
