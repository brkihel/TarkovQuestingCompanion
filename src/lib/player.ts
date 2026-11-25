// Posição/direção do jogador (vinda do evento `player-position` do Rust) e o
// ícone de seta que indica para onde o player estava olhando no print.

import L from "leaflet";
import type { TarkovMapConfig } from "../maps/mapsConfig";

export interface PlayerPose {
  x: number;
  y: number;
  z: number;
  /** quaternion [qx, qy, qz, qw] do print, ou null se ausente */
  q: [number, number, number, number] | null;
  /** Timestamp of the confirmed screenshot position, in Unix milliseconds. */
  observedAt?: number;
}

/**
 * Yaw (rotação no plano horizontal, em graus) a partir do quaternion do EFT
 * (Unity, Y para cima). Usa o vetor "forward" = q * (0,0,1) e o ângulo no
 * plano XZ: 0° = +Z, crescendo no sentido horário em direção a +X.
 */
export function yawFromQuat(q: [number, number, number, number]): number {
  const [x, y, , w] = q;
  const fx = 2 * (x * q[2] + w * y);
  const fz = 1 - 2 * (x * x + y * y);
  return (Math.atan2(fx, fz) * 180) / Math.PI;
}

/**
 * Ângulo de exibição na tela = yaw do jogo + rotação do mapa (CRS).
 * Espelha o que o tarkov.dev faz (rotation + coordinateRotation).
 * `extraOffset` permite calibrar caso a seta fique espelhada/invertida.
 */
export function displayAngle(
  pose: PlayerPose,
  coordinateRotation: number,
  extraOffset = 0,
): number | null {
  if (!pose.q) return null;
  return yawFromQuat(pose.q) + coordinateRotation + extraOffset;
}

// Calibração da seta por mapa. Alguns mapas (ex.: Factory) precisam de um ajuste
// fino de ângulo. O valor base vem de `config.headingOffset`; um override por
// mapa pode ser gravado no localStorage (calibração ao vivo no mapa grande), o
// que permite afinar in-game sem rebuild e depois "bakar" o valor no config.
const HEADING_KEY = "tqc:heading:";

export function headingOffsetFor(config: TarkovMapConfig): number {
  try {
    const raw = localStorage.getItem(HEADING_KEY + config.key);
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
  } catch {
    /* ignore */
  }
  return config.headingOffset ?? 0;
}

export function saveHeadingOffset(mapKey: string, deg: number): void {
  try {
    localStorage.setItem(HEADING_KEY + mapKey, String(deg));
  } catch {
    /* ignore */
  }
}

/**
 * Ícone do jogador: seta rotacionada (ou um ponto, se não houver direção).
 * `big` = versão destacada (maior, com pulso) para o mapa grande.
 */
export function playerIcon(angleDeg: number | null, big = false): L.DivIcon {
  const inner =
    angleDeg == null
      ? `<div class="player-dot"></div>`
      : `<div class="player-arrow" style="transform: rotate(${angleDeg}deg)"></div>`;
  const pulse = big ? `<div class="player-pulse"></div>` : "";
  const size = big ? 52 : 28;
  return L.divIcon({
    className: "marker-divicon",
    html: `<div class="player-marker${big ? " big" : ""}">${pulse}${inner}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}
