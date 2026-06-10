// Matemática de coordenadas portada 1:1 do tarkov.dev (src/pages/map/index.jsx,
// the-hideout/tarkov-dev, licença open-source). Replicar exatamente garante que
// a imagem do mapa e os marcadores de quest fiquem alinhados.
//
// Ideia: em vez de transformar cada ponto à mão, montamos um CRS customizado
// (escala + margem via L.Transformation, e rotação embutida na projeção).
// Aí o marcador é só o ponto cru [z, x] e o Leaflet faz o resto.

import L from "leaflet";
import type { TarkovMapConfig } from "./mapsConfig";

/** Rotaciona um latLng em torno da origem (graus). */
function applyRotation(latLng: L.LatLng, rotation: number): L.LatLng {
  if (!latLng.lng && !latLng.lat) {
    return L.latLng(0, 0);
  }
  if (!rotation) {
    return latLng;
  }
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = latLng.lng;
  const y = latLng.lat;
  const rotatedX = x * cos - y * sin;
  const rotatedY = x * sin + y * cos;
  return L.latLng(rotatedY, rotatedX);
}

/** CRS customizado do mapa: escala/margem (transform) + rotação na projeção. */
export function getCRS(config: TarkovMapConfig): L.CRS {
  const scaleX = config.transform[0];
  const scaleY = config.transform[2] * -1;
  const marginX = config.transform[1];
  const marginY = config.transform[3];

  return L.extend({}, L.CRS.Simple, {
    transformation: new L.Transformation(scaleX, marginX, scaleY, marginY),
    projection: L.extend({}, L.Projection.LonLat, {
      project: (latLng: L.LatLng) =>
        L.Projection.LonLat.project(
          applyRotation(latLng, config.coordinateRotation),
        ),
      unproject: (point: L.Point) =>
        applyRotation(
          L.Projection.LonLat.unproject(point),
          config.coordinateRotation * -1,
        ),
    }),
  }) as L.CRS;
}

/** Converte os bounds do JSON ([x, y]) para L.LatLngBounds ([lat=y, lng=x]). */
export function getBounds(
  bounds: [[number, number], [number, number]],
): L.LatLngBounds {
  return L.latLngBounds(
    [bounds[0][1], bounds[0][0]],
    [bounds[1][1], bounds[1][0]],
  );
}

/** Bounds expandidos (para maxBounds), igual ao tarkov.dev. */
export function getScaledBounds(
  bounds: [[number, number], [number, number]],
  scaleFactor: number,
): L.LatLngBoundsExpression {
  const centerX = (bounds[0][0] + bounds[1][0]) / 2;
  const centerY = (bounds[0][1] + bounds[1][1]) / 2;
  const width = bounds[1][0] - bounds[0][0];
  const height = bounds[1][1] - bounds[0][1];
  const newWidth = width * scaleFactor;
  const newHeight = height * scaleFactor;
  return [
    [centerY - newHeight / 2, centerX - newWidth / 2],
    [centerY + newHeight / 2, centerX + newWidth / 2],
  ];
}

/** Posição de jogo (x, z) -> ponto do mapa no CRS customizado: [z, x]. */
export function gamePos(x: number, z: number): L.LatLngExpression {
  return [z, x];
}
