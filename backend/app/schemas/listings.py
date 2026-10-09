from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.vocab import Category, PropertyType


class SearchParams(BaseModel):
    """Query string for GET /listings. Dates are optional but must come as a pair."""

    location: str | None = Field(None, max_length=100)
    check_in: date | None = None
    check_out: date | None = None
    guests: int = Field(1, ge=1, le=50)
    category: Category | None = None
    property_type: PropertyType | None = None
    # Prices are nightly base prices in paise, fees excluded. Both ends are inclusive.
    min_price_minor: int | None = Field(None, ge=0)
    max_price_minor: int | None = Field(None, ge=0)
    # Repeat the parameter to require several: ?amenity=pool&amenity=wifi
    amenity: list[str] = Field(default_factory=list, max_length=12)
    page: int = Field(1, ge=1)
    page_size: int = Field(12, ge=1, le=48)


class AmenityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    name: str
    icon_key: str


class PhotoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    url: str
    alt_text: str
    source: str
    position: int


class ListingSummary(BaseModel):
    id: str
    title: str
    city: str
    region: str
    location_label: str
    property_type: str
    category: str
    max_guests: int
    nightly_price_minor: int
    currency: str
    photo_url: str | None
    photo_alt: str | None
    photo_source: str | None
    # None when nobody has reviewed it yet; the UI shows "New" instead of a rating.
    rating: float | None
    review_count: int
    # Both decided by app/services/ratings.py, never by the client.
    guest_favourite: bool
    host_superhost: bool


class ListingPage(BaseModel):
    items: list[ListingSummary]
    page: int
    page_size: int
    total: int
    total_pages: int


class FavoriteIds(BaseModel):
    ids: list[str]


class HostOut(BaseModel):
    id: str
    display_name: str
    avatar_url: str | None
    member_since: int  # UTC Unix seconds
    # Over every review of this host's listings (not just the one being viewed).
    rating: float | None
    review_count: int
    superhost: bool


class ListingDetail(BaseModel):
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
    photos: list[PhotoOut]
    amenities: list[AmenityOut]
    host: HostOut
    rating: float | None
    review_count: int
    guest_favourite: bool
    # {"5": n, ..., "1": n}: how many reviews gave each star rating.
    rating_breakdown: dict[str, int]


class ReviewAuthor(BaseModel):
    display_name: str
    avatar_url: str | None


class ReviewOut(BaseModel):
    id: str
    rating: int
    body: str
    created_at: int
    author: ReviewAuthor


class ReviewPage(BaseModel):
    items: list[ReviewOut]
    page: int
    page_size: int
    total: int
    total_pages: int


class OccupiedRange(BaseModel):
    """Nights taken by someone. Deliberately no guest information."""

    check_in: date
    check_out: date


class AvailabilityOut(BaseModel):
    occupied: list[OccupiedRange]


class QuoteIn(BaseModel):
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=50)


class QuoteOut(BaseModel):
    listing_id: str
    check_in: date
    check_out: date
    guests: int
    nights: int
    nightly_price_minor: int
    subtotal_minor: int
    cleaning_fee_minor: int
    service_fee_minor: int
    total_minor: int
    currency: str
    quote_fingerprint: str
