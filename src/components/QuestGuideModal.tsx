// Modal que renderiza o guia da quest NATIVAMENTE (texto + imagens), sem abrir
// o navegador. O HTML já vem sanitizado e com as imagens em caminhos locais
// (ver scripts/sync-guide-content.mjs). Clicar numa imagem abre o Lightbox.

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { fetchGuideContent, type GuideContent } from "../lib/tarkovApi";
import { useT } from "../settings";
import { Lightbox } from "./QuestImageViewer";

type State = { status: "loading" } | { status: "ready"; data: GuideContent } | { status: "empty" };

export function QuestGuideModal({ seo, onClose }: { seo: string; onClose: () => void }) {
  const t = useT();
  const [state, setState] = useState<State>({ status: "loading" });
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    fetchGuideContent()
      .then((map) => {
        if (!alive) return;
        const data = map[seo];
        setState(data ? { status: "ready", data } : { status: "empty" });
      })
      .catch(() => alive && setState({ status: "empty" }));
    return () => {
      alive = false;
    };
  }, [seo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightbox) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, lightbox]);

  // clique numa imagem do guia -> abre o lightbox com todas as imagens do guia
  const onBodyClick = (e: MouseEvent) => {
    const tgt = e.target as HTMLElement;
    if (tgt.tagName !== "IMG" || !bodyRef.current) return;
    const imgs = [...bodyRef.current.querySelectorAll("img")].map((im) => im.getAttribute("src") || "");
    const index = imgs.indexOf(tgt.getAttribute("src") || "");
    if (index >= 0) setLightbox({ images: imgs, index });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="guide-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{state.status === "ready" ? state.data.name : t("guide.title")}</h2>
          <button className="modal-x" title={t("settings.close")} onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="guide-body" ref={bodyRef} onClick={onBodyClick}>
          {state.status === "loading" && <p className="panel-empty">{t("guide.loading")}</p>}
          {state.status === "empty" && <p className="panel-empty">{t("guide.empty")}</p>}
          {state.status === "ready" && (
            // HTML sanitizado em build time (sync-guide-content.mjs)
            <div className="guide-html" dangerouslySetInnerHTML={{ __html: state.data.html }} />
          )}
        </div>

        <footer className="guide-foot">{t("guide.source")}</footer>
      </div>

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          index={lightbox.index}
          onIndex={(index) => setLightbox((lb) => (lb ? { ...lb, index } : lb))}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
