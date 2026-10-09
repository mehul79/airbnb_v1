from typing import Annotated, Literal

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbDep
from app.schemas.host import (
    HostBookingPage,
    HostListingIn,
    HostListingList,
    HostListingOut,
    HostListingPatch,
)
from app.services import host as host_service
from app.services import uploads

router = APIRouter(tags=["host"])


@router.get("/host/listings", response_model=HostListingList)
def my_listings(db: DbDep, user: CurrentUser, include_archived: bool = False):
    return host_service.dashboard(db, user.id, include_archived)


@router.get("/host/listings/{listing_id}", response_model=HostListingOut)
def my_listing(listing_id: str, db: DbDep, user: CurrentUser):
    return host_service.to_out(host_service.get_owned(db, user.id, listing_id))


@router.post("/host/listings", response_model=HostListingOut, status_code=201)
def create_listing(body: HostListingIn, db: DbDep, user: CurrentUser):
    return host_service.to_out(host_service.create(db, user.id, body))


@router.patch("/host/listings/{listing_id}", response_model=HostListingOut)
def update_listing(listing_id: str, body: HostListingPatch, db: DbDep, user: CurrentUser):
    return host_service.to_out(host_service.update(db, user.id, listing_id, body))


@router.delete("/host/listings/{listing_id}", status_code=204)
def archive_listing(listing_id: str, db: DbDep, user: CurrentUser):
    host_service.archive(db, user.id, listing_id)


@router.post("/host/uploads/sign")
def sign_photo_upload(user: CurrentUser):
    """Signed parameters for one direct-to-Cloudinary upload. Needs a session; the secret stays here."""
    return uploads.sign_upload(user.id)


@router.get("/host/bookings", response_model=HostBookingPage)
def my_reservations(
    db: DbDep,
    user: CurrentUser,
    listing_id: str | None = None,
    phase: Literal["upcoming", "past", "all"] = "all",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 12,
):
    return host_service.reservations(db, user.id, listing_id, phase, page, page_size)
