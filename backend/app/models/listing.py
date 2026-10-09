from sqlalchemy import CheckConstraint, Column, ForeignKey, Index, String, Table, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.user import new_id, now
from app.vocab import Category, PhotoSource, PropertyType, sql_in

# Plain join table: a listing has many amenities and an amenity belongs to many listings.
listing_amenities = Table(
    "listing_amenities",
    Base.metadata,
    Column("listing_id", ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True),
    Column("amenity_id", ForeignKey("amenities.id"), primary_key=True),
    # Reverse lookup for "listings that have amenity X" filters.
    Index("ix_listing_amenities_amenity_listing", "amenity_id", "listing_id"),
)


class Amenity(Base):
    __tablename__ = "amenities"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    slug: Mapped[str] = mapped_column(String(40), unique=True)
    name: Mapped[str] = mapped_column(String(60))
    # Whitelisted key the frontend maps to a Tabler icon; unknown keys get a neutral icon.
    icon_key: Mapped[str] = mapped_column(String(40))


class Listing(Base):
    __tablename__ = "listings"
    __table_args__ = (
        CheckConstraint(f"property_type IN ({sql_in(PropertyType)})", name="ck_listings_property_type"),
        CheckConstraint(f"category IN ({sql_in(Category)})", name="ck_listings_category"),
        CheckConstraint("max_guests > 0", name="ck_listings_max_guests"),
        CheckConstraint("bedrooms >= 0 AND beds >= 0 AND bathrooms >= 0", name="ck_listings_rooms"),
        CheckConstraint("nightly_price_minor > 0", name="ck_listings_price"),
        CheckConstraint("cleaning_fee_minor >= 0", name="ck_listings_cleaning_fee"),
        CheckConstraint("currency = 'INR'", name="ck_listings_currency"),
        # Default explore order and archived filter.
        Index("ix_listings_archived_created_id", "archived_at", "created_at", "id"),
        Index("ix_listings_host_archived", "host_id", "archived_at"),
        Index("ix_listings_city", "city"),
        Index("ix_listings_property_type", "property_type"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    host_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    city: Mapped[str] = mapped_column(String(80))
    region: Mapped[str] = mapped_column(String(80))
    country: Mapped[str] = mapped_column(String(80))
    location_label: Mapped[str] = mapped_column(String(160))
    latitude: Mapped[float | None]
    longitude: Mapped[float | None]
    property_type: Mapped[str] = mapped_column(String(20))
    category: Mapped[str] = mapped_column(String(20))
    max_guests: Mapped[int]
    bedrooms: Mapped[int]
    beds: Mapped[int]
    bathrooms: Mapped[float]
    # Money is integer paise (1/100 rupee) so arithmetic is exact.
    nightly_price_minor: Mapped[int]
    cleaning_fee_minor: Mapped[int]
    currency: Mapped[str] = mapped_column(String(3), default="INR", server_default="INR")
    # "Delete" means archive: bookings keep pointing at the row.
    archived_at: Mapped[int | None]
    created_at: Mapped[int] = mapped_column(default=now)
    updated_at: Mapped[int] = mapped_column(default=now, onupdate=now)

    photos: Mapped[list["ListingPhoto"]] = relationship(
        order_by="ListingPhoto.position", cascade="all, delete-orphan"
    )
    amenities: Mapped[list[Amenity]] = relationship(secondary=listing_amenities, order_by=Amenity.name)


class ListingPhoto(Base):
    __tablename__ = "listing_photos"
    __table_args__ = (
        UniqueConstraint("listing_id", "position", name="uq_listing_photos_position"),
        CheckConstraint(f"source IN ({sql_in(PhotoSource)})", name="ck_listing_photos_source"),
        CheckConstraint("position >= 0", name="ck_listing_photos_position"),
        # A Cloudinary public id only makes sense for Cloudinary photos.
        CheckConstraint(
            "source = 'cloudinary' OR cloudinary_public_id IS NULL", name="ck_listing_photos_public_id"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"))
    # Tells the frontend which image loader to use.
    source: Mapped[str] = mapped_column(String(12), default=PhotoSource.UNSPLASH.value, server_default="unsplash")
    cloudinary_public_id: Mapped[str | None] = mapped_column(String(200))
    url: Mapped[str] = mapped_column(String(500))
    alt_text: Mapped[str] = mapped_column(String(200))
    position: Mapped[int]


class Review(Base):
    """Seeded and read-only for now."""

    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating"),
        UniqueConstraint("listing_id", "author_id", name="uq_reviews_listing_author"),
        Index("ix_reviews_listing_id", "listing_id"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    listing_id: Mapped[str] = mapped_column(ForeignKey("listings.id"))
    author_id: Mapped[str] = mapped_column(ForeignKey("users.id"))
    rating: Mapped[int]
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[int] = mapped_column(default=now)
