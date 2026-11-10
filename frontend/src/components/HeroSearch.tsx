import { Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { t } from "../i18n";
import { qs } from "../services/api";
import type { Category } from "../types";

/** Search panel on the homepage. Submits to /boote with URL query parameters. */
export function HeroSearch() {
  const navigate = useNavigate();
  const [f, setF] = useState({ q: "", category: "", price_min: "", price_max: "", location: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => { e.preventDefault(); navigate(`/boote${qs(f)}`); };
  const cell = "flex flex-col justify-center px-5 py-3.5 border-b border-line lg:border-b-0 lg:border-r";
  const lab = "text-[0.68rem] font-semibold uppercase tracking-label text-steel-600";
  const inp = "mt-0.5 w-full border-0 bg-transparent p-0 text-[0.95rem] text-ink placeholder:text-steel focus:outline-none focus:ring-0";
  return (
    <form onSubmit={submit} role="search" aria-label="Boote suchen"
      className="grid bg-white shadow-[0_24px_60px_-30px_rgba(16,36,53,0.45)] lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr_auto]">
      <label className={cell}><span className={lab}>Suchbegriff</span>
        <input className={inp} value={f.q} onChange={set("q")} placeholder="Hersteller, Modell, Referenz" /></label>
      <label className={cell}><span className={lab}>Bootstyp</span>
        <select className={`${inp} cursor-pointer`} value={f.category} onChange={set("category")}>
          <option value="">Alle Bootstypen</option>
          {(Object.keys(t.category) as Category[]).map((c) => <option key={c} value={c}>{t.category[c]}</option>)}
        </select></label>
      <label className={cell}><span className={lab}>Preis von</span>
        <input className={inp} inputMode="numeric" value={f.price_min} onChange={(e) => setF({ ...f, price_min: e.target.value.replace(/\D/g, "") })} placeholder="€ min." /></label>
      <label className={cell}><span className={lab}>Preis bis</span>
        <input className={inp} inputMode="numeric" value={f.price_max} onChange={(e) => setF({ ...f, price_max: e.target.value.replace(/\D/g, "") })} placeholder="€ max." /></label>
      <label className={cell}><span className={lab}>Standort</span>
        <input className={inp} value={f.location} onChange={set("location")} placeholder="Ort oder Region" /></label>
      <button type="submit" className="flex min-h-[60px] items-center justify-center gap-2 bg-navy px-8 text-sm font-semibold text-white transition-colors hover:bg-navy-600">
        <Search className="h-4 w-4" aria-hidden="true" /> Suchen
      </button>
    </form>
  );
}
