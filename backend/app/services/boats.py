import re
import secrets
import unicodedata

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Boat, BoatSpecification, DealerProfile, Equipment, RefurbishmentEntry, RefurbishmentReport, User
from ..models.enums import EQUIPMENT_KINDS
from ..schemas.inputs import BoatIn

_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def slugify(text: str) -> str:
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")


def new_reference(db: Session) -> str:
    while True:
        ref = "RS-" + "".join(secrets.choice(_ALPHABET) for _ in range(6))
        if not db.scalar(select(Boat.id).where(Boat.reference == ref)):
            return ref


def build_slug(boat: Boat) -> str:
    base = slugify(" ".join(str(p) for p in (boat.manufacturer, boat.model, boat.year) if p)) or "segelboot"
    return f"{base[:150]}-{boat.reference.lower()}"


def unique_dealer_slug(db: Session, name: str, exclude_id: int | None = None) -> str:
    base = slugify(name) or "haendler"
    if base in ("verzeichnis", "werden"):  # reserved frontend routes below /haendler
        base += "-boote"
    slug, n = base, 1
    while True:
        q = select(DealerProfile.id).where(DealerProfile.slug == slug)
        if exclude_id:
            q = q.where(DealerProfile.id != exclude_id)
        if not db.scalar(q):
            return slug
        n += 1
        slug = f"{base}-{n}"


def create_draft(db: Session, seller: User) -> Boat:
    boat = Boat(seller_id=seller.id, reference=new_reference(db), slug="", status="draft")
    if seller.has_role("dealer") and seller.dealer_profile:
        boat.dealer_id = seller.dealer_profile.id
    boat.slug = build_slug(boat)
    boat.spec = BoatSpecification()
    db.add(boat)
    return boat


def apply_input(db: Session, boat: Boat, data: BoatIn) -> None:
    for f in ("category", "manufacturer", "model", "year", "description", "price_eur",
              "location_city", "location_postal", "location_region"):
        value = getattr(data, f)
        setattr(boat, f, value if value != "" else None)
    boat.price_negotiable = data.price_negotiable
    boat.condition = data.condition
    boat.refurb_status = data.refurb_status
    boat.slug = build_slug(boat)

    if boat.spec is None:
        boat.spec = BoatSpecification()
    for f, v in data.spec.model_dump().items():
        setattr(boat.spec, f, v if v != "" else None)

    existing = {e.kind: e for e in boat.equipment}
    for kind in EQUIPMENT_KINDS:
        text = getattr(data.equipment, kind)
        if text:
            if kind in existing:
                existing[kind].description = text
            else:
                boat.equipment.append(Equipment(kind=kind, description=text))
        elif kind in existing:
            boat.equipment.remove(existing[kind])

    if data.report is None:
        if boat.report is not None:
            if boat.report.verification != "seller_provided":
                raise HTTPException(409, "Ein unabhängig geprüfter Bericht kann nicht entfernt werden. Bitte kontaktiere den Support.")
            db.delete(boat.report)
            boat.report = None
        boat.refurb_status = "none"
    else:
        rep = boat.report
        if rep is None:
            rep = RefurbishmentReport()
            boat.report = rep
        rep.summary, rep.seller_notes = data.report.summary or None, data.report.seller_notes or None
        by_id = {e.id: e for e in rep.entries}
        keep = []
        changed = False
        for pos, ein in enumerate(data.report.entries):
            entry = by_id.get(ein.id) if ein.id else None
            if entry is None:
                entry = RefurbishmentEntry()
                rep.entries.append(entry)
                changed = True
            new_vals = (ein.section, ein.status, ein.description or None, ein.work_date, ein.seller_notes or None)
            if (entry.section, entry.status, entry.description, entry.work_date, entry.seller_notes) != new_vals:
                changed = True
            entry.section, entry.status, entry.description, entry.work_date, entry.seller_notes = new_vals
            entry.position = pos
            keep.append(entry)
        for entry in list(rep.entries):
            if entry not in keep:
                rep.entries.remove(entry)
                changed = True
        # Any change by the seller invalidates an earlier independent verification.
        if changed and rep.verification != "seller_provided":
            rep.verification, rep.verified_by, rep.verified_at = "seller_provided", None, None


def publish_errors(boat: Boat) -> list[str]:
    """Server-side completeness check before a listing may go live."""
    errors = []
    if not boat.category:
        errors.append("Bitte wähle eine Bootskategorie.")
    if not boat.manufacturer:
        errors.append("Bitte gib den Hersteller an.")
    if not boat.model:
        errors.append("Bitte gib das Modell an.")
    if not boat.year:
        errors.append("Bitte gib das Baujahr an.")
    if not boat.spec or not boat.spec.length_m:
        errors.append("Bitte gib die Länge des Bootes an.")
    if not boat.description or len(boat.description) < 40:
        errors.append("Die Beschreibung sollte mindestens 40 Zeichen umfassen.")
    if not boat.images:
        errors.append("Bitte lade mindestens ein Foto hoch.")
    if not boat.price_eur:
        errors.append("Bitte gib einen Preis an.")
    if not boat.location_city:
        errors.append("Bitte gib den Standort an.")
    has_entries = bool(boat.report and boat.report.entries)
    if boat.refurb_status != "none" and not has_entries:
        errors.append("Für einen Refurbishment-Status wird ein Zustandsbericht mit mindestens einem Eintrag benötigt.")
    if boat.condition in ("refurbished", "restored") and not has_entries:
        errors.append("Aufbereitete oder restaurierte Boote benötigen einen Zustandsbericht mit mindestens einem Eintrag.")
    return errors
