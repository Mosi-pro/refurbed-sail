import io
import os
import tempfile

_tmp = tempfile.mkdtemp(prefix="rs-test-")
os.environ.update({
    "RS_DATABASE_URL": f"sqlite:///{_tmp}/test.db",
    "RS_UPLOAD_DIR": f"{_tmp}/uploads",
    "RS_LOG_DIR": f"{_tmp}/logs",
    "RS_SECRET_KEY": "test-secret",
    "RS_ENV": "development",
    "RS_PUBLIC_BASE_URL": "http://testserver",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import User, UserRole  # noqa: E402

PASSWORD = "sicheres-passwort-42"


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    ratelimit.reset_all()
    yield


class Api(TestClient):
    """Test client that behaves like the browser app: sends the CSRF token header."""

    send_csrf = True

    def request(self, method, url, **kw):
        if method.upper() in ("POST", "PUT", "PATCH", "DELETE") and self.send_csrf:
            if "rs_csrf" not in self.cookies:
                super().request("GET", "/api/health")
            kw["headers"] = {**(kw.get("headers") or {}), "X-CSRF-Token": self.cookies["rs_csrf"]}
        return super().request(method, url, **kw)


@pytest.fixture
def make_client():
    def _make(email=None, account_type="buyer", company=None):
        c = Api(app)
        if email:
            r = c.post("/api/auth/register", json={"email": email, "password": PASSWORD, "display_name": "Test Nutzer",
                                                   "account_type": account_type, "company_name": company})
            assert r.status_code == 201, r.text
        return c

    return _make


@pytest.fixture
def admin_client(make_client):
    c = make_client("admin@example.com")
    with SessionLocal() as db:
        u = db.query(User).filter_by(email="admin@example.com").one()
        u.roles.append(UserRole(role="admin"))
        db.commit()
    return c


def png_bytes(color=(20, 60, 90), size=(800, 600), fmt="PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, fmt)
    return buf.getvalue()


VALID_BOAT = {
    "category": "segelyacht", "manufacturer": "Dehler", "model": "34", "year": 1988,
    "description": "Ein gepflegtes Boot mit vollständiger Ausrüstung und neuer Maschine.",
    "price_eur": 38500, "location_city": "Kiel", "location_region": "Schleswig-Holstein",
    "condition": "used", "refurb_status": "none", "spec": {"length_m": 10.2, "berths": 6},
    "equipment": {"main_sail": "Großsegel 2021"},
}


def create_listing(client, admin=None, payload=None, publish=True):
    """Creates a listing with one image; optionally publishes and approves it."""
    r = client.post("/api/my/boats", json=payload or VALID_BOAT)
    assert r.status_code == 201, r.text
    boat = r.json()
    r = client.post(f"/api/my/boats/{boat['id']}/images", files=[("files", ("a.png", png_bytes(), "image/png"))])
    assert r.status_code == 201, r.text
    if publish:
        r = client.post(f"/api/my/boats/{boat['id']}/status", json={"action": "publish"})
        assert r.status_code == 200, r.text
        if admin is not None:
            r = admin.post(f"/api/admin/boats/{boat['id']}/decision", json={"action": "approve"})
            assert r.status_code == 200, r.text
    return boat
