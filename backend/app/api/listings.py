"""Seller endpoints: own listings, images and documents."""
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_db
from ..core.deps import current_user, optional_user
from ..core.ratelimit import rate_limit
from ..models import Boat, BoatImage, Conversation, Document, Favorite, RefurbishmentEntry, RefurbishmentReport, User, utcnow
from ..schemas.inputs import BoatIn, BoatStatusIn, ImageOrderIn
from ..services import storage
from ..services.boats import apply_input, create_draft, publish_errors
from ..services.serializers import boat_card, boat_detail, document_out, image_out

router = APIRouter(prefix="/api/my/boats", tags=["listings"])
doc_router = APIRouter(prefix="/api/documents", tags=["documents"])

EDITABLE = ("draft", "pending", "active", "paused", "rejected", "archived")


def require_seller(user: User = Depends(current_user)) -> User:
    if not (user.has_role("private_seller") or user.has_role("dealer")):
        raise HTTPException(403, "Zum Inserieren wird ein Verkäuferkonto benötigt.")
    return user


def own_boat(boat_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)) -> Boat:
    boat = db.get(Boat, boat_id)
    if boat is None or boat.seller_id != user.id or boat.status == "removed":
        raise HTTPException(404, "Dieses Inserat wurde nicht gefunden.")
    return boat


def _stats(db: Session, boat_ids: list[int]) -> dict[int, dict]:
    if not boat_ids:
        return {}
    fav = dict(db.execute(select(Favorite.boat_id, func.count()).where(Favorite.boat_id.in_(boat_ids))
                          .group_by(Favorite.boat_id)).all())
    inq = dict(db.execute(select(Conversation.boat_id, func.count()).where(Conversation.boat_id.in_(boat_ids))
                          .group_by(Conversation.boat_id)).all())
    return {i: {"favorites": fav.get(i, 0), "inquiries": inq.get(i, 0)} for i in boat_ids}


@router.get("")
def my_boats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    boats = db.scalars(select(Boat).where(Boat.seller_id == user.id, Boat.status != "removed")
                       .order_by(Boat.updated_at.desc())).unique().all()
    stats = _stats(db, [b.id for b in boats])
    return {"items": [boat_card(b) | {"view_count": b.view_count, "rejection_reason": b.rejection_reason}
                      | stats[b.id] for b in boats]}


@router.post("", status_code=201)
def create_boat(data: BoatIn, user: User = Depends(require_seller), db: Session = Depends(get_db)):
    drafts = db.scalar(select(func.count()).select_from(Boat).where(Boat.seller_id == user.id, Boat.status == "draft"))
    if drafts >= 50:
        raise HTTPException(409, "Du hast zu viele Entwürfe. Bitte lösche nicht benötigte Entwürfe.")
    boat = create_draft(db, user)
    apply_input(db, boat, data)
    db.commit()
    return boat_detail(boat) | {"publish_errors": publish_errors(boat)}


@router.get("/{boat_id}")
def get_my_boat(boat: Boat = Depends(own_boat)):
    return boat_detail(boat) | {"publish_errors": publish_errors(boat)}


@router.put("/{boat_id}")
def update_boat(data: BoatIn, boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    apply_input(db, boat, data)
    if boat.status in ("active", "pending"):
        errors = publish_errors(boat)
        if errors:
            raise HTTPException(422, " ".join(errors))
    boat.updated_at = utcnow()
    db.commit()
    db.refresh(boat)
    return boat_detail(boat) | {"publish_errors": publish_errors(boat)}


@router.post("/{boat_id}/status")
def change_status(data: BoatStatusIn, boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    s = get_settings()
    if data.action == "publish":
        if boat.status not in ("draft", "rejected", "archived", "paused"):
            raise HTTPException(409, "Dieses Inserat kann in seinem aktuellen Status nicht veröffentlicht werden.")
        errors = publish_errors(boat)
        if errors:
            raise HTTPException(422, " ".join(errors))
        was_approved = boat.status == "paused" and boat.published_at is not None
        boat.status = "active" if (was_approved or not s.listing_approval_required) else "pending"
        boat.rejection_reason = None
        if boat.status == "active" and boat.published_at is None:
            boat.published_at = utcnow()
    elif data.action == "pause":
        if boat.status != "active":
            raise HTTPException(409, "Nur aktive Inserate können pausiert werden.")
        boat.status = "paused"
    elif data.action == "resume":
        if boat.status != "paused":
            raise HTTPException(409, "Nur pausierte Inserate können fortgesetzt werden.")
        boat.status = "active"
    elif data.action == "archive":
        if boat.status == "archived":
            raise HTTPException(409, "Dieses Inserat ist bereits archiviert.")
        boat.status = "archived"
    elif data.action == "to_draft":
        if boat.status not in ("pending", "archived", "rejected"):
            raise HTTPException(409, "Dieses Inserat kann nicht in einen Entwurf umgewandelt werden.")
        boat.status = "draft"
        boat.published_at = None
    db.commit()
    return boat_card(boat)


@router.delete("/{boat_id}")
def delete_boat(boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    public = [p for i in boat.images for p in (i.path, i.thumb_path)]
    private = [d.path for d in boat.documents]
    db.delete(boat)
    db.commit()
    storage.delete_public(*public)
    storage.delete_private(*private)
    return {"ok": True}


# --- images ----------------------------------------------------------------
@router.post("/{boat_id}/images", status_code=201, dependencies=[Depends(rate_limit("upload", 120, 600))])
def upload_images(files: list[UploadFile] = File(...), boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    s = get_settings()
    if len(boat.images) + len(files) > s.max_images_per_boat:
        raise HTTPException(409, f"Pro Inserat sind höchstens {s.max_images_per_boat} Fotos möglich.")
    pos = max((i.position for i in boat.images), default=-1) + 1
    created = []
    for f in files:
        meta = storage.save_public_image(f, f"boats/{boat.id}")
        img = BoatImage(boat_id=boat.id, position=pos, **meta)
        boat.images.append(img)
        created.append(img)
        pos += 1
    boat.updated_at = utcnow()
    db.commit()
    return {"images": [image_out(i) for i in boat.images]}


@router.put("/{boat_id}/images/order")
def order_images(data: ImageOrderIn, boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    by_id = {i.id: i for i in boat.images}
    if set(data.image_ids) != set(by_id) or len(data.image_ids) != len(by_id):
        raise HTTPException(422, "Die Reihenfolge muss alle Fotos des Inserats enthalten.")
    for pos, image_id in enumerate(data.image_ids):
        by_id[image_id].position = pos
    db.commit()
    db.refresh(boat)
    return {"images": [image_out(i) for i in boat.images]}


@router.delete("/{boat_id}/images/{image_id}")
def delete_image(image_id: int, boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    img = next((i for i in boat.images if i.id == image_id), None)
    if img is None:
        raise HTTPException(404, "Foto nicht gefunden.")
    if boat.status in ("active", "pending") and len(boat.images) == 1:
        raise HTTPException(409, "Ein veröffentlichtes Inserat benötigt mindestens ein Foto.")
    paths = (img.path, img.thumb_path)
    boat.images.remove(img)
    db.commit()
    storage.delete_public(*paths)
    db.refresh(boat)
    return {"images": [image_out(i) for i in boat.images]}


# --- documents ---------------------------------------------------------------
@router.post("/{boat_id}/documents", status_code=201, dependencies=[Depends(rate_limit("upload", 120, 600))])
def upload_document(file: UploadFile = File(...), title: str | None = Form(None, max_length=160),
                    entry_id: int | None = Form(None), boat: Boat = Depends(own_boat),
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    s = get_settings()
    if len(boat.documents) >= s.max_documents_per_boat:
        raise HTTPException(409, f"Pro Inserat sind höchstens {s.max_documents_per_boat} Dokumente möglich.")
    if entry_id is not None:
        entry = db.scalar(select(RefurbishmentEntry).join(RefurbishmentReport)
                          .where(RefurbishmentEntry.id == entry_id, RefurbishmentReport.boat_id == boat.id))
        if entry is None:
            raise HTTPException(404, "Der Berichtseintrag wurde nicht gefunden.")
    meta = storage.save_private_document(file, f"boats/{boat.id}")
    original = (file.filename or "dokument")[:255]
    doc = Document(owner_id=user.id, boat_id=boat.id, entry_id=entry_id, title=(title or original)[:160],
                   original_name=original, **meta)
    db.add(doc)
    db.commit()
    return document_out(doc)


@router.delete("/{boat_id}/documents/{doc_id}")
def delete_document(doc_id: int, boat: Boat = Depends(own_boat), db: Session = Depends(get_db)):
    doc = next((d for d in boat.documents if d.id == doc_id), None)
    if doc is None:
        raise HTTPException(404, "Dokument nicht gefunden.")
    path = doc.path
    db.delete(doc)
    db.commit()
    storage.delete_private(path)
    return {"ok": True}


@doc_router.get("/{doc_id}/file")
def download_document(doc_id: int, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    """Documents are private files: visible to everyone only while the listing
    is live, otherwise only to the owner and administrators."""
    doc = db.get(Document, doc_id)
    if doc is None:
        raise HTTPException(404, "Dokument nicht gefunden.")
    privileged = user is not None and (user.id == doc.owner_id or user.has_role("admin"))
    if not privileged and not (doc.is_public and doc.boat.status == "active"):
        raise HTTPException(404, "Dokument nicht gefunden.")
    path = (get_settings().private_upload_dir / doc.path).resolve()
    if not path.is_file():
        raise HTTPException(404, "Dokument nicht gefunden.")
    return FileResponse(path, media_type=doc.mime, filename=doc.original_name if doc.kind == "pdf" else None,
                        content_disposition_type="inline",
                        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300"})
