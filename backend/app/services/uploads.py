"""Signed uploads to Cloudinary for photos a host adds to their own listing.

The browser uploads straight to Cloudinary; this module only signs the request, so the API
secret never leaves the backend. A signature covers the folder and timestamp, which means a
signature cannot be reused for another folder, and it expires on Cloudinary's side after an hour.
"""
import hashlib
import os
import re
import time
from urllib.parse import unquote, urlparse

from dotenv import load_dotenv

from app.errors import AppError

load_dotenv()
# Optional: without these the host form falls back to pasted links.
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

ALLOWED_FORMATS = "jpg,jpeg,png,webp"
ROOT_FOLDER = "airbnb-clone/listings"


def configured() -> bool:
    return bool(CLOUD_NAME and API_KEY and API_SECRET)


def _signature(params: dict[str, str]) -> str:
    # Cloudinary: sort the params, join as k=v&k=v, append the secret, SHA-1.
    to_sign = "&".join(f"{k}={v}" for k, v in sorted(params.items()))
    return hashlib.sha1((to_sign + API_SECRET).encode()).hexdigest()


def sign_upload(user_id: str) -> dict:
    if not configured():
        raise AppError(503, "UPLOADS_UNAVAILABLE", "Photo uploads are not set up. Paste a photo link instead.")
    # One folder per user keeps uploads tidy and traceable.
    params = {
        "allowed_formats": ALLOWED_FORMATS,
        "folder": f"{ROOT_FOLDER}/{user_id}",
        "timestamp": str(int(time.time())),
    }
    return {
        "cloud_name": CLOUD_NAME,
        "api_key": API_KEY,
        "signature": _signature(params),
        **params,
    }


_AFTER_UPLOAD = re.compile(r"^/[^/]+/image/upload/(?P<rest>.+)$")
_VERSIONED = re.compile(r"(?:^|/)v\d+/(?P<id>.+)$")


def cloudinary_public_id(url: str) -> str | None:
    """The public id inside a Cloudinary delivery URL, or None if it is not one.

    Delivery URLs look like /<cloud>/image/upload/[transformations/][v123/]<public id>.<ext>.
    """
    parsed = urlparse(url)
    if parsed.hostname != "res.cloudinary.com":
        return None
    match = _AFTER_UPLOAD.match(parsed.path)
    if not match:
        return None
    rest = match.group("rest")
    versioned = _VERSIONED.search(rest)
    public_id = versioned.group("id") if versioned else rest
    public_id = re.sub(r"\.[A-Za-z0-9]+$", "", unquote(public_id))
    return public_id[:200] or None
