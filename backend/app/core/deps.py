from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import User, UserSession, utcnow
from .db import get_db
from .security import hash_token

SESSION_COOKIE = "rs_session"
CSRF_COOKIE = "rs_csrf"


def optional_user(request: Request, db: Session = Depends(get_db)) -> User | None:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        return None
    sess = db.scalar(select(UserSession).where(UserSession.token_hash == hash_token(token)))
    if sess is None or sess.expires_at < utcnow() or not sess.user.is_active:
        return None
    request.state.session_id = sess.id
    return sess.user


def current_user(user: User | None = Depends(optional_user)) -> User:
    if user is None:
        raise HTTPException(status_code=401, detail="Bitte melde dich an.")
    return user


def require_role(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if not any(user.has_role(r) for r in roles):
            raise HTTPException(status_code=403, detail="Für diesen Bereich fehlt dir die Berechtigung.")
        return user

    return dep


require_admin = require_role("admin")
require_dealer = require_role("dealer")
