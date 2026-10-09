"""A small DB-API 2.0 driver for Turso over its HTTPS API (the "Hrana" /v2/pipeline endpoint).

Why this exists: Turso's Python packages are native code. They have no Windows wheels, and
`libsql-experimental` has none at all for Python 3.14, so they cannot be installed here. This module
is plain Python, so the same code runs on Windows, Linux and any host. SQLAlchemy uses it through
`create_engine("sqlite://", module=app.turso, creator=...)`, see app/db.py.

It copies the transaction behaviour of Python's sqlite3, which SQLAlchemy relies on:
- A SELECT or DDL statement outside a transaction runs on its own.
- The first INSERT/UPDATE/DELETE begins a transaction. It stays open on the server (identified by
  a "baton" token) until commit() or rollback().

Each request costs a network round trip, so the code sends as few as it can: a statement and the
BEGIN before it travel together, and executemany() sends many statements per request.
"""
import base64
import http.client
import json
from urllib.parse import urlparse

# --- DB-API module attributes -------------------------------------------------------------
apilevel = "2.0"
threadsafety = 1  # connections must not be shared between threads; SQLAlchemy's pool guarantees that
paramstyle = "qmark"
# SQLAlchemy's SQLite dialect checks these. Turso reported 3.47.0 when probed.
sqlite_version_info = (3, 47, 0)
sqlite_version = "3.47.0"
Binary = bytes


class Warning(Exception):  # noqa: A001 (the DB-API requires this name)
    pass


class Error(Exception):
    pass


class InterfaceError(Error):
    pass


class DatabaseError(Error):
    pass


class DataError(DatabaseError):
    pass


class OperationalError(DatabaseError):
    pass


class IntegrityError(DatabaseError):
    pass


class InternalError(DatabaseError):
    pass


class ProgrammingError(DatabaseError):
    pass


class NotSupportedError(DatabaseError):
    pass


# --- values and errors --------------------------------------------------------------------
def encode_value(v) -> dict:
    if v is None:
        return {"type": "null"}
    if isinstance(v, bool):
        return {"type": "integer", "value": "1" if v else "0"}
    if isinstance(v, int):
        return {"type": "integer", "value": str(v)}
    if isinstance(v, float):
        return {"type": "float", "value": v}
    if isinstance(v, bytes):
        return {"type": "blob", "base64": base64.b64encode(v).decode()}
    return {"type": "text", "value": str(v)}


def decode_value(cell: dict):
    kind = cell["type"]
    if kind == "null":
        return None
    if kind == "integer":
        return int(cell["value"])  # the API sends 64-bit integers as strings
    if kind == "float":
        return float(cell["value"])
    if kind == "blob":
        return base64.b64decode(cell["base64"])
    return cell["value"]


def error_from(message: str, code: str = "") -> Error:
    """Pick the exception class sqlite3 would have raised for this message."""
    low = message.lower()
    if "constraint failed" in low or code.startswith("SQLITE_CONSTRAINT"):
        return IntegrityError(message)
    return OperationalError(message)  # sqlite3 also uses this for locked databases, syntax errors, missing tables


def is_write(sql: str) -> bool:
    return sql.lstrip()[:7].upper().split(" ")[0].rstrip("(") in ("INSERT", "UPDATE", "DELETE", "REPLACE")


# --- connection ---------------------------------------------------------------------------
class Connection:
    isolation_level = None  # accepted so SQLAlchemy can read or set it; the server decides

    def __init__(self, url: str, auth_token: str, timeout: float = 30.0):
        parsed = urlparse(url)
        self._https = parsed.scheme != "http"
        self._host = parsed.netloc
        self._timeout = timeout
        self._headers = {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}
        self._http = None
        # Identifies the open transaction on the server, or None when there is none.
        self._baton = None

    # -- transport
    def _connection(self) -> http.client.HTTPConnection:
        if self._http is None:
            cls = http.client.HTTPSConnection if self._https else http.client.HTTPConnection
            self._http = cls(self._host, timeout=self._timeout)
        return self._http

    def _post(self, requests: list[dict]) -> list[dict]:
        body = json.dumps({"baton": self._baton, "requests": requests})
        for attempt in (1, 2):
            try:
                conn = self._connection()
                conn.request("POST", "/v2/pipeline", body, self._headers)
                response = conn.getresponse()
                raw = response.read()
                break
            except (http.client.RemoteDisconnected, ConnectionResetError, BrokenPipeError, http.client.CannotSendRequest) as exc:
                # A kept-alive connection the server already closed. Safe to retry once, but only
                # when no transaction is open, because that transaction died with the connection.
                self.close_http()
                if attempt == 2 or self._baton is not None:
                    self._baton = None
                    raise OperationalError(f"turso unavailable: connection lost ({exc})") from exc
            except OSError as exc:
                self.close_http()
                self._baton = None
                raise OperationalError(f"turso unavailable: {exc}") from exc

        if response.status in (401, 403):
            raise OperationalError("turso unavailable: the auth token was rejected")
        if response.status != 200:
            self._baton = None
            raise OperationalError(f"turso unavailable: HTTP {response.status} {raw[:200].decode(errors='replace')}")
        data = json.loads(raw)
        self._baton = data.get("baton")
        return data["results"]

    def close_http(self) -> None:
        if self._http is not None:
            self._http.close()
            self._http = None

    # -- running statements
    def run(self, statements: list[tuple[str, tuple]]) -> list[dict]:
        """Execute statements in order; return one result dict per statement. Raises on the first error."""
        out = []
        for start in range(0, len(statements), 100):  # keep each request a sensible size
            chunk = statements[start : start + 100]
            requests = []
            begin = self._baton is None and is_write(chunk[0][0])
            if begin:
                requests.append(_execute("BEGIN"))
            requests += [_execute(sql, params) for sql, params in chunk]
            if self._baton is None and not begin:
                requests.append({"type": "close"})  # nothing to keep open after a standalone statement
            results = self._post(requests)
            for item in results[1:] if begin else results:
                if item["type"] == "error":
                    raise error_from(item["error"].get("message", "database error"), item["error"].get("code", ""))
                if item["response"]["type"] == "execute":
                    out.append(item["response"]["result"])
            if begin and results[0]["type"] == "error":
                raise error_from(results[0]["error"].get("message", "database error"))
        return out

    def cursor(self) -> "Cursor":
        return Cursor(self)

    def execute(self, sql: str, params=()) -> "Cursor":
        return self.cursor().execute(sql, params)

    def commit(self) -> None:
        if self._baton is not None:
            self._finish("COMMIT")

    def rollback(self) -> None:
        if self._baton is not None:
            try:
                self._finish("ROLLBACK")
            except OperationalError:
                self._baton = None  # the transaction is gone either way

    def _finish(self, verb: str) -> None:
        results = self._post([_execute(verb), {"type": "close"}])
        self._baton = None
        if results[0]["type"] == "error":
            raise error_from(results[0]["error"].get("message", "database error"))

    def create_function(self, *args, **kwargs) -> None:
        pass  # SQLAlchemy registers a REGEXP helper on SQLite connections; the server has its own

    def close(self) -> None:
        self.rollback()
        self.close_http()


def _execute(sql: str, params=()) -> dict:
    return {"type": "execute", "stmt": {"sql": sql, "args": [encode_value(p) for p in params]}}


# --- cursor -------------------------------------------------------------------------------
class Cursor:
    arraysize = 1

    def __init__(self, connection: Connection):
        self.connection = connection
        self.description = None
        self.rowcount = -1
        self.lastrowid = None
        self._rows: list[tuple] = []
        self._pos = 0

    def execute(self, sql: str, params=()) -> "Cursor":
        self._load(self.connection.run([(sql, tuple(params))]))
        return self

    def executemany(self, sql: str, seq_of_params) -> "Cursor":
        self._load(self.connection.run([(sql, tuple(p)) for p in seq_of_params]))
        return self

    def _load(self, results: list[dict]) -> None:
        last = results[-1] if results else {"cols": [], "rows": []}
        self.description = tuple((c["name"], None, None, None, None, None, None) for c in last["cols"]) or None
        self._rows = [tuple(decode_value(cell) for cell in row) for row in last["rows"]]
        self._pos = 0
        self.rowcount = sum(r.get("affected_row_count", 0) for r in results)
        rowid = last.get("last_insert_rowid")
        self.lastrowid = int(rowid) if rowid is not None else None

    def fetchone(self):
        if self._pos >= len(self._rows):
            return None
        self._pos += 1
        return self._rows[self._pos - 1]

    def fetchmany(self, size=None):
        size = size or self.arraysize
        rows = self._rows[self._pos : self._pos + size]
        self._pos += len(rows)
        return rows

    def fetchall(self):
        rows = self._rows[self._pos :]
        self._pos = len(self._rows)
        return rows

    def __iter__(self):
        return iter(self.fetchall())

    def close(self) -> None:
        self._rows = []

    def setinputsizes(self, *args) -> None:
        pass

    def setoutputsize(self, *args) -> None:
        pass


def connect(url: str, auth_token: str, timeout: float = 30.0) -> Connection:
    return Connection(url, auth_token, timeout)
