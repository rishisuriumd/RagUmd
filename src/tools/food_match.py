"""Fuzzy match user-typed food names against items in the database."""

from __future__ import annotations

import re
import sqlite3
from difflib import SequenceMatcher


def _tokens(s: str) -> list[str]:
    raw = [t for t in re.split(r"[^\w]+", s.lower()) if len(t) > 1]
    # Common food-name typos: search both spellings
    extra: list[str] = []
    typo_alt = {"cury": "curry", "currey": "curry", "piza": "pizza", "checken": "chicken"}
    for t in raw:
        if t in typo_alt:
            extra.append(typo_alt[t])
    return list(dict.fromkeys(raw + extra))


def find_similar_food_names(
    conn: sqlite3.Connection,
    query: str,
    *,
    limit: int = 8,
) -> list[tuple[str, float]]:
    """Return (canonical_name, score) sorted by best match.

    Uses token substring filters to narrow candidates, then sequence similarity.
    """
    q = query.strip()
    if not q:
        return []
    toks = _tokens(q)
    if not toks:
        return []

    clause = " OR ".join(["LOWER(name) LIKE ?" for _ in toks])
    params = [f"%{t}%" for t in toks]
    rows = conn.execute(
        f"SELECT DISTINCT name FROM food_items WHERE {clause} LIMIT 1500",
        params,
    ).fetchall()
    names = [r[0] for r in rows]

    if not names:
        # Broader: any single significant token
        t0 = toks[0]
        rows = conn.execute(
            "SELECT DISTINCT name FROM food_items WHERE LOWER(name) LIKE ? LIMIT 800",
            (f"%{t0}%",),
        ).fetchall()
        names = [r[0] for r in rows]

    q_lower = q.lower()
    q_joined = " ".join(toks)
    scored: list[tuple[str, float]] = []
    for n in names:
        nl = n.lower()
        nt = " ".join(_tokens(n))
        r1 = SequenceMatcher(None, q_lower, nl).ratio()
        r2 = SequenceMatcher(None, q_joined, nt).ratio() if nt else 0.0
        score = max(r1, r2)
        if all(t in nl for t in toks):
            score = min(1.0, score + 0.12)
        scored.append((n, score))

    scored.sort(key=lambda x: (-x[1], x[0].lower()))
    seen: set[str] = set()
    out: list[tuple[str, float]] = []
    for n, s in scored:
        key = n.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append((n, s))
        if len(out) >= limit:
            break
    return out


def best_exact_or_none(conn: sqlite3.Connection, name: str) -> str | None:
    """Return canonical DB name if case-insensitive exact match exists."""
    row = conn.execute(
        "SELECT name FROM food_items WHERE LOWER(name) = LOWER(?) LIMIT 1",
        (name.strip(),),
    ).fetchone()
    return row["name"] if row else None
