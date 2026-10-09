"""Host-side DTOs. The client never sends host_id, ids of photos, status, or timestamps."""
from datetime import date
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.vocab import Category, PropertyType

MAX_PHOTOS = 20
MAX_AMENITIES = 20
# 10 lakh rupees a night, in paise: a sanity cap, not a business rule.
MAX_PRICE_MINOR = 100_000_000


class PhotoIn(BaseModel):
    url: str = Field(max_length=500)
    alt_text: str = Field("", max_length=200)


class HostListingIn(BaseModel):
    """A complete, valid listing. PATCH merges its changes into the stored record and validates the result with this."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=5000)
    city: str = Field(min_length=1, max_length=80)
    region: str = Field(min_length=1, max_length=80)
    country: str = Field(min_length=1, max_length=80)
    location_label: str = Field(min_length=1, max_length=160)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    property_type: PropertyType
    category: Category
    max_guests: int = Field(ge=1, le=50)
    bedrooms: int = Field(ge=0, le=50)
    beds: int = Field(ge=0, le=100)
    bathrooms: float = Field(ge=0, le=50)
    nightly_price_minor: int = Field(ge=1, le=MAX_PRICE_MINOR)
    cleaning_fee_minor: int = Field(ge=0, le=MAX_PRICE_MINOR)
    photos: list[PhotoIn] = Field(min_length=1, max_length=MAX_PHOTOS)
    # Amenity slugs, checked against the amenities table in the service.
    amenities: list[str] = Field(default_factory=list, max_length=MAX_AMENITIES)

    @field_validator("photos")
    @classmethod
    def https_urls_only(cls, photos: list[PhotoIn]) -> list[PhotoIn]:
        # We store and render the URL, never fetch it, but it still has to be a plain HTTPS link.
        for photo in photos:
            parsed = urlparse(photo.url.strip())
            if parsed.scheme != "https" or not parsed.hostname or any(c.isspace() for c in photo.url.strip()):
                raise ValueError("Every photo must be a valid https:// link.")
            photo.url = photo.url.strip()
        if len({p.url for p in photos}) != len(photos):
            raise ValueError("The same photo is listed twice.")
        return photos

    @field_validator("amenities")
    @classmethod
    def unique_amenities(cls, slugs: list[str]) -> list[str]:
        return list(dict.fromkeys(slugs))


class HostListingPatch(BaseModel):
    """Any subset of the listing fields. Photos and amenities, when present, replace the old lists."""

    model_config = ConfigDict(extra="forbid")

    title: str | None = None
    description: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    location_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    property_type: PropertyType | None = None
    category: Category | None = None
    max_guests: int | None = None
    bedrooms: int | None = None
    beds: int | None = None
    bathrooms: float | None = None
    nightly_price_minor: int | None = None
    cleaning_fee_minor: int | None = None
    photos: list[PhotoIn] | None = None
    amenities: list[str] | None = None


class HostPhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    alt_text: str
    source: str
    position: int


class HostListingOut(BaseModel):
    """Everything the edit form needs, including archived listings."""

    id: str
    title: str
    description: str
    city: str
    region: str
    country: str
    location_label: str
    latitude: float | None
    longitude: float | None
    property_type: str
    category: str
    max_guests: int
    bedrooms: int
    beds: int
    bathrooms: float
    nightly_price_minor: int
    cleaning_fee_minor: int
    currency: str
    photos: list[HostPhotoOut]
    amenities: list[str]  # slugs
    archived_at: int | None
    created_at: int


class HostListingSummary(BaseModel):
    """One row of the dashboard."""

    id: str
    title: str
    location_label: str
    nightly_price_minor: int
    photo_url: str | None
    archived_at: int | None
    upcoming_bookings: int


class HostListingList(BaseModel):
    items: list[HostListingSummary]


class HostBookingOut(BaseModel):
    """A reservation as its host sees it: the guest's name and the stay, never their email."""

    id: str
    reference: str
    listing_id: str
    listing_title: str
    guest_name: str
    guests: int
    check_in: date
    check_out: date
    nights: int
    total_minor: int
    currency: str
    phase: Literal["upcoming", "past"]
    created_at: int


class HostBookingPage(BaseModel):
    items: list[HostBookingOut]
    page: int
    page_size: int
    total: int
    total_pages: int
