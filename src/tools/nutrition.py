"""Nutrition query tools: get_item_nutrition."""

from __future__ import annotations

import json
from typing import Any

from src.db.models import get_connection


def get_item_nutrition(
    item_name: str,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """Fuzzy-match food items by name and return nutrition details.

    Uses SQL ``LIKE '%keyword%'`` on ``food_items.name``.
    Returns a list of dicts (one per matching item) with: name, label_url,
    serving_size, serving_per_container, calories, protein_g, total_fat_g,
    total_carbs_g, sodium_mg, ingredients, allergens, nutrients (dict).
    """
    conn = get_connection(db_path)
    try:
        pattern = f"%{item_name}%"
        rows = conn.execute(
            """\
            SELECT fi.name, fi.label_url,
                   fn.serving_size, fn.serving_per_container,
                   fn.calories, fn.protein_g, fn.total_fat_g, fn.total_carbs_g,
                   fn.sodium_mg, fn.ingredients, fn.allergens, fn.nutrients_json
            FROM food_items fi
            LEFT JOIN food_nutrition fn ON fn.food_item_id = fi.id
            WHERE fi.name LIKE ?
            ORDER BY LENGTH(fi.name), fi.name
            """,
            (pattern,),
        ).fetchall()

        out: list[dict[str, Any]] = []
        for r in rows:
            nutrients: dict[str, Any] = {}
            if r["nutrients_json"]:
                try:
                    nutrients = json.loads(r["nutrients_json"])
                except json.JSONDecodeError:
                    nutrients = {}
            out.append({
                "name": r["name"],
                "label_url": r["label_url"],
                "serving_size": r["serving_size"] or "",
                "serving_per_container": r["serving_per_container"] or "",
                "calories": r["calories"],
                "protein_g": r["protein_g"],
                "total_fat_g": r["total_fat_g"],
                "total_carbs_g": r["total_carbs_g"],
                "sodium_mg": r["sodium_mg"],
                "ingredients": r["ingredients"] or "",
                "allergens": r["allergens"] or "",
                "nutrients": nutrients,
            })
        return out
    finally:
        conn.close()
