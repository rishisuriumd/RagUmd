"""Diet / allergen filter tool: filter_items_by_diet."""

from __future__ import annotations

from datetime import date
from typing import Any

from src.db.models import get_connection


def _allergen_like_pattern(term: str) -> str | None:
    """Map a tag like 'Contains nuts' to a LIKE pattern for allergens text."""
    t = term.strip()
    if t.lower().startswith("contains "):
        t = t[9:].strip()
    if not t:
        return None
    low = t.lower()
    if low == "dairy":
        key = "milk"
    elif low == "egg":
        key = "egg"
    elif low in ("nuts", "nut"):
        key = "nut"
    elif low in ("soy", "soybeans"):
        key = "soy"
    elif low in ("wheat", "gluten"):
        key = "wheat"
    elif low == "fish":
        key = "fish"
    elif low == "shellfish":
        key = "shell"
    elif low == "sesame":
        key = "sesame"
    else:
        key = low
    return f"%{key}%"


def filter_items_by_diet(
    hall: str | None = None,
    dt: str | date | None = None,
    meal: str | None = None,
    include_tags: list[str] | None = None,
    exclude_allergens: list[str] | None = None,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """Filter menu items by dietary tags and allergen exclusions.

    ``include_tags``: item must have **all** of these tags in ``food_item_tags``.

    ``exclude_allergens``: exclude items that have a matching tag **or** whose
    ``food_nutrition.allergens`` text matches (case-insensitive LIKE).

    ``dt`` defaults to today.
    """
    include_tags = include_tags or []
    exclude_allergens = exclude_allergens or []

    conn = get_connection(db_path)
    try:
        if dt is None:
            dt_iso = date.today().isoformat()
        elif isinstance(dt, date):
            dt_iso = dt.isoformat()
        else:
            dt_iso = dt

        clauses: list[str] = ["me.date = ?"]
        params: list[Any] = [dt_iso]

        if hall:
            clauses.append("dh.name LIKE ?")
            params.append(f"%{hall}%")
        if meal:
            clauses.append("LOWER(me.meal) = LOWER(?)")
            params.append(meal)

        for tag in include_tags:
            clauses.append(
                "EXISTS (SELECT 1 FROM food_item_tags fit "
                "WHERE fit.food_item_id = fi.id AND fit.tag = ?)"
            )
            params.append(tag)

        for ex in exclude_allergens:
            clauses.append(
                "NOT EXISTS (SELECT 1 FROM food_item_tags fex "
                "WHERE fex.food_item_id = fi.id AND fex.tag = ?)"
            )
            params.append(ex)
            pat = _allergen_like_pattern(ex)
            if pat:
                clauses.append(
                    "(fn.allergens IS NULL OR LOWER(fn.allergens) NOT LIKE LOWER(?))"
                )
                params.append(pat)

        where = " AND ".join(clauses)

        rows = conn.execute(
            f"""\
            SELECT DISTINCT dh.name AS hall, me.date, me.meal, me.station,
                   fi.name AS item_name, fi.id AS food_item_id
            FROM menu_entries me
            JOIN dining_halls dh ON dh.id = me.hall_id
            JOIN food_items fi   ON fi.id = me.food_item_id
            LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
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
