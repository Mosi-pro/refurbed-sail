from app.core.db import SessionLocal
from app.models import User

from .conftest import PASSWORD, Api
from app.main import app


def test_health():
    r = Api(app).get("/api/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_register_login_logout(make_client):
    c = make_client("a@example.com")
    assert c.get("/api/auth/me").json()["user"]["email"] == "a@example.com"
    with SessionLocal() as db:
        u = db.query(User).one()
        assert u.password_hash.startswith("$argon2") and PASSWORD not in u.password_hash
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").json()["user"] is None
    assert c.post("/api/auth/login", json={"email": "a@example.com", "password": "falsch-falsch-1"}).status_code == 401
    r = c.post("/api/auth/login", json={"email": "A@example.com", "password": PASSWORD})
    assert r.status_code == 200
    assert "httponly" in r.headers["set-cookie"].lower()


def test_register_validation(make_client):
    c = make_client()
    base = {"email": "b@example.com", "display_name": "B B"}
    assert c.post("/api/auth/register", json=base | {"password": "kurz1"}).status_code == 422
    assert c.post("/api/auth/register", json=base | {"password": PASSWORD, "account_type": "admin"}).status_code == 422
    assert c.post("/api/auth/register", json=base | {"password": PASSWORD, "roles": ["admin"]}).status_code == 422
    assert c.post("/api/auth/register", json=base | {"password": PASSWORD}).status_code == 201
    assert Api(app).post("/api/auth/register", json=base | {"password": PASSWORD}).status_code == 409


def test_csrf_required(make_client):
    c = make_client()
    c.send_csrf = False
    body = {"email": "a@example.com", "password": PASSWORD}
    assert c.post("/api/auth/login", json=body).status_code == 403
    c.get("/api/health")
    token = c.cookies["rs_csrf"]
    assert c.post("/api/auth/login", json=body, headers={"X-CSRF-Token": "wrong"}).status_code == 403
    r = c.post("/api/auth/login", json=body, headers={"X-CSRF-Token": token, "Origin": "https://evil.example"})
    assert r.status_code == 403
    assert c.post("/api/auth/login", json=body, headers={"X-CSRF-Token": token}).status_code == 401


def test_login_rate_limit(make_client):
    c = make_client("a@example.com")
    c.post("/api/auth/logout")
    codes = [c.post("/api/auth/login", json={"email": "a@example.com", "password": "falsch-falsch-1"}).status_code
             for _ in range(10)]
    assert codes[0] == 401 and codes[-1] == 429


def test_cannot_self_grant_admin(make_client):
    c = make_client("a@example.com")
    assert c.post("/api/account/roles", json={"role": "admin"}).status_code == 422
    assert c.get("/api/admin/overview").status_code == 403
    assert make_client().get("/api/admin/overview").status_code == 401
    r = c.post("/api/account/roles", json={"role": "private_seller"})
    assert r.status_code == 200 and "private_seller" in r.json()["user"]["roles"]
    assert "admin" not in r.json()["user"]["roles"]


def test_password_change_and_reset(make_client, tmp_path):
    c = make_client("a@example.com")
    assert c.post("/api/auth/password/change", json={"current_password": "x" * 12, "new_password": "neues-passwort-99"}).status_code == 400
    assert c.post("/api/auth/password/change", json={"current_password": PASSWORD, "new_password": "neues-passwort-99"}).status_code == 200
    # reset: unknown addresses answer identically
    assert c.post("/api/auth/password/reset-request", json={"email": "nobody@example.com"}).json() == {"ok": True}
    assert c.post("/api/auth/password/reset-request", json={"email": "a@example.com"}).json() == {"ok": True}
    from app.core.config import get_settings
    line = (get_settings().log_dir / "mail.log").read_text().strip().splitlines()[-1]
    token = line.split("token=")[1]
    assert c.post("/api/auth/password/reset-confirm", json={"token": token, "password": "ganz-neues-pw-77"}).status_code == 200
    assert c.post("/api/auth/password/reset-confirm", json={"token": token, "password": "ganz-neues-pw-78"}).status_code == 400
    assert c.get("/api/auth/me").json()["user"] is None  # sessions revoked
    assert c.post("/api/auth/login", json={"email": "a@example.com", "password": "ganz-neues-pw-77"}).status_code == 200
