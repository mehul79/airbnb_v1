from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException


class AppError(Exception):
    """A failure the client should see, rendered as the shared error envelope."""

    def __init__(
        self, status: int, code: str, message: str, fields: dict[str, str] | None = None, extra: dict | None = None
    ):
        self.status = status
        self.code = code
        self.message = message
        self.fields = fields or {}
        # Extra keys merged into the error object, e.g. the fresh quote on PRICE_CHANGED.
        self.extra = extra or {}


def error_response(request: Request, status: int, code: str, message: str, fields=None, extra=None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": message,
                "fields": fields or {},
                "request_id": getattr(request.state, "request_id", None),
                **(extra or {}),
            }
        },
    )


async def app_error_handler(request: Request, exc: AppError):
    return error_response(request, exc.status, exc.code, exc.message, exc.fields, exc.extra)


async def validation_error_handler(request: Request, exc: RequestValidationError):
    # Map each failing field to one message so forms can show it inline.
    fields = {}
    for err in exc.errors():
        name = str(err["loc"][-1]) if err["loc"] else "body"
        fields.setdefault(name, err["msg"])
    return error_response(request, 422, "VALIDATION_ERROR", "Some fields are invalid.", fields)


async def http_error_handler(request: Request, exc: StarletteHTTPException):
    code = {404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED"}.get(exc.status_code, "HTTP_ERROR")
    return error_response(request, exc.status_code, code, str(exc.detail))


async def db_error_handler(request: Request, exc: OperationalError):
    # "database is locked": another writer held the lock past the busy timeout. Retryable, not a bug.
    message = str(exc.orig).lower()
    if "locked" in message or "busy" in message:
        return error_response(request, 503, "DATABASE_BUSY", "We are busy right now. Please try again in a moment.")
    raise exc
