"""Response builders. Private data (e-mail addresses, private phone numbers)
is never part of public payloads."""
from ..models import Boat, Conversation, DealerProfile, Document, Message, User

MEDIA = "/media/"


def media(path: str | None) -> str | None:
    return MEDIA + path if path else None


def iso(dt):
    return dt.isoformat() + "Z" if dt else None


def user_private(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "display_name": u.display_name,
        "location": u.location,
        "phone": u.phone,
        "bio": u.bio,
        "avatar_url": media(u.avatar_path),
        "roles": u.role_names,
        "is_demo": u.is_demo,
        "created_at": iso(u.created_at),
        "dealer": dealer_brief(u.dealer_profile) if u.dealer_profile and u.has_role("dealer") else None,
    }


def dealer_brief(d: DealerProfile) -> dict:
    return {
        "id": d.id,
        "slug": d.slug,
        "company_name": d.company_name,
        "logo_url": media(d.logo_path),
        "city": d.city,
        "verification_status": d.verification_status,
        "is_demo": d.is_demo,
    }


def dealer_public(d: DealerProfile, listing_count: int | None = None) -> dict:
    data = dealer_brief(d) | {
        "description": d.description,
        "contact_email": d.contact_email,
        "phone": d.phone,
        "website": d.website,
        "street": d.street,
        "postal_code": d.postal_code,
        "country": d.country,
        "member_since": iso(d.created_at),
    }
    if listing_count is not None:
        data["listing_count"] = listing_count
    return data


def seller_public(boat: Boat) -> dict:
    u = boat.seller
    return {
        "user_id": u.id,
        "type": boat.seller_type,
        "name": boat.dealer.company_name if boat.dealer else u.display_name,
        "image_url": media(boat.dealer.logo_path) if boat.dealer else media(u.avatar_path),
        "location": (boat.dealer.city if boat.dealer else u.location),
        "member_since": iso(u.created_at),
        "dealer": dealer_brief(boat.dealer) if boat.dealer else None,
    }


def image_out(i) -> dict:
    return {"id": i.id, "url": media(i.path), "thumb_url": media(i.thumb_path), "width": i.width, "height": i.height}


def boat_card(b: Boat) -> dict:
    return {
        "id": b.id,
        "reference": b.reference,
        "slug": b.slug,
        "category": b.category,
        "manufacturer": b.manufacturer,
        "model": b.model,
        "year": b.year,
        "price_eur": b.price_eur,
        "price_negotiable": b.price_negotiable,
        "location_city": b.location_city,
        "location_region": b.location_region,
        "country": b.country,
        "length_m": b.spec.length_m if b.spec else None,
        "condition": b.condition,
        "refurb_status": b.refurb_status,
        "status": b.status,
        "seller_type": b.seller_type,
        "seller_name": b.dealer.company_name if b.dealer else b.seller.display_name,
        "is_demo": b.is_demo,
        "image": image_out(b.images[0]) if b.images else None,
        "image_count": len(b.images),
        "published_at": iso(b.published_at),
        "created_at": iso(b.created_at),
        "updated_at": iso(b.updated_at),
    }


def document_out(d: Document) -> dict:
    return {
        "id": d.id,
        "kind": d.kind,
        "title": d.title,
        "original_name": d.original_name,
        "size_bytes": d.size_bytes,
        "entry_id": d.entry_id,
        "url": f"/api/documents/{d.id}/file",
        "created_at": iso(d.created_at),
    }


SPEC_FIELDS = (
    "length_m", "beam_m", "draft_m", "displacement_kg", "hull_material",
    "sail_area_m2", "mast_height_m", "berths", "engine", "trailer",
)


def report_out(b: Boat) -> dict | None:
    r = b.report
    if r is None:
        return None
    docs_by_entry: dict[int, list] = {}
    for d in b.documents:
        if d.entry_id:
            docs_by_entry.setdefault(d.entry_id, []).append(document_out(d))
    return {
        "id": r.id,
        "summary": r.summary,
        "seller_notes": r.seller_notes,
        "verification": r.verification,
        "verified_by": r.verified_by,
        "verified_at": iso(r.verified_at),
        "updated_at": iso(r.updated_at),
        "entries": [
            {
                "id": e.id,
                "section": e.section,
                "status": e.status,
                "description": e.description,
                "work_date": e.work_date.isoformat() if e.work_date else None,
                "seller_notes": e.seller_notes,
                "documents": docs_by_entry.get(e.id, []),
            }
            for e in r.entries
        ],
    }


def boat_detail(b: Boat) -> dict:
    spec = {f: getattr(b.spec, f) if b.spec else None for f in SPEC_FIELDS}
    return boat_card(b) | {
        "description": b.description,
        "location_postal": b.location_postal,
        "rejection_reason": b.rejection_reason,
        "view_count": b.view_count,
        "spec": spec,
        "equipment": {e.kind: e.description for e in b.equipment},
        "images": [image_out(i) for i in b.images],
        "report": report_out(b),
        "documents": [document_out(d) for d in b.documents if not d.entry_id],
        "seller": seller_public(b),
    }


def message_out(m: Message, viewer_id: int) -> dict:
    return {
        "id": m.id,
        "kind": m.kind,
        "body": m.body,
        "mine": m.sender_id == viewer_id,
        "created_at": iso(m.created_at),
        "read_at": iso(m.read_at),
    }


def conversation_out(c: Conversation, viewer_id: int, unread: int = 0, last: Message | None = None) -> dict:
    is_buyer = c.buyer_id == viewer_id
    other = c.seller if is_buyer else c.buyer
    b = c.boat
    other_name = other.display_name
    if is_buyer and b.dealer:
        other_name = b.dealer.company_name
    return {
        "id": c.id,
        "role": "buyer" if is_buyer else "seller",
        "other": {"name": other_name, "image_url": media(other.avatar_path)},
        "boat": {
            "id": b.id,
            "slug": b.slug,
            "reference": b.reference,
            "title": f"{b.manufacturer or ''} {b.model or ''}".strip(),
            "year": b.year,
            "price_eur": b.price_eur,
            "status": b.status,
            "thumb_url": media(b.images[0].thumb_path) if b.images else None,
        },
        "unread": unread,
        "last_message": message_out(last, viewer_id) if last else None,
        "last_message_at": iso(c.last_message_at),
    }
