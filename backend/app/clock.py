from datetime import date, datetime
from zoneinfo import ZoneInfo

# The demo defines "today" in Indian time, whatever timezone the server runs in.
IST = ZoneInfo("Asia/Kolkata")


def today() -> date:
    # Services call clock.today() (not a copy of it) so tests can pin the date.
    return datetime.now(IST).date()
