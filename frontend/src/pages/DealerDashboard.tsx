import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useOutletContext } from "react-router-dom";
import { ListingsTable } from "../components/ListingsTable";
import { Messages } from "../components/Messages";
import { DocumentLink } from "../components/ReportView";
import { StatusBadge, VerificationBadge } from "../components/badges";
import { Alert, Avatar, EmptyState, ErrorState, Field, LoadingState } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { label } from "../i18n";
import { formatDate } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatCard, BoatStatus, Dealer, DocumentOut, RefurbStatus } from "../types";

interface Dashboard {
  totals: { by_status: Record<string, number>; views: number; favorites: number; inquiries: number; unread_messages: number };
  listings: BoatCard[];
  reports: { boat_id: number; boat_title: string; reference: string; status: BoatStatus; refurb_status: RefurbStatus; entry_count: number; verification: string; updated_at: string }[];
  documents: DocumentOut[];
}
const useDash = () => useOutletContext<Dashboard>();

export function DealerLayout() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["dealer-dashboard"], queryFn: () => api.get<Dashboard>("/api/dealer/dashboard") });
  const d = user!.dealer!;
  const tabs = [["/haendler", "Übersicht"], ["/haendler/inserate", "Inserate"], ["/haendler/anfragen", "Anfragen"], ["/haendler/berichte", "Zustandsberichte"], ["/haendler/dokumente", "Dokumente"], ["/haendler/profil", "Händlerprofil"]];
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="container-page pt-10">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex items-center gap-5">
              <Avatar src={d.logo_url} name={d.company_name} size={64} square />
              <div><p className="eyebrow">Händlerbereich</p><h1 className="display mt-1 text-4xl">{d.company_name}</h1><div className="mt-2"><VerificationBadge status={d.verification_status} /></div></div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={`/haendler/${d.slug}`} className="btn-secondary btn-sm">Öffentliches Profil</Link>
              <Link to="/haendler/verzeichnis" className="btn-secondary btn-sm">Händlerverzeichnis</Link>
              <Link to="/inserat-erstellen" className="btn-primary btn-sm">Neues Inserat</Link>
            </div>
          </div>
          <nav aria-label="Händlerbereich" className="-mb-px mt-8 flex gap-7 overflow-x-auto">
            {tabs.map(([to, text]) => (
              <NavLink key={to} to={to} end={to === "/haendler"} className={({ isActive }) => `whitespace-nowrap border-b-2 pb-3 text-sm font-semibold ${isActive ? "border-navy text-navy" : "border-transparent text-steel-600 hover:text-navy"}`}>
                {text}{to.endsWith("anfragen") && q.data?.totals.unread_messages ? ` (${q.data.totals.unread_messages})` : ""}
              </NavLink>))}
          </nav>
        </div>
      </div>
      <div className="container-page py-10">
        {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Outlet context={q.data} />}
      </div>
    </>
  );
}

export function DealerOverview() {
  const { totals, listings } = useDash();
  const { user } = useAuth();
  const s = totals.by_status;
  const stats: [string, number, string][] = [
    ["Aktive Inserate", s.active ?? 0, `${s.draft ?? 0} Entwürfe · ${s.pending ?? 0} in Prüfung · ${s.archived ?? 0} archiviert`],
    ["Aufrufe gesamt", totals.views, "Alle Inserate"], ["Auf Merklisten", totals.favorites, "Gemerkte Boote"],
    ["Anfragen", totals.inquiries, `${totals.unread_messages} ungelesene Nachrichten`],
  ];
  const top = [...listings].filter((b) => b.status === "active").sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0)).slice(0, 8);
  return (
    <div className="space-y-10">
      {user!.dealer!.verification_status === "unverified" && (
        <Alert kind="info"><strong>Ihr Händlerkonto ist noch nicht verifiziert.</strong> Vervollständigen Sie Ihr <Link className="link" to="/haendler/profil">Händlerprofil</Link> – unser Team prüft die Angaben und vergibt den Verifizierungsstatus. Inserieren können Sie bereits jetzt.</Alert>
      )}
      <dl className="grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([k, v, sub]) => (
          <div key={k} className="border-b border-r border-line bg-white p-6"><dt className="eyebrow">{k}</dt><dd className="mt-3 font-serif text-4xl text-navy">{v.toLocaleString("de-DE")}</dd><dd className="mt-1 text-xs text-steel-600">{sub}</dd></div>))}
      </dl>
      <section aria-labelledby="stat-h">
        <h2 id="stat-h" className="mb-4 text-xl font-semibold">Inseratsstatistik</h2>
        {top.length === 0 ? <EmptyState title="Noch keine aktiven Inserate" text="Sobald Inserate online sind, sehen Sie hier Aufrufe, Merklisten und Anfragen je Boot." action={<Link to="/inserat-erstellen" className="btn-primary">Boot inserieren</Link>} /> : (
          <div className="overflow-x-auto border border-line bg-white">
            <table className="table-base min-w-[640px]">
              <thead><tr><th scope="col">Boot</th><th scope="col">Online seit</th><th scope="col" className="text-right">Aufrufe</th><th scope="col" className="text-right">Gemerkt</th><th scope="col" className="text-right">Anfragen</th></tr></thead>
              <tbody>{top.map((b) => (
                <tr key={b.id}><td><Link className="font-semibold hover:underline" to={`/boote/${b.slug}`}>{b.manufacturer} {b.model}</Link><span className="ml-2 font-mono text-xs text-steel-600">{b.reference}</span></td>
                  <td>{formatDate(b.published_at)}</td><td className="text-right tabular-nums">{b.view_count}</td><td className="text-right tabular-nums">{b.favorites}</td><td className="text-right tabular-nums">{b.inquiries}</td></tr>))}</tbody>
            </table>
          </div>)}
      </section>
    </div>
  );
}

export function DealerListings() {
  const { listings } = useDash();
  const groups: [string, BoatStatus[]][] = [["Aktive Inserate", ["active", "paused"]], ["In Prüfung und abgelehnt", ["pending", "rejected"]], ["Entwürfe", ["draft"]], ["Archiv", ["archived"]]];
  if (listings.length === 0) return <EmptyState title="Noch kein Bestand" text="Legen Sie Ihr erstes Inserat an." action={<Link to="/inserat-erstellen" className="btn-primary">Boot inserieren</Link>} />;
  return (
    <div className="space-y-12">
      {groups.map(([title, st]) => {
        const items = listings.filter((b) => st.includes(b.status));
        return (<section key={title}><h2 className="mb-4 text-xl font-semibold">{title} <span className="text-base font-normal text-steel-600">({items.length})</span></h2>
          {items.length ? <ListingsTable boats={items} /> : <p className="border-t border-line pt-4 text-sm text-steel-600">Keine Inserate in diesem Bereich.</p>}</section>);
      })}
    </div>
  );
}

export function DealerInquiries() { return <Messages basePath="/haendler/anfragen" role="seller" />; }

export function DealerReports() {
  const { reports } = useDash();
  if (reports.length === 0) return <EmptyState title="Noch keine Zustandsberichte" text="Zustandsberichte legen Sie im Inserat unter „Zustand“ und „Zustandsbericht“ an." />;
  return (
    <div className="overflow-x-auto border border-line bg-white">
      <table className="table-base min-w-[720px]">
        <thead><tr><th scope="col">Boot</th><th scope="col">Inserat</th><th scope="col">Kennzeichnung</th><th scope="col">Einträge</th><th scope="col">Herkunft</th><th scope="col">Geändert</th><th scope="col"><span className="sr-only">Aktion</span></th></tr></thead>
        <tbody>{reports.map((r) => (
          <tr key={r.boat_id}><td className="font-semibold">{r.boat_title}<div className="font-mono text-xs font-normal text-steel-600">{r.reference}</div></td>
            <td><StatusBadge status={r.status} /></td><td>{label("refurbStatus", r.refurb_status)}</td><td className="tabular-nums">{r.entry_count}</td>
            <td>{r.verification === "independently_verified" ? "Unabhängig geprüft" : "Verkäuferangabe"}</td><td>{formatDate(r.updated_at)}</td>
            <td className="text-right"><Link className="btn-secondary btn-sm" to={`/inserat-erstellen/${r.boat_id}?schritt=7`}>Bearbeiten</Link></td></tr>))}</tbody>
      </table>
    </div>
  );
}

export function DealerDocuments() {
  const { documents } = useDash();
  if (documents.length === 0) return <EmptyState title="Noch keine Dokumente" text="Rechnungen, Gutachten und Fotos laden Sie im Inserat unter „Zustandsbericht“ hoch." />;
  const byBoat = new Map<number, DocumentOut[]>();
  documents.forEach((d) => byBoat.set(d.boat_id!, [...(byBoat.get(d.boat_id!) ?? []), d]));
  return (
    <div className="space-y-8">
      {[...byBoat.entries()].map(([boatId, docs]) => (
        <section key={boatId} className="border border-line bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{docs[0].boat_title}</h2><Link className="btn-secondary btn-sm" to={`/inserat-erstellen/${boatId}?schritt=7`}>Dokumente verwalten</Link></div>
          <div className="mt-4 flex flex-wrap gap-2">{docs.map((d) => <DocumentLink key={d.id} doc={d} />)}</div>
        </section>))}
    </div>
  );
}

export function DealerProfile() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dealer-profile"], queryFn: () => api.get<Dealer>("/api/dealer/profile") });
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { if (q.data) setF(Object.fromEntries(["company_name", "description", "contact_email", "phone", "website", "street", "postal_code", "city"].map((k) => [k, (q.data as unknown as Record<string, string | null>)[k] ?? ""]))); }, [q.data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["me"] }); qc.invalidateQueries({ queryKey: ["dealer-profile"] }); qc.invalidateQueries({ queryKey: ["dealers"] }); };
  const save = useMutation({ mutationFn: () => api.put("/api/dealer/profile", f), onSuccess: refresh });
  const logo = useMutation({ mutationFn: (file: File) => { const fd = new FormData(); fd.append("file", file); return api.upload("/api/dealer/logo", fd); }, onSuccess: refresh });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const inp = (k: string, props: object = {}) => (p: object) => <input {...p} {...props} className="input" value={f[k] ?? ""} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_360px]">
      <form className="max-w-2xl space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <h2 className="text-xl font-semibold">Händlerprofil</h2>
        <div className="flex items-center gap-5">
          <Avatar src={d.logo_url} name={d.company_name} size={96} square />
          <div><input type="file" id="logo-file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && logo.mutate(e.target.files[0])} />
            <label htmlFor="logo-file" className="btn-secondary btn-sm cursor-pointer">{logo.isPending ? "Wird hochgeladen …" : "Firmenlogo ändern"}</label>
            <p className="mt-1.5 text-xs text-steel-600">Quadratisch, JPEG, PNG oder WebP, max. 10 MB</p></div>
        </div>
        {logo.isError && <Alert>{errorMessage(logo.error)}</Alert>}
        <Field label="Firmenname" required>{inp("company_name", { required: true, minLength: 2, maxLength: 120 })}</Field>
        <Field label="Unternehmensbeschreibung" hint="Schwerpunkte, Leistungen, Geschichte.">{(p) => <textarea {...p} rows={6} maxLength={5000} className="input" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />}</Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Öffentliche E-Mail-Adresse" hint="Wird im Händlerprofil angezeigt.">{inp("contact_email", { type: "email" })}</Field>
          <Field label="Telefon">{inp("phone", { type: "tel", maxLength: 40 })}</Field>
          <Field label="Website">{inp("website", { maxLength: 255, placeholder: "https://" })}</Field>
          <Field label="Straße und Hausnummer">{inp("street", { maxLength: 120 })}</Field>
          <Field label="Postleitzahl">{inp("postal_code", { maxLength: 12 })}</Field>
          <Field label="Ort">{inp("city", { maxLength: 80 })}</Field>
        </div>
        {save.isError && <Alert>{errorMessage(save.error)}</Alert>}
        {save.isSuccess && <Alert kind="success">Das Händlerprofil wurde gespeichert.</Alert>}
        <button className="btn-primary" disabled={save.isPending}>Profil speichern</button>
      </form>
      <aside className="border border-line bg-white p-6 lg:self-start">
        <h2 className="eyebrow">Verifizierung</h2>
        <div className="mt-3"><VerificationBadge status={d.verification_status} /></div>
        <p className="mt-4 text-sm text-steel-600">Der Verifizierungsstatus wird ausschließlich vom REFURBED SAIL Team vergeben und kann hier nicht geändert werden.</p>
        {d.verification_history && d.verification_history.length > 0 && (
          <ol className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
            {d.verification_history.map((h, i) => (<li key={i}><span className="font-medium">{label("dealerVerification", h.status)}</span><span className="block text-xs text-steel-600">{formatDate(h.created_at)}{h.note ? ` · ${h.note}` : ""}</span></li>))}
          </ol>)}
      </aside>
    </div>
  );
}
