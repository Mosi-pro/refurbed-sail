"""Fictional demo content. Everything created here is flagged is_demo=True and
is labelled as "Demo-Inserat" in the user interface."""
import io
import random
import shutil
from datetime import date, timedelta

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.security import hash_password
from ..models import (Boat, BoatImage, BoatSpecification, Conversation, DealerProfile, Document, Equipment, Favorite,
                      ListingReport, Message, RefurbishmentEntry, RefurbishmentReport, User, UserRole,
                      VerificationRecord, utcnow)
from . import storage
from .boats import build_slug, new_reference, slugify
from .demo_images import listing_images, render_scene

DOMAIN = "demo.refurbed-sail.example.com"

DEALERS = [
    ("nordlicht", "Nordlicht Yachtservice", "Kiel", "24159", "verified",
     "Familiengeführter Yachtservice an der Kieler Förde. Wir bereiten gebrauchte Fahrtenyachten in eigener Halle auf – von der Osmosebehandlung bis zum neuen stehenden Gut – und dokumentieren jeden Arbeitsschritt."),
    ("alsterblick", "Werft Alsterblick", "Hamburg", "22299", "refurb_documented",
     "Kleine Werft mit Schwerpunkt auf klassischen Kielbooten und Regattaklassen. Restaurierungen in Holz und GFK, Riggservice und Winterlager. Zu jedem Boot gibt es ein vollständiges Arbeitsprotokoll."),
    ("bodensee", "Bodensee Bootskontor", "Konstanz", "78462", "business_checked",
     "Handel mit Daysailern, Sportbooten und Jollen am Bodensee. Probeschläge nach Vereinbarung direkt ab unserem Steg."),
    ("mueritz", "Segelwerk Müritz", "Waren (Müritz)", "17192", "unverified",
     "Gebrauchtboote und Zubehör für das Binnenrevier. Wir vermitteln trailerbare Boote für Einsteiger und Vereine."),
]
PRIVATE = [("jonas", "Jonas W.", "Flensburg"), ("katrin", "Katrin L.", "Berlin"), ("brandt", "Familie Brandt", "Lübeck")]

# seller, category, manufacturer, model, year, price, city, region, condition, refurb_status,
# (length, beam, draft, displacement, hull, sail area, mast, berths, engine, trailer), description
BOATS = [
    ("nordlicht", "segelyacht", "Dehler", "34", 1988, 38500, "Kiel", "Schleswig-Holstein", "refurbished", "work_completed",
     (10.20, 3.40, 1.75, 4200, "GFK", 56.0, 14.6, 6, "Yanmar 2GM20, 18 PS, 2019 überholt", None),
     "Sportlicher Fahrtenklassiker von van de Stadt. Im Winter 2023/24 in unserer Halle umfassend aufbereitet: Unterwasserschiff neu aufgebaut, stehendes Gut ersetzt, Polster neu bezogen. Segelfertig und mit vollständigem Arbeitsprotokoll."),
    ("nordlicht", "segelyacht", "Hallberg-Rassy", "29", 1985, 42900, "Flensburg", "Schleswig-Holstein", "restored", "work_completed",
     (8.90, 2.83, 1.60, 3800, "GFK", 41.0, 12.4, 5, "Volvo Penta D1-20, 19 PS, eingebaut 2017", None),
     "Solide schwedische Fahrtenyacht aus zweiter Hand. Teakdeck saniert, Mahagoni-Ausbau aufgearbeitet und neu lackiert, Elektrik vollständig erneuert. Ein Boot für lange Sommer in der Dänischen Südsee."),
    ("nordlicht", "segelyacht", "Bavaria", "32 Cruiser", 2011, 64900, "Heiligenhafen", "Schleswig-Holstein", "used", "inspection_documented",
     (9.99, 3.42, 1.50, 5200, "GFK", 51.0, 14.2, 6, "Volvo Penta D1-20, 19 PS, 820 Betriebsstunden", None),
     "Gepflegte Eigneryacht mit Zweikabinen-Layout, nie verchartert. Rumpf, Rigg und Maschine wurden vor dem Verkauf in unserer Werkstatt durchgesehen; das Protokoll liegt dem Inserat bei."),
    ("nordlicht", "daysailer", "Tofinou", "8", 2007, 54500, "Kiel", "Schleswig-Holstein", "refurbished", "work_completed",
     (8.00, 2.48, 1.80, 1500, "GFK, Teakdeck", 40.0, 11.8, 2, "Yanmar 1GM10, 9 PS", None),
     "Eleganter Daysailer mit Schwenkkiel. Lackierung des Rumpfs in Dunkelblau erneuert, Teakdeck geschliffen und neu verfugt, laufendes Gut ersetzt."),
    ("alsterblick", "regattaboot", "J/Boats", "J/70", 2015, 31500, "Hamburg", "Hamburg", "refurbished", "work_completed",
     (6.93, 2.25, 1.45, 795, "GFK", 45.0, 9.6, 0, None, "Straßentrailer, TÜV neu"),
     "Regattaklar vorbereitetes Sportboot: Unterwasserschiff gespachtelt und geschliffen, Kiel profiliert, Beschläge überholt. Mit Regattasegeln aus der Saison 2023 und Straßentrailer."),
    ("alsterblick", "kielboot", "Nordisches Folkeboot", "GFK", 1974, 14800, "Hamburg", "Hamburg", "restored", "work_completed",
     (7.64, 2.20, 1.20, 1930, "GFK, Holzaufbau", 24.0, 10.0, 2, "Außenborder 4 PS", None),
     "Liebevoll restauriertes Folkeboot. Holzaufbau abgezogen und zehnfach lackiert, Mast überholt, Persenning neu. Ein ehrlicher Klassiker für Alster und Elbe."),
    ("alsterblick", "regattaboot", "Drachen", "Petticrow", 1992, 22500, "Hamburg", "Hamburg", "used", "documentation_available",
     (8.90, 1.95, 1.20, 1700, "GFK", 27.7, 10.5, 0, None, "Straßentrailer"),
     "Regattadrachen aus Vereinsbesitz mit vollständiger Bootsakte. Rechnungen und Wartungsnachweise der letzten zehn Jahre sind als Dokumente hinterlegt."),
    ("bodensee", "daysailer", "Saffier", "Se 26", 2014, 58000, "Konstanz", "Baden-Württemberg", "used", "inspection_documented",
     (7.90, 2.30, 1.35, 1450, "GFK", 34.0, 10.9, 2, "Elektro-Saildrive 4 kW", None),
     "Niederländischer Daysailer in sehr gepflegtem Zustand, ausschließlich im Süßwasser gesegelt. Selbstwendefock, Elektroantrieb mit Bodensee-Zulassung."),
    ("bodensee", "jolle", "ILCA", "7 (Laser Standard)", 2018, 4200, "Konstanz", "Baden-Württemberg", "used", "none",
     (4.23, 1.39, 0.80, 59, "GFK", 7.06, 6.1, 0, None, "Slipwagen"),
     "Einhandjolle aus Vereinsbestand, regelmäßig gewartet. Rumpf steif und dicht, ein Trainingssegel und ein Regattasegel."),
    ("bodensee", "katamaran", "Hobie", "Cat 16", 2012, 5900, "Radolfzell", "Baden-Württemberg", "refurbished", "documentation_available",
     (5.05, 2.41, 0.25, 145, "GFK", 20.3, 8.1, 0, None, "Straßentrailer mit Mastauflage"),
     "Der Strandkat schlechthin. Trampolin und Trapezdrähte erneuert, Rümpfe poliert. Rechnungen der Arbeiten liegen bei."),
    ("bodensee", "sportboot", "Esse", "850", 2009, 49000, "Friedrichshafen", "Baden-Württemberg", "used", "none",
     (8.50, 2.20, 1.60, 1280, "GFK/Sandwich", 46.0, 12.2, 0, "Elektro-Außenborder", "Straßentrailer"),
     "Schnelles Schweizer Sportboot für den See. Carbonmast, Gennaker, Bodenseezulassung. Verkauf im Kundenauftrag."),
    ("mueritz", "kielboot", "Dehler", "Varianta 18", 2010, 7900, "Waren (Müritz)", "Mecklenburg-Vorpommern", "used", "none",
     (5.50, 2.20, 1.10, 550, "GFK", 18.0, 8.2, 2, "Außenborder 2,3 PS", "Hafentrailer"),
     "Unkompliziertes Einsteigerboot mit kleiner Schlupfkajüte. Ideal für Müritz und Bodden."),
    ("mueritz", "katamaran", "Topcat", "K1", 2015, 7500, "Röbel", "Mecklenburg-Vorpommern", "used", "none",
     (5.50, 2.50, 0.20, 160, "GFK", 22.0, 8.5, 0, None, "Slipwagen"),
     "Sportlicher Zweihand-Katamaran mit Gennaker. Trampolin in gutem Zustand, Rümpfe ohne Reparaturen."),
    ("mueritz", "regattaboot", "X-Yachts", "X-79", 1984, 11500, "Waren (Müritz)", "Mecklenburg-Vorpommern", "used", "none",
     (7.96, 2.88, 1.35, 1400, "GFK", 34.0, 10.6, 4, "Außenborder 5 PS", "Straßentrailer"),
     "Schneller Däne mit aktiver Klassenszene. Regattagarderobe vorhanden, Unterwasserschiff 2022 neu."),
    ("jonas", "sportboot", "Melges", "24", 2006, 19900, "Flensburg", "Schleswig-Holstein", "used", "documentation_available",
     (7.32, 2.50, 1.52, 809, "GFK", 35.0, 9.6, 0, None, "Straßentrailer"),
     "Privatverkauf wegen Klassenwechsel. Das Boot wurde immer trocken gelagert. Rechnungen für Kielarbeiten und neues Rigg (2021) habe ich als Dokumente angehängt."),
    ("katrin", "jolle", "RS Sailing", "RS Aero 7", 2019, 6400, "Berlin", "Berlin", "used", "none",
     (4.00, 1.40, 0.90, 30, "Epoxy-Sandwich", 7.4, 5.6, 0, None, "Slipwagen und Trailer-Aufsatz"),
     "Sehr leichte Einhandjolle, wenig gesegelt und immer unter Persenning gelagert. Abholung am Wannsee."),
    ("katrin", "jolle", "Mader", "470er", 2008, 3900, "Berlin", "Berlin", "used", "none",
     (4.70, 1.69, 1.05, 120, "GFK", 12.7, 6.8, 0, None, "Slipwagen"),
     "Zweimannjolle für ambitioniertes Vereinssegeln. Zwei Satz Segel, Spinnaker, Unter- und Oberpersenning."),
    ("brandt", "segelyacht", "Hanse", "315", 2017, 89000, "Lübeck", "Schleswig-Holstein", "used", "none",
     (9.62, 3.35, 1.85, 4700, "GFK", 47.0, 14.4, 6, "Volvo Penta D1-13, 12 PS, 310 Betriebsstunden", None),
     "Unsere Familienyacht aus erster Hand, jährlich vom Fachbetrieb gewartet. Selbstwendefock, Bugstrahlruder, Sprayhood und Kuchenbude. Liegeplatz in Travemünde kann nach Absprache übernommen werden."),
    ("brandt", "kielboot", "H-Boot", "Artekno", 1983, 9800, "Lübeck", "Schleswig-Holstein", "restored", "work_completed",
     (8.28, 2.18, 1.30, 1450, "GFK", 25.0, 10.3, 4, "Außenborder 4 PS", None),
     "Über drei Winter in Eigenleistung restauriert und jeden Schritt fotografiert: Deck neu lackiert, Beschläge neu gedichtet, Mast eloxiert. Den Bericht findest du unten – alles Angaben von uns als Verkäufer."),
    ("jonas", "jolle", "Bootswerft Fricke & Dannhus", "Conger", 1998, 2900, "Flensburg", "Schleswig-Holstein", "used", "none",
     (5.00, 1.85, 1.05, 240, "GFK", 14.0, 6.5, 0, None, "Straßentrailer"),
     "Gutmütige Wanderjolle für die Familie. Schwert und Ruder überholt, Segel gebraucht, aber in Ordnung."),
]

REPORT_TEXT = {
    "hull": ("renewed", "Unterwasserschiff bis auf das Gelcoat abgetragen, fünf Lagen Epoxidprimer aufgebaut, Antifouling neu. Feuchtemessung vor und nach den Arbeiten dokumentiert."),
    "deck": ("repaired", "Relingsstützen und Püttinge demontiert, Durchführungen neu abgedichtet. Antirutschbelag im Cockpit erneuert."),
    "rigging": ("renewed", "Stehendes Gut vollständig ersetzt (Wanten, Vor- und Achterstag). Mast gelegt, Terminals und Salinge geprüft."),
    "sails": ("inspected", "Großsegel und Fock vom Segelmacher durchgesehen, zwei Nähte nachgenäht. Tuch mit normalen Gebrauchsspuren."),
    "fittings": ("repaired", "Winschen zerlegt, gereinigt und gefettet. Zwei Klemmen ersetzt, Travellerschlitten neu gelagert."),
    "electronics": ("inspected", "Bordnetz durchgemessen, Batterien geprüft. Instrumente funktionsfähig."),
    "engine": ("inspected", "Motorservice mit Öl-, Filter- und Impellerwechsel. Kompression geprüft, Probelauf unter Last."),
    "interior": ("renewed", "Polster neu bezogen, Bodenbretter geschliffen und lackiert, Bilge gereinigt und konserviert."),
    "other": ("not_inspected", "Rettungsmittel und Gasanlage wurden im Rahmen der Aufbereitung nicht geprüft."),
}


def _demo_pdf(title: str, lines: list[str]) -> bytes:
    page = Image.new("RGB", (1240, 1754), "white")
    d = ImageDraw.Draw(page)
    big, small = ImageFont.load_default(size=40), ImageFont.load_default(size=24)
    d.text((100, 110), "REFURBED SAIL – Demo-Dokument", fill=(115, 129, 138), font=small)
    d.text((100, 170), title, fill=(16, 36, 53), font=big)
    d.line([(100, 240), (1140, 240)], fill=(182, 139, 88), width=2)
    y = 290
    for line in lines:
        d.text((100, y), line, fill=(32, 43, 49), font=small)
        y += 44
    d.text((100, 1600), "Fiktives Beispieldokument. Kein realer Prüfbericht.", fill=(150, 62, 52), font=small)
    buf = io.BytesIO()
    page.save(buf, "PDF", resolution=150)
    return buf.getvalue()


def purge_demo(db: Session) -> int:
    s = get_settings()
    boat_ids = list(db.scalars(select(Boat.id).where(Boat.is_demo.is_(True))))
    user_ids = list(db.scalars(select(User.id).where(User.is_demo.is_(True))))
    dealer_ids = list(db.scalars(select(DealerProfile.id).where(DealerProfile.is_demo.is_(True))))
    for b in boat_ids:
        shutil.rmtree(s.public_upload_dir / "boats" / str(b), ignore_errors=True)
        shutil.rmtree(s.private_upload_dir / "boats" / str(b), ignore_errors=True)
    for d in dealer_ids:
        shutil.rmtree(s.public_upload_dir / "dealers" / str(d), ignore_errors=True)
    if user_ids:
        db.execute(delete(User).where(User.id.in_(user_ids)))  # cascades via foreign keys
    db.commit()
    return len(boat_ids)


def _logo(name: str) -> Image.Image:
    img = Image.new("RGB", (600, 600), (16, 36, 53))
    d = ImageDraw.Draw(img)
    initials = "".join(w[0] for w in name.split()[:2]).upper()
    font = ImageFont.load_default(size=220)
    box = d.textbbox((0, 0), initials, font=font)
    d.text(((600 - box[2] + box[0]) / 2 - box[0], (600 - box[3] + box[1]) / 2 - box[1]), initials, fill=(247, 247, 244), font=font)
    d.line([(190, 470), (410, 470)], fill=(182, 139, 88), width=6)
    return img


def seed_demo(db: Session, password: str) -> dict:
    purge_demo(db)
    rng = random.Random(7)
    pw = hash_password(password)
    users: dict[str, User] = {}

    def mk_user(key, name, city, roles):
        u = User(email=f"{key}@{DOMAIN}", password_hash=pw, display_name=name, location=city, is_demo=True,
                 roles=[UserRole(role=r) for r in roles],
                 created_at=utcnow() - timedelta(days=rng.randint(200, 900)))
        db.add(u)
        db.flush()
        users[key] = u
        return u

    for key, name, city, postal, status, desc in DEALERS:
        u = mk_user(key, name, city, ["buyer", "dealer"])
        dp = DealerProfile(user_id=u.id, slug=slugify(name), company_name=name, description=desc, city=city,
                           postal_code=postal, street="Musterkai 1 (fiktiv)", phone="+49 000 0000000 (Demo)",
                           contact_email=f"kontakt-{key}@{DOMAIN}", website="https://example.com",
                           verification_status=status, is_demo=True, created_at=u.created_at)
        db.add(dp)
        db.flush()
        dp.logo_path = storage.store_public_pil(_logo(name), f"dealers/{dp.id}", 600, 200)["path"]
        if status != "unverified":
            db.add(VerificationRecord(dealer_id=dp.id, status=status, note="Demo-Datensatz"))
    for key, name, city in PRIVATE:
        mk_user(key, name, city, ["buyer", "private_seller"])
    buyer = mk_user("kaeufer", "Mara Demo", "Bremen", ["buyer"])
    db.flush()

    boats = []
    for i, (seller, cat, manu, model, year, price, city, region, cond, rstatus, spec, desc) in enumerate(BOATS):
        u = users[seller]
        db.refresh(u)
        published = utcnow() - timedelta(days=i * 2 + rng.randint(0, 2), hours=rng.randint(0, 20))
        b = Boat(seller_id=u.id, dealer_id=u.dealer_profile.id if u.dealer_profile else None, reference=new_reference(db),
                 slug="", category=cat, manufacturer=manu, model=model, year=year, price_eur=price,
                 price_negotiable=price < 20000, location_city=city, location_region=region, condition=cond,
                 refurb_status=rstatus, status="active", description=desc, is_demo=True,
                 created_at=published, published_at=published, view_count=rng.randint(20, 900))
        b.slug = build_slug(b)
        keys = ("length_m", "beam_m", "draft_m", "displacement_kg", "hull_material", "sail_area_m2", "mast_height_m",
                "berths", "engine", "trailer")
        b.spec = BoatSpecification(**dict(zip(keys, spec)))
        b.equipment = [Equipment(kind="main_sail", description="Großsegel, durchgelattet, guter Zustand"),
                       Equipment(kind="jib", description="Fock mit Rollanlage" if cat in ("segelyacht", "daysailer") else "Fock")]
        if cat in ("regattaboot", "sportboot", "katamaran"):
            b.equipment.append(Equipment(kind="gennaker", description="Gennaker mit Bergeschlauch"))
        if cat == "segelyacht":
            b.equipment += [Equipment(kind="genoa", description="Rollgenua 135 %"),
                            Equipment(kind="electronics", description="Kartenplotter, Echolot, Logge, Windmessanlage, UKW-Funk mit DSC"),
                            Equipment(kind="other", description="Sprayhood, Ankergeschirr, Landanschluss mit Ladegerät, Badeleiter, Winterplane")]
        else:
            b.equipment.append(Equipment(kind="other", description="Persenning, Festmacher, Fender, Paddel"))
        db.add(b)
        db.flush()
        for pos, img in enumerate(listing_images(1000 + i, cat, 4 if cat == "segelyacht" else 3)):
            b.images.append(BoatImage(position=pos, **storage.store_public_pil(img, f"boats/{b.id}")))

        if rstatus != "none":
            sections = list(REPORT_TEXT) if rstatus == "work_completed" else ["hull", "rigging", "sails", "other"]
            if not spec[8] or "Außenborder" in (spec[8] or ""):
                sections = [s_ for s_ in sections if s_ != "engine"]
            if spec[7] == 0:
                sections = [s_ for s_ in sections if s_ not in ("interior", "electronics")]
            rep = RefurbishmentReport(
                summary="Zusammenfassung der dokumentierten Arbeiten und Prüfungen. Alle Angaben stammen vom Verkäufer.",
                seller_notes="Belege und Fotos zu den einzelnen Positionen können bei der Besichtigung eingesehen werden.")
            b.report = rep
            for pos, sec in enumerate(sections):
                status, text = REPORT_TEXT[sec]
                if rstatus != "work_completed" and status in ("renewed", "repaired"):
                    status = "inspected"
                    text = "Sichtprüfung ohne Befund. " + text.split(". ")[-1]
                rep.entries.append(RefurbishmentEntry(
                    section=sec, status=status, description=text, position=pos,
                    work_date=None if status == "not_inspected" else date.today() - timedelta(days=rng.randint(40, 400))))
            if i == 2:
                rep.entries.append(RefurbishmentEntry(section="fittings", status="defect_reported", position=9,
                                                      description="Ankerwinsch ohne Funktion, Motor defekt. Im Preis berücksichtigt.",
                                                      seller_notes="Ersatzteil ist beim Hersteller noch lieferbar."))
            db.flush()
            s = get_settings()
            for title, entry in (("Arbeitsprotokoll (Demo)", None), ("Feuchtemessung Rumpf (Demo)", rep.entries[0])):
                rel = f"boats/{b.id}/demo-{slugify(title)}.pdf"
                path = s.private_upload_dir / rel
                path.parent.mkdir(parents=True, exist_ok=True)
                data = _demo_pdf(title, [f"Boot: {manu} {model} ({year})", f"Referenz: {b.reference}", "",
                                         "Dieses Dokument ist ein Platzhalter für die Demoversion.",
                                         "In echten Inseraten laden Verkäufer hier Rechnungen,",
                                         "Messprotokolle und Gutachten als PDF hoch."])
                path.write_bytes(data)
                db.add(Document(owner_id=u.id, boat_id=b.id, entry_id=entry.id if entry else None, kind="pdf",
                                title=title, original_name=f"{slugify(title)}.pdf", path=rel, mime="application/pdf",
                                size_bytes=len(data)))
            if i in (0, 4):
                photo = render_scene(5000 + i, (1600, 1067), "close", "keel")
                meta = storage._save_jpeg(photo, s.private_upload_dir / f"boats/{b.id}/demo-foto.jpg", 1600)
                db.add(Document(owner_id=u.id, boat_id=b.id, entry_id=rep.entries[0].id, kind="image",
                                title="Foto nach Abschluss der Arbeiten (Demo)", original_name="foto.jpg",
                                path=f"boats/{b.id}/demo-foto.jpg", mime="image/jpeg", size_bytes=meta[0] * meta[1]))
        boats.append(b)

    # one listing awaiting approval so the moderation queue is not empty
    pend = boats[-1]
    pend.status, pend.published_at = "pending", None

    conv = Conversation(boat_id=boats[0].id, buyer_id=buyer.id, seller_id=boats[0].seller_id,
                        created_at=utcnow() - timedelta(days=2), last_message_at=utcnow() - timedelta(hours=5))
    db.add(conv)
    db.flush()
    for who, kind, hours, text in (
        (buyer.id, "viewing_request", 48, "Guten Tag, die Dehler 34 interessiert mich sehr. Wäre eine Besichtigung am kommenden Samstag in Kiel möglich?"),
        (boats[0].seller_id, "message", 44, "Moin! Samstag passt gut, das Boot steht noch in der Halle – so können Sie sich auch das Unterwasserschiff ansehen. 11 Uhr?"),
        (buyer.id, "message", 5, "Perfekt, 11 Uhr passt. Können Sie mir vorab das Protokoll der Feuchtemessung zeigen?"),
    ):
        db.add(Message(conversation_id=conv.id, sender_id=who, kind=kind, body=text,
                       created_at=utcnow() - timedelta(hours=hours),
                       read_at=utcnow() - timedelta(hours=hours - 1) if hours > 5 else None))
    for b in boats[:4]:
        db.add(Favorite(user_id=buyer.id, boat_id=b.id))
    db.add(ListingReport(boat_id=boats[11].id, reporter_id=buyer.id, reason="wrong_information",
                         details="Demo-Meldung: Das angegebene Baujahr passt nicht zur Rumpfnummer auf dem Foto."))
    db.commit()
    return {"boats": len(boats), "users": len(users), "domain": DOMAIN,
            "accounts": [u.email for u in users.values()]}
