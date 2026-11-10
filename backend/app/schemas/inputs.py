"""Request schemas (input validation). Responses are built by app.services.serializers."""
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..models import enums

Category = Literal[enums.CATEGORIES]
Condition = Literal[enums.CONDITIONS]
RefurbStatus = Literal[enums.REFURB_STATUSES]


class Base(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


def _password_rules(v: str) -> str:
    if len(v) < 10:
        raise ValueError("Das Passwort muss mindestens 10 Zeichen lang sein.")
    if v.isdigit() or v.isalpha():
        raise ValueError("Das Passwort muss Buchstaben und Ziffern oder Sonderzeichen enthalten.")
    return v


class RegisterIn(Base):
    email: EmailStr
    password: str = Field(max_length=200)
    display_name: str = Field(min_length=2, max_length=80)
    account_type: Literal["buyer", "private_seller", "dealer"] = "buyer"
    company_name: str | None = Field(default=None, max_length=120)

    _pw = field_validator("password")(_password_rules)


class LoginIn(Base):
    email: EmailStr
    password: str = Field(max_length=200)


class PasswordResetRequestIn(Base):
    email: EmailStr


class PasswordResetConfirmIn(Base):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(max_length=200)

    _pw = field_validator("password")(_password_rules)


class PasswordChangeIn(Base):
    current_password: str = Field(max_length=200)
    new_password: str = Field(max_length=200)

    _pw = field_validator("new_password")(_password_rules)


class ProfileIn(Base):
    display_name: str = Field(min_length=2, max_length=80)
    location: str | None = Field(default=None, max_length=120)
    phone: str | None = Field(default=None, max_length=40)
    bio: str | None = Field(default=None, max_length=2000)


class RoleAddIn(Base):
    role: Literal["private_seller", "dealer"]
    company_name: str | None = Field(default=None, max_length=120)


class DealerProfileIn(Base):
    company_name: str = Field(min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=5000)
    contact_email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=40)
    website: str | None = Field(default=None, max_length=255)
    street: str | None = Field(default=None, max_length=120)
    postal_code: str | None = Field(default=None, max_length=12)
    city: str | None = Field(default=None, max_length=80)

    @field_validator("website")
    @classmethod
    def _website(cls, v):
        if v and not v.lower().startswith(("http://", "https://")):
            v = "https://" + v
        return v or None

    @field_validator("contact_email", mode="before")
    @classmethod
    def _empty_email(cls, v):
        return v or None


class SpecIn(Base):
    length_m: float | None = Field(default=None, gt=0, lt=100)
    beam_m: float | None = Field(default=None, gt=0, lt=30)
    draft_m: float | None = Field(default=None, ge=0, lt=15)
    displacement_kg: int | None = Field(default=None, gt=0, lt=500000)
    hull_material: str | None = Field(default=None, max_length=60)
    sail_area_m2: float | None = Field(default=None, gt=0, lt=2000)
    mast_height_m: float | None = Field(default=None, gt=0, lt=80)
    berths: int | None = Field(default=None, ge=0, le=30)
    engine: str | None = Field(default=None, max_length=160)
    trailer: str | None = Field(default=None, max_length=160)


class EquipmentIn(Base):
    main_sail: str | None = Field(default=None, max_length=1000)
    jib: str | None = Field(default=None, max_length=1000)
    genoa: str | None = Field(default=None, max_length=1000)
    spinnaker: str | None = Field(default=None, max_length=1000)
    gennaker: str | None = Field(default=None, max_length=1000)
    electronics: str | None = Field(default=None, max_length=2000)
    other: str | None = Field(default=None, max_length=3000)


class ReportEntryIn(Base):
    id: int | None = None
    section: Literal[enums.REPORT_SECTIONS]
    status: Literal[enums.ENTRY_STATUSES]
    description: str | None = Field(default=None, max_length=3000)
    work_date: date | None = None
    seller_notes: str | None = Field(default=None, max_length=2000)


class ReportIn(Base):
    summary: str | None = Field(default=None, max_length=3000)
    seller_notes: str | None = Field(default=None, max_length=3000)
    entries: list[ReportEntryIn] = Field(default_factory=list, max_length=40)


class BoatIn(Base):
    """All fields optional so that drafts can be saved at any step.
    Completeness is enforced server-side when a listing is published."""

    category: Category | None = None
    manufacturer: str | None = Field(default=None, max_length=80)
    model: str | None = Field(default=None, max_length=80)
    year: int | None = Field(default=None, ge=1850, le=2100)
    description: str | None = Field(default=None, max_length=10000)
    price_eur: int | None = Field(default=None, ge=1, le=50_000_000)
    price_negotiable: bool = False
    location_city: str | None = Field(default=None, max_length=80)
    location_postal: str | None = Field(default=None, max_length=12)
    location_region: str | None = Field(default=None, max_length=80)
    condition: Condition = "used"
    refurb_status: RefurbStatus = "none"
    spec: SpecIn = Field(default_factory=SpecIn)
    equipment: EquipmentIn = Field(default_factory=EquipmentIn)
    report: ReportIn | None = None


class BoatStatusIn(Base):
    action: Literal["publish", "pause", "resume", "archive", "to_draft"]


class ImageOrderIn(Base):
    image_ids: list[int] = Field(max_length=100)


class ConversationStartIn(Base):
    boat_id: int
    kind: Literal[enums.MESSAGE_KINDS] = "message"
    body: str = Field(min_length=2, max_length=4000)


class MessageIn(Base):
    body: str = Field(min_length=1, max_length=4000)


class ListingReportIn(Base):
    reason: Literal[enums.LISTING_REPORT_REASONS]
    details: str | None = Field(default=None, max_length=2000)


# --- admin -----------------------------------------------------------------
class AdminUserUpdateIn(Base):
    is_active: bool
    note: str | None = Field(default=None, max_length=500)


class AdminBoatDecisionIn(Base):
    action: Literal["approve", "reject", "remove", "restore"]
    reason: str | None = Field(default=None, max_length=1000)


class AdminDealerVerifyIn(Base):
    status: Literal[enums.DEALER_VERIFICATION]
    note: str | None = Field(default=None, max_length=1000)


class AdminReportResolveIn(Base):
    status: Literal["resolved", "dismissed"]
    note: str | None = Field(default=None, max_length=1000)
    remove_listing: bool = False


class AdminRefurbReviewIn(Base):
    verification: Literal[enums.REPORT_VERIFICATION]
    verified_by: str | None = Field(default=None, max_length=160)
    note: str | None = Field(default=None, max_length=1000)
