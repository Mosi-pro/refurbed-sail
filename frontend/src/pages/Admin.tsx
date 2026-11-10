import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { DocumentLink } from "../components/ReportView";
import { EntryStatusBadge, StatusBadge, VerificationBadge } from "../components/badges";
import { Alert, EmptyState, ErrorState, Field, LoadingState, Modal, Pagination } from "../components/ui";
import { label, t } from "../i18n";
import { boatTitle, formatDate, formatDateTime, formatPrice } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatCard, Dealer, DealerVerification, Paged, Report, Role } from "../types";

const TABS = [["/admin", "Übersicht"], ["/admin/inserate", "Inserate"], ["/admin/meldungen", "Meldungen"], ["/admin/haendler", "Händler"], ["/admin/berichte", "Zustandsberichte"], ["/admin/nutzer", "Nutzer"], ["/admin/protokoll", "Protokoll"]];

export function AdminLayout() {
  return (
    <>
      <div className="on-dark bg-navy text-white">
        <div className="container-page pt-10">
          <p className="eyebrow !text-white/60">Administration</p>
          <h1 className="mt-2 font-serif text-4xl text-white">Plattformverwaltung</h1>
          <nav aria-label="Administration" className="mt-8 flex gap-7 overflow-x-auto">
            {TABS.map(([to, text]) => (<NavLink key={to} to={to} end={to === "/admin"} className={({ isActive }) => `whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${isActive ? "border-brass text-white" : "border-transparent text-white/65 hover:text-white"}`}>{text}</NavLink>))}
          </nav>
        </div>
      </div>
      <div className="container-page py-10"><Outlet /></div>
    </>
  );
}

function useAdmin<T>(key: unknown[], path: string, params?: Record<string, string | number | undefined>) {
  return useQuery({ queryKey: ["admin", ...key], queryFn: () => api.get<T>(path, params), placeholderData: keepPreviousData });
}
function QueryView<T>({ q, children }: { q: { isLoading: boolean; isError: boolean; error: unknown; data?: T; refetch: () => void }; children: (d: T) => ReactNode }) {
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={q.refetch} />;
  return <>{children(q.data as T)}</>;
}
function useAction(onDone?: () => void) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ method = "post", path, body }: { method?: "post" | "patch"; path: string; body: object }) => api[method](path, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); qc.invalidateQueries({ queryKey: ["boats"] }); qc.invalidateQueries({ queryKey: ["facets"] }); onDone?.(); } });
}
const TableWrap = ({ children, min = 760 }: { children: ReactNode; min?: number }) => <div className="overflow-x-auto border border-line bg-white"><table className="table-base" style={{ minWidth: min }}>{children}</table></div>;

interface Overview { users: { total: number; active: number; new_7d: number }; listings: { by_status: Record<string, number>; total: number; new_7d: number }; dealers: { total: number; unverified: number }; reports_open: number; pending_listings: number; refurb_reports_unreviewed: number; messages_7d: number; conversations: number }

export function AdminOverview() {
  const q = useAdmin<Overview>(["overview"], "/api/admin/overview");
  return (<QueryView q={q}>{(o) => (
    <div className="space-y-10">
      <section aria-labelledby="todo-h"><h2 id="todo-h" className="mb-4 text-xl font-semibold">Offene Aufgaben</h2>
        <dl className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
          {([["Inserate zur Freigabe", o.pending_listings, "/admin/inserate?status=pending"], ["Offene Meldungen", o.reports_open, "/admin/meldungen"],
            ["Unverifizierte Händler", o.dealers.unverified, "/admin/haendler"], ["Ungeprüfte Zustandsberichte", o.refurb_reports_unreviewed, "/admin/berichte"]] as [string, number, string][]).map(([k, v, to]) => (
            <div key={k} className="relative border-b border-r border-line bg-white p-6 hover:bg-sand"><dt className="eyebrow"><Link to={to} className="after:absolute after:inset-0">{k}</Link></dt>
              <dd className={`mt-3 font-serif text-4xl ${v > 0 ? "text-brass-700" : "text-navy"}`}>{v}</dd></div>))}
        </dl></section>
      <section aria-labelledby="stats-h"><h2 id="stats-h" className="mb-4 text-xl font-semibold">Plattform</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="border border-line bg-white p-6"><h3 className="eyebrow">Nutzer</h3><p className="mt-3 font-serif text-4xl">{o.users.total}</p>
            <p className="mt-1 text-sm text-steel-600">{o.users.active} aktiv · {o.users.new_7d} neu in 7 Tagen · {o.dealers.total} Händler</p></div>
          <div className="border border-line bg-white p-6"><h3 className="eyebrow">Inserate</h3><p className="mt-3 font-serif text-4xl">{o.listings.total}</p>
            <ul className="mt-2 space-y-1 text-sm">{Object.entries(o.listings.by_status).map(([s, n]) => <li key={s} className="flex justify-between"><span className="text-steel-600">{label("boatStatus", s)}</span><span className="tabular-nums">{n}</span></li>)}</ul></div>
          <div className="border border-line bg-white p-6"><h3 className="eyebrow">Kommunikation</h3><p className="mt-3 font-serif text-4xl">{o.messages_7d}</p>
            <p className="mt-1 text-sm text-steel-600">Nachrichten in 7 Tagen · {o.conversations} Unterhaltungen gesamt</p></div>
        </div></section>
    </div>)}</QueryView>);
}

function ReasonModal({ title, text, required, confirm, pending, error, onClose, onSubmit }: { title: string; text: string; required?: boolean; confirm: string; pending: boolean; error: unknown; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  return (<Modal title={title} onClose={onClose}><form onSubmit={(e) => { e.preventDefault(); onSubmit(reason); }} className="space-y-4">
    <p className="text-sm text-steel-600">{text}</p>
    <Field label={required ? "Begründung" : "Notiz (optional)"} required={required}>{(p) => <textarea {...p} required={required} rows={3} maxLength={1000} className="input" value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
    {error ? <Alert>{errorMessage(error)}</Alert> : null}
    <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={onClose}>Abbrechen</button><button className="btn-primary" disabled={pending}>{confirm}</button></div>
  </form></Modal>);
}

export function AdminBoats() {
  const [status, setStatus] = useState(new URLSearchParams(location.search).get("status") ?? "pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ boat: BoatCard; action: "reject" | "remove" } | null>(null);
  const q = useAdmin<Paged<BoatCard>>(["boats", status, search, page], "/api/admin/boats", { status: status || undefined, q: search || undefined, page });
  const act = useAction(() => setModal(null));
  const decide = (b: BoatCard, action: string, reason?: string) => act.mutate({ path: `/api/admin/boats/${b.id}/decision`, body: { action, reason: reason || null } });
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end gap-3">
        <Field label="Status">{(p) => <select {...p} className="input w-auto" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="">Alle</option>{Object.entries(t.boatStatus).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>}</Field>
        <Field label="Suche">{(p) => <input {...p} type="search" className="input" placeholder="Hersteller, Modell, Referenz" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />}</Field>
      </div>
      {act.isError && !modal && <div className="mb-4"><Alert>{errorMessage(act.error)}</Alert></div>}
      <QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Keine Inserate" text={status === "pending" ? "Aktuell wartet kein Inserat auf Freigabe." : "Für diese Auswahl gibt es keine Inserate."} /> : (<>
        <TableWrap min={900}>
          <thead><tr><th scope="col">Inserat</th><th scope="col">Verkäufer</th><th scope="col">Preis</th><th scope="col">Status</th><th scope="col">Aktionen</th></tr></thead>
          <tbody>{d.items.map((b) => (
            <tr key={b.id}>
              <td><div className="flex gap-3">{b.image && <img src={b.image.thumb_url} alt="" className="h-12 w-16 shrink-0 object-cover" />}
                <div><Link className="font-semibold hover:underline" to={`/boote/${b.slug}`}>{boatTitle(b)}</Link>{b.is_demo && <span className="ml-2 text-xs text-steel-600">Demo</span>}
                  <div className="text-xs text-steel-600"><span className="font-mono">{b.reference}</span> · {label("category", b.category)} · {b.year ?? "–"} · {b.image_count} Fotos{b.has_report ? " · Zustandsbericht" : ""}</div>
                  {b.rejection_reason && <div className="mt-1 text-xs text-danger">Begründung: {b.rejection_reason}</div>}</div></div></td>
              <td>{b.seller_name}<div className="text-xs text-steel-600">{b.seller_email} · {label("sellerType", b.seller_type)}</div></td>
              <td className="whitespace-nowrap">{formatPrice(b.price_eur)}</td>
              <td><StatusBadge status={b.status} /><div className="mt-1 text-xs text-steel-600">{formatDate(b.updated_at)}</div></td>
              <td><div className="flex flex-wrap gap-2">
                {(b.status === "pending" || b.status === "rejected") && <button className="btn-primary btn-sm" disabled={act.isPending} onClick={() => decide(b, "approve")}>Freigeben</button>}
                {["pending", "active", "paused"].includes(b.status) && <button className="btn-secondary btn-sm" onClick={() => setModal({ boat: b, action: "reject" })}>Ablehnen</button>}
                {b.status !== "removed" ? <button className="btn-danger btn-sm" onClick={() => setModal({ boat: b, action: "remove" })}>Entfernen</button>
                  : <button className="btn-secondary btn-sm" disabled={act.isPending} onClick={() => decide(b, "restore")}>Wiederherstellen</button>}
              </div></td>
            </tr>))}</tbody>
        </TableWrap>
        <Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}</QueryView>
      {modal && <ReasonModal required pending={act.isPending} error={act.error} onClose={() => { setModal(null); act.reset(); }}
        title={modal.action === "reject" ? "Inserat ablehnen" : "Inserat entfernen"} confirm={modal.action === "reject" ? "Ablehnen" : "Entfernen"}
        text={`${boatTitle(modal.boat)} (${modal.boat.reference}). ${modal.action === "reject" ? "Der Verkäufer sieht die Begründung und kann das Inserat überarbeiten." : "Das Inserat wird für den Verkäufer und alle Besucher unsichtbar."} Die Aktion wird protokolliert.`}
        onSubmit={(r) => decide(modal.boat, modal.action, r)} />}
    </div>
  );
}

interface ReportItem { id: number; reason: string; details: string | null; status: string; resolution_note: string | null; created_at: string; reporter: string | null; boat: BoatCard }
export function AdminReports() {
  const [status, setStatus] = useState("open");
  const [modal, setModal] = useState<{ r: ReportItem; remove: boolean; status: "resolved" | "dismissed" } | null>(null);
  const q = useAdmin<{ items: ReportItem[] }>(["reports", status], "/api/admin/reports", { status });
  const act = useAction(() => setModal(null));
  return (
    <div>
      <div className="mb-5 flex gap-2">{[["open", "Offen"], ["resolved", "Erledigt"], ["dismissed", "Verworfen"]].map(([k, v]) => <button key={k} className={`btn btn-sm ${status === k ? "border-navy bg-navy text-white" : "border-line bg-white"}`} onClick={() => setStatus(k)}>{v}</button>)}</div>
      <QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Keine Meldungen" text="In diesem Bereich liegen keine Meldungen vor." /> : (
        <ul className="space-y-4">{d.items.map((r) => (
          <li key={r.id} className="border border-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><span className="tag border-danger/40 text-danger">{label("reportReason", r.reason)}</span>
                <h2 className="mt-3 text-lg font-semibold"><Link className="hover:underline" to={`/boote/${r.boat.slug}`}>{boatTitle(r.boat)}</Link> <span className="font-mono text-xs font-normal text-steel-600">{r.boat.reference}</span></h2>
                <p className="text-xs text-steel-600">Gemeldet am {formatDateTime(r.created_at)} von {r.reporter ?? "anonym"} · Inserat: {label("boatStatus", r.boat.status)}</p></div>
              {r.status === "open" && (<div className="flex flex-wrap gap-2">
                <button className="btn-danger btn-sm" onClick={() => setModal({ r, remove: true, status: "resolved" })}>Inserat entfernen</button>
                <button className="btn-secondary btn-sm" onClick={() => setModal({ r, remove: false, status: "resolved" })}>Als erledigt markieren</button>
                <button className="btn-secondary btn-sm" onClick={() => setModal({ r, remove: false, status: "dismissed" })}>Verwerfen</button></div>)}
            </div>
            {r.details && <p className="mt-4 border-l border-brass pl-3 text-sm">{r.details}</p>}
            {r.resolution_note && <p className="mt-3 text-sm text-steel-600">Notiz: {r.resolution_note}</p>}
          </li>))}</ul>)}</QueryView>
      {modal && <ReasonModal required={modal.remove} pending={act.isPending} error={act.error} onClose={() => { setModal(null); act.reset(); }}
        title={modal.remove ? "Gemeldetes Inserat entfernen" : modal.status === "resolved" ? "Meldung erledigen" : "Meldung verwerfen"} confirm="Bestätigen"
        text={`${boatTitle(modal.r.boat)} (${modal.r.boat.reference}). Die Aktion wird protokolliert.`}
        onSubmit={(note) => act.mutate({ path: `/api/admin/reports/${modal.r.id}/resolve`, body: { status: modal.status, note: note || null, remove_listing: modal.remove } })} />}
    </div>
  );
}

type AdminDealer = Dealer & { owner_email: string; owner_active: boolean; history: { status: DealerVerification; note: string | null; created_at: string }[] };
export function AdminDealers() {
  const q = useAdmin<{ items: AdminDealer[] }>(["dealers"], "/api/admin/dealers");
  const [modal, setModal] = useState<{ d: AdminDealer; status: DealerVerification } | null>(null);
  const act = useAction(() => setModal(null));
  return (<QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Noch keine Händler" /> : (<>
    <TableWrap min={900}>
      <thead><tr><th scope="col">Händler</th><th scope="col">Kontakt</th><th scope="col">Inserate</th><th scope="col">Status</th><th scope="col">Verifizierung setzen</th></tr></thead>
      <tbody>{d.items.map((x) => (
        <tr key={x.id}>
          <td><Link className="font-semibold hover:underline" to={`/haendler/${x.slug}`}>{x.company_name}</Link>{x.is_demo && <span className="ml-2 text-xs text-steel-600">Demo</span>}
            <div className="text-xs text-steel-600">{[x.street, x.postal_code, x.city].filter(Boolean).join(", ") || "Keine Adresse hinterlegt"}</div>
            <div className="text-xs text-steel-600">Registriert am {formatDate(x.member_since)}{!x.owner_active && " · Konto deaktiviert"}</div></td>
          <td className="text-xs">{x.owner_email}<div className="text-steel-600">{x.phone ?? "kein Telefon"}{x.website ? ` · ${x.website}` : ""}</div></td>
          <td className="tabular-nums">{x.listing_count}</td>
          <td><VerificationBadge status={x.verification_status} />{x.history[0] && <div className="mt-1 text-xs text-steel-600">{formatDate(x.history[0].created_at)}{x.history[0].note ? ` · ${x.history[0].note}` : ""}</div>}</td>
          <td><select aria-label={`Verifizierung für ${x.company_name}`} className="input !min-h-[36px] w-auto py-1 text-sm" value={x.verification_status} onChange={(e) => setModal({ d: x, status: e.target.value as DealerVerification })}>
            {Object.entries(t.dealerVerification).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></td>
        </tr>))}</tbody>
    </TableWrap>
    {modal && <ReasonModal pending={act.isPending} error={act.error} onClose={() => { setModal(null); act.reset(); }} title="Verifizierungsstatus ändern" confirm="Status setzen"
      text={`${modal.d.company_name}: ${label("dealerVerification", modal.d.verification_status)} → ${label("dealerVerification", modal.status)}. Bitte notiere, welche Unterlagen geprüft wurden.`}
      onSubmit={(note) => act.mutate({ path: `/api/admin/dealers/${modal.d.id}/verification`, body: { status: modal.status, note: note || null } })} />}
  </>)}</QueryView>);
}

interface RefurbItem { boat: BoatCard; report: Report; document_count: number; admin_reviewed_at: string | null; admin_review_note: string | null }
export function AdminRefurb() {
  const q = useAdmin<{ items: RefurbItem[] }>(["refurb"], "/api/admin/refurb-reports");
  const [open, setOpen] = useState<RefurbItem | null>(null);
  const [f, setF] = useState({ verification: "seller_provided", verified_by: "", note: "" });
  const act = useAction(() => setOpen(null));
  return (<QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Keine Zustandsberichte" /> : (<>
    <TableWrap>
      <thead><tr><th scope="col">Boot</th><th scope="col">Kennzeichnung</th><th scope="col">Umfang</th><th scope="col">Herkunft</th><th scope="col">Prüfung durch Admin</th><th scope="col"><span className="sr-only">Aktion</span></th></tr></thead>
      <tbody>{d.items.map((x) => (
        <tr key={x.report.id}><td><Link className="font-semibold hover:underline" to={`/boote/${x.boat.slug}`}>{boatTitle(x.boat)}</Link><div className="text-xs text-steel-600"><span className="font-mono">{x.boat.reference}</span> · {x.boat.seller_name}</div></td>
          <td>{label("condition", x.boat.condition)}<div className="text-xs text-steel-600">{label("refurbStatus", x.boat.refurb_status)}</div></td>
          <td className="whitespace-nowrap">{x.report.entries.length} Einträge · {x.document_count} Dok.</td>
          <td>{x.report.verification === "independently_verified" ? <span className="tag border-brass/60 text-brass-700">Unabhängig geprüft</span> : "Verkäuferangabe"}</td>
          <td>{x.admin_reviewed_at ? formatDate(x.admin_reviewed_at) : <span className="text-brass-700">Offen</span>}</td>
          <td className="text-right"><button className="btn-secondary btn-sm" onClick={() => { setOpen(x); setF({ verification: x.report.verification, verified_by: x.report.verified_by ?? "", note: x.admin_review_note ?? "" }); act.reset(); }}>Prüfen</button></td></tr>))}</tbody>
    </TableWrap>
    {open && (<Modal wide title={`Zustandsbericht: ${boatTitle(open.boat)}`} onClose={() => setOpen(null)}>
      <ol className="divide-y divide-line border-y border-line">{open.report.entries.map((e) => (
        <li key={e.id} className="py-3"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{label("section", e.section)}</span><EntryStatusBadge status={e.status} />{e.work_date && <span className="text-xs text-steel-600">{formatDate(e.work_date)}</span>}</div>
          {e.description && <p className="mt-1 text-sm">{e.description}</p>}
          {e.documents.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{e.documents.map((doc) => <DocumentLink key={doc.id} doc={doc} />)}</div>}</li>))}</ol>
      <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); act.mutate({ path: `/api/admin/refurb-reports/${open.report.id}/review`, body: { verification: f.verification, verified_by: f.verified_by || null, note: f.note || null } }); }}>
        <fieldset><legend className="label">Kennzeichnung im Inserat</legend>
          <label className="flex gap-3 py-1 text-sm"><input type="radio" className="mt-1 accent-navy" checked={f.verification === "seller_provided"} onChange={() => setF({ ...f, verification: "seller_provided" })} />Angaben des Verkäufers (Standard)</label>
          <label className="flex gap-3 py-1 text-sm"><input type="radio" className="mt-1 accent-navy" checked={f.verification === "independently_verified"} onChange={() => setF({ ...f, verification: "independently_verified" })} />Unabhängig geprüft – nur bei vorliegendem Gutachten eines Dritten</label></fieldset>
        {f.verification === "independently_verified" && <Field label="Geprüft durch" required hint="Name des Sachverständigen oder der Prüfstelle. Wird im Inserat angezeigt.">{(p) => <input {...p} required maxLength={160} className="input" value={f.verified_by} onChange={(e) => setF({ ...f, verified_by: e.target.value })} />}</Field>}
        <Field label="Interne Notiz">{(p) => <textarea {...p} rows={2} maxLength={1000} className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
        {act.isError && <Alert>{errorMessage(act.error)}</Alert>}
        <div className="flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setOpen(null)}>Abbrechen</button><button className="btn-primary" disabled={act.isPending}>Prüfung speichern</button></div>
      </form></Modal>)}
  </>)}</QueryView>);
}

interface AdminUser { id: number; email: string; display_name: string; roles: Role[]; is_active: boolean; is_demo: boolean; created_at: string; last_login_at: string | null; listing_count: number }
export function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<AdminUser | null>(null);
  const q = useAdmin<Paged<AdminUser>>(["users", search, page], "/api/admin/users", { q: search || undefined, page });
  const act = useAction(() => setModal(null));
  return (
    <div>
      <div className="mb-5 max-w-sm"><Field label="Suche">{(p) => <input {...p} type="search" className="input" placeholder="Name oder E-Mail-Adresse" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />}</Field></div>
      {act.isError && !modal && <div className="mb-4"><Alert>{errorMessage(act.error)}</Alert></div>}
      <QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Keine Konten gefunden" /> : (<>
        <TableWrap>
          <thead><tr><th scope="col">Konto</th><th scope="col">Rollen</th><th scope="col">Inserate</th><th scope="col">Registriert</th><th scope="col">Letzte Anmeldung</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Aktion</span></th></tr></thead>
          <tbody>{d.items.map((u) => (
            <tr key={u.id}><td><span className="font-semibold">{u.display_name}</span>{u.is_demo && <span className="ml-2 text-xs text-steel-600">Demo</span>}<div className="text-xs text-steel-600">{u.email}</div></td>
              <td>{u.roles.map((r) => label("role", r)).join(", ")}</td><td className="tabular-nums">{u.listing_count}</td><td>{formatDate(u.created_at)}</td><td>{u.last_login_at ? formatDateTime(u.last_login_at) : "–"}</td>
              <td>{u.is_active ? <span className="tag border-ok/40 text-ok">Aktiv</span> : <span className="tag border-danger/40 text-danger">Deaktiviert</span>}</td>
              <td className="text-right">{u.roles.includes("admin") ? <span className="text-xs text-steel-600">Administrator</span> : u.is_active ? <button className="btn-danger btn-sm" onClick={() => setModal(u)}>Deaktivieren</button>
                : <button className="btn-secondary btn-sm" disabled={act.isPending} onClick={() => act.mutate({ method: "patch", path: `/api/admin/users/${u.id}`, body: { is_active: true } })}>Aktivieren</button>}</td></tr>))}</tbody>
        </TableWrap>
        <Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}</QueryView>
      {modal && <ReasonModal pending={act.isPending} error={act.error} onClose={() => { setModal(null); act.reset(); }} title="Konto deaktivieren" confirm="Deaktivieren"
        text={`${modal.display_name} (${modal.email}) wird abgemeldet und kann sich nicht mehr anmelden. Aktive Inserate werden pausiert.`}
        onSubmit={(note) => act.mutate({ method: "patch", path: `/api/admin/users/${modal.id}`, body: { is_active: false, note: note || null } })} />}
    </div>
  );
}

interface AuditItem { id: number; action: string; target_type: string; target_id: number | null; details: string | null; admin: string; created_at: string }
export function AdminAudit() {
  const [page, setPage] = useState(1);
  const q = useAdmin<Paged<AuditItem>>(["audit", page], "/api/admin/audit-log", { page });
  return (<QueryView q={q}>{(d) => d.items.length === 0 ? <EmptyState title="Noch keine Einträge" text="Administrative Aktionen werden hier protokolliert." /> : (<>
    <TableWrap>
      <thead><tr><th scope="col">Zeitpunkt</th><th scope="col">Administrator</th><th scope="col">Aktion</th><th scope="col">Ziel</th><th scope="col">Details</th></tr></thead>
      <tbody>{d.items.map((a) => (<tr key={a.id}><td className="whitespace-nowrap">{formatDateTime(a.created_at)}</td><td>{a.admin}</td><td className="font-mono text-xs">{a.action}</td>
        <td className="whitespace-nowrap text-xs">{a.target_type} #{a.target_id}</td>
        <td className="max-w-md break-words text-xs text-steel-600">{a.details ? Object.entries(JSON.parse(a.details) as Record<string, unknown>).filter(([, v]) => v !== null).map(([k, v]) => `${k}: ${v}`).join(" · ") : "–"}</td></tr>))}</tbody>
    </TableWrap><Pagination page={d.page} pages={d.pages} onChange={setPage} /></>)}</QueryView>);
}
