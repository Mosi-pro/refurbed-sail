import { useQuery } from "@tanstack/react-query";
import { Globe, Mail, MapPin, Phone } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { BoatGrid } from "../components/BoatCard";
import { DemoTag, VerificationBadge } from "../components/badges";
import { Avatar, EmptyState, ErrorState, LoadingState, PageHeader } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import { formatMonthYear } from "../lib/format";
import { api } from "../services/api";
import type { Dealer } from "../types";

export function DealerDirectory() {
  const q = useQuery({ queryKey: ["dealers"], queryFn: () => api.get<{ items: Dealer[] }>("/api/dealers") });
  const { hasRole } = useAuth();
  return (
    <>
      <PageHeader eyebrow="Händler und Werften" title="Händlerverzeichnis"
        text="Händler, Werften und Refurbishment-Betriebe auf REFURBED SAIL. Der Verifizierungsstatus wird von unserem Team vergeben – nicht automatisch bei der Registrierung.">
        {hasRole("dealer") ? <Link to="/haendler" className="btn-secondary">Zum Händlerbereich</Link> : <Link to="/haendler/werden" className="btn-primary">Händler werden</Link>}
      </PageHeader>
      <div className="container-page py-12">
        {q.isLoading ? <LoadingState /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data!.items.length === 0 ? (
          <EmptyState title="Noch keine Händler" text="Sobald sich die ersten Händler registriert haben, erscheinen sie hier." action={<Link className="btn-primary" to="/haendler/werden">Händler werden</Link>} />
        ) : (
          <ul className="grid gap-6 md:grid-cols-2">
            {q.data!.items.map((d) => (
              <li key={d.id} className="group relative flex gap-6 border border-line bg-white p-7 transition-colors hover:border-navy/30">
                <Avatar src={d.logo_url} name={d.company_name} size={84} square />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5"><VerificationBadge status={d.verification_status} />{d.is_demo && <DemoTag />}</div>
                  <h2 className="mt-3 text-xl font-semibold"><Link to={`/haendler/${d.slug}`} className="after:absolute after:inset-0">{d.company_name}</Link></h2>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-steel-600"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{d.city || "Standort nicht angegeben"} · {d.listing_count} {d.listing_count === 1 ? "Boot" : "Boote"}</p>
                  {d.description && <p className="mt-3 line-clamp-2 text-sm text-ink/80">{d.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

export function DealerPublic() {
  const { slug } = useParams();
  const q = useQuery({ queryKey: ["dealer", slug], queryFn: () => api.get<Dealer>(`/api/dealers/${slug}`), retry: false });
  if (q.isLoading) return <LoadingState />;
  if (q.isError) return <div className="container-page py-20"><ErrorState error={q.error} /><p className="mt-6 text-center"><Link className="link" to="/haendler/verzeichnis">Zum Händlerverzeichnis</Link></p></div>;
  const d = q.data!;
  const address = [d.street, [d.postal_code, d.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return (
    <>
      <div className="border-b border-line bg-white">
        <div className="container-page grid gap-10 py-12 lg:grid-cols-[1fr_340px] lg:py-16">
          <div className="flex flex-col gap-7 sm:flex-row">
            <Avatar src={d.logo_url} name={d.company_name} size={120} square />
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5"><VerificationBadge status={d.verification_status} />{d.is_demo && <DemoTag />}</div>
              <h1 className="display mt-4 text-4xl md:text-5xl">{d.company_name}</h1>
              <p className="mt-3 text-sm text-steel-600">{d.city ? `${d.city} · ` : ""}Auf REFURBED SAIL seit {formatMonthYear(d.member_since)}</p>
              {d.description && <p className="mt-6 max-w-2xl whitespace-pre-line text-ink/90">{d.description}</p>}
            </div>
          </div>
          <aside className="border border-line bg-sand p-6 text-sm lg:self-start" aria-label="Kontakt">
            <h2 className="eyebrow mb-4">Kontakt</h2>
            <ul className="space-y-3">
              {address && <li className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" />{address}</li>}
              {d.phone && <li className="flex gap-3"><Phone className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" />{d.phone}</li>}
              {d.contact_email && <li className="flex gap-3"><Mail className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" /><a className="break-all hover:underline" href={`mailto:${d.contact_email}`}>{d.contact_email}</a></li>}
              {d.website && <li className="flex gap-3"><Globe className="mt-0.5 h-4 w-4 shrink-0 text-steel-600" aria-hidden="true" /><a className="break-all hover:underline" href={d.website} target="_blank" rel="noopener noreferrer nofollow">{d.website.replace(/^https?:\/\//, "")}</a></li>}
              {!address && !d.phone && !d.contact_email && !d.website && <li className="text-steel-600">Dieser Händler hat keine öffentlichen Kontaktdaten hinterlegt. Kontaktiere ihn über ein Inserat.</li>}
            </ul>
          </aside>
        </div>
      </div>
      <section className="container-page py-14" aria-labelledby="inv-h">
        <h2 id="inv-h" className="display mb-8 text-3xl">Aktueller Bestand <span className="font-sans text-base font-medium text-steel-600">({d.boats!.length})</span></h2>
        {d.boats!.length ? <BoatGrid boats={d.boats!} /> : <EmptyState title="Derzeit keine Boote im Bestand" text="Dieser Händler hat aktuell keine aktiven Inserate." />}
      </section>
    </>
  );
}

export function BecomeDealer() {
  const { user, hasRole } = useAuth();
  const steps = [
    ["Registrieren", "Konto als Händler anlegen und Firmennamen angeben. Das dauert zwei Minuten."],
    ["Profil vervollständigen", "Logo, Beschreibung, Standort und Kontaktdaten – Ihr öffentliches Händlerprofil."],
    ["Verifizierung", "Unser Team prüft Ihre Unternehmensdaten und vergibt den Status. Bis dahin gelten Sie als „nicht verifiziert“."],
    ["Boote einstellen", "Bestand anlegen, Zustandsberichte und Dokumente hinterlegen, Anfragen beantworten."],
  ];
  return (
    <>
      <section className="on-dark relative bg-navy text-white">
        <img src="/images/dealer.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="container-page relative py-24 md:py-32">
          <p className="eyebrow !text-white/70">Für Händler und Werften</p>
          <h1 className="mt-4 max-w-3xl font-serif text-5xl leading-[1.05] text-white md:text-6xl">Gute Arbeit verdient einen Ort, an dem man sie sieht.</h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">REFURBED SAIL ist der Marktplatz für Betriebe, die Segelboote sorgfältig aufbereiten – und das belegen können.</p>
          <div className="mt-9">
            {hasRole("dealer") ? <Link to="/haendler" className="btn-light px-7">Zum Händlerbereich</Link>
              : user ? <Link to="/konto/profil" className="btn-light px-7">Händlerkonto aktivieren</Link>
              : <Link to="/registrieren?typ=haendler" className="btn-light px-7">Als Händler registrieren</Link>}
          </div>
        </div>
      </section>
      <section className="container-page grid gap-12 py-20 lg:grid-cols-3">
        {[["Sichtbar für die richtigen Käufer", "Wer hier sucht, sucht ein Segelboot – und achtet auf Zustand und Dokumentation statt nur auf den niedrigsten Preis."],
          ["Dokumentation als Verkaufsargument", "Zustandsberichte je Baugruppe, Rechnungen und Fotos machen Ihre Arbeit nachvollziehbar und rechtfertigen Ihren Preis."],
          ["Ein Werkzeug für den Alltag", "Bestand, Entwürfe, Anfragen, Dokumente und Statistiken in einem aufgeräumten Händlerbereich."]].map(([h, p]) => (
          <div key={h} className="border-t border-navy/20 pt-6"><h2 className="font-serif text-2xl">{h}</h2><p className="mt-3 text-steel-600">{p}</p></div>
        ))}
      </section>
      <section className="border-y border-line bg-white py-20">
        <div className="container-page">
          <h2 className="display text-4xl">In vier Schritten zum Händlerprofil</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {steps.map(([h, p], i) => (
              <li key={h}><span className="font-serif text-4xl text-brass-700">{String(i + 1).padStart(2, "0")}</span><h3 className="mt-3 text-lg font-semibold">{h}</h3><p className="mt-2 text-sm text-steel-600">{p}</p></li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
