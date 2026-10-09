from datetime import date

import pytest

from app.errors import AppError
from app.services import pricing, stays


def test_price_arithmetic():
    p = pricing.compute_price(950000, 150000, 2)
    assert (p.subtotal_minor, p.service_fee_minor, p.total_minor) == (1900000, 190000, 2240000)


@pytest.mark.parametrize("subtotal, fee", [(104, 10), (105, 11), (106, 11), (0, 0), (1, 0), (5, 1)])
def test_service_fee_rounds_half_up(subtotal, fee):
    # 10% of 105 paise is 10.5, which rounds up to 11; 10.4 rounds down to 10.
    assert pricing.compute_price(subtotal, 0, 1).service_fee_minor == fee


def test_fingerprint_changes_with_anything_that_affects_the_price():
    a, b = date(2026, 11, 1), date(2026, 11, 3)
    base = pricing.compute_price(1000, 100, 2)
    fp = pricing.fingerprint("L1", a, b, 2, base)
    assert fp == pricing.fingerprint("L1", a, b, 2, base)
    assert fp != pricing.fingerprint("L1", a, b, 3, base)
    assert fp != pricing.fingerprint("L2", a, b, 2, base)
    assert fp != pricing.fingerprint("L1", a, b, 2, pricing.compute_price(1001, 100, 2))


def fields_of(call):
    with pytest.raises(AppError) as err:
        call()
    return err.value.fields


def test_date_rules():
    today = date(2026, 10, 10)  # pinned by the autouse fixture
    assert stays.validate_dates(today, date(2026, 10, 11)) == 1  # check-in today is fine
    assert "check_in" in fields_of(lambda: stays.validate_dates(date(2026, 10, 9), date(2026, 10, 12)))
    assert "check_out" in fields_of(lambda: stays.validate_dates(today, today))  # zero nights
    assert "check_out" in fields_of(lambda: stays.validate_dates(date(2026, 10, 12), date(2026, 10, 11)))  # reversed
    assert "check_out" in fields_of(lambda: stays.validate_dates(today, date(2027, 10, 12)))  # 367 nights


def test_guest_rules():
    stays.validate_guests(4, 4)
    assert "guests" in fields_of(lambda: stays.validate_guests(5, 4))
    assert "guests" in fields_of(lambda: stays.validate_guests(0, 4))
