from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.deps import require_dealer
from ..core.ratelimit import rate_limit
from ..models import Boat, Conversation, DealerProfile, Document, Favorite, Message, User
from ..schemas.inputs import DealerProfileIn
from ..services import storage
from ..services.serializers import boat_card, dealer_public, document_out, report_out

router = APIRouter(prefix="/api", tags=["dealers"])


def _active_counts(db: Session) -> dict[int, int]:
    return dict(db.execute(select(Boat.dealer_id, func.count()).where(Boat.status == "active", Boat.dealer_id.is_not(None))
                           .group_by(Boat.dealer_id)).all())


@router.get("/dealers")
def list_dealers(db: Session = Depends(get_db)):
    counts = _active_counts(db)
    dealers = db.scalars(select(DealerProfile).join(User, User.id == DealerProfile.user_id)
                         .where(User.is_active.is_(True)).order_by(DealerProfile.company_name)).all()
    rank = {"refurb_documented": 0, "verified": 0, "business_checked": 1, "unverified": 2}
    dealers = sorted(dealers, key=lambda d: (rank[d.verification_status], -counts.get(d.id, 0), d.company_name))
    return {"items": [dealer_public(d, counts.get(d.id, 0)) for d in dealers]}


@router.get("/dealers/{slug}")
def get_dealer(slug: str, db: Session = Depends(get_db)):
    d = db.scalar(select(DealerProfile).where(DealerProfile.slug == slug))
    if d is None or not d.user.is_active:
        raise HTTPException(404, "Dieser Händler wurde nicht gefunden.")
    boats = db.scalars(select(Boat).where(Boat.dealer_id == d.id, Boat.status == "active")
                       .order_by(Boat.published_at.desc())).unique().all()
    return dealer_public(d, len(boats)) | {"boats": [boat_card(b) for b in boats]}


# --- own dealer area -----------------------------------------------------------
def _profile(user: User) -> DealerProfile:
    if user.dealer_profile is None:
        raise HTTPException(404, "Es wurde noch kein Händlerprofil angelegt.")
    return user.dealer_profile


@router.get("/dealer/profile")
def my_dealer_profile(user: User = Depends(require_dealer)):
    d = _profile(user)
    return dealer_public(d) | {
        "verification_history": [
            {"status": r.status, "note": r.note, "created_at": r.created_at.isoformat() + "Z"}
            for r in d.verification_records
        ]
    }


@router.put("/dealer/profile")
def update_dealer_profile(data: DealerProfileIn, user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    d = _profile(user)
    # verification_status is intentionally not part of the input schema.
    for f, v in data.model_dump().items():
        setattr(d, f, v or None if f != "company_name" else v)
    db.commit()
    return dealer_public(d)


@router.post("/dealer/logo", dependencies=[Depends(rate_limit("upload", 120, 600))])
def upload_logo(file: UploadFile = File(...), user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    d = _profile(user)
    meta = storage.save_public_image(file, f"dealers/{d.id}", max_side=800, thumb_side=240)
    old = d.logo_path
    d.logo_path = meta["path"]
    db.commit()
    storage.delete_public(old, old.replace(".jpg", "_t.jpg") if old else None)
    return dealer_public(d)


@router.get("/dealer/dashboard")
def dealer_dashboard(user: User = Depends(require_dealer), db: Session = Depends(get_db)):
    """Listing statistics, inquiries, refurbishment reports and documents of the dealer."""
    boats = db.scalars(select(Boat).where(Boat.seller_id == user.id, Boat.status != "removed")
                       .order_by(Boat.updated_at.desc())).unique().all()
    ids = [b.id for b in boats]
    fav = dict(db.execute(select(Favorite.boat_id, func.count()).where(Favorite.boat_id.in_(ids))
                          .group_by(Favorite.boat_id)).all()) if ids else {}
    inq = dict(db.execute(select(Conversation.boat_id, func.count()).where(Conversation.boat_id.in_(ids))
                          .group_by(Conversation.boat_id)).all()) if ids else {}
    unread = db.scalar(select(func.count()).select_from(Message).join(Conversation)
                       .where(Conversation.seller_id == user.id, Message.sender_id != user.id,
                              Message.read_at.is_(None)))
    by_status: dict[str, int] = {}
    for b in boats:
        by_status[b.status] = by_status.get(b.status, 0) + 1
    docs = db.scalars(select(Document).where(Document.boat_id.in_(ids)).order_by(Document.created_at.desc())).all() if ids else []
    title = {b.id: f"{b.manufacturer or ''} {b.model or ''}".strip() or "Unbenannter Entwurf" for b in boats}
    return {
        "totals": {
            "by_status": by_status,
            "views": sum(b.view_count for b in boats),
            "favorites": sum(fav.values()),
            "inquiries": sum(inq.values()),
            "unread_messages": unread,
        },
        "listings": [boat_card(b) | {"view_count": b.view_count, "favorites": fav.get(b.id, 0),
                                     "inquiries": inq.get(b.id, 0), "rejection_reason": b.rejection_reason}
                     for b in boats],
        "reports": [{"boat_id": b.id, "boat_title": title[b.id], "reference": b.reference, "status": b.status,
                     "refurb_status": b.refurb_status, "entry_count": len(b.report.entries),
                     "verification": b.report.verification, "updated_at": report_out(b)["updated_at"]}
                    for b in boats if b.report],
        "documents": [document_out(d) | {"boat_id": d.boat_id, "boat_title": title[d.boat_id]} for d in docs],
    }
