"""Public marketplace endpoints."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.deps import optional_user
from ..core.ratelimit import rate_limit
from ..models import Boat, BoatSpecification, DealerProfile, ListingReport, User
from ..models.enums import CATEGORIES, CONDITIONS, REFURB_STATUSES, SELLER_TYPES, VERIFIED_DEALER_STATUSES
from ..schemas.inputs import ListingReportIn
from ..services.serializers import boat_card, boat_detail

router = APIRouter(prefix="/api/boats", tags=["boats"])


def _like(value: str) -> str:
    return "%" + value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def _multi(value: str | None, allowed) -> list[str]:
    return [v for v in (value or "").split(",") if v in allowed]


@router.get("")
def list_boats(
    q: str | None = Query(None, max_length=100),
    category: str | None = None,
    manufacturer: str | None = Query(None, max_length=80),
    model: str | None = Query(None, max_length=80),
    price_min: int | None = Query(None, ge=0),
    price_max: int | None = Query(None, ge=0),
    year_min: int | None = Query(None, ge=1800, le=2200),
    year_max: int | None = Query(None, ge=1800, le=2200),
    length_min: float | None = Query(None, ge=0),
    length_max: float | None = Query(None, ge=0),
    location: str | None = Query(None, max_length=80),
    seller_type: str | None = None,
    condition: str | None = None,
    refurb_status: str | None = None,
    refurbished_only: bool = False,
    dealer: str | None = Query(None, max_length=120),
    sort: Literal["newest", "price_asc", "price_desc", "year_desc"] = "newest",
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=48),
    db: Session = Depends(get_db),
):
    stmt = (
        select(Boat)
        .outerjoin(BoatSpecification, BoatSpecification.boat_id == Boat.id)
        .outerjoin(DealerProfile, DealerProfile.id == Boat.dealer_id)
        .where(Boat.status == "active")
    )
    if q:
        for term in q.split()[:6]:
            like = _like(term)
            stmt = stmt.where(or_(
                Boat.manufacturer.ilike(like, escape="\\"), Boat.model.ilike(like, escape="\\"),
                Boat.description.ilike(like, escape="\\"), Boat.reference.ilike(like, escape="\\"),
                Boat.location_city.ilike(like, escape="\\"),
            ))
    if cats := _multi(category, CATEGORIES):
        stmt = stmt.where(Boat.category.in_(cats))
    if manufacturer:
        stmt = stmt.where(Boat.manufacturer.ilike(_like(manufacturer), escape="\\"))
    if model:
        stmt = stmt.where(Boat.model.ilike(_like(model), escape="\\"))
    if price_min is not None:
        stmt = stmt.where(Boat.price_eur >= price_min)
    if price_max is not None:
        stmt = stmt.where(Boat.price_eur <= price_max)
    if year_min is not None:
        stmt = stmt.where(Boat.year >= year_min)
    if year_max is not None:
        stmt = stmt.where(Boat.year <= year_max)
    if length_min is not None:
        stmt = stmt.where(BoatSpecification.length_m >= length_min)
    if length_max is not None:
        stmt = stmt.where(BoatSpecification.length_m <= length_max)
    if location:
        like = _like(location)
        stmt = stmt.where(or_(
            Boat.location_city.ilike(like, escape="\\"), Boat.location_region.ilike(like, escape="\\"),
            Boat.location_postal.ilike(like, escape="\\"),
        ))
    if types := _multi(seller_type, SELLER_TYPES):
        conds = []
        if "private" in types:
            conds.append(Boat.dealer_id.is_(None))
        if "dealer" in types:
            conds.append(Boat.dealer_id.is_not(None) & DealerProfile.verification_status.not_in(VERIFIED_DEALER_STATUSES))
        if "verified_dealer" in types:
            conds.append(DealerProfile.verification_status.in_(VERIFIED_DEALER_STATUSES))
        stmt = stmt.where(or_(*conds))
    if conds_ := _multi(condition, CONDITIONS):
        stmt = stmt.where(Boat.condition.in_(conds_))
    if statuses := _multi(refurb_status, REFURB_STATUSES):
        stmt = stmt.where(Boat.refurb_status.in_(statuses))
    if refurbished_only:
        stmt = stmt.where(or_(Boat.condition.in_(("refurbished", "restored")), Boat.refurb_status != "none"))
    if dealer:
        stmt = stmt.where(DealerProfile.slug == dealer)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {
        "newest": (Boat.published_at.desc(), Boat.id.desc()),
        "price_asc": (Boat.price_eur.asc(), Boat.id.desc()),
        "price_desc": (Boat.price_eur.desc(), Boat.id.desc()),
        "year_desc": (Boat.year.desc(), Boat.id.desc()),
    }[sort]
    rows = db.scalars(stmt.order_by(*order).offset((page - 1) * page_size).limit(page_size)).unique().all()
    return {
        "items": [boat_card(b) for b in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
    }


@router.get("/facets")
def facets(db: Session = Depends(get_db)):
    active = Boat.status == "active"
    manufacturers = db.execute(
        select(Boat.manufacturer, func.count()).where(active, Boat.manufacturer.is_not(None))
        .group_by(Boat.manufacturer).order_by(Boat.manufacturer)
    ).all()
    categories = dict(db.execute(select(Boat.category, func.count()).where(active).group_by(Boat.category)).all())
    return {
        "manufacturers": [{"name": m, "count": c} for m, c in manufacturers],
        "categories": {c: categories.get(c, 0) for c in CATEGORIES},
        "total": sum(categories.values()),
        "has_demo": bool(db.scalar(select(Boat.id).where(active, Boat.is_demo.is_(True)).limit(1))),
    }


@router.get("/{slug}")
def get_boat(slug: str, request: Request, db: Session = Depends(get_db), user: User | None = Depends(optional_user)):
    boat = db.scalar(select(Boat).where(or_(Boat.slug == slug, Boat.reference == slug.upper())))
    if boat is None:
        raise HTTPException(404, "Dieses Inserat wurde nicht gefunden.")
    is_owner = user is not None and (user.id == boat.seller_id or user.has_role("admin"))
    if boat.status != "active" and not is_owner:
        raise HTTPException(404, "Dieses Inserat ist nicht mehr verfügbar.")
    if boat.status == "active" and not is_owner:
        boat.view_count = Boat.view_count + 1
        db.commit()
        db.refresh(boat)
    data = boat_detail(boat)
    others = db.scalars(
        select(Boat).where(Boat.seller_id == boat.seller_id, Boat.status == "active", Boat.id != boat.id)
        .order_by(Boat.published_at.desc()).limit(3)
    ).unique().all()
    data["seller"]["other_listings"] = [boat_card(b) for b in others]
    data["seller"]["listing_count"] = db.scalar(
        select(func.count()).select_from(Boat).where(Boat.seller_id == boat.seller_id, Boat.status == "active"))
    data["is_owner"] = bool(user and user.id == boat.seller_id)
    return data


@router.post("/{boat_id}/report", status_code=201, dependencies=[Depends(rate_limit("report", 10, 3600))])
def report_listing(boat_id: int, data: ListingReportIn, db: Session = Depends(get_db),
                   user: User | None = Depends(optional_user)):
    boat = db.get(Boat, boat_id)
    if boat is None or boat.status != "active":
        raise HTTPException(404, "Dieses Inserat wurde nicht gefunden.")
    db.add(ListingReport(boat_id=boat.id, reporter_id=user.id if user else None,
                         reason=data.reason, details=data.details))
    db.commit()
    return {"ok": True}
