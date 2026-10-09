from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class BookingIn(BaseModel):
    """What the client may say. Who is booking, the price and the status are never read from it."""

    listing_id: str = Field(min_length=1, max_length=36)
    check_in: date
    check_out: date
    guests: int = Field(ge=1, le=50)
    # From the quote the user just reviewed. If the price moved since, the booking is refused.
    quote_fingerprint: str = Field(min_length=64, max_length=64)


class BookingOut(BaseModel):
    id: str
    reference: str  # short code shown on the confirmation page
    listing_id: str
    status: str
    # "upcoming" until the checkout day arrives (so a stay in progress is still upcoming).
    phase: Literal["upcoming", "past"]
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
    # Copied at booking time, so they survive later edits and archiving of the listing.
    listing_title: str
    location: str
    cover_photo_url: str
    created_at: int


class BookingPage(BaseModel):
    items: list[BookingOut]
    page: int
    page_size: int
    total: int
    total_pages: int
