"""Administration. Every route requires the admin role; state-changing
actions are written to the audit log."""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from ..core.db import get_db
from ..core.deps import require_admin
from ..models import (AuditLog, Boat, Conversation, DealerProfile, ListingReport, Message, RefurbishmentReport, User,
                      UserSession, VerificationRecord, utcnow)
from ..schemas.inputs import (AdminBoatDecisionIn, AdminDealerVerifyIn, AdminRefurbReviewIn, AdminReportResolveIn,
                              AdminUserUpdateIn)
from ..services.audit import log_action
from ..services.serializers import boat_card, dealer_public, iso, report_out

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


def _count(db: Session, model, *where) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where))


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    week = utcnow() - timedelta(days=7)
    by_status = dict(db.execute(select(Boat.status, func.count()).group_by(Boat.status)).all())
    return {
        "users": {"total": _count(db, User), "active": _count(db, User, User.is_active.is_(True)),
                  "new_7d": _count(db, User, User.created_at >= week)},
        "listings": {"by_status": by_status, "total": sum(by_status.values()),
                     "new_7d": _count(db, Boat, Boat.created_at >= week)},
        "dealers": {"total": _count(db, DealerProfile),
                    "unverified": _count(db, DealerProfile, DealerProfile.verification_status == "unverified")},
        "reports_open": _count(db, ListingReport, ListingReport.status == "open"),
        "pending_listings": by_status.get("pending", 0),
        "refurb_reports_unreviewed": _count(db, RefurbishmentReport, RefurbishmentReport.admin_reviewed_at.is_(None)),
        "messages_7d": _count(db, Message, Message.created_at >= week),
        "conversations": _count(db, Conversation),
    }


# --- users -------------------------------------------------------------------
@router.get("/users")
def users(q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1), db: Session = Depends(get_db)):
    stmt = select(User)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.email.ilike(like), User.display_name.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(User.created_at.desc()).offset((page - 1) * 25).limit(25)).all()
    counts = dict(db.execute(select(Boat.seller_id, func.count()).where(Boat.seller_id.in_([u.id for u in rows]),
                                                                        Boat.status != "removed")
                             .group_by(Boat.seller_id)).all()) if rows else {}
    return {"total": total, "page": page, "pages": max(1, -(-total // 25)), "items": [
        {"id": u.id, "email": u.email, "display_name": u.display_name, "roles": u.role_names,
         "is_active": u.is_active, "is_demo": u.is_demo, "created_at": iso(u.created_at),
         "last_login_at": iso(u.last_login_at), "listing_count": counts.get(u.id, 0)} for u in rows]}


@router.patch("/users/{user_id}")
def update_user(user_id: int, data: AdminUserUpdateIn, request: Request, admin: User = Depends(require_admin),
                db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(404, "Konto nicht gefunden.")
    if user.id == admin.id:
        raise HTTPException(409, "Du kannst dein eigenes Konto nicht deaktivieren.")
    user.is_active = data.is_active
    if not data.is_active:
        db.execute(delete(UserSession).where(UserSession.user_id == user.id))
        # Listings of disabled accounts are taken offline.
        for boat in db.scalars(select(Boat).where(Boat.seller_id == user.id, Boat.status.in_(("active", "pending")))).unique():
            boat.status = "paused"
    log_action(db, admin, "user.enable" if data.is_active else "user.disable", "user", user.id,
               {"email": user.email, "note": data.note}, request)
    db.commit()
    return {"ok": True}


# --- listings ------------------------------------------------------------------
@router.get("/boats")
def boats(status: str | None = None, q: str | None = Query(None, max_length=100), page: int = Query(1, ge=1),
          db: Session = Depends(get_db)):
    stmt = select(Boat)
    if status:
        stmt = stmt.where(Boat.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Boat.manufacturer.ilike(like), Boat.model.ilike(like), Boat.reference.ilike(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.scalars(stmt.order_by(Boat.updated_at.desc()).offset((page - 1) * 25).limit(25)).unique().all()
    return {"total": total, "page": page, "pages": max(1, -(-total // 25)), "items": [
        boat_card(b) | {"seller_email": b.seller.email, "rejection_reason": b.rejection_reason,
                        "has_report": b.report is not None} for b in rows]}


@router.post("/boats/{boat_id}/decision")
def boat_decision(boat_id: int, data: AdminBoatDecisionIn, request: Request, admin: User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    boat = db.get(Boat, boat_id)
    if boat is None:
        raise HTTPException(404, "Inserat nicht gefunden.")
    before = boat.status
    if data.action == "approve":
        if boat.status not in ("pending", "rejected"):
            raise HTTPException(409, "Nur eingereichte Inserate können freigegeben werden.")
        boat.status, boat.rejection_reason = "active", None
        boat.published_at = boat.published_at or utcnow()
    elif data.action == "reject":
        if boat.status not in ("pending", "active", "paused"):
            raise HTTPException(409, "Dieses Inserat kann nicht abgelehnt werden.")
        if not data.reason:
            raise HTTPException(422, "Bitte gib eine Begründung an.")
        boat.status, boat.rejection_reason = "rejected", data.reason
    elif data.action == "remove":
        if not data.reason:
            raise HTTPException(422, "Bitte gib eine Begründung an.")
        boat.status, boat.rejection_reason = "removed", data.reason
    elif data.action == "restore":
        if boat.status != "removed":
            raise HTTPException(409, "Nur entfernte Inserate können wiederhergestellt werden.")
        boat.status = "draft"
    log_action(db, admin, f"listing.{data.action}", "boat", boat.id,
               {"reference": boat.reference, "from": before, "to": boat.status, "reason": data.reason}, request)
    db.commit()
    return boat_card(boat)


# --- dealers -------------------------------------------------------------------
@router.get("/dealers")
def dealers(db: Session = Depends(get_db)):
    rows = db.scalars(select(DealerProfile).order_by(DealerProfile.created_at.desc())).all()
    counts = dict(db.execute(select(Boat.dealer_id, func.count()).where(Boat.status == "active")
                             .group_by(Boat.dealer_id)).all())
    return {"items": [dealer_public(d, counts.get(d.id, 0)) | {
        "owner_email": d.user.email, "owner_active": d.user.is_active,
        "history": [{"status": r.status, "note": r.note, "created_at": iso(r.created_at)}
                    for r in d.verification_records[:5]]} for d in rows]}


@router.post("/dealers/{dealer_id}/verification")
def verify_dealer(dealer_id: int, data: AdminDealerVerifyIn, request: Request, admin: User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    d = db.get(DealerProfile, dealer_id)
    if d is None:
        raise HTTPException(404, "Händler nicht gefunden.")
    before = d.verification_status
    d.verification_status = data.status
    db.add(VerificationRecord(dealer_id=d.id, status=data.status, note=data.note, admin_id=admin.id))
    log_action(db, admin, "dealer.verification", "dealer", d.id,
               {"company": d.company_name, "from": before, "to": data.status, "note": data.note}, request)
    db.commit()
    return dealer_public(d)


# --- reported listings -----------------------------------------------------------
@router.get("/reports")
def reports(status: str = "open", db: Session = Depends(get_db)):
    rows = db.scalars(select(ListingReport).where(ListingReport.status == status)
                      .order_by(ListingReport.created_at.desc()).limit(200)).unique().all()
    return {"items": [{"id": r.id, "reason": r.reason, "details": r.details, "status": r.status,
                       "resolution_note": r.resolution_note, "created_at": iso(r.created_at),
                       "reporter": r.reporter.display_name if r.reporter else None,
                       "boat": boat_card(r.boat)} for r in rows]}


@router.post("/reports/{report_id}/resolve")
def resolve_report(report_id: int, data: AdminReportResolveIn, request: Request, admin: User = Depends(require_admin),
                   db: Session = Depends(get_db)):
    r = db.get(ListingReport, report_id)
    if r is None:
        raise HTTPException(404, "Meldung nicht gefunden.")
    r.status, r.resolution_note, r.resolved_by_id, r.resolved_at = data.status, data.note, admin.id, utcnow()
    if data.remove_listing and r.boat.status != "removed":
        r.boat.status = "removed"
        r.boat.rejection_reason = data.note or "Nach Meldung durch die Moderation entfernt."
        log_action(db, admin, "listing.remove", "boat", r.boat_id,
                   {"reference": r.boat.reference, "via_report": r.id, "reason": data.note}, request)
    log_action(db, admin, f"report.{data.status}", "listing_report", r.id, {"note": data.note}, request)
    db.commit()
    return {"ok": True}


# --- refurbishment documentation ---------------------------------------------------
@router.get("/refurb-reports")
def refurb_reports(db: Session = Depends(get_db)):
    rows = db.scalars(select(RefurbishmentReport).join(Boat).where(Boat.status != "removed")
                      .order_by(RefurbishmentReport.admin_reviewed_at.is_not(None), RefurbishmentReport.updated_at.desc())
                      .limit(200)).unique().all()
    return {"items": [{"boat": boat_card(r.boat), "report": report_out(r.boat),
                       "document_count": len(r.boat.documents),
                       "admin_reviewed_at": iso(r.admin_reviewed_at), "admin_review_note": r.admin_review_note}
                      for r in rows]}


@router.post("/refurb-reports/{report_id}/review")
def review_refurb(report_id: int, data: AdminRefurbReviewIn, request: Request, admin: User = Depends(require_admin),
                  db: Session = Depends(get_db)):
    r = db.get(RefurbishmentReport, report_id)
    if r is None:
        raise HTTPException(404, "Bericht nicht gefunden.")
    if data.verification == "independently_verified" and not data.verified_by:
        raise HTTPException(422, "Bitte gib an, wer die unabhängige Prüfung durchgeführt hat.")
    r.verification = data.verification
    r.verified_by = data.verified_by if data.verification == "independently_verified" else None
    r.verified_at = utcnow() if data.verification == "independently_verified" else None
    r.admin_reviewed_at, r.admin_review_note = utcnow(), data.note
    log_action(db, admin, "refurb_report.review", "refurbishment_report", r.id,
               {"boat": r.boat.reference, "verification": data.verification, "verified_by": data.verified_by,
                "note": data.note}, request)
    db.commit()
    return {"ok": True}


@router.get("/audit-log")
def audit_log(page: int = Query(1, ge=1), db: Session = Depends(get_db)):
    total = _count(db, AuditLog)
    rows = db.scalars(select(AuditLog).order_by(AuditLog.id.desc()).offset((page - 1) * 50).limit(50)).all()
    return {"total": total, "page": page, "pages": max(1, -(-total // 50)), "items": [
        {"id": a.id, "action": a.action, "target_type": a.target_type, "target_id": a.target_id,
         "details": a.details, "admin": a.admin.display_name if a.admin else "System / CLI",
         "created_at": iso(a.created_at)} for a in rows]}
