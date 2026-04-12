"""Menu query tools: get_menu and search_items."""

from __future__ import annotations

import sqlite3
from datetime import date
from typing import Any

from src.db.models import get_connection


def get_menu(
    hall: str | None = None,
    dt: str | date | None = None,
    meal: str | None = None,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """Return menu items for a given hall, date, and/or meal.

    All parameters are optional filters.  ``dt`` defaults to today.
    Returns a list of dicts with keys: hall, date, meal, station,
    item_name, dietary_tags.
    """
    conn = get_connection(db_path)
    try:
        if dt is None:
            dt = date.today().isoformat()
        elif isinstance(dt, date):
            dt = dt.isoformat()

        clauses: list[str] = ["me.date = ?"]
        params: list[Any] = [dt]

        if hall:
            clauses.append("dh.name LIKE ?")
            params.append(f"%{hall}%")
        if meal:
            clauses.append("LOWER(me.meal) = LOWER(?)")
            params.append(meal)

        where = " AND ".join(clauses)

        rows = conn.execute(
            f"""\
            SELECT dh.name AS hall, me.date, me.meal, me.station,
                   fi.name AS item_name, fi.id AS food_item_id
            FROM menu_entries me
            JOIN dining_halls dh ON dh.id = me.hall_id
            JOIN food_items fi   ON fi.id = me.food_item_id
            WHERE {where}
            ORDER BY dh.name, me.meal, me.station, fi.name
            """,
            params,
        ).fetchall()

        results: list[dict[str, Any]] = []
        for r in rows:
            tags = [
                t["tag"]
                for t in conn.execute(
                    "SELECT tag FROM food_item_tags WHERE food_item_id = ?",
                    (r["food_item_id"],),
                ).fetchall()
            ]
            results.append({
                "hall": r["hall"],
                "date": r["date"],
                "meal": r["meal"],
                "station": r["station"],
                "item_name": r["item_name"],
                "dietary_tags": tags,
            })

        return results
    finally:
        conn.close()


def search_items(
    keyword: str,
    hall: str | None = None,
    dt: str | date | None = None,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """Search menu items by keyword (name substring match).

    Returns matching items with hall/date/meal context.
    """
    conn = get_connection(db_path)
    try:
        clauses: list[str] = ["fi.name LIKE ?"]
        params: list[Any] = [f"%{keyword}%"]

        if dt:
            if isinstance(dt, date):
                dt = dt.isoformat()
            clauses.append("me.date = ?")
            params.append(dt)
        if hall:
            clauses.append("dh.name LIKE ?")
            params.append(f"%{hall}%")

        where = " AND ".join(clauses)

        rows = conn.execute(
            f"""\
            SELECT DISTINCT dh.name AS hall, me.date, me.meal, me.station,
                   fi.name AS item_name
            FROM menu_entries me
            JOIN dining_halls dh ON dh.id = me.hall_id
            JOIN food_items fi   ON fi.id = me.food_item_id
            WHERE {where}
            ORDER BY me.date, dh.name, me.meal, fi.name
            """,
            params,
        ).fetchall()

        return [dict(r) for r in rows]
    finally:
        conn.close()
