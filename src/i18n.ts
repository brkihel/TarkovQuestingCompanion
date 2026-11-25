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
  "quests.completed": "Completed",
  "extract.payment": "Payment",
  "extract.item": "Required item",
  "extract.flare": "Requires a signal flare",
  "extract.switch": "Requires switch activation",
  "extract.coop": "Requires PMC + Scav cooperation",
  "extract.pmc": "PMC extraction",
  "extract.scav": "Scav extraction",
  "extract.shared": "Shared extraction",
  "extract.check": "Check availability and requirements in raid.",

  "quests.search": "Search tasks or objectives…",
  "quests.trader": "Trader",
  "quests.allTraders": "All traders",
  "quests.maxLevel": "Maximum player level",
  "quests.hideDone": "Hide completed",
  "quests.allMaps": "All maps",
  "quests.emptyFilter": "No tasks match these filters.",
  "quests.noCoordinates": "No map coordinates available.",
  "quests.optional": "Optional",
  "plan.title": "Raid plan",
  "plan.stops": "stops",
  "plan.note": "Suggested visit order by proximity and floor. Check passages on the map; this is not a navigable route. Alternative item spawns show one suggested location.",
  "plan.bring": "Keys and supplies to bring",
  "plan.noItems": "No single required supply or key listed for these tasks. Check objective descriptions for equipment and alternatives.",
  "data.updated": "Data updated",
  "data.coverage": "tasks with coordinates on this map",
  "data.guides": "tasks with guide links",
  "data.position": "Last confirmed position",
  "data.noPosition": "Position not yet confirmed",
  "data.age": "seconds ago",
  "data.source": "Source data",
  "data.stale": "Position needs an update",

  "brand.companion": "Companion",

  "nav.map": "Map",
  "nav.mode": "Game mode",
  "mode.regular": "PvP · Persistent",
  "mode.pve": "PvE",
  "mode.pvp-season": "PvP · Season",

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
  "hotkeys.customMarker": "right-click map: add/remove a marker",

  "marker.editorTitle": "New marker",
  "marker.add": "Add",
  "marker.notePlaceholder": "Note (optional)",

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
  "objective.badge": "Objective",
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
  "quests.completed": "Concluída",
  "extract.payment": "Pagamento",
  "extract.item": "Item exigido",
  "extract.flare": "Exige sinalizador",
  "extract.switch": "Exige ativação de interruptor",
  "extract.coop": "Exige cooperação PMC + Scav",
  "extract.pmc": "Extração PMC",
  "extract.scav": "Extração Scav",
  "extract.shared": "Extração compartilhada",
  "extract.check": "Confira disponibilidade e requisitos na raid.",

  "quests.search": "Buscar tarefas ou objetivos…",
  "quests.trader": "Trader",
  "quests.allTraders": "Todos os traders",
  "quests.maxLevel": "Nível máximo do jogador",
  "quests.hideDone": "Ocultar concluídas",
  "quests.allMaps": "Todos os mapas",
  "quests.emptyFilter": "Nenhuma tarefa corresponde aos filtros.",
  "quests.noCoordinates": "Coordenadas indisponíveis neste mapa.",
  "quests.optional": "Opcional",
  "plan.title": "Plano da raid",
  "plan.stops": "paradas",
  "plan.note": "Ordem sugerida por proximidade e andar. Confira as passagens no mapa; isto não é uma rota navegável. Itens com vários spawns mostram um local sugerido.",
  "plan.bring": "Chaves e suprimentos para levar",
  "plan.noItems": "Nenhuma chave ou suprimento único listado. Confira equipamentos e alternativas na descrição dos objetivos.",
  "data.updated": "Dados atualizados",
  "data.coverage": "tarefas com coordenadas neste mapa",
  "data.guides": "tarefas com links de guia",
  "data.position": "Última posição confirmada",
  "data.noPosition": "Posição ainda não confirmada",
  "data.age": "segundos atrás",
  "data.source": "Dados da fonte",
  "data.stale": "Atualize a posição",

  "brand.companion": "Companion",

  "nav.map": "Mapa",
  "nav.mode": "Modo de jogo",
  "mode.regular": "PvP · Persistente",
  "mode.pve": "PvE",
  "mode.pvp-season": "PvP · Temporada",

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
  "hotkeys.customMarker": "clique direito no mapa: adicionar/remover marca",

  "marker.editorTitle": "Nova marca",
  "marker.add": "Adicionar",
  "marker.notePlaceholder": "Nota (opcional)",

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
  "objective.badge": "Objetivo",
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
