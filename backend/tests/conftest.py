import pytest
from datetime import date

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app import clock
from app.config import settings
from app.db import get_db, make_engine
from app.main import app
from app.seed import seed

ORIGIN = {"Origin": settings.frontend_origin}
TODAY = date(2026, 10, 10)


@pytest.fixture(autouse=True)
def fixed_today(monkeypatch):
    """Every test runs on the same day, so date rules and seeded stays never drift."""
    monkeypatch.setattr(clock, "today", lambda: TODAY)


@pytest.fixture
def engine(tmp_path):
    """A fresh SQLite file per test, built by the real migrations."""
    url = f"sqlite:///{tmp_path / 'test.db'}"
    cfg = Config("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", url)
    command.upgrade(cfg, "head")
    return make_engine(url)


@pytest.fixture
def db(engine):
    with sessionmaker(engine, expire_on_commit=False)() as session:
        yield session


@pytest.fixture
def client(engine):
    factory = sessionmaker(engine, expire_on_commit=False)

    def override_get_db():
        with factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app, headers=ORIGIN) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def seeded(db):
    seed(db)
    return db
