import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { BoatCardSkeleton, BoatGrid } from "../components/BoatCard";
import { EmptyState, ErrorState, PageHeader, Pagination } from "../components/ui";
import { t } from "../i18n";
import { api } from "../services/api";
import type { BoatCard, Facets, Paged } from "../types";

const TEXT_KEYS = ["q", "manufacturer", "model", "price_min", "price_max", "year_min", "year_max", "length_min", "length_max", "location"] as const;
const MULTI_KEYS = ["category", "seller_type", "condition", "refurb_status"] as const;
const ALL_KEYS = [...TEXT_KEYS, ...MULTI_KEYS, "refurbished_only"] as const;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line py-5">
      <legend className="float-left mb-3 w-full text-[0.8rem] font-semibold uppercase tracking-label text-navy">{title}</legend>
      <div className="clear-both">{children}</div>
    </fieldset>
  );
}

/** Text input that writes to the URL after a short pause (debounced). */
function Debounced({ value, onCommit, ...rest }: { value: string; onCommit: (v: string) => void } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const id = setTimeout(() => onCommit(v), 400);
    return () => clearTimeout(id);
  }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  return <input {...rest} className="input" value={v} onChange={(e) => setV(e.target.value)} />;
}

export function BoatsPage({ refurbishedOnly = false }: { refurbishedOnly?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const params: Record<string, string> = {};
  for (const k of ALL_KEYS) { const v = sp.get(k); if (v) params[k] = v; }
  if (refurbishedOnly) params.refurbished_only = "true";
  const sort = sp.get("sort") || "newest";
  const page = Math.max(1, Number(sp.get("page")) || 1);

  const query = useQuery({
    queryKey: ["boats", params, sort, page],
    queryFn: () => api.get<Paged<BoatCard>>("/api/boats", { ...params, sort, page, page_size: 12 }),
    placeholderData: keepPreviousData,
  });
  const facets = useQuery({ queryKey: ["facets"], queryFn: () => api.get<Facets>("/api/boats/facets"), staleTime: 60_000 });

  const update = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k); }
    if (resetPage) next.delete("page");
    setSp(next, { replace: resetPage });
  };
  const multi = (k: string) => (sp.get(k) || "").split(",").filter(Boolean);
  const toggleMulti = (k: string, v: string) => {
    const cur = multi(k);
    update({ [k]: (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]).join(",") || null });
  };
  const activeCount = ALL_KEYS.filter((k) => sp.get(k) && !(refurbishedOnly && k === "refurbished_only")).length;
  const reset = () => setSp(sort !== "newest" ? { sort } : {}, { replace: true });

  const check = (k: string, v: string, text: string, count?: number) => (
    <label key={v} className="flex min-h-[36px] cursor-pointer items-center gap-3 text-[0.92rem]">
      <input type="checkbox" className="h-4 w-4 rounded-none border-navy/40 accent-navy" checked={multi(k).includes(v)} onChange={() => toggleMulti(k, v)} />
      <span className="flex-1">{text}</span>
      {count !== undefined && <span className="text-xs text-steel-600">{count}</span>}
    </label>
  );
  const range = (title: string, a: string, b: string, phA: string, phB: string, mode: "numeric" | "decimal" = "numeric") => (
    <Group title={title}>
      <div className="grid grid-cols-2 gap-2">
        <Debounced aria-label={`${title} von`} inputMode={mode} placeholder={phA} value={sp.get(a) || ""} onCommit={(v) => update({ [a]: v.replace(",", ".").replace(/[^\d.]/g, "") || null })} />
        <Debounced aria-label={`${title} bis`} inputMode={mode} placeholder={phB} value={sp.get(b) || ""} onCommit={(v) => update({ [b]: v.replace(",", ".").replace(/[^\d.]/g, "") || null })} />
      </div>
    </Group>
  );

  const filters = (
    <form onSubmit={(e) => e.preventDefault()} aria-label="Filter">
      <div className="pb-5">
        <label className="label" htmlFor="f-q">Suchbegriff</label>
        <Debounced id="f-q" type="search" placeholder="Hersteller, Modell, Referenz" value={sp.get("q") || ""} onCommit={(v) => update({ q: v || null })} />
      </div>
      <Group title="Bootstyp">{Object.entries(t.category).map(([k, v]) => check("category", k, v, facets.data?.categories[k as keyof Facets["categories"]]))}</Group>
      <Group title="Hersteller & Modell">
        <select aria-label="Hersteller" className="input" value={sp.get("manufacturer") || ""} onChange={(e) => update({ manufacturer: e.target.value || null })}>
          <option value="">Alle Hersteller</option>
          {facets.data?.manufacturers.map((m) => <option key={m.name} value={m.name}>{m.name} ({m.count})</option>)}
        </select>
        <div className="mt-2"><Debounced aria-label="Modell" placeholder="Modell" value={sp.get("model") || ""} onCommit={(v) => update({ model: v || null })} /></div>
      </Group>
      {range("Preis (€)", "price_min", "price_max", "von", "bis")}
      {range("Baujahr", "year_min", "year_max", "von", "bis")}
      {range("Länge (m)", "length_min", "length_max", "von", "bis", "decimal")}
      <Group title="Standort"><Debounced aria-label="Standort" placeholder="Ort, Region oder PLZ" value={sp.get("location") || ""} onCommit={(v) => update({ location: v || null })} /></Group>
      <Group title="Verkäufer">{Object.entries(t.sellerType).map(([k, v]) => check("seller_type", k, v))}</Group>
      <Group title="Zustand">{Object.entries(t.condition).map(([k, v]) => check("condition", k, v))}</Group>
      <Group title="Refurbishment-Status">
        {Object.entries(t.refurbStatus).filter(([k]) => k !== "none").map(([k, v]) => check("refurb_status", k, v))}
      </Group>
      {activeCount > 0 && <button type="button" onClick={reset} className="btn-secondary w-full">Alle Filter zurücksetzen</button>}
    </form>
  );

  const data = query.data;
  return (
    <>
      <PageHeader
        eyebrow={refurbishedOnly ? "Refurbished" : "Marktplatz"}
        title={refurbishedOnly ? "Aufbereitet. Dokumentiert." : "Boote entdecken"}
        text={refurbishedOnly
          ? "Boote, die aufbereitet oder restauriert wurden oder zu denen ein dokumentierter Zustandsbericht vorliegt. Die Angaben stammen vom Verkäufer, sofern nicht ausdrücklich als unabhängig geprüft gekennzeichnet."
          : "Gebrauchte und aufbereitete Segelboote von privaten Verkäufern, Händlern und Werften."}
      />
      <div className="container-page grid gap-10 py-10 lg:grid-cols-[280px_1fr] lg:gap-14">
        <aside className="hidden lg:block" aria-label="Filter">{filters}</aside>
        <section aria-live="polite" aria-busy={query.isFetching}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-5">
            <p className="text-sm text-steel-600">
              {data ? <><strong className="font-semibold text-navy">{data.total}</strong> {data.total === 1 ? "Boot" : "Boote"} gefunden</> : "Suche läuft …"}
            </p>
            <div className="flex items-center gap-3">
              <button className="btn-secondary btn-sm lg:hidden" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Filter{activeCount ? ` (${activeCount})` : ""}
              </button>
              <label className="flex items-center gap-2 text-sm">
                <span className="hidden text-steel-600 sm:inline">Sortierung</span>
                <select aria-label="Sortierung" className="input !min-h-[36px] w-auto py-1 text-sm" value={sort} onChange={(e) => update({ sort: e.target.value === "newest" ? null : e.target.value })}>
                  {Object.entries(t.sort).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            </div>
          </div>
          {query.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <BoatCardSkeleton key={i} />)}</div>
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : data!.items.length === 0 ? (
            <EmptyState title="Keine Boote gefunden" text="Zu dieser Auswahl gibt es aktuell kein Inserat. Passe die Filter an oder setze sie zurück."
              action={activeCount > 0 ? <button className="btn-primary" onClick={reset}>Filter zurücksetzen</button> : undefined} />
          ) : (
            <div className={query.isPlaceholderData ? "opacity-60 transition-opacity" : ""}>
              <BoatGrid boats={data!.items} />
              <Pagination page={data!.page} pages={data!.pages} onChange={(p) => { update({ page: p > 1 ? String(p) : null }, false); window.scrollTo({ top: 0 }); }} />
            </div>
          )}
        </section>
      </div>
      {filtersOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-sand lg:hidden" role="dialog" aria-modal="true" aria-label="Filter">
          <div className="flex items-center justify-between border-b border-line bg-white px-5 py-4">
            <h2 className="text-lg font-semibold">Filter</h2>
            <button onClick={() => setFiltersOpen(false)} aria-label="Filter schließen" className="p-2"><X className="h-5 w-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-5">{filters}</div>
          <div className="border-t border-line bg-white p-4">
            <button className="btn-primary w-full" onClick={() => setFiltersOpen(false)}>{data ? `${data.total} Boote anzeigen` : "Ergebnisse anzeigen"}</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Boats() { return <BoatsPage />; }
