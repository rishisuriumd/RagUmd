"""General dining info query tool: lookup_dining_info."""

from __future__ import annotations

from typing import Any

from src.db.models import get_connection

TOPIC_KEYWORDS: dict[str, list[str]] = {
    "resident-plans": ["resident", "unlimited", "dining plan", "base", "premium", "preferred", "guest pass"],
    "connector-plans": ["connector", "block", "meal plan", "five-day", "anytime", "off-campus", "block meal"],
    "dining-dollars": ["dining dollar", "dd", "bundle", "discount", "where to use", "stamp", "cafe", "shop", "convenience"],
    "nutrition-allergies-special-diets": ["allergy", "allergies", "allergen", "special diet", "intolerance", "nutrition info", "nutritionist", "celiac", "gluten free"],
    "student-employment": ["job", "employment", "work", "hire", "hiring", "student worker", "scholarship", "federal work study"],
    "sick-meals": ["sick", "ill", "unwell", "sick meal", "pickup", "representative"],
}


def lookup_dining_info(
    query: str,
    db_path: str | None = None,
) -> list[dict[str, Any]]:
    """Search general dining info pages by keyword.

    Matches query terms against page titles and content (case-insensitive).
    Also uses a topic keyword map for better relevance.
    Returns matching pages ranked by relevance.
    """
    conn = get_connection(db_path)
    try:
        query_lower = query.lower()

        # First: find slugs that match via topic keywords
        matched_slugs: list[str] = []
        for slug, keywords in TOPIC_KEYWORDS.items():
            if any(kw in query_lower for kw in keywords):
                matched_slugs.append(slug)

        results: list[dict[str, Any]] = []

        if matched_slugs:
            placeholders = ",".join("?" for _ in matched_slugs)
            rows = conn.execute(
                f"SELECT slug, title, url, content FROM dining_info WHERE slug IN ({placeholders})",
                matched_slugs,
            ).fetchall()
            results.extend(dict(r) for r in rows)

        # Also do a content/title LIKE search for anything else
        pattern = f"%{query}%"
        rows = conn.execute(
            "SELECT slug, title, url, content FROM dining_info "
            "WHERE (LOWER(title) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?)) "
            "ORDER BY title",
            (pattern, pattern),
        ).fetchall()
        seen = {r["slug"] for r in results}
        for r in rows:
            if r["slug"] not in seen:
                results.append(dict(r))
                seen.add(r["slug"])

        return results
    finally:
        conn.close()
