from typing import Annotated, Literal

from fastapi import APIRouter, Header, Query, Response

from app.api.deps import CurrentUser, DbDep
from app.schemas.bookings import BookingIn, BookingOut, BookingPage
from app.services import bookings as booking_service

router = APIRouter(tags=["bookings"])

# The client makes up one key per checkout attempt and reuses it when retrying.
IdempotencyKey = Annotated[str, Header(alias="Idempotency-Key", min_length=8, max_length=80, pattern=r"^[A-Za-z0-9_.:-]+$")]


@router.post("/bookings", response_model=BookingOut, status_code=201)
def create_booking(body: BookingIn, db: DbDep, user: CurrentUser, response: Response, idempotency_key: IdempotencyKey):
    booking, created = booking_service.create(db, user.id, body, idempotency_key)
    if not created:
        response.status_code = 200  # a retry of a request that already succeeded
    return booking_service.to_out(booking)


@router.get("/bookings/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: str, db: DbDep, user: CurrentUser):
    return booking_service.to_out(booking_service.get_for_guest(db, user.id, booking_id))


@router.get("/me/bookings", response_model=BookingPage)
def my_trips(
    db: DbDep,
    user: CurrentUser,
    phase: Literal["upcoming", "past", "all"] = "all",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=50)] = 12,
):
    return booking_service.trips(db, user.id, phase, page, page_size)
