from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base
from .user import DealerProfile, User, utcnow


class Boat(Base):
    __tablename__ = "boats"
    __table_args__ = (
        Index("ix_boats_status_published", "status", "published_at"),
        Index("ix_boats_status_price", "status", "price_eur"),
        Index("ix_boats_status_category", "status", "category"),
        Index("ix_boats_manufacturer_model", "manufacturer", "model"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    slug: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    dealer_id: Mapped[int | None] = mapped_column(ForeignKey("dealer_profiles.id", ondelete="SET NULL"), index=True)

    category: Mapped[str | None] = mapped_column(String(20))
    manufacturer: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    year: Mapped[int | None] = mapped_column(Integer, index=True)
    description: Mapped[str | None] = mapped_column(Text)
    price_eur: Mapped[int | None] = mapped_column(Integer)
    price_negotiable: Mapped[bool] = mapped_column(Boolean, default=False)
    location_city: Mapped[str | None] = mapped_column(String(80), index=True)
    location_postal: Mapped[str | None] = mapped_column(String(12))
    location_region: Mapped[str | None] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(2), default="DE")

    condition: Mapped[str] = mapped_column(String(20), default="used")
    refurb_status: Mapped[str] = mapped_column(String(30), default="none")
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    view_count: Mapped[int] = mapped_column(Integer, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    published_at: Mapped[datetime | None] = mapped_column(DateTime)

    seller: Mapped[User] = relationship(lazy="joined")
    dealer: Mapped[DealerProfile | None] = relationship(lazy="joined")
    spec: Mapped["BoatSpecification | None"] = relationship(
        back_populates="boat", uselist=False, cascade="all, delete-orphan", lazy="joined"
    )
    images: Mapped[list["BoatImage"]] = relationship(
        back_populates="boat", cascade="all, delete-orphan", order_by="BoatImage.position", lazy="selectin"
    )
    equipment: Mapped[list["Equipment"]] = relationship(back_populates="boat", cascade="all, delete-orphan")
    report: Mapped["RefurbishmentReport | None"] = relationship(
        back_populates="boat", uselist=False, cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(back_populates="boat", cascade="all, delete-orphan")

    @property
    def seller_type(self) -> str:
        if self.dealer is None:
            return "private"
        from .enums import VERIFIED_DEALER_STATUSES

        return "verified_dealer" if self.dealer.verification_status in VERIFIED_DEALER_STATUSES else "dealer"


class BoatSpecification(Base):
    __tablename__ = "boat_specifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), unique=True)
    length_m: Mapped[float | None] = mapped_column(Float, index=True)
    beam_m: Mapped[float | None] = mapped_column(Float)
    draft_m: Mapped[float | None] = mapped_column(Float)
    displacement_kg: Mapped[int | None] = mapped_column(Integer)
    hull_material: Mapped[str | None] = mapped_column(String(60))
    sail_area_m2: Mapped[float | None] = mapped_column(Float)
    mast_height_m: Mapped[float | None] = mapped_column(Float)
    berths: Mapped[int | None] = mapped_column(Integer)
    engine: Mapped[str | None] = mapped_column(String(160))
    trailer: Mapped[str | None] = mapped_column(String(160))

    boat: Mapped[Boat] = relationship(back_populates="spec")


class Equipment(Base):
    __tablename__ = "equipment"
    __table_args__ = (UniqueConstraint("boat_id", "kind"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)

    boat: Mapped[Boat] = relationship(back_populates="equipment")


class BoatImage(Base):
    __tablename__ = "boat_images"

    id: Mapped[int] = mapped_column(primary_key=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(255))
    thumb_path: Mapped[str] = mapped_column(String(255))
    width: Mapped[int] = mapped_column(Integer, default=0)
    height: Mapped[int] = mapped_column(Integer, default=0)
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    boat: Mapped[Boat] = relationship(back_populates="images")


class RefurbishmentReport(Base):
    __tablename__ = "refurbishment_reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), unique=True)
    summary: Mapped[str | None] = mapped_column(Text)
    seller_notes: Mapped[str | None] = mapped_column(Text)
    # Only administrators may change this away from "seller_provided".
    verification: Mapped[str] = mapped_column(String(30), default="seller_provided")
    verified_by: Mapped[str | None] = mapped_column(String(160))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime)
    admin_reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)
    admin_review_note: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    boat: Mapped[Boat] = relationship(back_populates="report")
    entries: Mapped[list["RefurbishmentEntry"]] = relationship(
        back_populates="report", cascade="all, delete-orphan", order_by="RefurbishmentEntry.position"
    )


class RefurbishmentEntry(Base):
    __tablename__ = "refurbishment_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    report_id: Mapped[int] = mapped_column(ForeignKey("refurbishment_reports.id", ondelete="CASCADE"), index=True)
    section: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    work_date: Mapped[date | None] = mapped_column(Date)
    seller_notes: Mapped[str | None] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)

    report: Mapped[RefurbishmentReport] = relationship(back_populates="entries")
    documents: Mapped[list["Document"]] = relationship(back_populates="entry")


class Document(Base):
    """Uploaded PDF documents and supporting images. Files live in private
    storage and are only served through an authorising endpoint."""

    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), index=True)
    entry_id: Mapped[int | None] = mapped_column(ForeignKey("refurbishment_entries.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(10))  # pdf | image
    title: Mapped[str] = mapped_column(String(160))
    original_name: Mapped[str] = mapped_column(String(255))
    path: Mapped[str] = mapped_column(String(255))
    mime: Mapped[str] = mapped_column(String(60))
    size_bytes: Mapped[int] = mapped_column(Integer)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    boat: Mapped[Boat] = relationship(back_populates="documents")
    entry: Mapped[RefurbishmentEntry | None] = relationship(back_populates="documents")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "boat_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    boat_id: Mapped[int] = mapped_column(ForeignKey("boats.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    boat: Mapped[Boat] = relationship()
