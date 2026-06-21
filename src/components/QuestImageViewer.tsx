// Tooltip unificado do objetivo (hover no marcador): nome/trader/descrição +
// carrossel de imagens de localização + botão "Abrir guia" (modal nativo).
// Clicar numa imagem abre o Lightbox.

import { useEffect, useState } from "react";
import { useT } from "../settings";

export interface CarouselPoint {
  x: number;
  y: number;
}

export interface ObjectiveInfo {
  title: string;
  subtitle?: string;
  body?: string;
  /** posição do objetivo na quest (1-based) e total — exibido como "Objetivo i/N" */
  index?: number;
  count?: number;
}

interface TooltipProps {
  info?: ObjectiveInfo;
  images: string[];
  point: CarouselPoint;
  hasGuide: boolean;
  onOpen: (index: number) => void;
  onOpenGuide: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/** Painel flutuante acima do marcador. */
export function ObjectiveTooltip({
  info,
  images,
  point,
  hasGuide,
  onOpen,
  onOpenGuide,
  onMouseEnter,
  onMouseLeave,
}: TooltipProps) {
  const t = useT();
  const [i, setI] = useState(0);
  const idx = Math.min(i, Math.max(0, images.length - 1));
  const many = images.length > 1;

  return (
    <div
      className="obj-tip"
      style={{ left: point.x, top: point.y }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {info && (
        <div className="obj-text">
          <strong className="obj-title">{info.title}</strong>
          {info.subtitle && <span className="obj-sub">{info.subtitle}</span>}
          {info.count != null && info.count > 1 && (
            <span className="obj-objnum">
              {t("objective.badge")} {info.index}/{info.count}
            </span>
          )}
          {info.body && <p className="obj-body">{info.body}</p>}
        </div>
      )}

      {images.length > 0 && (
        <div className="obj-carousel">
          <button type="button" className="obj-thumb" title={t("image.open")} onClick={() => onOpen(idx)}>
            <img src={images[idx]} alt="" loading="lazy" draggable={false} />
            {many && <span className="obj-count">{idx + 1}/{images.length}</span>}
          </button>
          {many && (
            <>
              <button
                type="button"
                className="obj-arrow obj-prev"
                aria-label={t("image.prev")}
                onClick={() => setI((p) => (p - 1 + images.length) % images.length)}
              >
                ‹
              </button>
              <button
                type="button"
                className="obj-arrow obj-next"
                aria-label={t("image.next")}
                onClick={() => setI((p) => (p + 1) % images.length)}
              >
                ›
              </button>
            </>
          )}
        </div>
      )}

      {hasGuide && (
        <button type="button" className="obj-guide-btn" onClick={onOpenGuide}>
          {t("guide.open")}
        </button>
      )}
    </div>
  );
}

interface LightboxProps {
  images: string[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}

/** Viewer maior (médio) da imagem clicada, com navegação e teclado. */
export function Lightbox({ images, index, onIndex, onClose }: LightboxProps) {
  const t = useT();
  const many = images.length > 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowLeft") onIndex((index - 1 + images.length) % images.length);
      else if (many && e.key === "ArrowRight") onIndex((index + 1) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, images.length, many, onClose, onIndex]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox" onClick={(e) => e.stopPropagation()}>
        <img src={images[index]} alt="" draggable={false} />
        <button className="lightbox-x" title={t("image.close")} onClick={onClose}>
          ✕
        </button>
        {many && (
          <>
            <button
              className="lightbox-arrow lightbox-prev"
              aria-label={t("image.prev")}
              onClick={() => onIndex((index - 1 + images.length) % images.length)}
            >
              ‹
            </button>
            <button
              className="lightbox-arrow lightbox-next"
              aria-label={t("image.next")}
              onClick={() => onIndex((index + 1) % images.length)}
            >
              ›
            </button>
            <span className="lightbox-count">{index + 1}/{images.length}</span>
          </>
        )}
      </div>
    </div>
  );
}
