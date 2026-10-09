"""The Turso driver's own rules, with a fake server. No network. The real server is covered by test_turso.py."""
import pytest

from app import turso


def ok(rows=(), cols=(), affected=0, rowid=None):
    result = {"cols": [{"name": c} for c in cols], "rows": [list(r) for r in rows], "affected_row_count": affected, "last_insert_rowid": rowid}
    return {"type": "ok", "response": {"type": "execute", "result": result}}


class FakeConnection(turso.Connection):
    """Records each request and answers like the server: a baton while a transaction is open, none after close."""

    def __init__(self, replies):
        super().__init__("libsql://example.turso.io", "token")
        self.sent = []
        self.replies = list(replies)

    def _post(self, requests):
        self.sent.append((self._baton, [r["stmt"]["sql"] if r["type"] == "execute" else "close" for r in requests]))
        results = [self.replies.pop(0) if r["type"] == "execute" else {"type": "ok", "response": {"type": "close"}} for r in requests]
        closed = any(r["type"] == "close" for r in requests)
        self._baton = None if closed else "baton-1"
        return results


def test_values_round_trip():
    for value, encoded in [(None, "null"), (7, "integer"), (True, "integer"), (1.5, "float"), ("x", "text"), (b"\x00\xff", "blob")]:
        cell = turso.encode_value(value)
        assert cell["type"] == encoded
    assert turso.encode_value(2**62) == {"type": "integer", "value": str(2**62)}  # big integers travel as strings
    assert turso.decode_value({"type": "integer", "value": "123"}) == 123
    assert turso.decode_value(turso.encode_value(b"\x00\xff")) == b"\x00\xff"
    assert turso.decode_value({"type": "null"}) is None


def test_errors_map_to_the_classes_sqlalchemy_expects():
    assert isinstance(turso.error_from("UNIQUE constraint failed: bookings.key"), turso.IntegrityError)
    assert isinstance(turso.error_from("FOREIGN KEY constraint failed"), turso.IntegrityError)
    assert isinstance(turso.error_from("CHECK constraint failed: ck_x"), turso.IntegrityError)
    assert isinstance(turso.error_from("database is locked"), turso.OperationalError)
    assert isinstance(turso.error_from("no such table: nope"), turso.OperationalError)


def test_only_data_changes_begin_a_transaction():
    assert all(turso.is_write(s) for s in ("INSERT INTO t VALUES (1)", "  update t set a=1", "DELETE FROM t", "REPLACE INTO t VALUES (1)"))
    assert not any(turso.is_write(s) for s in ("SELECT 1", "CREATE TABLE t (a)", "PRAGMA foreign_keys", "DROP TABLE t"))


def test_a_select_runs_alone_and_leaves_nothing_open():
    conn = FakeConnection([ok(rows=[[{"type": "integer", "value": "3"}]], cols=["n"])])
    cur = conn.cursor().execute("SELECT count(*) AS n FROM t")
    assert cur.fetchall() == [(3,)] and cur.description[0][0] == "n"
    assert conn.sent == [(None, ["SELECT count(*) AS n FROM t", "close"])]
    assert conn._baton is None


def test_a_write_sends_begin_with_it_and_stays_open_until_commit():
    conn = FakeConnection([ok(), ok(affected=1, rowid="5"), ok()])
    cur = conn.cursor().execute("INSERT INTO t VALUES (?)", (1,))
    assert (cur.rowcount, cur.lastrowid) == (1, 5)
    assert conn.sent[0] == (None, ["BEGIN", "INSERT INTO t VALUES (?)"])  # one round trip, not two
    assert conn._baton == "baton-1"

    conn.cursor().execute("SELECT 1")  # joins the open transaction
    assert conn.sent[1] == ("baton-1", ["SELECT 1"])

    conn.replies = [ok()]
    conn.commit()
    assert conn.sent[2] == ("baton-1", ["COMMIT", "close"]) and conn._baton is None


def test_executemany_is_batched_into_few_requests():
    conn = FakeConnection([ok()] + [ok(affected=1) for _ in range(250)])
    cur = conn.cursor().executemany("INSERT INTO t VALUES (?)", [(i,) for i in range(250)])
    assert cur.rowcount == 250
    assert len(conn.sent) == 3  # 100 + 100 + 50 statements, BEGIN riding with the first


def test_rollback_and_commit_do_nothing_when_nothing_is_open():
    conn = FakeConnection([])
    conn.commit()
    conn.rollback()
    assert conn.sent == []


def test_a_failed_statement_raises_and_keeps_the_transaction_for_rollback():
    failure = {"type": "error", "error": {"message": "UNIQUE constraint failed: t.a", "code": "SQLITE_CONSTRAINT"}}
    conn = FakeConnection([ok(), failure, ok()])
    with pytest.raises(turso.IntegrityError):
        conn.cursor().execute("INSERT INTO t VALUES (1)")
    assert conn._baton == "baton-1"  # SQLAlchemy will now call rollback(), which needs the baton
    conn.rollback()
    assert conn.sent[-1] == ("baton-1", ["ROLLBACK", "close"]) and conn._baton is None
