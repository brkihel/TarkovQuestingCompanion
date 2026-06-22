// Ícones de marcador customizados (divIcon do Leaflet).

import L from "leaflet";
import { escapeHtml } from "./layerDefs";

// silhueta simples de pessoa (cabeça + ombros)
const PERSON_PATH =
  "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z";

export type ExtractBadge = "pay" | "flare" | "switch";

export interface ExtractIconOpts {
  /** tipo especial: saída paga (taxi), flare ou switch */
  badge?: ExtractBadge;
  /** ofuscar (extração em outro andar) */
  faded?: boolean;
  /** seta indicando que a extração está acima/abaixo do andar atual */
  arrow?: "up" | "down";
}

// Glifo (emoji) por tipo de saída especial.
const EXTRACT_BADGE_GLYPH: Record<ExtractBadge, string> = {
  pay: "💲",
  flare: "🔥",
  switch: "🔌",
};

/** Ícone de extract: bonequinho colorido pela facção + nome embaixo. */
export function extractIcon(color: string, label: string, opts: ExtractIconOpts = {}): L.DivIcon {
  const svg =
    `<svg viewBox="0 0 24 24" width="22" height="22" class="extract-person">` +
    `<path d="${PERSON_PATH}" fill="${color}" stroke="#0d0c0a" stroke-width="1.3"/></svg>`;
  const badge = opts.badge
    ? `<span class="extract-badge">${EXTRACT_BADGE_GLYPH[opts.badge]}</span>`
    : "";
  const arrow = opts.arrow
    ? `<span class="extract-arrow">${opts.arrow === "up" ? "▲" : "▼"}</span>`
    : "";
  const cls = "extract-icon" + (opts.faded ? " is-faded" : "");
  const html =
    `<div class="${cls}"><div class="extract-person-wrap">${svg}${badge}${arrow}</div>` +
    `<span class="extract-label" style="color:${color}">${escapeHtml(label)}</span></div>`;
  return L.divIcon({
    className: "marker-divicon",
    html,
    iconSize: [110, 40],
    iconAnchor: [55, 11],
  });
}

// Glifos (linha, viewBox 24x24) por grupo de loot. Desenhados simples para
// ficarem legíveis em ~14px. Renderizados com stroke branco sobre o fundo da cor
// do grupo. Os 3 grupos médicos compartilham a cruz (a cor já os diferencia).
const LOOT_GLYPHS: Record<string, string> = {
  // caixa/engradado (cache, wooden-crate)
  "loot-cache": "M4 8h16v12H4z M9 8v12 M15 8v12",
  "loot-woodcrate": "M4 8h16v12H4z M9 8v12 M15 8v12",
  // caixa de munição (caixa + projétil)
  "loot-ammo": "M4 11h16v8H4z M8 11V8h8v3 M12 14v3",
  // granada
  "loot-grenade": "M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M11 9V6h2v3 M13 6h2l1 2",
  // arma (pistola)
  "loot-weapon": "M4 11h12l4-1v3h-5l-1 3h-3l1-3H4z M7 14v3",
  // caixa registradora / cash ($)
  "loot-cash": "M12 5v14 M16 8a4 3 0 0 0-4-2c-2.2 0-3.5 1-3.5 2.3 0 1.4 1.4 2 3.5 2.2 2.1.2 3.5.8 3.5 2.2 0 1.3-1.3 2.3-3.5 2.3a4 3 0 0 1-4-2",
  // cofre (cadeado)
  "loot-safe": "M7 11V9a5 5 0 0 1 10 0v2 M5 11h14v9H5z M12 15v2",
  // corpo (caveira)
  "loot-body": "M6 11a6 6 0 0 1 12 0v3l-2 1v2h-2v-2h-4v2H8v-2l-2-1z M9 11h.5 M14.5 11h.5",
  // jaqueta / casaco
  "loot-jacket": "M9 5l3 2 3-2 3 3-2 2v9H8v-9L6 8z M12 7v11",
  // gaveteiro
  "loot-drawer": "M5 6h14v12H5z M5 12h14 M10 9h4 M10 15h4",
  // bolsa esportiva (duffle)
  "loot-sportsbag": "M6 11h12v8H6z M9 11a3 3 0 0 1 6 0 M6 15h12",
  // engradado técnico (chip)
  "loot-techcrate": "M8 8h8v8H8z M10 5v3 M14 5v3 M10 16v3 M14 16v3 M5 10h3 M5 14h3 M16 10h3 M16 14h3",
  // caixa de ferramentas (chave inglesa)
  "loot-toolbox": "M14.5 7.5a3.2 3.2 0 0 0 4 4l-7 7-4-4 7-7z M6 19l2.5-2.5",
  // bloco de PC (monitor)
  "loot-pcblock": "M4 6h16v10H4z M9 19h6 M12 16v3",
  // crate/case/bag médicos (cruz)
  "loot-medcrate": "M12 6v12 M6 12h12",
  "loot-medcase": "M12 6v12 M6 12h12",
  "loot-medbag": "M12 6v12 M6 12h12",
  // suprimento de ração (lata/conserva)
  "loot-ration": "M8 9h8v10H8z M8 9c0-1.4 8-1.4 8 0 M11 12h2",
  default: "M5 7h14v12H5z M5 12h14",
};

/** Marcador de loot: badge redondo da cor do grupo + glifo do tipo. */
export function lootIcon(color: string, key: string): L.DivIcon {
  const d = LOOT_GLYPHS[key] ?? LOOT_GLYPHS.default;
  const svg =
    `<svg viewBox="0 0 24 24" width="13" height="13">` +
    `<path d="${d}" fill="none" stroke="#fff" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const html = `<div class="loot-icon" style="background:${color}">${svg}</div>`;
  return L.divIcon({
    className: "marker-divicon",
    html,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    tooltipAnchor: [0, -10],
  });
}

/** Alfinete customizado do usuário: pin colorido com um emoji no centro. */
export function customPinIcon(color: string, icon: string): L.DivIcon {
  const html =
    `<div class="custom-pin">` +
    `<svg viewBox="0 0 24 32" width="28" height="37">` +
    `<path d="M12 0C5.4 0 0 5.2 0 11.6 0 20 12 32 12 32s12-12 12-20.4C24 5.2 18.6 0 12 0z" ` +
    `fill="${color}" stroke="#0d0c0a" stroke-width="1.4"/>` +
    `<circle cx="12" cy="11" r="7.5" fill="#0d0c0a" fill-opacity="0.25"/></svg>` +
    `<span class="custom-pin-icon">${icon}</span></div>`;
  return L.divIcon({
    className: "marker-divicon",
    html,
    iconSize: [28, 37],
    iconAnchor: [14, 36],
    popupAnchor: [0, -34],
    tooltipAnchor: [0, -34],
  });
}
