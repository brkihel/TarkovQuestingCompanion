// Editor de marca customizada: um popup do Leaflet (HTML nativo) com paleta de
// cores, seletor de ícone e campo de nota. Fica no "mundo" do Leaflet para não
// conflitar com o sistema de tooltip React do TarkovMap.

import L from "leaflet";
import { PIN_COLORS, PIN_ICONS } from "../lib/customMarkers";

export interface EditorResult {
  color: string;
  icon: string;
  note: string;
}

export interface EditorLabels {
  title: string;
  add: string;
  notePlaceholder: string;
}

/** Abre um popup-editor em `latlng`; chama `onSave` ao confirmar. */
export function openMarkerEditor(
  map: L.Map,
  latlng: L.LatLng,
  labels: EditorLabels,
  onSave: (r: EditorResult) => void,
): void {
  let color = PIN_COLORS[0];
  let icon = PIN_ICONS[0];

  const root = L.DomUtil.create("div", "cm-editor");

  const title = L.DomUtil.create("div", "cm-title", root);
  title.textContent = labels.title;

  // cores
  const colors = L.DomUtil.create("div", "cm-row cm-colors", root);
  PIN_COLORS.forEach((c, i) => {
    const b = L.DomUtil.create("button", "cm-swatch" + (i === 0 ? " sel" : ""), colors);
    b.type = "button";
    b.style.background = c;
    b.onclick = () => {
      color = c;
      colors.querySelectorAll(".cm-swatch").forEach((e) => e.classList.remove("sel"));
      b.classList.add("sel");
    };
  });

  // ícones
  const icons = L.DomUtil.create("div", "cm-row cm-icons", root);
  PIN_ICONS.forEach((ic, i) => {
    const b = L.DomUtil.create("button", "cm-ico" + (i === 0 ? " sel" : ""), icons);
    b.type = "button";
    b.textContent = ic;
    b.onclick = () => {
      icon = ic;
      icons.querySelectorAll(".cm-ico").forEach((e) => e.classList.remove("sel"));
      b.classList.add("sel");
    };
  });

  // nota
  const input = L.DomUtil.create("input", "cm-note", root) as HTMLInputElement;
  input.type = "text";
  input.placeholder = labels.notePlaceholder;
  input.maxLength = 60;

  // confirmar
  const add = L.DomUtil.create("button", "cm-add", root);
  add.type = "button";
  add.textContent = labels.add;

  const popup = L.popup({ className: "cm-popup", minWidth: 176, closeButton: true })
    .setLatLng(latlng)
    .setContent(root);

  const submit = () => {
    onSave({ color, icon, note: input.value.trim() });
    map.closePopup(popup);
  };
  add.onclick = submit;
  input.onkeydown = (e) => {
    if (e.key === "Enter") submit();
  };

  // os cliques no editor não devem virar pan/zoom/criação no mapa
  L.DomEvent.disableClickPropagation(root);
  L.DomEvent.disableScrollPropagation(root);

  map.openPopup(popup);
  setTimeout(() => input.focus(), 0);
}
