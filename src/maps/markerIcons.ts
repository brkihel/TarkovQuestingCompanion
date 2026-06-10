// Ícones de marcador customizados (divIcon do Leaflet).

import L from "leaflet";
import { escapeHtml } from "./layerDefs";

// silhueta simples de pessoa (cabeça + ombros)
const PERSON_PATH =
  "M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z";

/** Ícone de extract: bonequinho colorido pela facção + nome embaixo. */
export function extractIcon(color: string, label: string): L.DivIcon {
  const svg =
    `<svg viewBox="0 0 24 24" width="22" height="22" class="extract-person">` +
    `<path d="${PERSON_PATH}" fill="${color}" stroke="#0d0c0a" stroke-width="1.3"/></svg>`;
  const html =
    `<div class="extract-icon">${svg}` +
    `<span class="extract-label" style="color:${color}">${escapeHtml(label)}</span></div>`;
  return L.divIcon({
    className: "marker-divicon",
    html,
    iconSize: [110, 40],
    iconAnchor: [55, 11],
  });
}
