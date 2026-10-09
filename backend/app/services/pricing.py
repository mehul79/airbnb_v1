"""Price rules. All money is integer paise, so there is no floating point anywhere."""
import hashlib
from dataclasses import dataclass
from datetime import date

# Bump when the fee rules change, so old quote fingerprints stop matching.
POLICY_VERSION = "v1"


@dataclass(frozen=True)
class Price:
    nights: int
    nightly_price_minor: int
    subtotal_minor: int
    cleaning_fee_minor: int
    service_fee_minor: int
    total_minor: int


def compute_price(nightly_price_minor: int, cleaning_fee_minor: int, nights: int) -> Price:
    subtotal = nights * nightly_price_minor
    # 10% service fee, rounded half up: add 50 before the integer division by 100.
    service_fee = (subtotal * 10 + 50) // 100
    return Price(
        nights=nights,
        nightly_price_minor=nightly_price_minor,
        subtotal_minor=subtotal,
        cleaning_fee_minor=cleaning_fee_minor,
        service_fee_minor=service_fee,
        total_minor=subtotal + cleaning_fee_minor + service_fee,
    )


def fingerprint(listing_id: str, check_in: date, check_out: date, guests: int, price: Price) -> str:
    """A token for "this exact stay at this exact price". It is compared at booking time, never trusted as proof."""
    parts = [
        POLICY_VERSION,
        listing_id,
        check_in.isoformat(),
        check_out.isoformat(),
        str(guests),
        str(price.nightly_price_minor),
        str(price.cleaning_fee_minor),
        str(price.service_fee_minor),
        str(price.total_minor),
        "INR",
    ]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()
