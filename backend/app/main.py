import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import auth, bookings, favorites, health, host, listings
from app.config import settings
from app.errors import (
    AppError,
    app_error_handler,
    db_error_handler,
    error_response,
    http_error_handler,
    validation_error_handler,
)

app = FastAPI(title="Airbnb clone API")

app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_error_handler)
app.add_exception_handler(OperationalError, db_error_handler)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = uuid.uuid4().hex
    # CSRF defence: the session cookie is SameSite=Lax, and every state-changing
    # request must also come from our own frontend. The Next.js relay forwards Origin.
    if request.method not in ("GET", "HEAD", "OPTIONS") and request.headers.get("origin") != settings.frontend_origin:
        return error_response(request, 403, "BAD_ORIGIN", "Request origin is not allowed.")
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    return response


app.include_router(health.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(listings.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(favorites.router, prefix="/api/v1")
app.include_router(host.router, prefix="/api/v1")
