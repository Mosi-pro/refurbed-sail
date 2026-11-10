# REFURBED SAIL

**Buy better. Sail further.** – Marktplatz für gebrauchte und professionell aufbereitete Segelboote.

Vollständige Webanwendung: React-Frontend, FastAPI-Backend, SQLite-Datenbank, Sitzungs-Authentifizierung,
Inserate mit Zustandsberichten, internes Nachrichtensystem, Händlerbereich und Administration.
Läuft direkt auf Debian 13 (oder Ubuntu 24.04) – ohne Docker, ohne externen Hosting-Dienst.

## Schnellstart

Voraussetzungen: `python3` (≥ 3.11, mit `python3-venv`), `node` (≥ 20) und `npm`, `curl`.

```bash
./start.sh
```

Beim ersten Start legt das Skript `.env` mit zufälligem `RS_SECRET_KEY` an, richtet die Python-Umgebung
(`.venv`) ein, installiert die npm-Pakete, führt die Datenbankmigrationen aus, baut das Frontend und startet
beide Dienste.

| | |
|---|---|
| Website | http://localhost:5173 |
| Health-Endpunkt | `GET /api/health` (http://localhost:5173/api/health oder http://127.0.0.1:8000/api/health) |
| Stoppen | `./stop.sh` |
| Entwicklungsmodus (Hot Reload) | `./start.sh dev` |
| Logs | `logs/backend.log`, `logs/frontend.log`, `logs/mail.log` |

### Administrator anlegen

Es gibt keine voreingestellten Zugangsdaten. Der erste Administrator wird über die Kommandozeile angelegt:

```bash
scripts/manage.sh create-admin
```

Das Kommando fragt E-Mail-Adresse und Passwort (mind. 12 Zeichen) interaktiv ab. Existiert das Konto bereits,
erhält es Administratorrechte. Für Automatisierung: `RS_ADMIN_PASSWORD=… scripts/manage.sh create-admin --email …`.
Über die Weboberfläche oder die API kann sich niemand selbst zum Administrator machen.

### Demodaten (optional)

```bash
scripts/manage.sh seed-demo
```

Legt 20 **fiktive** Inserate, vier Händler und Demo-Konten an und gibt das (zufällig erzeugte) gemeinsame
Passwort aus. Alle Demo-Inhalte sind in der Datenbank mit `is_demo` markiert und in der Oberfläche als
„Demo-Inserat“ gekennzeichnet; zusätzlich erscheint ein Hinweisbanner. Entfernen: `scripts/manage.sh purge-demo`.

Die Bilder der Demo-Inserate und die redaktionellen Bilder der Website werden lokal mit Pillow erzeugt
(`backend/app/services/demo_images.py`, `scripts/generate_site_images.py`) – es sind **Platzhalter, keine
Fotografien**. Für den Echtbetrieb die Dateien in `frontend/public/images/` (gleiche Dateinamen) durch
lizenzierte Fotos ersetzen. Echte Inserate verwenden immer die hochgeladenen Fotos der Verkäufer.

### Zugriff aus dem lokalen Netz

In `.env`:

```
FRONTEND_HOST=0.0.0.0
RS_PUBLIC_BASE_URL=http://<IP-des-Servers>:5173
```

Danach `./stop.sh && ./start.sh`. Die Website ist dann unter `http://<IP-des-Servers>:5173` erreichbar; das
Backend bleibt an `127.0.0.1` gebunden und wird nur über den Frontend-Server angesprochen.
Der eingebaute Server ist für das lokale Netz gedacht – **nicht ins Internet freigeben**. Für einen
öffentlichen Betrieb siehe „Produktion“.

## Daten, Uploads, Backup

| Was | Wo |
|---|---|
| Datenbank | `data/refurbed_sail.db` (SQLite, WAL-Modus) |
| Öffentliche Uploads (Bootsfotos, Logos, Avatare) | `uploads/public/` – ausgeliefert unter `/media/…` |
| Private Uploads (PDF-Dokumente, Belegfotos) | `uploads/private/` – nur über `/api/documents/{id}/file` mit Berechtigungsprüfung |
| Konfiguration | `.env` (siehe `.env.example`) |

```bash
scripts/backup.sh /pfad/zum/backup-ziel
```

erstellt ein konsistentes Archiv aus Datenbank (SQLite-Online-Backup, auch im laufenden Betrieb) und
`uploads/`. Zusätzlich `.env` separat und sicher aufbewahren (enthält `RS_SECRET_KEY`).
Wiederherstellen: Dienste stoppen, Archiv entpacken, `refurbed_sail.db` nach `data/` und `uploads/` an seinen
Platz kopieren, starten.

## Architektur

```
backend/
  app/
    api/         Router: auth, boats (öffentlich), listings (Verkäufer), account, messages, dealers, admin
    core/        Konfiguration, Datenbank, Sicherheit, Rate-Limiting, Abhängigkeiten
    models/      SQLAlchemy-Modelle (16 Tabellen + Sitzungen/Reset-Tokens)
    schemas/     Pydantic-Eingabeschemata
    services/    Upload-Verarbeitung, Inseratslogik, Serialisierung, Audit-Log, Demodaten
    cli.py       Verwaltungskommandos
    main.py      FastAPI-App, CSRF-/Security-Middleware, Health-Endpunkt
  alembic/       Migrationen
  tests/         pytest-Suite
frontend/
  src/
    components/  UI-Bausteine, Bootskarte, Galerie, Zustandsbericht, Nachrichten
    pages/       Seiten (Start, Marktplatz, Detail, Konto, Händler, Admin, Inseratsformular …)
    layouts/     Seitenrahmen (Header, Footer)
    hooks/       useAuth, useFavorites
    services/    API-Client
    i18n/        Sprachdateien
    types/
scripts/         manage.sh, backup.sh, generate_site_images.py
data/ uploads/ logs/
```

Frontend: React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query. Schriften (Manrope,
DM Serif Display) werden lokal ausgeliefert – keine Anfragen an Dritte.
Backend: Python 3, FastAPI, SQLAlchemy 2, Pydantic 2, Alembic, Uvicorn, Pillow, Argon2.

### Routen

`/` · `/boote` · `/boote/<slug>` · `/refurbished` · `/haendler` (Händlerbereich für Händler, sonst
Verzeichnis) · `/haendler/verzeichnis` · `/haendler/werden` · `/haendler/<slug>` · `/so-funktionierts` ·
`/anmelden` · `/registrieren` · `/passwort-vergessen` · `/konto/…` · `/merkliste` · `/inserat-erstellen` ·
`/admin/…` · `/ueber-uns` · `/kontakt` · `/hilfe` · `/impressum` · `/datenschutz` · `/agb`

API-Dokumentation im Entwicklungsmodus: http://127.0.0.1:8000/api/docs

### Sicherheit

- Passwörter: Argon2id. Sitzungen: zufällige Tokens, in der Datenbank nur als HMAC-Hash gespeichert;
  Cookie `HttpOnly`, `SameSite=Lax`, in Produktion `Secure`.
- CSRF: Double-Submit-Token (`X-CSRF-Token`) plus Origin-Prüfung für alle schreibenden API-Aufrufe.
- Autorisierung ausschließlich serverseitig (Rollen: Käufer, Privatverkäufer, Händler, Administrator).
  Rollen `admin` und Händler-Verifizierung sind über keine Nutzer-API setzbar.
- Rate-Limiting für Anmeldung, Registrierung, Passwort-Reset, Nachrichten, Meldungen und Uploads
  (im Arbeitsspeicher, pro Prozess).
- Uploads: Größenlimits, Typprüfung anhand des Dateiinhalts, Bilder werden neu kodiert (entfernt EXIF/GPS),
  Vorschaubilder werden erzeugt, PDFs anhand der Signatur geprüft. Private Dateien liegen außerhalb des
  statisch ausgelieferten Verzeichnisses.
- Zustandsberichte gelten immer als „Angaben des Verkäufers“. „Unabhängig geprüft“ kann nur ein
  Administrator setzen (mit Angabe der prüfenden Stelle); jede Änderung durch den Verkäufer setzt die
  Kennzeichnung zurück.
- Administrative Aktionen werden im Audit-Log protokolliert (`/admin/protokoll`).

### Inserats-Freigabe

Mit `RS_LISTING_APPROVAL_REQUIRED=true` (Standard) gehen neue Inserate in den Status „In Prüfung“ und werden
erst nach Freigabe durch einen Administrator sichtbar.

### Passwort-Reset

Die Architektur ist vollständig (Token, Ablauf, Einmalverwendung, Sitzungs-Widerruf). Ein E-Mail-Versand ist
noch nicht angebunden: Der Reset-Link wird in `logs/mail.log` geschrieben. Für den Echtbetrieb in
`backend/app/api/auth.py` (`password_reset_request`) einen SMTP-Versand ergänzen.

### PostgreSQL

Der Datenzugriff läuft vollständig über SQLAlchemy/Alembic. Für PostgreSQL `psycopg` installieren und
`RS_DATABASE_URL=postgresql+psycopg://user:pass@host/db` setzen, dann `alembic upgrade head`.

### Lokalisierung

Die API liefert nur Codes (z. B. `refurbished`, `work_completed`). Alle Enum-Bezeichnungen, Navigation und
gemeinsame Texte liegen in `frontend/src/i18n/de.ts`; Zahlen, Preise und Daten werden über `Intl` mit der
aktiven Locale formatiert. Für Englisch: `en.ts` mit demselben Typ `Messages` anlegen und in
`i18n/index.ts` registrieren. Redaktionelle Fließtexte einzelner Seiten stehen derzeit noch direkt in den
Seitenkomponenten und müssen für eine zweite Sprache in die Sprachdateien ausgelagert werden.

## Tests

```bash
.venv/bin/pip install -r backend/requirements-dev.txt
cd backend && ../.venv/bin/python -m pytest
cd frontend && npm run typecheck
```

## Produktion

Die mitgelieferten Skripte starten Uvicorn und `vite preview` – geeignet für Rechner und lokales Netz.
Für einen öffentlichen Betrieb zusätzlich:

1. `RS_ENV=production`, `RS_SECRET_KEY` gesetzt, `RS_PUBLIC_BASE_URL=https://ihre-domain`.
2. Reverse Proxy mit TLS (z. B. nginx oder Caddy) vor der Anwendung; `frontend/dist` statisch ausliefern,
   `/api` und `/media` an Uvicorn (127.0.0.1:8000) weiterleiten.
3. Dienste über systemd betreiben, regelmäßige Backups einrichten.
4. Impressum, Datenschutzerklärung und AGB eintragen (`frontend/src/pages/Static.tsx`) – die Seiten enthalten
   bewusst keine erfundenen Unternehmensangaben. Kontaktadresse und Instagram-Profil über
   `VITE_CONTACT_EMAIL` / `VITE_INSTAGRAM_URL` (Datei `frontend/.env`) setzen.
5. E-Mail-Versand anbinden (Passwort-Reset).

## Bekannte Einschränkungen

- Platzhalterbilder statt Fotografien für Demo-Inserate und redaktionelle Flächen (siehe oben).
- Kein E-Mail-Versand (Reset-Link im Log); keine E-Mail-Verifizierung bei der Registrierung.
- Nachrichten werden per Polling aktualisiert (5–30 Sekunden), nicht in Echtzeit.
- Rate-Limits liegen im Arbeitsspeicher eines Prozesses (bei mehreren Workern z. B. Redis verwenden).
- Suche per SQL-`LIKE`; keine Umkreissuche, keine Volltext-Engine.
- Bootsfotos sind unter nicht erratbaren Dateinamen öffentlich abrufbar, auch bei Entwürfen; Dokumente dagegen
  sind zugriffsgeschützt.
- Keine Zahlungsabwicklung; der Kauf findet zwischen Käufer und Verkäufer statt.
