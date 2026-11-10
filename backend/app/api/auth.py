import logging
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..core.config import get_settings
from ..core.db import get_db
from ..core.deps import SESSION_COOKIE, current_user, optional_user
from ..core.ratelimit import check_rate, client_ip, rate_limit
from ..core.security import hash_password, hash_token, needs_rehash, new_token, verify_password
from ..models import DealerProfile, PasswordResetToken, User, UserRole, UserSession, utcnow
from ..schemas.inputs import LoginIn, PasswordChangeIn, PasswordResetConfirmIn, PasswordResetRequestIn, RegisterIn
from ..services.boats import unique_dealer_slug
from ..services.serializers import user_private

router = APIRouter(prefix="/api/auth", tags=["auth"])
mail_log = logging.getLogger("refurbed_sail.mail")


def start_session(db: Session, user: User, request: Request, response: Response) -> None:
    s = get_settings()
    token = new_token()
    db.add(UserSession(
        token_hash=hash_token(token),
        user_id=user.id,
        expires_at=utcnow() + timedelta(days=s.session_days),
        ip=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:255],
    ))
    user.last_login_at = utcnow()
    response.set_cookie(
        SESSION_COOKIE, token, max_age=s.session_days * 86400, httponly=True,
        secure=s.secure_cookies, samesite="lax", path="/",
    )


def create_dealer_profile(db: Session, user: User, company_name: str | None) -> DealerProfile:
    name = (company_name or user.display_name).strip()
    profile = DealerProfile(user_id=user.id, company_name=name, slug=unique_dealer_slug(db, name),
                            verification_status="unverified", city=user.location)
    db.add(profile)
    return profile


@router.get("/me")
def me(user: User | None = Depends(optional_user)):
    return {"user": user_private(user) if user else None}


@router.post("/register", status_code=201, dependencies=[Depends(rate_limit("register", 8, 3600))])
def register(data: RegisterIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(409, "Für diese E-Mail-Adresse besteht bereits ein Konto.")
    if data.account_type == "dealer" and not data.company_name:
        raise HTTPException(422, "Bitte gib den Firmennamen an.")
    user = User(email=email, password_hash=hash_password(data.password), display_name=data.display_name)
    # Roles are derived from a fixed whitelist; "admin" can never be self-assigned.
    roles = {"buyer"}
    if data.account_type in ("private_seller", "dealer"):
        roles.add(data.account_type)
    user.roles = [UserRole(role=r) for r in sorted(roles)]
    db.add(user)
    db.flush()
    if "dealer" in roles:
        create_dealer_profile(db, user, data.company_name)
    start_session(db, user, request, response)
    db.commit()
    db.refresh(user)
    return {"user": user_private(user)}


@router.post("/login")
def login(data: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    email = data.email.lower()
    check_rate(f"login-ip:{client_ip(request)}", 20, 900)
    check_rate(f"login-account:{email}", 8, 900)
    user = db.scalar(select(User).where(User.email == email))
    ok = verify_password(data.password, user.password_hash if user else None)
    if not ok or user is None:
        raise HTTPException(401, "E-Mail-Adresse oder Passwort sind nicht korrekt.")
    if not user.is_active:
        raise HTTPException(403, "Dieses Konto wurde deaktiviert. Bitte wende dich an den Support.")
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
    start_session(db, user, request, response)
    db.commit()
    return {"user": user_private(user)}


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.post("/logout-all")
def logout_all(response: Response, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@router.post("/password/change", dependencies=[Depends(rate_limit("pwchange", 10, 900))])
def change_password(data: PasswordChangeIn, request: Request, user: User = Depends(current_user),
                    db: Session = Depends(get_db)):
    if not verify_password(data.current_password, user.password_hash):
        raise HTTPException(400, "Das aktuelle Passwort ist nicht korrekt.")
    user.password_hash = hash_password(data.new_password)
    # Invalidate every other session of this account.
    db.execute(delete(UserSession).where(
        UserSession.user_id == user.id, UserSession.id != getattr(request.state, "session_id", 0)))
    db.commit()
    return {"ok": True}


@router.post("/password/reset-request", dependencies=[Depends(rate_limit("pwreset", 5, 3600))])
def password_reset_request(data: PasswordResetRequestIn, db: Session = Depends(get_db)):
    """Always answers identically so that account existence is not revealed.
    No mail transport is configured yet: the reset link is written to logs/mail.log."""
    user = db.scalar(select(User).where(User.email == data.email.lower(), User.is_active.is_(True)))
    if user:
        token = new_token()
        db.add(PasswordResetToken(user_id=user.id, token_hash=hash_token(token),
                                  expires_at=utcnow() + timedelta(hours=2)))
        db.commit()
        link = f"{get_settings().public_base_url}/passwort-zuruecksetzen?token={token}"
        mail_log.info("Passwort-Reset für %s: %s", user.email, link)
    return {"ok": True}


@router.post("/password/reset-confirm", dependencies=[Depends(rate_limit("pwreset-confirm", 10, 3600))])
def password_reset_confirm(data: PasswordResetConfirmIn, db: Session = Depends(get_db)):
    rec = db.scalar(select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(data.token)))
    if rec is None or rec.used_at is not None or rec.expires_at < utcnow():
        raise HTTPException(400, "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.")
    user = db.get(User, rec.user_id)
    user.password_hash = hash_password(data.password)
    rec.used_at = utcnow()
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()
    return {"ok": True}
