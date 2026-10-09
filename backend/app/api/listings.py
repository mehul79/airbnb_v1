from datetime import date
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import DbDep
from app.models import Amenity
from app.schemas.listings import (
    AmenityOut,
    AvailabilityOut,
    ListingDetail,
    ListingPage,
    MapPage,
    QuoteIn,
    QuoteOut,
    ReviewPage,
    SearchParams,
)
from app.services import listings as listing_service

router = APIRouter(tags=["listings"])


@router.get("/amenities", response_model=list[AmenityOut])
def list_amenities(db: DbDep):
    return db.scalars(select(Amenity).order_by(Amenity.name)).all()


@router.get("/listings", response_model=ListingPage)
def search_listings(params: Annotated[SearchParams, Query()], db: DbDep):
    return listing_service.search(db, params)


# Declared before /listings/{listing_id}, or "map" would be read as a listing id.
@router.get("/listings/map", response_model=MapPage)
def map_listings(params: Annotated[SearchParams, Query()], db: DbDep):
    return listing_service.map_pins(db, params)


@router.get("/listings/{listing_id}", response_model=ListingDetail)
def get_listing(listing_id: str, db: DbDep):
    return listing_service.detail(db, listing_id)


@router.get("/listings/{listing_id}/reviews", response_model=ReviewPage)
def get_reviews(
    listing_id: str,
    db: DbDep,
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 10,
):
    return listing_service.reviews(db, listing_id, page, page_size)


@router.get("/listings/{listing_id}/availability", response_model=AvailabilityOut)
def get_availability(
    listing_id: str,
    db: DbDep,
    start: Annotated[date | None, Query(alias="from")] = None,
    end: Annotated[date | None, Query(alias="to")] = None,
):
    return listing_service.availability(db, listing_id, start, end)


@router.post("/listings/{listing_id}/quote", response_model=QuoteOut)
def get_quote(listing_id: str, body: QuoteIn, db: DbDep):
    return listing_service.quote(db, listing_id, body.check_in, body.check_out, body.guests)
