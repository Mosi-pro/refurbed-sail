import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ClipboardCheck, FileText, MessageSquare, Sailboat } from "lucide-react";
import { Link } from "react-router-dom";
import { BoatCardSkeleton, BoatGrid } from "../components/BoatCard";
import { HeroSearch } from "../components/HeroSearch";
import { EmptyState, ErrorState } from "../components/ui";
import { t } from "../i18n";
import { api } from "../services/api";
import type { BoatCard, Category, Facets, Paged } from "../types";

const CATEGORIES: Category[] = ["jolle", "sportboot", "kielboot", "daysailer", "segelyacht", "regattaboot"];

function ArrowLink({ to, children, light }: { to: string; children: string; light?: boolean }) {
  return (
    <Link to={to} className={`group inline-flex items-center gap-2 text-sm font-semibold ${light ? "text-white" : "text-navy"}`}>
      <span className="border-b border-brass pb-0.5">{children}</span>
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
    </Link>
  );
}

export default function Home() {
  const featured = useQuery({ queryKey: ["boats", "featured"], queryFn: () => api.get<Paged<BoatCard>>("/api/boats", { page_size: 6 }) });
  const facets = useQuery({ queryKey: ["facets"], queryFn: () => api.get<Facets>("/api/boats/facets"), staleTime: 60_000 });

  return (
    <>
      {/* Hero */}
      <section className="relative bg-navy">
        <img src="/images/hero.jpg" alt="Segelyacht unter Vollzeug vor der Küste" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/75 via-navy/35 to-transparent" aria-hidden="true" />
        <div className="on-dark container-page relative flex min-h-[560px] flex-col justify-center pb-40 pt-20 md:min-h-[680px] lg:pb-36">
          <p className="eyebrow !text-white/75">Der Marktplatz für Segelboote</p>
          <h1 className="mt-5 max-w-3xl font-serif text-[2.7rem] leading-[1.04] text-white sm:text-6xl lg:text-[4.6rem]">
            Dein nächstes Segelboot.<br />Ein besserer Anfang.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/85">
            Entdecke gebrauchte und professionell aufbereitete Segelboote von ausgewählten Verkäufern.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link to="/boote" className="btn-light px-7">Boote entdecken</Link>
            <Link to="/inserat-erstellen" className="btn-outline-light px-7">Boot anbieten</Link>
          </div>
        </div>
      </section>
      <div className="container-page relative z-10 -mt-24 lg:-mt-[38px]"><HeroSearch /></div>

      {/* Featured */}
      <section className="container-page pt-20 md:pt-28" aria-labelledby="featured-h">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-3">Neu auf dem Marktplatz</p>
            <h2 id="featured-h" className="display text-4xl md:text-5xl">Aktuelle Boote</h2>
          </div>
          <ArrowLink to="/boote">{`Alle ${facets.data?.total ?? ""} Boote ansehen`.replace("  ", " ")}</ArrowLink>
        </div>
        {featured.isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <BoatCardSkeleton key={i} />)}</div>
        ) : featured.isError ? (
          <ErrorState error={featured.error} onRetry={() => featured.refetch()} />
        ) : featured.data!.items.length === 0 ? (
          <EmptyState title="Noch keine Boote inseriert" text="Sobald die ersten Inserate freigegeben sind, erscheinen sie hier."
            action={<Link to="/inserat-erstellen" className="btn-primary">Erstes Boot inserieren</Link>} />
        ) : (
          <BoatGrid boats={featured.data!.items} />
        )}
      </section>

      {/* Refurbished editorial */}
      <section className="mt-24 bg-white md:mt-32" aria-labelledby="refurb-h">
        <div className="container-page grid items-stretch gap-0 lg:grid-cols-2">
          <div className="relative -mx-5 min-h-[360px] sm:-mx-8 lg:mx-0 lg:-ml-12 lg:min-h-[640px]">
            <img src="/images/refurbished.jpg" alt="Aufbereitete Segelyacht auf dem Wasser" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center py-14 lg:py-24 lg:pl-20">
            <p className="eyebrow mb-4">Refurbished</p>
            <h2 id="refurb-h" className="display text-4xl md:text-[3.2rem]">Ein gebrauchtes Boot.<br />Mit neuem Anspruch.</h2>
            <p className="mt-6 max-w-lg text-[1.05rem] text-ink/85">
              Bei einem gebrauchten Boot entscheidet der Zustand – und der lässt sich auf Fotos selten erkennen. Auf REFURBED SAIL
              dokumentieren Verkäufer Prüfungen und Arbeiten Bauteil für Bauteil: Rumpf, Rigg, Segel, Motor.
            </p>
            <dl className="mt-9 divide-y divide-line border-y border-line">
              {[
                ["Zustandsbericht je Baugruppe", "Was wurde geprüft, was erneuert, was repariert – und wann."],
                ["Belege statt Behauptungen", "Rechnungen, Messprotokolle und Fotos direkt im Inserat."],
                ["Klare Kennzeichnung", "Verkäuferangaben und unabhängig geprüfte Angaben sind immer getrennt ausgewiesen."],
              ].map(([k, v]) => (
                <div key={k} className="grid gap-1 py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
                  <dt className="text-sm font-semibold text-navy">{k}</dt><dd className="text-sm text-steel-600">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-9"><ArrowLink to="/refurbished">Aufbereitete Boote ansehen</ArrowLink></div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container-page pt-24 md:pt-32" aria-labelledby="cat-h">
        <div className="mb-10 max-w-2xl">
          <p className="eyebrow mb-3">Bootstypen</p>
          <h2 id="cat-h" className="display text-4xl md:text-5xl">Von der Jolle bis zur Fahrtenyacht</h2>
        </div>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 lg:gap-5">
          {CATEGORIES.map((c) => (
            <li key={c}>
              <Link to={`/boote?category=${c}`} className="group relative block aspect-[4/5] overflow-hidden bg-navy">
                <img src={`/images/cat-${c}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-navy/80 via-navy/5 to-transparent" aria-hidden="true" />
                <span className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white">
                  <span className="font-serif text-[1.35rem] leading-tight">{t.categoryPlural[c]}</span>
                  {facets.data && <span className="text-xs text-white/75">{facets.data.categories[c]}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Trust */}
      <section className="container-page pt-24 md:pt-32" aria-labelledby="trust-h">
        <div className="grid gap-10 border-t border-navy/15 pt-12 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="eyebrow mb-3">Warum REFURBED SAIL</p>
            <h2 id="trust-h" className="display text-4xl">Besser entscheiden.</h2>
          </div>
          <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
            {[
              [ClipboardCheck, "Transparente Zustandsangaben", "Zustand, Baujahr, Ausstattung und bekannte Mängel stehen strukturiert im Inserat – nicht versteckt im Fließtext."],
              [FileText, "Dokumentierte Aufbereitung", "Arbeiten werden je Baugruppe mit Datum, Beschreibung und Belegen festgehalten. Du siehst, was gemacht wurde."],
              [MessageSquare, "Direkter Kontakt zum Verkäufer", "Fragen, Besichtigung, weitere Unterlagen: alles über das interne Nachrichtensystem, ohne deine E-Mail-Adresse preiszugeben."],
              [Sailboat, "Spezialisiert auf Segelboote", "Keine Motorboote, keine Wohnmobile. Filter und Datenfelder sind für Segler gemacht – von der Segelfläche bis zum Tiefgang."],
            ].map(([Icon, title, text]) => {
              const I = Icon as typeof Sailboat;
              return (
                <div key={title as string}>
                  <I className="h-6 w-6 text-brass-700" strokeWidth={1.5} aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold">{title as string}</h3>
                  <p className="mt-2 text-[0.95rem] text-steel-600">{text as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dealers */}
      <section className="container-page pt-24 md:pt-32" aria-labelledby="dealer-h">
        <div className="on-dark grid overflow-hidden bg-navy text-white lg:grid-cols-[1.1fr_1fr]">
          <div className="px-7 py-14 sm:px-12 lg:px-16 lg:py-20">
            <p className="eyebrow !text-white/60">Für Profis</p>
            <h2 id="dealer-h" className="mt-4 font-serif text-4xl leading-tight text-white md:text-5xl">Für Händler und Werften.</h2>
            <p className="mt-6 max-w-md text-white/80">
              Zeigen Sie, was in Ihren Booten steckt. Mit Händlerprofil, Bestandsverwaltung und dokumentierten Zustandsberichten
              erreichen Sie Käufer, die Qualität suchen – und bereit sind, dafür zu bezahlen.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-white/85">
              {["Eigenes Händlerprofil mit Logo, Beschreibung und Bestand", "Zustandsberichte und Dokumente zentral verwalten",
                "Anfragen und Besichtigungstermine an einem Ort", "Verifizierung durch das REFURBED SAIL Team"].map((x) => (
                <li key={x} className="flex gap-3"><span className="mt-[0.6em] h-px w-5 shrink-0 bg-brass" aria-hidden="true" />{x}</li>
              ))}
            </ul>
            <Link to="/haendler/werden" className="btn-light mt-10 px-7">Händler werden</Link>
          </div>
          <div className="relative min-h-[280px]">
            <img src="/images/dealer.jpg" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
        </div>
      </section>
    </>
  );
}
