"""Smoke tests for dining query tools (requires umd_dining.db — run run_loader.py first)."""

from __future__ import annotations

import unittest
from pathlib import Path

from src.tools import (
    filter_items_by_diet,
    get_item_nutrition,
    get_menu,
    search_items,
)

DB = Path(__file__).resolve().parent.parent / "umd_dining.db"
SAMPLE_DATE = "2026-04-10"


@unittest.skipUnless(DB.exists(), "umd_dining.db missing; run: python run_loader.py")
class TestDiningTools(unittest.TestCase):
    def test_get_menu(self) -> None:
        rows = get_menu(hall="Yahentamitsi", dt=SAMPLE_DATE, meal="Breakfast")
        self.assertGreater(len(rows), 0)
        self.assertIn("station", rows[0])
        self.assertIn("dietary_tags", rows[0])

    def test_filter_items_by_diet_include(self) -> None:
        rows = filter_items_by_diet(
            hall="South Campus",
            dt=SAMPLE_DATE,
            meal="Breakfast",
            include_tags=["vegan"],
        )
        self.assertGreater(len(rows), 0)
        for r in rows[:10]:
            self.assertIn("vegan", r["dietary_tags"])

    def test_filter_items_by_diet_exclude(self) -> None:
        rows = filter_items_by_diet(
            hall="251 North",
            dt=SAMPLE_DATE,
            meal="Lunch",
            exclude_allergens=["Contains nuts", "Contains sesame"],
        )
        self.assertGreater(len(rows), 0)

    def test_get_item_nutrition(self) -> None:
        rows = get_item_nutrition("Pancakes")
        self.assertGreaterEqual(len(rows), 1)
        self.assertIn("nutrients", rows[0])

    def test_search_items(self) -> None:
        rows = search_items("Pizza", hall="South Campus", dt=SAMPLE_DATE)
        self.assertGreater(len(rows), 0)


if __name__ == "__main__":
    unittest.main()
