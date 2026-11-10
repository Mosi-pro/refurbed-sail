import { useMutation, useQuery } from "@tanstack/react-query";
import { BadgeCheck, CalendarDays, ChevronRight, Flag, Info, MapPin, MessageSquare, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { BoatGrid, FavoriteButton } from "../components/BoatCard";
import { Gallery } from "../components/Gallery";
import { DocumentLink, ReportView } from "../components/ReportView";
import { ConditionTag, DemoTag, RefurbTag, StatusBadge, VerificationBadge } from "../components/badges";
import { Alert, Avatar, ErrorState, Field, LoadingState, Modal } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { label, t } from "../i18n";
import { boatLocation, boatTitle, formatMeters, formatMonthYear, formatNumber, formatPrice } from "../lib/format";
import { api, errorMessage } from "../services/api";
import type { BoatDetail as Boat, EquipmentKind, MessageKind } from "../types";

const CONTACT: { kind: MessageKind; label: string; icon: typeof Info; template: (title: string) => string }[] = [
  { kind: "message", label: "Nachricht schreiben", icon: MessageSquare, template: () => "" },
  { kind: "viewing_request", label: "Besichtigung anfragen", icon: CalendarDays,
    template: (x) => `Guten Tag,\n\nich interessiere mich für die ${x} und würde das Boot gern besichtigen. Wann wäre ein Termin möglich?\n\nViele Grüße` },
  { kind: "info_request", label: "Weitere Informationen anfordern", icon: Info,
    template: (x) => `Guten Tag,\n\nkönnen Sie mir weitere Informationen und Unterlagen zur ${x} zusenden?\n\nViele Grüße` },
];

function ContactModal({ boat, kind, onClose }: { boat: Boat; kind: MessageKind; onClose: () => void }) {
  const conf = CONTACT.find((c) => c.kind === kind)!;
  const [body, setBody] = useState(conf.template(boatTitle(boat)));
  const navigate = useNavigate();
  const send = useMutation({
    mutationFn: () => api.post<{ id: number }>("/api/conversations", { boat_id: boat.id, kind, body }),
    onSuccess: (r) => navigate(`/konto/nachrichten/${r.id}`),
  });
  return (
    <Modal title={conf.label} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-4">
        <p className="text-sm text-steel-600">An <strong className="text-navy">{boat.seller.name}</strong> · {boatTitle(boat)} ({boat.reference}). Deine E-Mail-Adresse wird nicht weitergegeben.</p>
        <Field label="Deine Nachricht" required>{(p) => <textarea {...p} required minLength={2} maxLength={4000} rows={7} className="input" value={body} onChange={(e) => setBody(e.target.value)} />}</Field>
        {send.isError && <Alert>{errorMessage(send.error)}</Alert>}
        <div className="flex justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn-primary" disabled={send.isPending || body.trim().length < 2}>Nachricht senden</button>
        </div>
      </form>
    </Modal>
  );
}

function ReportListingModal({ boat, onClose }: { boat: Boat; onClose: () => void }) {
  const [reason, setReason] = useState("wrong_information");
  const [details, setDetails] = useState("");
  const send = useMutation({ mutationFn: () => api.post(`/api/boats/${boat.id}/report`, { reason, details: details || null }) });
  return (
    <Modal title="Inserat melden" onClose={onClose}>
      {send.isSuccess ? (
        <div className="space-y-4"><Alert kind="success">Danke für deinen Hinweis. Unser Team prüft das Inserat.</Alert><button className="btn-primary" onClick={onClose}>Schließen</button></div>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); send.mutate(); }} className="space-y-4">
          <Field label="Grund">{(p) => (
            <select {...p} className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              {Object.entries(t.reportReason).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>)}</Field>
          <Field label="Beschreibung" hint="Was ist dir aufgefallen?">{(p) => <textarea {...p} rows={4} maxLength={2000} className="input" value={details} onChange={(e) => setDetails(e.target.value)} />}</Field>
          {send.isError && <Alert>{errorMessage(send.error)}</Alert>}
          <div className="flex justify-end gap-3">
            <button type="button" className="btn-secondary" onClick={onClose}>{t.common.cancel}</button>
            <button className="btn-primary" disabled={send.isPending}>Meldung senden</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

export default function BoatDetail() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [contact, setContact] = useState<MessageKind | null>(null);
  const [reporting, setReporting] = useState(false);
  const q = useQuery({ queryKey: ["boat", slug], queryFn: () => api.get<Boat>(`/api/boats/${slug}`), retry: false });

  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <div className="container-page py-20"><ErrorState error={q.error} onRetry={() => q.refetch()} /><p className="mt-6 text-center"><Link className="link" to="/boote">Zurück zur Übersicht</Link></p></div>;
  const boat = q.data!;
  const title = boatTitle(boat);
  const s = boat.spec;
  const openContact = (kind: MessageKind) => {
    if (!user) navigate(`/anmelden?next=${encodeURIComponent(loc.pathname)}`);
    else setContact(kind);
  };
  const specs: [string, string | null][] = [
    ["Hersteller", boat.manufacturer], ["Modell", boat.model], ["Baujahr", boat.year ? String(boat.year) : null],
    [t.spec.length_m, s.length_m != null ? formatMeters(s.length_m) : null], [t.spec.beam_m, s.beam_m != null ? formatMeters(s.beam_m) : null],
    [t.spec.draft_m, s.draft_m != null ? formatMeters(s.draft_m) : null],
    [t.spec.displacement_kg, s.displacement_kg != null ? `${formatNumber(s.displacement_kg)} kg` : null],
    [t.spec.hull_material, s.hull_material], [t.spec.sail_area_m2, s.sail_area_m2 != null ? `${formatNumber(s.sail_area_m2, 1)} m²` : null],
    [t.spec.mast_height_m, s.mast_height_m != null ? formatMeters(s.mast_height_m) : null],
    [t.spec.berths, s.berths != null ? String(s.berths) : null], [t.spec.engine, s.engine], [t.spec.trailer, s.trailer],
  ];
  const equipment = (Object.keys(t.equipment) as EquipmentKind[]).filter((k) => boat.equipment[k]);
  const dealer = boat.seller.dealer;

  return (
    <article>
      <div className="border-b border-line bg-white">
        <nav aria-label="Brotkrumen" className="container-page flex items-center gap-1.5 py-3.5 text-[0.8rem] text-steel-600">
          <Link to="/boote" className="hover:text-navy">Boote</Link><ChevronRight className="h-3 w-3" aria-hidden="true" />
          {boat.category && <><Link to={`/boote?category=${boat.category}`} className="hover:text-navy">{t.categoryPlural[boat.category]}</Link><ChevronRight className="h-3 w-3" aria-hidden="true" /></>}
          <span className="truncate text-navy" aria-current="page">{title}</span>
        </nav>
      </div>

      {boat.status !== "active" && (
        <div className="container-page pt-6"><Alert kind="info">
          <span className="mr-2"><StatusBadge status={boat.status} /></span>
          Dieses Inserat ist nicht öffentlich sichtbar. Du siehst eine Vorschau.
        </Alert></div>
      )}

      <div className="container-page grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        <div className="min-w-0">
          <div className="mb-5 lg:hidden" aria-hidden="true">
            <p className="eyebrow">{label("category", boat.category)} · {boat.year}</p>
            <p className="display mt-1 text-3xl">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-navy">{formatPrice(boat.price_eur)}</p>
          </div>
          <Gallery images={boat.images} title={title} />

          <section className="mt-12" aria-labelledby="desc-h">
            <h2 id="desc-h" className="display text-3xl">Beschreibung</h2>
            <p className="mt-5 max-w-3xl whitespace-pre-line text-[1.02rem] leading-relaxed text-ink/90">{boat.description || "Für dieses Boot liegt keine Beschreibung vor."}</p>
          </section>

          <section className="mt-14" aria-labelledby="spec-h">
            <h2 id="spec-h" className="display text-3xl">Technische Daten</h2>
            <dl className="mt-6 grid border-t border-navy/15 sm:grid-cols-2 sm:gap-x-12">
              {specs.filter(([, v]) => v).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-6 border-b border-line py-3 text-[0.95rem]">
                  <dt className="text-steel-600">{k}</dt><dd className="text-right font-medium text-navy">{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          {equipment.length > 0 && (
            <section className="mt-14" aria-labelledby="eq-h">
              <h2 id="eq-h" className="display text-3xl">Segel und Ausstattung</h2>
              <dl className="mt-6 border-t border-navy/15">
                {equipment.map((k) => (
                  <div key={k} className="grid gap-1 border-b border-line py-3.5 text-[0.95rem] sm:grid-cols-[200px_1fr] sm:gap-8">
                    <dt className="font-medium text-navy">{t.equipment[k]}</dt><dd className="whitespace-pre-line text-ink/85">{boat.equipment[k]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>

        {/* Summary column */}
        <aside className="lg:sticky lg:top-[96px] lg:self-start">
          <div className="border border-line bg-white p-7">
            <div className="flex flex-wrap gap-1.5"><ConditionTag boat={boat} /><RefurbTag boat={boat} />{boat.is_demo && <DemoTag />}</div>
            <p className="eyebrow mt-5">{label("category", boat.category)} · {boat.year}</p>
            <h1 className="display mt-2 text-[2.1rem]">{title}</h1>
            <p className="mt-5 text-3xl font-semibold tracking-tight text-navy">
              {formatPrice(boat.price_eur)}{boat.price_negotiable && <span className="ml-2 text-sm font-medium text-steel-600">Verhandlungsbasis</span>}
            </p>
            <dl className="mt-6 space-y-2.5 border-t border-line pt-5 text-sm">
              <div className="flex justify-between gap-4"><dt className="flex items-center gap-2 text-steel-600"><MapPin className="h-4 w-4" aria-hidden="true" />Standort</dt><dd className="text-right font-medium">{boatLocation(boat) || "–"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-steel-600">Länge</dt><dd className="font-medium">{formatMeters(s.length_m)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-steel-600">Zustand</dt><dd className="font-medium">{label("condition", boat.condition)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-steel-600">Verkäufer</dt><dd className="font-medium">{label("sellerType", boat.seller_type)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-steel-600">Inserats-Nr.</dt><dd className="font-mono text-[0.85rem] font-medium">{boat.reference}</dd></div>
            </dl>
            {boat.is_owner ? (
              <Link to={`/inserat-erstellen/${boat.id}`} className="btn-primary mt-6 w-full"><Pencil className="h-4 w-4" aria-hidden="true" />Inserat bearbeiten</Link>
            ) : boat.status === "active" ? (
              <div className="mt-6 space-y-2.5">
                {CONTACT.map((c, i) => (
                  <button key={c.kind} onClick={() => openContact(c.kind)} className={`${i === 0 ? "btn-primary" : "btn-secondary"} w-full`}>
                    <c.icon className="h-4 w-4" aria-hidden="true" />{c.label}
                  </button>
                ))}
                <FavoriteButton boatId={boat.id} withLabel className="btn w-full border-transparent text-navy hover:bg-sand" />
              </div>
            ) : null}
          </div>

          <section className="mt-5 border border-line bg-white p-7" aria-labelledby="seller-h">
            <h2 id="seller-h" className="eyebrow">Verkäufer</h2>
            <div className="mt-4 flex items-center gap-4">
              <Avatar src={boat.seller.image_url} name={boat.seller.name} size={56} square={!!dealer} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-navy">{boat.seller.name}</p>
                <p className="text-sm text-steel-600">{label("sellerType", boat.seller.type)}{boat.seller.location ? ` · ${boat.seller.location}` : ""}</p>
              </div>
            </div>
            <div className="mt-4">
              {dealer ? <VerificationBadge status={dealer.verification_status} /> : <span className="tag border-navy/20 bg-white text-steel-600">Privatverkauf · nicht verifiziert</span>}
            </div>
            <p className="mt-4 text-sm text-steel-600">
              Mitglied seit {formatMonthYear(boat.seller.member_since)} · {boat.seller.listing_count} {boat.seller.listing_count === 1 ? "aktives Inserat" : "aktive Inserate"}
            </p>
            {dealer && <Link to={`/haendler/${dealer.slug}`} className="link mt-4 inline-block text-sm">Händlerprofil ansehen</Link>}
          </section>

          {boat.status === "active" && !boat.is_owner && (
            <button onClick={() => setReporting(true)} className="mt-4 inline-flex items-center gap-2 text-[0.8rem] text-steel-600 hover:text-navy">
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />Inserat melden
            </button>
          )}
        </aside>
      </div>

      {/* Condition report */}
      <section className="mt-20 border-y border-line bg-white py-16 md:py-20" aria-labelledby="report-h">
        <div className="container-page">
          <div className="max-w-3xl">
            <p className="eyebrow mb-3">Zustandsbericht</p>
            <h2 id="report-h" className="display text-4xl md:text-5xl">Der Zustand. Transparent dokumentiert.</h2>
          </div>
          <div className="mt-10 max-w-5xl">
            {boat.report && boat.report.entries.length > 0 ? (
              <ReportView report={boat.report} sellerName={boat.seller.name} />
            ) : (
              <div className="border-l-2 border-navy/30 bg-sand px-5 py-4 text-sm">
                <p className="font-semibold text-navy">Für dieses Boot liegt kein Zustandsbericht vor.</p>
                <p className="mt-1 text-ink/80">Der Verkäufer hat keine Prüfungen oder Arbeiten dokumentiert. Frage gezielt nach Wartungsnachweisen und vereinbare eine Besichtigung.</p>
              </div>
            )}
            {boat.documents.length > 0 && (
              <div className="mt-10">
                <h3 className="text-[1.05rem] font-semibold">Dokumente zum Boot</h3>
                <p className="mt-1 text-sm text-steel-600">Vom Verkäufer bereitgestellt.</p>
                <div className="mt-4 flex flex-wrap gap-2">{boat.documents.map((d) => <DocumentLink key={d.id} doc={d} />)}</div>
              </div>
            )}
          </div>
        </div>
      </section>

      {boat.seller.other_listings && boat.seller.other_listings.length > 0 && (
        <section className="container-page pt-16" aria-labelledby="other-h">
          <div className="mb-8 flex items-end justify-between gap-4">
            <h2 id="other-h" className="display text-3xl">Weitere Boote von {boat.seller.name}</h2>
            {dealer && <Link to={`/haendler/${dealer.slug}`} className="link hidden text-sm sm:inline">Gesamten Bestand ansehen</Link>}
          </div>
          <BoatGrid boats={boat.seller.other_listings} />
        </section>
      )}

      {boat.seller.type === "verified_dealer" && (
        <p className="container-page mt-10 flex items-start gap-2 text-xs text-steel-600">
          <BadgeCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brass-700" aria-hidden="true" />
          „Verifizierter Händler“ bedeutet: REFURBED SAIL hat die Unternehmensdaten des Händlers geprüft. Es ist keine Aussage über den Zustand einzelner Boote.
        </p>
      )}

      {contact && <ContactModal boat={boat} kind={contact} onClose={() => setContact(null)} />}
      {reporting && <ReportListingModal boat={boat} onClose={() => setReporting(false)} />}
    </article>
  );
}
