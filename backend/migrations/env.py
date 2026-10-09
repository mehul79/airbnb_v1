from alembic import context

import app.models  # noqa: F401  (registers tables on Base.metadata)
from app.config import settings
from app.db import Base, make_engine

config = context.config
# Tests pass sqlalchemy.url explicitly; otherwise use DATABASE_URL (a SQLite file or a Turso address).
url = config.get_main_option("sqlalchemy.url") or settings.database_url

with make_engine(url).connect() as connection:
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
