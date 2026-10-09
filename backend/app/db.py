import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    pass


def make_engine(url: str, busy_timeout: float = 5.0):
    """busy_timeout is how long a writer waits for SQLite's write lock. A function so tests can use their own file."""
    engine = create_engine(url, connect_args={"timeout": busy_timeout})

    # Whenever a new connection is created, SQLAlchemy automatically runs these two SQLite settings.
    @event.listens_for(engine, "connect")
    def _pragmas(conn, _record):
        conn.execute("PRAGMA foreign_keys=ON")  # off by default in SQLite, per connection
        conn.execute("PRAGMA journal_mode=WAL")  # readers and the writer don't block each other

    return engine


engine = make_engine(os.getenv("DATABASE_URL", "sqlite:///./dev.db"))
SessionLocal = sessionmaker(engine, expire_on_commit=False)


def get_db():
    with SessionLocal() as db:
        yield db
