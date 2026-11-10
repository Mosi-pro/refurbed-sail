from app.core.db import SessionLocal
from app.models import AuditLog

from .conftest import create_listing


def test_messaging_and_favorites(make_client, admin_client):
    seller = make_client("s@example.com", "private_seller")
    buyer = make_client("b@example.com")
    stranger = make_client("x@example.com")
    boat = create_listing(seller, admin_client)

    assert make_client().post("/api/conversations", json={"boat_id": boat["id"], "body": "Hallo"}).status_code == 401
    assert seller.post("/api/conversations", json={"boat_id": boat["id"], "body": "Hallo"}).status_code == 409
    r = buyer.post("/api/conversations", json={"boat_id": boat["id"], "kind": "viewing_request", "body": "Besichtigung?"})
    assert r.status_code == 201
    cid = r.json()["id"]
    # same buyer + boat -> same conversation
    assert buyer.post("/api/conversations", json={"boat_id": boat["id"], "body": "Noch eine Frage"}).json()["id"] == cid
    assert seller.get("/api/conversations/unread-count").json()["unread"] == 2
    lst = seller.get("/api/conversations").json()["items"]
    assert lst[0]["unread"] == 2 and lst[0]["boat"]["reference"] == boat["reference"] and lst[0]["role"] == "seller"
    assert "@" not in str(lst)  # no e-mail addresses exposed
    assert stranger.get(f"/api/conversations/{cid}").status_code == 404
    assert stranger.post(f"/api/conversations/{cid}/messages", json={"body": "hi"}).status_code == 404
    conv = seller.get(f"/api/conversations/{cid}").json()
    assert len(conv["messages"]) == 2 and conv["messages"][0]["kind"] == "viewing_request"
    assert seller.get("/api/conversations/unread-count").json()["unread"] == 0
    assert seller.post(f"/api/conversations/{cid}/messages", json={"body": "Gern am Samstag."}).status_code == 201
    msgs = buyer.get(f"/api/conversations/{cid}", params={"after_id": conv["messages"][-1]["id"]}).json()["messages"]
    assert len(msgs) == 1 and msgs[0]["mine"] is False
    assert buyer.get(f"/api/conversations/{cid}").json()["messages"][0]["read_at"] is not None

    assert make_client().put(f"/api/favorites/{boat['id']}").status_code == 401
    assert buyer.put(f"/api/favorites/{boat['id']}").status_code == 200
    assert buyer.put(f"/api/favorites/{boat['id']}").status_code == 200
    assert buyer.get("/api/favorites/ids").json()["ids"] == [boat["id"]]
    assert len(buyer.get("/api/favorites").json()["items"]) == 1
    assert buyer.delete(f"/api/favorites/{boat['id']}").status_code == 200
    assert buyer.get("/api/favorites").json()["items"] == []


def test_message_rate_limit(make_client, admin_client):
    seller = make_client("s@example.com", "private_seller")
    buyer = make_client("b@example.com")
    boat = create_listing(seller, admin_client)
    cid = buyer.post("/api/conversations", json={"boat_id": boat["id"], "body": "Hallo"}).json()["id"]
    codes = [buyer.post(f"/api/conversations/{cid}/messages", json={"body": f"n{i}"}).status_code for i in range(31)]
    assert 429 in codes


def test_dealer_verification_and_admin(make_client, admin_client):
    dealer = make_client("d@example.com", "dealer", "Werft Nord")
    prof = dealer.get("/api/dealer/profile").json()
    assert prof["verification_status"] == "unverified" and prof["slug"] == "werft-nord"
    # dealers cannot verify themselves
    r = dealer.put("/api/dealer/profile", json={"company_name": "Werft Nord", "verification_status": "verified"})
    assert r.status_code == 422
    r = dealer.put("/api/dealer/profile", json={"company_name": "Werft Nord", "city": "Kiel", "website": "werft.example"})
    assert r.status_code == 200 and r.json()["website"] == "https://werft.example" and r.json()["verification_status"] == "unverified"
    assert dealer.post(f"/api/admin/dealers/{prof['id']}/verification", json={"status": "verified"}).status_code == 403
    boat = create_listing(dealer, admin_client)
    anon = make_client()
    assert anon.get(f"/api/boats/{boat['slug']}").json()["seller"]["type"] == "dealer"
    assert admin_client.post(f"/api/admin/dealers/{prof['id']}/verification",
                             json={"status": "verified", "note": "HRB geprüft"}).status_code == 200
    assert anon.get(f"/api/boats/{boat['slug']}").json()["seller"]["type"] == "verified_dealer"
    assert anon.get("/api/boats", params={"seller_type": "verified_dealer"}).json()["total"] == 1
    pub = anon.get("/api/dealers/werft-nord").json()
    assert pub["verification_status"] == "verified" and len(pub["boats"]) == 1
    assert dealer.get("/api/dealer/dashboard").json()["totals"]["by_status"] == {"active": 1}
    assert make_client("b@example.com").get("/api/dealer/dashboard").status_code == 403

    # reports + removal
    assert anon.post(f"/api/boats/{boat['id']}/report", json={"reason": "fraud", "details": "Verdacht"}).status_code == 201
    reports = admin_client.get("/api/admin/reports").json()["items"]
    assert len(reports) == 1
    assert admin_client.post(f"/api/admin/reports/{reports[0]['id']}/resolve",
                             json={"status": "resolved", "note": "entfernt", "remove_listing": True}).status_code == 200
    assert anon.get(f"/api/boats/{boat['slug']}").status_code == 404
    assert dealer.get("/api/my/boats").json()["items"] == []

    # disable account
    users = admin_client.get("/api/admin/users", params={"q": "d@example"}).json()["items"]
    assert admin_client.patch(f"/api/admin/users/{users[0]['id']}", json={"is_active": False}).status_code == 200
    assert dealer.get("/api/auth/me").json()["user"] is None
    me = admin_client.get("/api/auth/me").json()["user"]
    assert admin_client.patch(f"/api/admin/users/{me['id']}", json={"is_active": False}).status_code == 409

    with SessionLocal() as db:
        actions = [a.action for a in db.query(AuditLog).order_by(AuditLog.id)]
    assert actions == ["listing.approve", "dealer.verification", "listing.remove", "report.resolved", "user.disable"]
    assert admin_client.get("/api/admin/audit-log").json()["total"] == 5
    ov = admin_client.get("/api/admin/overview").json()
    assert ov["users"]["total"] == 3 and ov["listings"]["by_status"] == {"removed": 1}
