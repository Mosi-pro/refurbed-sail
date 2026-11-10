import logging
import secrets
from logging.handlers import RotatingFileHandler
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from .api import account, admin, auth, boats, dealers, listings, messages
from .core.config import get_settings
from .core.db import engine
from .core.deps import CSRF_COOKIE

settings = get_settings()

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
_mail = logging.getLogger("refurbed_sail.mail")
if not _mail.handlers:
    h = RotatingFileHandler(settings.log_dir / "mail.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    h.setFormatter(logging.Formatter("%(asctime)s %(message)s"))
    _mail.addHandler(h)
    _mail.propagate = False

app = FastAPI(
    title="REFURBED SAIL API",
    version="1.0.0",
    docs_url=None if settings.is_production else "/api/docs",
    redoc_url=None,
    openapi_url=None if settings.is_production else "/api/openapi.json",
)

UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}


def _origin_allowed(request: Request) -> bool:
    origin = request.headers.get("origin")
    if not origin:
        return True
    host = urlparse(origin).netloc
    extra = {urlparse(o.strip()).netloc for o in settings.allowed_origins.split(",") if o.strip()}
    forwarded = request.headers.get("x-forwarded-host")
    return host in {request.headers.get("host"), forwarded, urlparse(settings.public_base_url).netloc} | extra


@app.middleware("http")
async def security_middleware(request: Request, call_next):
    """CSRF protection (double-submit token + Origin check) and security headers."""
    csrf_cookie = request.cookies.get(CSRF_COOKIE)
    if request.method in UNSAFE and request.url.path.startswith("/api/"):
        header = request.headers.get("x-csrf-token")
        if not csrf_cookie or not header or not secrets.compare_digest(csrf_cookie, header) or not _origin_allowed(request):
            return JSONResponse({"detail": "Sicherheitsprüfung fehlgeschlagen. Bitte lade die Seite neu."}, status_code=403)
    response = await call_next(request)
    if not csrf_cookie:
        response.set_cookie(CSRF_COOKIE, secrets.token_urlsafe(24), max_age=60 * 60 * 24 * 30, httponly=False,
                            secure=settings.secure_cookies, samesite="lax", path="/")
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/"):
        response.headers.setdefault("Cache-Control", "no-store")
    return response


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    """Flatten validation errors into one readable message plus field details."""
    fields = {}
    for err in exc.errors():
        loc = ".".join(str(p) for p in err["loc"] if p not in ("body", "query"))
        fields[loc] = err["msg"].removeprefix("Value error, ")
    first = next(iter(fields.items()), ("", "Ungültige Eingabe."))
    return JSONResponse({"detail": f"Ungültige Eingabe ({first[0]}): {first[1]}" if first[0] else first[1],
                         "fields": fields}, status_code=422)


@app.get("/api/health", tags=["system"])
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # pragma: no cover
        db_ok = False
    body = {"status": "ok" if db_ok else "degraded", "database": "ok" if db_ok else "error",
            "service": "refurbed-sail", "version": app.version}
    return JSONResponse(body, status_code=200 if db_ok else 503)


for module in (auth, boats, listings, account, messages, dealers, admin):
    app.include_router(module.router)
app.include_router(listings.doc_router)

# Only uploads/public is served statically. uploads/private is reachable
# exclusively through /api/documents/{id}/file, which checks authorisation.
app.mount("/media", StaticFiles(directory=settings.public_upload_dir), name="media")
