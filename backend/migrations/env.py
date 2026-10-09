import os

from alembic import context

import app.models  # noqa: F401  (registers tables on Base.metadata)
from app.db import Base, make_engine

config = context.config
# Tests pass sqlalchemy.url explicitly; otherwise use DATABASE_URL.
url = config.get_main_option("sqlalchemy.url") or os.getenv("DATABASE_URL", "sqlite:///./dev.db")

with make_engine(url).connect() as connection:
    # SQLite table rebuilds (batch migrations) drop and recreate tables; with foreign keys on, that would cascade-delete child rows.
    connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
    connection.commit()  # end the implicit transaction, or Alembic would not commit its own
    context.configure(connection=connection, target_metadata=Base.metadata)
    with context.begin_transaction():
        context.run_migrations()
