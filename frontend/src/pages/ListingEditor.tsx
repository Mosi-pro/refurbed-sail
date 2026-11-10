import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { StatusBadge } from "../components/badges";
import { Alert, ErrorState, Field, LoadingState, Spinner } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { label, t } from "../i18n";
import { boatTitle, formatBytes, formatPrice } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatDetail, BoatImage, DocumentOut, EntryStatus, EquipmentKind, ReportSection, User } from "../types";

const STEPS = ["Kategorie & Hersteller", "Technische Daten", "Beschreibung", "Fotos", "Ausstattung", "Zustand", "Zustandsbericht", "Preis & Standort", "Vorschau"];
const SPEC_NUM = ["length_m", "beam_m", "draft_m", "displacement_kg", "sail_area_m2", "mast_height_m", "berths"] as const;
const SPEC_TEXT = ["hull_material", "engine", "trailer"] as const;
const EQUIP = Object.keys(t.equipment) as EquipmentKind[];

interface EntryForm { id?: number; section: ReportSection; status: EntryStatus; description: string; work_date: string; seller_notes: string }
interface Form {
  category: string; manufacturer: string; model: string; year: string; description: string; price_eur: string; price_negotiable: boolean;
  location_city: string; location_postal: string; location_region: string; condition: string; hasReport: boolean; refurb_status: string;
  spec: Record<string, string>; equipment: Record<string, string>; summary: string; seller_notes: string; entries: EntryForm[];
}
const EMPTY: Form = {
  category: "", manufacturer: "", model: "", year: "", description: "", price_eur: "", price_negotiable: false, location_city: "",
  location_postal: "", location_region: "", condition: "used", hasReport: false, refurb_status: "documentation_available",
  spec: {}, equipment: {}, summary: "", seller_notes: "", entries: [],
};
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

function fromBoat(b: BoatDetail): Form {
  return {
    category: b.category ?? "", manufacturer: b.manufacturer ?? "", model: b.model ?? "", year: b.year ? String(b.year) : "",
    description: b.description ?? "", price_eur: b.price_eur ? String(b.price_eur) : "", price_negotiable: b.price_negotiable,
    location_city: b.location_city ?? "", location_postal: b.location_postal ?? "", location_region: b.location_region ?? "",
    condition: b.condition, hasReport: !!b.report, refurb_status: b.refurb_status === "none" ? "documentation_available" : b.refurb_status,
    spec: Object.fromEntries(Object.entries(b.spec).map(([k, v]) => [k, SPEC_TEXT.includes(k as never) ? v ?? "" : str(v)])) as Record<string, string>,
    equipment: { ...b.equipment } as Record<string, string>,
    summary: b.report?.summary ?? "", seller_notes: b.report?.seller_notes ?? "",
    entries: (b.report?.entries ?? []).map((e) => ({ id: e.id, section: e.section, status: e.status, description: e.description ?? "", work_date: e.work_date ?? "", seller_notes: e.seller_notes ?? "" })),
  };
}
const num = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() === "" || Number.isNaN(n) ? null : n; };
function toPayload(f: Form) {
  const spec: Record<string, unknown> = {};
  for (const k of SPEC_NUM) spec[k] = k === "displacement_kg" || k === "berths" ? (num(f.spec[k] ?? "") === null ? null : Math.round(num(f.spec[k])!)) : num(f.spec[k] ?? "");
  for (const k of SPEC_TEXT) spec[k] = f.spec[k]?.trim() || null;
  return {
    category: f.category || null, manufacturer: f.manufacturer.trim() || null, model: f.model.trim() || null,
    year: num(f.year) === null ? null : Math.round(num(f.year)!), description: f.description.trim() || null,
    price_eur: num(f.price_eur) === null ? null : Math.round(num(f.price_eur)!), price_negotiable: f.price_negotiable,
    location_city: f.location_city.trim() || null, location_postal: f.location_postal.trim() || null, location_region: f.location_region.trim() || null,
    condition: f.condition, refurb_status: f.hasReport ? f.refurb_status : "none", spec,
    equipment: Object.fromEntries(EQUIP.map((k) => [k, f.equipment[k]?.trim() || null])),
    report: f.hasReport ? { summary: f.summary.trim() || null, seller_notes: f.seller_notes.trim() || null,
      entries: f.entries.map((e) => ({ id: e.id ?? null, section: e.section, status: e.status, description: e.description.trim() || null, work_date: e.work_date || null, seller_notes: e.seller_notes.trim() || null })) } : null,
  };
}

function SellerGate() {
  const { setUser } = useAuth();
  const [company, setCompany] = useState("");
  const m = useMutation({ mutationFn: (body: object) => api.post<{ user: User }>("/api/account/roles", body), onSuccess: (r) => setUser(r.user) });
  return (
    <div className="container-page py-16">
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow">Boot inserieren</p>
        <h1 className="display mt-3 text-4xl">Wie möchtest du verkaufen?</h1>
        <p className="mt-3 text-steel-600">Dein Konto ist bisher nur zum Suchen und Merken eingerichtet. Wähle, wie du inserieren möchtest.</p>
        {m.isError && <div className="mt-6"><Alert>{errorMessage(m.error)}</Alert></div>}
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="border border-line bg-white p-7">
            <h2 className="text-lg font-semibold">Privat verkaufen</h2>
            <p className="mt-2 text-sm text-steel-600">Für Eigner, die ihr eigenes Boot anbieten. Ein Zustandsbericht ist freiwillig.</p>
            <button className="btn-primary mt-6" disabled={m.isPending} onClick={() => m.mutate({ role: "private_seller" })}>Als Privatverkäufer fortfahren</button>
          </div>
          <form className="border border-line bg-white p-7" onSubmit={(e) => { e.preventDefault(); m.mutate({ role: "dealer", company_name: company }); }}>
            <h2 className="text-lg font-semibold">Als Händler oder Werft</h2>
            <p className="mt-2 text-sm text-steel-600">Mit Händlerprofil und Bestandsverwaltung. Die Verifizierung erfolgt durch unser Team.</p>
            <div className="mt-4"><Field label="Firmenname" required>{(p) => <input {...p} required minLength={2} className="input" value={company} onChange={(e) => setCompany(e.target.value)} />}</Field></div>
            <button className="btn-secondary mt-4" disabled={m.isPending}>Händlerkonto aktivieren</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function ListingEditor() {
  const { isSeller } = useAuth();
  const { id } = useParams();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const step = Math.min(STEPS.length, Math.max(1, Number(sp.get("schritt")) || 1));
  const [boat, setBoat] = useState<BoatDetail | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState<string | null>(null);

  const load = useQuery({ queryKey: ["my-boat", id], queryFn: () => api.get<BoatDetail>(`/api/my/boats/${id}`), enabled: !!id && isSeller, retry: false, gcTime: 0 });
  useEffect(() => { if (load.data && (!boat || boat.id !== load.data.id)) { setBoat(load.data); setForm(fromBoat(load.data)); } }, [load.data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!id) { setBoat(null); setForm(EMPTY); } }, [id]);
  useEffect(() => { window.scrollTo({ top: 0 }); setSaved(false); }, [step]);

  if (!isSeller) return <SellerGate />;
  if (id && load.isLoading) return <LoadingState />;
  if (id && load.isError) return <div className="container-page py-20"><ErrorState error={load.error} /></div>;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof Form) => ({ value: form[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) });
  const goto = (n: number) => setSp({ schritt: String(n) }, { replace: false });

  /** Saves the draft (creating it on first save). Returns the stored listing or null on error. */
  async function save(): Promise<BoatDetail | null> {
    setBusy(true); setError(null);
    try {
      const payload = toPayload(form);
      const res = boat ? await api.put<BoatDetail>(`/api/my/boats/${boat.id}`, payload) : await api.post<BoatDetail>("/api/my/boats", payload);
      setBoat(res);
      setForm((f) => ({ ...f, entries: f.entries.map((e, i) => ({ ...e, id: res.report?.entries[i]?.id ?? e.id })) }));
      qc.invalidateQueries({ queryKey: ["my-boats"] }); qc.invalidateQueries({ queryKey: ["dealer-dashboard"] });
      if (!boat) navigate(`/inserat-erstellen/${res.id}?schritt=${step}`, { replace: true });
      return res;
    } catch (e) { setError(errorMessage(e)); return null; } finally { setBusy(false); }
  }
  async function next(target: number) {
    const res = await save();
    if (res) { if (!boat) navigate(`/inserat-erstellen/${res.id}?schritt=${target}`, { replace: true }); else goto(target); }
  }
  async function publish() {
    const res = await save();
    if (!res) return;
    if (["active", "pending"].includes(res.status)) { setPublished("Deine Änderungen wurden gespeichert."); return; }
    setBusy(true);
    try {
      const r = await api.post<{ status: string }>(`/api/my/boats/${res.id}/status`, { action: "publish" });
      qc.invalidateQueries({ queryKey: ["my-boats"] });
      setPublished(r.status === "pending" ? "Dein Inserat wurde eingereicht. Unser Team prüft es vor der Veröffentlichung – den Status siehst du unter „Meine Inserate“." : "Dein Inserat ist jetzt online.");
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }

  // --- uploads -------------------------------------------------------------
  async function ensureBoat() { return boat ?? (await save()); }
  async function uploadImages(files: File[]) {
    if (!files.length) return;
    const b = await ensureBoat(); if (!b) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData(); files.forEach((f) => fd.append("files", f));
      const r = await api.upload<{ images: BoatImage[] }>(`/api/my/boats/${b.id}/images`, fd);
      setBoat((x) => (x ? { ...x, images: r.images } : x));
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function imageAction(fn: () => Promise<{ images: BoatImage[] }>) {
    setBusy(true); setError(null);
    try { const r = await fn(); setBoat((x) => (x ? { ...x, images: r.images } : x)); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const moveImage = (i: number, d: number) => {
    const ids = boat!.images.map((x) => x.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    imageAction(() => api.put(`/api/my/boats/${boat!.id}/images/order`, { image_ids: ids }));
  };
  async function uploadDoc(file: File | undefined, entryIndex?: number) {
    if (!file) return;
    const b = await save(); if (!b) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("title", file.name.replace(/\.[^.]+$/, ""));
      if (entryIndex !== undefined) fd.append("entry_id", String(b.report!.entries[entryIndex].id));
      await api.upload(`/api/my/boats/${b.id}/documents`, fd);
      setBoat(await api.get<BoatDetail>(`/api/my/boats/${b.id}`));
    } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  async function deleteDoc(d: DocumentOut) {
    setBusy(true); setError(null);
    try { await api.del(`/api/my/boats/${boat!.id}/documents/${d.id}`); setBoat(await api.get<BoatDetail>(`/api/my/boats/${boat!.id}`)); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  const DocRow = ({ d }: { d: DocumentOut }) => (
    <li className="flex items-center gap-3 border border-line bg-sand px-3 py-2 text-sm">
      <FileText className="h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" />
      <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate font-medium hover:underline">{d.title}</a>
      <span className="shrink-0 text-xs text-steel-600">{d.kind === "pdf" ? "PDF" : "Foto"} · {formatBytes(d.size_bytes)}</span>
      <button type="button" onClick={() => deleteDoc(d)} aria-label={`${d.title} löschen`} className="p-1 text-steel-600 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
    </li>
  );
  const FileButton = ({ id: fid, onFile, children, accept }: { id: string; onFile: (f: File | undefined) => void; children: ReactNode; accept: string }) => (
    <><input id={fid} type="file" accept={accept} className="sr-only" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
      <label htmlFor={fid} className="btn-secondary btn-sm cursor-pointer"><Upload className="h-3.5 w-3.5" aria-hidden="true" />{children}</label></>
  );
  const setEntry = (i: number, patch: Partial<EntryForm>) => set("entries", form.entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const needsReport = form.condition !== "used";

  const body: Record<number, ReactNode> = {
    1: (<div className="space-y-6">
      <fieldset><legend className="label">Bootskategorie <span className="text-brass-700" aria-hidden="true">*</span></legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(t.category).map(([k, v]) => (
            <label key={k} className={`flex min-h-[52px] cursor-pointer items-center justify-center border px-3 text-center text-sm font-semibold ${form.category === k ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy/40"}`}>
              <input type="radio" name="category" className="sr-only" checked={form.category === k} onChange={() => set("category", k)} />{v}
            </label>))}
        </div></fieldset>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Hersteller / Werft" required>{(p) => <input {...p} className="input" maxLength={80} placeholder="z. B. Dehler" {...text("manufacturer")} />}</Field>
        <Field label="Modell" required>{(p) => <input {...p} className="input" maxLength={80} placeholder="z. B. 34" {...text("model")} />}</Field>
        <Field label="Baujahr" required>{(p) => <input {...p} className="input" inputMode="numeric" maxLength={4} placeholder="z. B. 1988" value={form.year} onChange={(e) => set("year", e.target.value.replace(/\D/g, ""))} />}</Field>
      </div></div>),
    2: (<div className="grid gap-5 sm:grid-cols-2">
      {([["length_m", "m", true], ["beam_m", "m"], ["draft_m", "m"], ["displacement_kg", "kg"], ["sail_area_m2", "m²"], ["mast_height_m", "m"], ["berths", "Anzahl"]] as [string, string, boolean?][]).map(([k, unit, req]) => (
        <Field key={k} label={`${label("spec", k)} (${unit})`} required={req}>{(p) => <input {...p} className="input" inputMode="decimal" value={form.spec[k] ?? ""} onChange={(e) => set("spec", { ...form.spec, [k]: e.target.value.replace(/[^\d.,]/g, "") })} />}</Field>))}
      <Field label={t.spec.hull_material}>{(p) => <input {...p} className="input" maxLength={60} placeholder="z. B. GFK" value={form.spec.hull_material ?? ""} onChange={(e) => set("spec", { ...form.spec, hull_material: e.target.value })} />}</Field>
      <Field label={t.spec.engine} hint="Typ, Leistung, Betriebsstunden – oder leer lassen.">{(p) => <input {...p} className="input" maxLength={160} value={form.spec.engine ?? ""} onChange={(e) => set("spec", { ...form.spec, engine: e.target.value })} />}</Field>
      <Field label={t.spec.trailer} hint="z. B. Straßentrailer, Slipwagen – oder leer lassen.">{(p) => <input {...p} className="input" maxLength={160} value={form.spec.trailer ?? ""} onChange={(e) => set("spec", { ...form.spec, trailer: e.target.value })} />}</Field>
    </div>),
    3: (<Field label="Beschreibung" required hint={`${form.description.length} / 10.000 Zeichen · mindestens 40. Beschreibe Geschichte, Nutzung, Besonderheiten und bekannte Mängel.`}>{(p) => <textarea {...p} rows={12} maxLength={10000} className="input" {...text("description")} />}</Field>),
    4: (<div>
      <p className="text-sm text-steel-600">JPEG, PNG oder WebP, je bis 10 MB, höchstens 24 Fotos. Das erste Foto ist das Titelbild. Standortdaten werden automatisch entfernt.</p>
      <input id="img-up" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { uploadImages(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
      <label htmlFor="img-up" className="mt-5 flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-navy/30 bg-white px-6 py-10 text-center hover:border-navy">
        <Upload className="h-6 w-6 text-steel-600" aria-hidden="true" /><span className="text-sm font-semibold text-navy">Fotos auswählen</span><span className="text-xs text-steel-600">Mehrfachauswahl möglich</span>
      </label>
      {boat && boat.images.length > 0 && (
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {boat.images.map((img, i) => (
            <li key={img.id} className="border border-line bg-white">
              <div className="relative"><img src={img.thumb_url} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="tag absolute left-2 top-2 border-navy bg-navy text-white">Titelbild</span>}</div>
              <div className="flex items-center justify-between px-2 py-1.5">
                <span className="text-xs text-steel-600">Position {i + 1}</span>
                <span className="flex">
                  <button type="button" disabled={i === 0 || busy} onClick={() => moveImage(i, -1)} aria-label={`Foto ${i + 1} nach vorn`} className="p-2 disabled:opacity-30"><ArrowUp className="h-4 w-4 -rotate-90" /></button>
                  <button type="button" disabled={i === boat.images.length - 1 || busy} onClick={() => moveImage(i, 1)} aria-label={`Foto ${i + 1} nach hinten`} className="p-2 disabled:opacity-30"><ArrowDown className="h-4 w-4 -rotate-90" /></button>
                  <button type="button" disabled={busy} onClick={() => imageAction(() => api.del(`/api/my/boats/${boat.id}/images/${img.id}`))} aria-label={`Foto ${i + 1} löschen`} className="p-2 text-steel-600 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                </span>
              </div>
            </li>))}
        </ol>)}
    </div>),
    5: (<div className="space-y-5">
      <p className="text-sm text-steel-600">Alle Felder sind freiwillig. Nenne Alter, Hersteller und Zustand der Segel, wo bekannt.</p>
      {EQUIP.map((k) => (<Field key={k} label={t.equipment[k]}>{(p) => k === "electronics" || k === "other"
        ? <textarea {...p} rows={3} maxLength={2000} className="input" value={form.equipment[k] ?? ""} onChange={(e) => set("equipment", { ...form.equipment, [k]: e.target.value })} />
        : <input {...p} maxLength={1000} className="input" value={form.equipment[k] ?? ""} onChange={(e) => set("equipment", { ...form.equipment, [k]: e.target.value })} />}</Field>))}
    </div>),
    6: (<div className="space-y-8">
      <fieldset><legend className="label">Wie bietest du das Boot an?</legend>
        <div className="space-y-2">
          {([["used", "Gebraucht", "Ein gewöhnliches Gebrauchtboot. Ein Zustandsbericht ist freiwillig."],
            ["refurbished", "Refurbished", "Das Boot wurde vor dem Verkauf aufbereitet. Ein Zustandsbericht mit mindestens einem Eintrag ist erforderlich."],
            ["restored", "Restauriert", "Das Boot wurde umfassend restauriert. Ein Zustandsbericht mit mindestens einem Eintrag ist erforderlich."]] as const).map(([v, h, d]) => (
            <label key={v} className={`flex cursor-pointer gap-3 border px-4 py-3.5 ${form.condition === v ? "border-navy bg-white" : "border-line bg-white/60 hover:border-navy/40"}`}>
              <input type="radio" name="condition" className="mt-1 accent-navy" checked={form.condition === v} onChange={() => setForm((f) => ({ ...f, condition: v, hasReport: v !== "used" ? true : f.hasReport }))} />
              <span><span className="block text-sm font-semibold text-navy">{h}</span><span className="block text-[0.82rem] text-steel-600">{d}</span></span>
            </label>))}
        </div></fieldset>
      <fieldset><legend className="label">Zustandsbericht</legend>
        <label className={`flex gap-3 border border-line bg-white px-4 py-3.5 ${needsReport ? "opacity-70" : "cursor-pointer"}`}>
          <input type="checkbox" className="mt-1 h-4 w-4 accent-navy" checked={form.hasReport} disabled={needsReport} onChange={(e) => set("hasReport", e.target.checked)} />
          <span><span className="block text-sm font-semibold text-navy">Ich möchte Prüfungen und Arbeiten dokumentieren</span>
            <span className="block text-[0.82rem] text-steel-600">{needsReport ? "Für aufbereitete und restaurierte Boote erforderlich." : "Freiwillig für Privatverkäufe – schafft aber Vertrauen bei Käufern."}</span></span>
        </label>
        {form.hasReport && (
          <div className="mt-4"><Field label="Status der Dokumentation" hint="Wird als Kennzeichnung im Inserat angezeigt.">{(p) => (
            <select {...p} className="input" value={form.refurb_status} onChange={(e) => set("refurb_status", e.target.value)}>
              {Object.entries(t.refurbStatus).filter(([k]) => k !== "none").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>)}</Field></div>)}
      </fieldset>
    </div>),
    7: (!form.hasReport ? (
      <div className="border border-line bg-white p-7">
        <h3 className="text-lg font-semibold">Kein Zustandsbericht</h3>
        <p className="mt-2 text-sm text-steel-600">Du bietest dein Boot als gewöhnliches Gebrauchtboot ohne Zustandsbericht an. Das ist in Ordnung – du kannst diesen Schritt überspringen.</p>
        <button type="button" className="btn-secondary mt-5" onClick={() => set("hasReport", true)}>Doch einen Zustandsbericht anlegen</button>
      </div>
    ) : (
      <div className="space-y-8">
        <Alert kind="info">Der Bericht wird im Inserat als <strong>„Angaben des Verkäufers“</strong> gekennzeichnet. Eine Kennzeichnung als unabhängig geprüft kann nur unser Team nach Vorlage eines Gutachtens vergeben.</Alert>
        <Field label="Zusammenfassung" hint="Was wurde wann und von wem gemacht?">{(p) => <textarea {...p} rows={3} maxLength={3000} className="input" {...text("summary")} />}</Field>
        <div>
          <h3 className="label">Einträge je Baugruppe</h3>
          <ol className="space-y-4">
            {form.entries.map((e, i) => {
              const docs = boat?.report?.entries.find((x) => x.id === e.id)?.documents ?? [];
              return (
                <li key={e.id ?? `n${i}`} className="border border-line bg-white p-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Baugruppe">{(p) => <select {...p} className="input" value={e.section} onChange={(ev) => setEntry(i, { section: ev.target.value as ReportSection })}>{Object.entries(t.section).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
                    <Field label="Status">{(p) => <select {...p} className="input" value={e.status} onChange={(ev) => setEntry(i, { status: ev.target.value as EntryStatus })}>{Object.entries(t.entryStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
                    <Field label="Datum der Arbeiten">{(p) => <input {...p} type="date" className="input" value={e.work_date} max={new Date().toISOString().slice(0, 10)} onChange={(ev) => setEntry(i, { work_date: ev.target.value })} />}</Field>
                  </div>
                  <div className="mt-4 space-y-4">
                    <Field label="Beschreibung">{(p) => <textarea {...p} rows={3} maxLength={3000} className="input" value={e.description} onChange={(ev) => setEntry(i, { description: ev.target.value })} />}</Field>
                    <Field label="Anmerkung des Verkäufers">{(p) => <input {...p} maxLength={2000} className="input" value={e.seller_notes} onChange={(ev) => setEntry(i, { seller_notes: ev.target.value })} />}</Field>
                  </div>
                  {docs.length > 0 && <ul className="mt-4 space-y-2">{docs.map((d) => <DocRow key={d.id} d={d} />)}</ul>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <FileButton id={`entry-doc-${i}`} accept="application/pdf,image/jpeg,image/png,image/webp" onFile={(f) => uploadDoc(f, i)}>Beleg oder Foto anhängen</FileButton>
                    <button type="button" className="inline-flex items-center gap-1.5 text-sm text-steel-600 hover:text-danger" onClick={() => set("entries", form.entries.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" aria-hidden="true" />Eintrag entfernen</button>
                  </div>
                </li>);
            })}
          </ol>
          <button type="button" className="btn-secondary mt-4" onClick={() => {
            const used = new Set(form.entries.map((e) => e.section));
            const sec = (Object.keys(t.section) as ReportSection[]).find((s) => !used.has(s)) ?? "other";
            set("entries", [...form.entries, { section: sec, status: "inspected", description: "", work_date: "", seller_notes: "" }]);
          }}><Plus className="h-4 w-4" aria-hidden="true" />Eintrag hinzufügen</button>
        </div>
        <Field label="Allgemeine Hinweise des Verkäufers">{(p) => <textarea {...p} rows={3} maxLength={3000} className="input" {...text("seller_notes")} />}</Field>
        <div>
          <h3 className="label">Dokumente zum Boot</h3>
          <p className="mb-3 text-sm text-steel-600">Rechnungen, Gutachten, Messprotokolle als PDF (bis 15 MB). Dokumente sind erst öffentlich abrufbar, wenn das Inserat online ist.</p>
          {boat && boat.documents.length > 0 && <ul className="mb-3 space-y-2">{boat.documents.map((d) => <DocRow key={d.id} d={d} />)}</ul>}
          <FileButton id="boat-doc" accept="application/pdf" onFile={(f) => uploadDoc(f)}>PDF hochladen</FileButton>
        </div>
      </div>)),
    8: (<div className="grid gap-5 sm:grid-cols-2">
      <Field label="Preis (€)" required>{(p) => <input {...p} className="input" inputMode="numeric" placeholder="z. B. 38500" value={form.price_eur} onChange={(e) => set("price_eur", e.target.value.replace(/\D/g, ""))} />}</Field>
      <label className="flex items-center gap-3 self-end pb-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-navy" checked={form.price_negotiable} onChange={(e) => set("price_negotiable", e.target.checked)} />Verhandlungsbasis (VB)</label>
      <Field label="Ort / Liegeplatz" required>{(p) => <input {...p} className="input" maxLength={80} placeholder="z. B. Kiel" {...text("location_city")} />}</Field>
      <Field label="Postleitzahl">{(p) => <input {...p} className="input" maxLength={12} {...text("location_postal")} />}</Field>
      <Field label="Region / Bundesland">{(p) => <input {...p} className="input" maxLength={80} placeholder="z. B. Schleswig-Holstein" {...text("location_region")} />}</Field>
    </div>),
    9: published ? (
      <div className="border border-line bg-white p-8 text-center">
        <Check className="mx-auto h-8 w-8 text-ok" aria-hidden="true" />
        <h3 className="mt-3 font-serif text-2xl">{published}</h3>
        <div className="mt-6 flex justify-center gap-3"><Link className="btn-primary" to="/konto/inserate">Zu meinen Inseraten</Link>{boat && <Link className="btn-secondary" to={`/boote/${boat.slug}`}>Inserat ansehen</Link>}</div>
      </div>
    ) : (
      <div className="space-y-6">
        <div className="grid gap-6 border border-line bg-white p-6 sm:grid-cols-[220px_1fr]">
          {boat?.images[0] ? <img src={boat.images[0].thumb_url} alt="" className="aspect-[4/3] w-full object-cover" /> : <div className="flex aspect-[4/3] items-center justify-center bg-line text-xs text-steel-600">Kein Foto</div>}
          <div>
            <p className="eyebrow">{label("category", form.category) || "Kategorie fehlt"} · {form.year || "Baujahr fehlt"}</p>
            <h3 className="mt-1 font-serif text-3xl">{boatTitle({ manufacturer: form.manufacturer, model: form.model })}</h3>
            <p className="mt-2 text-2xl font-semibold">{formatPrice(num(form.price_eur))}{form.price_negotiable && <span className="ml-2 text-sm font-medium text-steel-600">VB</span>}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
              <dt className="text-steel-600">Standort</dt><dd>{form.location_city || "–"}</dd>
              <dt className="text-steel-600">Länge</dt><dd>{form.spec.length_m ? `${form.spec.length_m} m` : "–"}</dd>
              <dt className="text-steel-600">Zustand</dt><dd>{label("condition", form.condition)}</dd>
              <dt className="text-steel-600">Zustandsbericht</dt><dd>{form.hasReport ? `${form.entries.length} Einträge · ${label("refurbStatus", form.refurb_status)}` : "Keiner"}</dd>
              <dt className="text-steel-600">Fotos</dt><dd>{boat?.images.length ?? 0}</dd>
            </dl>
          </div>
        </div>
        {boat?.publish_errors && boat.publish_errors.length > 0 ? (
          <div role="alert" className="border-l-2 border-brass bg-white px-5 py-4">
            <p className="text-sm font-semibold text-navy">Vor der Veröffentlichung fehlt noch:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">{boat.publish_errors.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
        ) : boat ? <Alert kind="success">Alle Pflichtangaben sind vollständig.</Alert> : null}
        {boat && <p className="text-sm text-steel-600">Du kannst dir das Inserat vorab so ansehen, wie Käufer es sehen: <Link className="link" to={`/boote/${boat.slug}`} target="_blank">Vorschau öffnen</Link></p>}
      </div>),
  };

  const live = boat && ["active", "pending"].includes(boat.status);
  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{boat ? `Inserat ${boat.reference}` : "Neues Inserat"}</p>
          <h1 className="display mt-2 text-4xl">{boat ? boatTitle({ manufacturer: form.manufacturer, model: form.model }) : "Boot inserieren"}</h1>
        </div>
        {boat && <StatusBadge status={boat.status} />}
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Schritte">
          <ol className="flex gap-1 overflow-x-auto lg:block lg:space-y-0 lg:border-l lg:border-line">
            {STEPS.map((s, i) => {
              const n = i + 1, active = n === step;
              return (<li key={s} className="shrink-0">
                <button type="button" disabled={busy} aria-current={active ? "step" : undefined} onClick={() => (n === step ? undefined : next(n))}
                  className={`flex w-full items-center gap-3 whitespace-nowrap px-3 py-2.5 text-left text-sm lg:-ml-px lg:border-l-2 lg:px-4 ${active ? "bg-white font-semibold text-navy lg:border-navy lg:bg-transparent" : "text-steel-600 hover:text-navy lg:border-transparent"}`}>
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center text-[0.7rem] font-bold ${active ? "bg-navy text-white" : "border border-navy/25"}`}>{n}</span>{s}
                </button></li>);
            })}
          </ol>
        </nav>
        <form className="min-w-0 max-w-3xl" onSubmit={(e) => { e.preventDefault(); if (step < STEPS.length) next(step + 1); else publish(); }}>
          <h2 className="mb-6 border-b border-line pb-4 text-xl font-semibold"><span className="text-steel-600">Schritt {step} von {STEPS.length} · </span>{STEPS[step - 1]}</h2>
          {body[step]}
          {error && <div className="mt-6"><Alert>{error}</Alert></div>}
          {saved && !error && <div className="mt-6"><Alert kind="success">Entwurf gespeichert.</Alert></div>}
          {!(step === 9 && published) && (
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
              <button type="button" className="btn-secondary" disabled={step === 1 || busy} onClick={() => next(step - 1)}>{t.common.back}</button>
              <div className="flex flex-wrap items-center gap-3">
                {busy && <Spinner className="text-steel-600" />}
                <button type="button" className="btn-secondary" disabled={busy} onClick={async () => setSaved(!!(await save()))}>{live ? "Änderungen speichern" : "Entwurf speichern"}</button>
                {step < STEPS.length ? <button className="btn-primary" disabled={busy}>Speichern und weiter</button>
                  : <button className="btn-primary" disabled={busy || (!live && !!boat?.publish_errors?.length)}>{live ? "Änderungen speichern" : "Inserat einreichen"}</button>}
              </div>
            </div>)}
        </form>
      </div>
    </div>
  );
}
