import { ChevronLeft, ChevronRight, Expand, ImageOff, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { BoatImage } from "../types";

export function Gallery({ images, title }: { images: BoatImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [full, setFull] = useState(false);
  const count = images.length;
  const go = useCallback((d: number) => setIndex((i) => (i + d + count) % count), [count]);

  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFull(false);
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [full, go]);

  if (count === 0)
    return <div className="flex aspect-[3/2] items-center justify-center bg-line text-steel"><ImageOff className="h-8 w-8" aria-hidden="true" /><span className="sr-only">Keine Fotos vorhanden</span></div>;

  const arrow = "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center bg-white/95 text-navy hover:bg-white";
  return (
    <div>
      <div className="relative bg-navy">
        <button type="button" onClick={() => setFull(true)} className="block w-full" aria-label="Foto im Vollbild öffnen">
          <img src={images[index].url} alt={`${title} – Foto ${index + 1} von ${count}`} className="aspect-[3/2] w-full object-cover" />
        </button>
        {count > 1 && (<>
          <button type="button" className={`${arrow} left-3`} onClick={() => go(-1)} aria-label="Vorheriges Foto"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" className={`${arrow} right-3`} onClick={() => go(1)} aria-label="Nächstes Foto"><ChevronRight className="h-5 w-5" /></button>
        </>)}
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 bg-navy/85 px-3 py-1.5 text-xs font-semibold text-white">
          <Expand className="h-3.5 w-3.5" aria-hidden="true" />{index + 1} / {count}
        </div>
      </div>
      {count > 1 && (
        <ul className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6" aria-label="Weitere Fotos">
          {images.map((img, i) => (
            <li key={img.id}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Foto ${i + 1} anzeigen`} aria-current={i === index}
                className={`block w-full border-2 ${i === index ? "border-navy" : "border-transparent opacity-80 hover:opacity-100"}`}>
                <img src={img.thumb_url} alt="" loading="lazy" className="aspect-[3/2] w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full && (
        <div className="on-dark fixed inset-0 z-50 flex flex-col bg-[#0A1722]" role="dialog" aria-modal="true" aria-label={`Fotos: ${title}`}>
          <div className="flex items-center justify-between px-5 py-3 text-white">
            <p className="text-sm">{title} · {index + 1} / {count}</p>
            <button autoFocus onClick={() => setFull(false)} aria-label="Vollbild schließen" className="flex h-11 w-11 items-center justify-center"><X className="h-6 w-6" /></button>
          </div>
          <div className="relative flex flex-1 items-center justify-center overflow-hidden px-2 pb-6">
            <img src={images[index].url} alt={`${title} – Foto ${index + 1}`} className="max-h-full max-w-full object-contain" />
            {count > 1 && (<>
              <button className={`${arrow} left-3`} onClick={() => go(-1)} aria-label="Vorheriges Foto"><ChevronLeft className="h-5 w-5" /></button>
              <button className={`${arrow} right-3`} onClick={() => go(1)} aria-label="Nächstes Foto"><ChevronRight className="h-5 w-5" /></button>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
