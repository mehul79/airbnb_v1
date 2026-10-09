from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str, busy_timeout: float = 5.0) -> Engine:
    """SQLite file engine. busy_timeout is how long a writer waits for the write lock."""
    engine = create_engine(url, connect_args={"timeout": busy_timeout})

    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):
        # SQLite ignores foreign keys unless asked, per connection.
        dbapi_conn.execute("PRAGMA foreign_keys=ON")
        # WAL: readers don't block the writer or each other; the setting persists in the file.
        dbapi_conn.execute("PRAGMA journal_mode=WAL")

    return engine


engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db
