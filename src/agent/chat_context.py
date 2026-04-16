"""Per-request context for chat tools (user id, db connection, client actions)."""

from __future__ import annotations

from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any

import sqlite3

_user_id: ContextVar[int | None] = ContextVar("chat_user_id", default=None)
_conn: ContextVar[sqlite3.Connection | None] = ContextVar("chat_conn", default=None)
_actions: ContextVar[list[dict[str, Any]] | None] = ContextVar("chat_actions", default=None)


@contextmanager
def chat_context_run(user_id: int, conn: sqlite3.Connection):
    bucket: list[dict[str, Any]] = []
    t1 = _user_id.set(user_id)
    t2 = _conn.set(conn)
    t3 = _actions.set(bucket)
    try:
        yield bucket
    finally:
        _user_id.reset(t1)
        _conn.reset(t2)
        _actions.reset(t3)


def get_chat_user_id() -> int | None:
    return _user_id.get()


def get_chat_conn() -> sqlite3.Connection | None:
    return _conn.get()


def append_client_action(action: dict[str, Any]) -> None:
    bucket = _actions.get()
    if bucket is not None:
        bucket.append(action)


def drain_client_actions() -> list[dict[str, Any]]:
    bucket = _actions.get()
    if not bucket:
        return []
    out = list(bucket)
    bucket.clear()
    return out
