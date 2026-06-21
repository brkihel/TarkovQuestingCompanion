// Seletor de andar (nível) do mapa. Aparece só em mapas com mais de um andar.
// Botões verticais, do andar mais alto para o mais baixo.

import type { FloorDef } from "../maps/floors";

interface Props {
  floors: FloorDef[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function FloorSwitcher({ floors, activeId, onSelect }: Props) {
  return (
    <div className="floor-switcher" role="group" aria-label="Map floor">
      {floors.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`floor-btn${f.id === activeId ? " active" : ""}`}
          aria-pressed={f.id === activeId}
          onClick={() => onSelect(f.id)}
        >
          {f.name}
        </button>
      ))}
    </div>
  );
}
