from app.main import app

from .conftest import VALID_BOAT, Api, create_listing, png_bytes


def test_buyer_cannot_create_listing(make_client):
    assert make_client("b@example.com").post("/api/my/boats", json=VALID_BOAT).status_code == 403
    assert make_client().post("/api/my/boats", json=VALID_BOAT).status_code == 401


def test_listing_lifecycle_with_approval(make_client, admin_client):
    seller = make_client("s@example.com", "private_seller")
    anon = make_client()
    r = seller.post("/api/my/boats", json={})  # empty draft is allowed
    assert r.status_code == 201
    boat_id = r.json()["id"]
    r = seller.post(f"/api/my/boats/{boat_id}/status", json={"action": "publish"})
    assert r.status_code == 422  # incomplete
    assert seller.put(f"/api/my/boats/{boat_id}", json=VALID_BOAT).status_code == 200
    assert seller.post(f"/api/my/boats/{boat_id}/status", json={"action": "publish"}).status_code == 422  # no photo
    seller.post(f"/api/my/boats/{boat_id}/images", files=[("files", ("a.png", png_bytes(), "image/png"))])
    r = seller.post(f"/api/my/boats/{boat_id}/status", json={"action": "publish"})
    assert r.json()["status"] == "pending"
    slug = r.json()["slug"]
    assert anon.get("/api/boats").json()["total"] == 0
    assert anon.get(f"/api/boats/{slug}").status_code == 404
    assert seller.get(f"/api/boats/{slug}").status_code == 200  # owner preview
    assert seller.post(f"/api/admin/boats/{boat_id}/decision", json={"action": "approve"}).status_code == 403
    assert admin_client.post(f"/api/admin/boats/{boat_id}/decision", json={"action": "approve"}).status_code == 200
    data = anon.get(f"/api/boats/{slug}").json()
    assert data["seller"]["type"] == "private" and "email" not in str(data["seller"])
    assert anon.get("/api/boats").json()["total"] == 1
    # pause / resume keeps approval
    assert seller.post(f"/api/my/boats/{boat_id}/status", json={"action": "pause"}).json()["status"] == "paused"
    assert anon.get("/api/boats").json()["total"] == 0
    assert seller.post(f"/api/my/boats/{boat_id}/status", json={"action": "resume"}).json()["status"] == "active"
    # other users cannot touch it
    other = make_client("o@example.com", "private_seller")
    assert other.put(f"/api/my/boats/{boat_id}", json=VALID_BOAT).status_code == 404
    assert other.delete(f"/api/my/boats/{boat_id}").status_code == 404
    assert seller.delete(f"/api/my/boats/{boat_id}").status_code == 200
    assert anon.get(f"/api/boats/{slug}").status_code == 404


def test_filters_sort_pagination(make_client, admin_client):
    seller = make_client("s@example.com", "private_seller")
    dealer = make_client("d@example.com", "dealer", "Werft Test")
    create_listing(seller, admin_client)
    create_listing(seller, admin_client, VALID_BOAT | {"category": "jolle", "manufacturer": "ILCA", "model": "7", "year": 2018,
                                                       "price_eur": 4200, "location_city": "Konstanz",
                                                       "spec": {"length_m": 4.23}})
    create_listing(dealer, admin_client, VALID_BOAT | {"category": "regattaboot", "manufacturer": "J/Boats", "model": "J/70",
                                                       "year": 2015, "price_eur": 31500, "location_city": "Hamburg",
                                                       "spec": {"length_m": 6.93}})
    c = make_client()

    def total(**params):
        return c.get("/api/boats", params=params).json()["total"]

    assert total() == 3
    assert total(category="jolle") == 1 and total(category="jolle,regattaboot") == 2
    assert total(q="dehler") == 1 and total(q="j/70") == 1 and total(q="100%") == 0
    assert total(manufacturer="ilca") == 1 and total(model="34") == 1
    assert total(price_min=5000) == 2 and total(price_max=5000) == 1 and total(price_min=5000, price_max=35000) == 1
    assert total(year_min=2010) == 2 and total(year_max=1990) == 1
    assert total(length_min=6, length_max=8) == 1
    assert total(location="kons") == 1
    assert total(seller_type="private") == 2 and total(seller_type="dealer") == 1 and total(seller_type="verified_dealer") == 0
    assert total(condition="used") == 3 and total(condition="refurbished") == 0
    assert total(refurb_status="work_completed") == 0
    prices = [b["price_eur"] for b in c.get("/api/boats", params={"sort": "price_asc"}).json()["items"]]
    assert prices == sorted(prices)
    years = [b["year"] for b in c.get("/api/boats", params={"sort": "year_desc"}).json()["items"]]
    assert years == sorted(years, reverse=True)
    page = c.get("/api/boats", params={"page_size": 2, "page": 2}).json()
    assert page["pages"] == 2 and len(page["items"]) == 1
    f = c.get("/api/boats/facets").json()
    assert f["categories"]["jolle"] == 1 and len(f["manufacturers"]) == 3
    assert c.get("/api/boats", params={"sort": "bogus"}).status_code == 422


def test_refurb_report_rules(make_client, admin_client):
    dealer = make_client("d@example.com", "dealer", "Werft Test")
    payload = VALID_BOAT | {"condition": "refurbished", "refurb_status": "work_completed"}
    r = dealer.post("/api/my/boats", json=payload)
    boat_id = r.json()["id"]
    assert r.json()["refurb_status"] == "none"  # no report -> status cannot be claimed
    dealer.post(f"/api/my/boats/{boat_id}/images", files=[("files", ("a.png", png_bytes(), "image/png"))])
    assert dealer.post(f"/api/my/boats/{boat_id}/status", json={"action": "publish"}).status_code == 422
    payload["report"] = {"summary": "Aufbereitung 2024", "entries": [
        {"section": "hull", "status": "renewed", "description": "Neu aufgebaut", "work_date": "2024-03-01"},
        {"section": "rigging", "status": "inspected"}]}
    r = dealer.put(f"/api/my/boats/{boat_id}", json=payload)
    rep = r.json()["report"]
    assert r.status_code == 200 and len(rep["entries"]) == 2 and rep["verification"] == "seller_provided"
    # seller cannot set verification
    bad = payload | {"report": payload["report"] | {"verification": "independently_verified"}}
    assert dealer.put(f"/api/my/boats/{boat_id}", json=bad).status_code == 422
    # document attached to entry
    entry_id = rep["entries"][0]["id"]
    r = dealer.post(f"/api/my/boats/{boat_id}/documents", files={"file": ("p.pdf", b"%PDF-1.4 demo", "application/pdf")},
                    data={"entry_id": str(entry_id), "title": "Protokoll"})
    assert r.status_code == 201
    doc_url = r.json()["url"]
    assert make_client().get(doc_url).status_code == 404  # private until the listing is live
    assert dealer.get(doc_url).status_code == 200
    dealer.post(f"/api/my/boats/{boat_id}/status", json={"action": "publish"})
    admin_client.post(f"/api/admin/boats/{boat_id}/decision", json={"action": "approve"})
    assert make_client().get(doc_url).status_code == 200
    # admin marks independent verification; seller edit resets it
    report_id = rep["id"]
    assert admin_client.post(f"/api/admin/refurb-reports/{report_id}/review",
                             json={"verification": "independently_verified"}).status_code == 422
    assert admin_client.post(f"/api/admin/refurb-reports/{report_id}/review",
                             json={"verification": "independently_verified", "verified_by": "Sachverständigenbüro X"}).status_code == 200
    detail = dealer.get(f"/api/my/boats/{boat_id}").json()
    assert detail["report"]["verification"] == "independently_verified"
    payload["report"]["entries"] = [{"id": e["id"], "section": e["section"], "status": e["status"],
                                     "description": "geändert"} for e in detail["report"]["entries"]]
    r = dealer.put(f"/api/my/boats/{boat_id}", json=payload)
    assert r.json()["report"]["verification"] == "seller_provided"


def test_upload_validation(make_client):
    seller = make_client("s@example.com", "private_seller")
    boat_id = seller.post("/api/my/boats", json={}).json()["id"]
    url = f"/api/my/boats/{boat_id}/images"
    assert seller.post(url, files=[("files", ("x.png", b"not an image", "image/png"))]).status_code == 415
    assert seller.post(url, files=[("files", ("x.jpg", b"<svg onload=alert(1)>", "image/jpeg"))]).status_code == 415
    assert seller.post(url, files=[("files", ("x.png", b"", "image/png"))]).status_code == 400
    r = seller.post(url, files=[("files", ("a.png", png_bytes(), "image/png")),
                                ("files", ("b.jpg", png_bytes((200, 10, 10), fmt="JPEG"), "image/jpeg"))])
    assert r.status_code == 201
    imgs = r.json()["images"]
    assert len(imgs) == 2 and imgs[0]["url"].endswith(".jpg")
    assert seller.get(imgs[0]["thumb_url"]).status_code == 200
    ids = [i["id"] for i in imgs]
    r = seller.put(f"{url}/order", json={"image_ids": ids[::-1]})
    assert [i["id"] for i in r.json()["images"]] == ids[::-1]
    assert seller.put(f"{url}/order", json={"image_ids": ids[:1]}).status_code == 422
    assert len(seller.delete(f"{url}/{ids[0]}").json()["images"]) == 1
    doc = f"/api/my/boats/{boat_id}/documents"
    assert seller.post(doc, files={"file": ("x.pdf", b"MZ\x90\x00 exe", "application/pdf")}).status_code == 415
    from app.core.config import get_settings
    get_settings().max_document_mb = 0
    try:
        assert seller.post(doc, files={"file": ("x.pdf", b"%PDF-1.4" + b"0" * 2048, "application/pdf")}).status_code == 413
    finally:
        get_settings().max_document_mb = 15
    assert Api(app).get("/media/../private/x").status_code == 404
