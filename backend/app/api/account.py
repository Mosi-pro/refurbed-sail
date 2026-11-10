from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.deps import current_user
from ..core.ratelimit import rate_limit
from ..models import Boat, Conversation, Favorite, Message, User, UserRole
from ..schemas.inputs import ProfileIn, RoleAddIn
from ..services import storage
from ..services.serializers import boat_card, user_private
from .auth import create_dealer_profile

router = APIRouter(prefix="/api", tags=["account"])


@router.get("/account/overview")
def overview(user: User = Depends(current_user), db: Session = Depends(get_db)):
    by_status = dict(db.execute(select(Boat.status, func.count()).where(Boat.seller_id == user.id, Boat.status != "removed")
                                .group_by(Boat.status)).all())
    unread = db.scalar(
        select(func.count()).select_from(Message).join(Conversation)
        .where((Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id),
               Message.sender_id != user.id, Message.read_at.is_(None)))
    return {
        "listings": by_status,
        "listings_total": sum(by_status.values()),
        "unread_messages": unread,
        "favorites": db.scalar(select(func.count()).select_from(Favorite).where(Favorite.user_id == user.id)),
        "conversations": db.scalar(select(func.count()).select_from(Conversation).where(
            (Conversation.buyer_id == user.id) | (Conversation.seller_id == user.id))),
    }


@router.put("/account/profile")
def update_profile(data: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.display_name = data.display_name
    user.location, user.phone, user.bio = data.location or None, data.phone or None, data.bio or None
    db.commit()
    return {"user": user_private(user)}


@router.post("/account/avatar", dependencies=[Depends(rate_limit("upload", 120, 600))])
def upload_avatar(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    meta = storage.save_public_image(file, f"avatars/{user.id}", max_side=600, thumb_side=200)
    old = user.avatar_path
    user.avatar_path = meta["path"]
    db.commit()
    storage.delete_public(old, old.replace(".jpg", "_t.jpg") if old else None)
    return {"user": user_private(user)}


@router.post("/account/roles")
def add_role(data: RoleAddIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Users may upgrade themselves to seller roles only. The schema restricts
    the role to a whitelist – administrator rights are granted via CLI."""
    if not user.has_role(data.role):
        user.roles.append(UserRole(role=data.role))
    if data.role == "dealer" and user.dealer_profile is None:
        if not data.company_name:
            raise HTTPException(422, "Bitte gib den Firmennamen an.")
        create_dealer_profile(db, user, data.company_name)
    db.commit()
    db.refresh(user)
    return {"user": user_private(user)}


# --- favorites ---------------------------------------------------------------
@router.get("/favorites")
def list_favorites(user: User = Depends(current_user), db: Session = Depends(get_db)):
    favs = db.scalars(select(Favorite).where(Favorite.user_id == user.id).order_by(Favorite.created_at.desc())).all()
    return {"items": [boat_card(f.boat) | {"available": f.boat.status == "active"} for f in favs
                      if f.boat.status in ("active", "paused")]}


@router.get("/favorites/ids")
def favorite_ids(user: User = Depends(current_user), db: Session = Depends(get_db)):
    return {"ids": list(db.scalars(select(Favorite.boat_id).where(Favorite.user_id == user.id)))}


@router.put("/favorites/{boat_id}")
def add_favorite(boat_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    boat = db.get(Boat, boat_id)
    if boat is None or boat.status != "active":
        raise HTTPException(404, "Dieses Inserat wurde nicht gefunden.")
    if not db.scalar(select(Favorite.id).where(Favorite.user_id == user.id, Favorite.boat_id == boat_id)):
        db.add(Favorite(user_id=user.id, boat_id=boat_id))
        db.commit()
    return {"ok": True}


@router.delete("/favorites/{boat_id}")
def remove_favorite(boat_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(Favorite).where(Favorite.user_id == user.id, Favorite.boat_id == boat_id))
    db.commit()
    return {"ok": True}
