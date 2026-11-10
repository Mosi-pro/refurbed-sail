import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui";
import { site } from "../config/site";

function Prose({ children }: { children: ReactNode }) {
  return <div className="container-page py-14"><div className="max-w-3xl space-y-5 text-[1.02rem] leading-relaxed text-ink/90 [&_h2]:mt-10 [&_h2]:font-serif [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc">{children}</div></div>;
}

function OperatorNotice({ what }: { what: string }) {
  return (
    <div className="border-l-2 border-brass bg-white px-5 py-4 text-sm">
      <p className="font-semibold text-navy">Vom Betreiber zu ergänzen</p>
      <p className="mt-1 text-ink/80">{what} Diese Seite enthält bewusst keine erfundenen Unternehmensangaben. Vor einem öffentlichen Betrieb müssen die rechtlich erforderlichen Inhalte durch den Betreiber eingetragen und rechtlich geprüft werden.</p>
    </div>
  );
}

export function HowItWorks() {
  const buyer = [
    ["Suchen und vergleichen", "Filtere nach Bootstyp, Preis, Baujahr, Länge und Standort. Jede Suche lässt sich als Link teilen."],
    ["Zustand verstehen", "Lies den Zustandsbericht: Welche Baugruppen wurden geprüft, erneuert oder repariert? Wo gibt es bekannte Mängel?"],
    ["Verkäufer kontaktieren", "Stelle Fragen, fordere Unterlagen an oder vereinbare eine Besichtigung – direkt über das Nachrichtensystem."],
    ["Besichtigen und entscheiden", "Der Kauf findet zwischen dir und dem Verkäufer statt. Besichtige das Boot immer persönlich."],
  ];
  const seller = [
    ["Inserat anlegen", "In neun übersichtlichen Schritten: Daten, Fotos, Ausstattung, Zustand, Preis. Entwürfe werden gespeichert."],
    ["Zustand dokumentieren", "Optional für Privatverkäufer, empfohlen für alle: Ein Zustandsbericht mit Belegen schafft Vertrauen."],
    ["Freigabe", "Unser Team prüft jedes neue Inserat, bevor es veröffentlicht wird."],
    ["Anfragen beantworten", "Alle Nachrichten laufen in deinem Konto zusammen – übersichtlich je Inserat."],
  ];
  const list = (items: string[][]) => (
    <ol className="mt-8 border-t border-navy/15">
      {items.map(([h, p], i) => (
        <li key={h} className="grid grid-cols-[56px_1fr] gap-4 border-b border-line py-6">
          <span className="font-serif text-3xl text-brass-700">{String(i + 1).padStart(2, "0")}</span>
          <div><h3 className="text-lg font-semibold">{h}</h3><p className="mt-1 text-steel-600">{p}</p></div>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      <PageHeader eyebrow="So funktioniert's" title="Vom ersten Blick bis zum ersten Schlag." text="REFURBED SAIL bringt Käufer und Verkäufer von Segelbooten zusammen – mit strukturierten Angaben statt vager Versprechen." />
      <div className="container-page grid gap-16 py-16 lg:grid-cols-2">
        <section aria-labelledby="buy-h"><p className="eyebrow mb-2">Für Käufer</p><h2 id="buy-h" className="display text-3xl">Ein Boot finden</h2>{list(buyer)}<Link to="/boote" className="btn-primary mt-8">Boote entdecken</Link></section>
        <section aria-labelledby="sell-h"><p className="eyebrow mb-2">Für Verkäufer</p><h2 id="sell-h" className="display text-3xl">Ein Boot anbieten</h2>{list(seller)}<Link to="/inserat-erstellen" className="btn-primary mt-8">Boot inserieren</Link></section>
      </div>
      <section className="border-y border-line bg-white py-16">
        <div className="container-page max-w-4xl">
          <h2 className="display text-3xl">Was die Kennzeichnungen bedeuten</h2>
          <dl className="mt-8 grid gap-x-12 gap-y-6 sm:grid-cols-2">
            {[["Gebraucht", "Ein gebrauchtes Boot ohne besondere Aufbereitung."],
              ["Refurbished", "Das Boot wurde vor dem Verkauf aufbereitet. Ein Zustandsbericht ist Pflicht."],
              ["Restauriert", "Das Boot wurde umfassend restauriert. Ein Zustandsbericht ist Pflicht."],
              ["Angaben des Verkäufers", "Der Zustandsbericht stammt vom Verkäufer und wurde nicht unabhängig geprüft. Das ist der Normalfall."],
              ["Unabhängig geprüft", "Nur wenn ein Dritter den Bericht geprüft hat und unser Team dies bestätigt, wird ein Bericht so gekennzeichnet."],
              ["Verifizierter Händler", "Die Unternehmensdaten des Händlers wurden durch unser Team geprüft. Keine Aussage über einzelne Boote."]].map(([k, v]) => (
              <div key={k}><dt className="font-semibold text-navy">{k}</dt><dd className="mt-1 text-sm text-steel-600">{v}</dd></div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}

export function About() {
  return (<><PageHeader eyebrow="Über uns" title="Buy better. Sail further." />
    <Prose>
      <p>Ein gutes Segelboot hält Jahrzehnte. Rümpfe aus den Achtzigern segeln heute so sicher wie damals – wenn sie gepflegt wurden. Genau das ist beim Gebrauchtkauf die schwierige Frage: Wie steht es wirklich um Rumpf, Rigg und Maschine?</p>
      <p>REFURBED SAIL ist ein spezialisierter Marktplatz für gebrauchte und aufbereitete Segelboote. Wir geben Verkäufern die Werkzeuge, den Zustand ihres Bootes nachvollziehbar zu dokumentieren, und Käufern die Möglichkeit, Angebote ehrlich zu vergleichen.</p>
      <h2>Wofür wir stehen</h2>
      <ul><li>Segelboote – von der Jolle bis zur Fahrtenyacht. Keine Motorboote.</li><li>Strukturierte Zustandsberichte statt Werbeversprechen.</li><li>Eine klare Trennung zwischen Verkäuferangaben und unabhängig geprüften Angaben.</li><li>Länger nutzen statt neu bauen: Jedes Boot, das weitersegelt, ist ein gutes Boot.</li></ul>
    </Prose></>);
}

export function Contact() {
  return (<><PageHeader eyebrow="Kontakt" title="Wir sind für dich da." />
    <Prose>
      <h2 className="!mt-0">Fragen zu einem Boot</h2>
      <p>Wende dich direkt an den Verkäufer: Auf jeder Inseratsseite findest du die Schaltflächen „Nachricht schreiben“, „Besichtigung anfragen“ und „Weitere Informationen anfordern“.</p>
      <h2>Ein Inserat melden</h2>
      <p>Wenn dir ein Inserat verdächtig oder fehlerhaft erscheint, nutze die Funktion „Inserat melden“ auf der Inseratsseite. Unser Team prüft jede Meldung.</p>
      <h2>Fragen zur Plattform</h2>
      {site.contactEmail ? <p>Schreib uns an <a className="link" href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.</p>
        : <OperatorNotice what="Hier erscheint die Kontaktadresse des Betreibers (Konfiguration über VITE_CONTACT_EMAIL)." />}
      <p>Antworten auf häufige Fragen findest du in der <Link className="link" to="/hilfe">Hilfe</Link>.</p>
    </Prose></>);
}

export function Help() {
  const faq = [
    ["Was kostet ein Inserat?", "In dieser Version ist das Inserieren kostenlos. Es findet keine Zahlungsabwicklung über die Plattform statt."],
    ["Warum ist mein Inserat noch nicht sichtbar?", "Neue Inserate werden vor der Veröffentlichung von unserem Team geprüft. Den Status siehst du unter „Meine Inserate“."],
    ["Muss ich als Privatverkäufer einen Zustandsbericht anlegen?", "Nein. Für ein gewöhnliches Gebrauchtboot ist der Bericht freiwillig. Nur wenn du dein Boot als „Refurbished“ oder „Restauriert“ anbietest, ist ein Bericht erforderlich."],
    ["Wer prüft die Zustandsberichte?", "Zustandsberichte sind Angaben des Verkäufers und werden so gekennzeichnet. Nur wenn ein unabhängiger Dritter geprüft hat und unser Team das bestätigt, erscheint der Hinweis „Unabhängig geprüft“."],
    ["Sieht der Verkäufer meine E-Mail-Adresse?", "Nein. Die Kommunikation läuft über das interne Nachrichtensystem. Deine E-Mail-Adresse wird nicht weitergegeben."],
    ["Wie werde ich verifizierter Händler?", "Registriere dich als Händler und vervollständige dein Profil. Die Verifizierung vergibt ausschließlich unser Team nach Prüfung der Unternehmensdaten."],
    ["Welche Dateien kann ich hochladen?", "Fotos als JPEG, PNG oder WebP (bis 10 MB), Dokumente als PDF (bis 15 MB). Standortdaten in Fotos werden beim Hochladen entfernt."],
    ["Wie lösche ich mein Inserat?", "Unter „Meine Inserate“ kannst du Inserate pausieren, archivieren oder endgültig löschen."],
  ];
  return (<><PageHeader eyebrow="Hilfe" title="Häufige Fragen" />
    <div className="container-page py-14"><div className="max-w-3xl border-t border-navy/15">
      {faq.map(([q, a]) => (
        <details key={q} className="group border-b border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.05rem] font-semibold text-navy">{q}<span className="text-xl font-normal text-brass-700 group-open:rotate-45 transition-transform" aria-hidden="true">+</span></summary>
          <p className="pb-6 pr-10 text-steel-600">{a}</p>
        </details>
      ))}
    </div></div></>);
}

export function Imprint() {
  return (<><PageHeader eyebrow="Rechtliches" title="Impressum" /><Prose>
    <OperatorNotice what="Hier stehen die Anbieterkennzeichnung nach § 5 DDG (Name, Anschrift, Kontakt, Vertretungsberechtigte, Registerangaben, USt-IdNr.)." />
  </Prose></>);
}

export function Privacy() {
  return (<><PageHeader eyebrow="Rechtliches" title="Datenschutz" /><Prose>
    <OperatorNotice what="Hier steht die Datenschutzerklärung des Verantwortlichen nach Art. 13 DSGVO." />
    <h2>Technische Fakten zu dieser Anwendung</h2>
    <p>Die folgenden Punkte beschreiben, wie die Software arbeitet, und können als Grundlage für die Datenschutzerklärung dienen:</p>
    <ul>
      <li>Es werden ausschließlich technisch notwendige Cookies gesetzt: ein Sitzungs-Cookie für die Anmeldung und ein Cookie zum Schutz vor Cross-Site-Request-Forgery.</li>
      <li>Es sind keine Analyse-, Werbe- oder Tracking-Dienste eingebunden. Schriften werden lokal ausgeliefert.</li>
      <li>Passwörter werden ausschließlich als Argon2-Hash gespeichert.</li>
      <li>E-Mail-Adressen von Nutzern werden anderen Nutzern nicht angezeigt.</li>
      <li>Metadaten (z. B. GPS-Positionen) werden beim Hochladen aus Fotos entfernt.</li>
    </ul>
  </Prose></>);
}

export function Terms() {
  return (<><PageHeader eyebrow="Rechtliches" title="Allgemeine Geschäftsbedingungen" /><Prose>
    <OperatorNotice what="Hier stehen die Nutzungsbedingungen des Betreibers." />
    <h2>Grundsätze der Plattform</h2>
    <ul>
      <li>REFURBED SAIL vermittelt den Kontakt zwischen Käufern und Verkäufern. Kaufverträge kommen ausschließlich zwischen diesen zustande.</li>
      <li>Verkäufer sind für die Richtigkeit ihrer Angaben und Zustandsberichte verantwortlich.</li>
      <li>Inserate werden vor Veröffentlichung geprüft und können bei Verstößen entfernt werden.</li>
    </ul>
  </Prose></>);
}

export function NotFound() {
  return (
    <div className="container-page py-28 text-center">
      <p className="eyebrow">Fehler 404</p>
      <h1 className="display mt-4 text-5xl">Hier ist nur offenes Wasser.</h1>
      <p className="mx-auto mt-4 max-w-md text-steel-600">Die Seite wurde nicht gefunden. Vielleicht wurde das Inserat entfernt oder der Link ist nicht mehr aktuell.</p>
      <div className="mt-8 flex justify-center gap-3"><Link className="btn-primary" to="/boote">Boote entdecken</Link><Link className="btn-secondary" to="/">Zur Startseite</Link></div>
    </div>
  );
}
