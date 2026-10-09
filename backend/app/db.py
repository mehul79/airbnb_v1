from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import QueuePool

from app import turso
from app.config import settings


class Base(DeclarativeBase):
    pass


def make_engine(url: str, busy_timeout: float = 5.0) -> Engine:
    """Local SQLite file or Turso. busy_timeout is how long a SQLite writer waits for the write lock."""
    if url.startswith(("libsql://", "https://", "http://")):
        # Turso: SQLAlchemy's SQLite dialect, with our own pure-Python driver (see app/turso.py).
        # The "sqlite://" URL is a placeholder; connections come from creator.
        return create_engine(
            "sqlite://",
            module=turso,
            creator=lambda: turso.connect(url, settings.turso_auth_token),
            poolclass=QueuePool,
            pool_size=5,
            max_overflow=5,
            pool_recycle=240,  # drop idle connections before the server or a proxy does
        )
    engine = create_engine(url, connect_args={"timeout": busy_timeout})

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _record):
        # SQLite ignores foreign keys unless asked, per connection.
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


engine = make_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    with SessionLocal() as db:
        yield db
