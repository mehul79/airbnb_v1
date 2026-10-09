"""Run any command against a Turso database named in .env.

    uv run python scripts/on_turso.py testing alembic upgrade head
    uv run python scripts/on_turso.py testing python -m app.seed
    uv run python scripts/on_turso.py production alembic upgrade head

It sets DATABASE_URL and TURSO_AUTH_TOKEN for that one command and prints which database it is
using (the host only, never the token). Naming the target on every call is deliberate: production
changes should never happen by accident.
"""
import os
import subprocess
import sys
from urllib.parse import urlparse

from dotenv import dotenv_values

if len(sys.argv) < 3 or sys.argv[1] not in ("testing", "production"):
    sys.exit("usage: on_turso.py testing|production <command...>")

target = sys.argv[1].upper()
env = dotenv_values(".env")
url, token = env[f"TURSO_DATABASE_URL_{target}"], env[f"TURSO_{target}_SECRET"]

print(f"[on_turso] {target} database: {urlparse(url).hostname}", flush=True)
os.environ["DATABASE_URL"] = url
os.environ["TURSO_AUTH_TOKEN"] = token
os.environ["PYTHONPATH"] = os.getcwd()  # run from backend/ so "import app" works for scripts anywhere
command = sys.argv[2:]
# Use this project's interpreter, whatever "python" or "alembic" would resolve to on PATH.
if command[0] == "python":
    command[0] = sys.executable
elif command[0] == "alembic":
    command = [sys.executable, "-m", "alembic", *command[1:]]
sys.exit(subprocess.call(command))
