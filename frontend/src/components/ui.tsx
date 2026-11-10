import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { t } from "../i18n";
import { errorMessage } from "../services/api";

export function Spinner({ className = "" }: { className?: string }) {
  return <Loader2 className={`h-5 w-5 animate-spin ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = t.common.loading }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-3 py-20 text-steel-600">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-lg border border-line bg-white px-8 py-10 text-center">
      <AlertCircle className="mx-auto h-6 w-6 text-danger" aria-hidden="true" />
      <h2 className="mt-3 text-lg font-semibold">{t.common.errorTitle}</h2>
      <p className="mt-2 text-sm text-steel-600">{errorMessage(error)}</p>
      {onRetry && <button className="btn-secondary mt-6" onClick={onRetry}>{t.common.retry}</button>}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="border border-dashed border-navy/20 bg-white/60 px-8 py-14 text-center">
      <h2 className="font-serif text-2xl text-navy">{title}</h2>
      {text && <p className="mx-auto mt-3 max-w-md text-sm text-steel-600">{text}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const style = { error: "border-danger/40 bg-[#FBF3F1] text-danger", success: "border-ok/40 bg-[#F1F7F3] text-ok",
    info: "border-navy/20 bg-white text-ink" }[kind];
  return <div role={kind === "error" ? "alert" : "status"} className={`border-l-2 px-4 py-3 text-sm ${style}`}>{children}</div>;
}

export function Field({ label, hint, error, children, required }:
  { label: string; hint?: string; error?: string; required?: boolean; children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode }) {
  const id = useId();
  const describedBy = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div>
      <label htmlFor={id} className="label">{label}{required && <span className="text-brass-700" aria-hidden="true"> *</span>}</label>
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {error ? <p id={`${id}-e`} className="mt-1.5 text-[0.8rem] text-danger">{error}</p>
        : hint ? <p id={`${id}-h`} className="mt-1.5 text-[0.8rem] text-steel-600">{hint}</p> : null}
    </div>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("textarea, input, select, button:not([data-close])")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/60 sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title}
        className={`max-h-[92vh] w-full overflow-y-auto bg-white ${wide ? "sm:max-w-2xl" : "sm:max-w-lg"}`}>
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button data-close onClick={onClose} aria-label={t.nav.close} className="-mr-2 p-2 text-steel-600 hover:text-navy"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  const nums: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const btn = "flex h-11 min-w-[44px] items-center justify-center border px-3 text-sm font-semibold";
  return (
    <nav aria-label="Seitennavigation" className="mt-12 flex flex-wrap items-center justify-center gap-2">
      <button className={`${btn} border-line bg-white disabled:opacity-40`} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Vorherige Seite"><ChevronLeft className="h-4 w-4" /></button>
      {nums.map((n, i) => n === "…" ? <span key={`e${i}`} className="px-1 text-steel">…</span> : (
        <button key={n} aria-current={n === page ? "page" : undefined} onClick={() => onChange(n)}
          className={`${btn} ${n === page ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-navy"}`}>{n}</button>
      ))}
      <button className={`${btn} border-line bg-white disabled:opacity-40`} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Nächste Seite"><ChevronRight className="h-4 w-4" /></button>
    </nav>
  );
}

export function PageHeader({ eyebrow, title, text, children }: { eyebrow?: string; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="container-page flex flex-col gap-6 py-10 md:flex-row md:items-end md:justify-between md:py-14">
        <div className="max-w-2xl">
          {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
          <h1 className="display text-4xl md:text-5xl">{title}</h1>
          {text && <p className="mt-4 text-steel-600">{text}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Avatar({ src, name, size = 48, square }: { src: string | null; name: string; size?: number; square?: boolean }) {
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const cls = `shrink-0 overflow-hidden border border-line bg-navy text-white flex items-center justify-center font-semibold ${square ? "" : "rounded-full"}`;
  return src ? <img src={src} alt="" width={size} height={size} className={`${cls} object-cover`} style={{ width: size, height: size }} />
    : <span aria-hidden="true" className={cls} style={{ width: size, height: size, fontSize: size * 0.36 }}>{initials}</span>;
}
