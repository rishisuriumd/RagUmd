"""LangChain @tool wrappers around the dining query functions.

Each tool has a clear docstring that the LLM reads to decide when/how to call it.
All return JSON-serializable strings so the agent can include them in responses.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Optional

from langchain_core.tools import tool

from src.agent.tools_user import USER_APP_TOOLS


@tool
def get_menu(
    hall: Optional[str] = None,
    dt: Optional[str] = None,
    meal: Optional[str] = None,
) -> str:
    """Look up the dining hall menu for a specific hall, date, and meal.

    Args:
        hall: Dining hall name or partial match. Options: "South Campus",
              "Yahentamitsi Dining Hall", "251 North". Leave empty for all halls.
        dt:   Date in YYYY-MM-DD format. Defaults to today if not provided.
        meal: One of "Breakfast", "Lunch", or "Dinner". Leave empty for all meals.

    Returns a JSON list of menu items with station, item_name, and dietary_tags.
    """
    from src.tools.menu import get_menu as _get_menu

    rows = _get_menu(hall=hall, dt=dt, meal=meal)
    if not rows:
        return "No menu items found for the given filters."
    return json.dumps(rows[:80], indent=2)


@tool
def filter_items_by_diet(
    hall: Optional[str] = None,
    dt: Optional[str] = None,
    meal: Optional[str] = None,
    include_tags: Optional[list[str]] = None,
    exclude_allergens: Optional[list[str]] = None,
) -> str:
    """Filter menu items by dietary preferences and allergen exclusions.

    Args:
        hall: Dining hall name or partial match. Leave empty for all halls.
        dt:   Date in YYYY-MM-DD format. Defaults to today.
        meal: "Breakfast", "Lunch", or "Dinner". Leave empty for all.
        include_tags: Tags the item MUST have. Values: "vegan", "vegetarian",
                      "HalalFriendly".
        exclude_allergens: Tags the item must NOT have. Values:
                           "Contains dairy", "Contains egg", "Contains gluten",
                           "Contains nuts", "Contains sesame", "Contains soy",
                           "Contains fish", "Contains Shellfish".

    Returns a JSON list of matching items.
    """
    from src.tools.filters import filter_items_by_diet as _filter

    rows = _filter(
        hall=hall,
        dt=dt,
        meal=meal,
        include_tags=include_tags,
        exclude_allergens=exclude_allergens,
    )
    if not rows:
        return "No items match the given dietary filters."
    return json.dumps(rows[:80], indent=2)


@tool
def get_item_nutrition(item_name: str) -> str:
    """Get nutrition facts for a food item by name (fuzzy match).

    Args:
        item_name: Full or partial name of the food item (e.g. "Pancakes",
                   "Grilled Chicken").

    Returns nutrition details including calories, macros, ingredients,
    and allergens for all matching items.
    """
    from src.tools.nutrition import get_item_nutrition as _get_nutrition

    rows = _get_nutrition(item_name=item_name)
    if not rows:
        return f"No nutrition info found for '{item_name}'."

    compact = []
    for r in rows[:10]:
        compact.append({
            "name": r["name"],
            "calories": r["calories"],
            "protein_g": r["protein_g"],
            "total_fat_g": r["total_fat_g"],
            "total_carbs_g": r["total_carbs_g"],
            "sodium_mg": r["sodium_mg"],
            "serving_size": r["serving_size"],
            "ingredients": r["ingredients"][:200] if r["ingredients"] else "",
            "allergens": r["allergens"],
        })
    return json.dumps(compact, indent=2)


@tool
def search_items(
    keyword: str,
    hall: Optional[str] = None,
    dt: Optional[str] = None,
) -> str:
    """Search for menu items by keyword across all halls and dates.

    Args:
        keyword: Word or phrase to search for in item names (e.g. "pizza",
                 "chicken", "vegan").
        hall:    Optional dining hall filter.
        dt:      Optional date filter (YYYY-MM-DD).

    Returns matching items with their hall, date, meal, and station.
    """
    from src.tools.menu import search_items as _search

    rows = _search(keyword=keyword, hall=hall, dt=dt)
    if not rows:
        return f"No menu items found matching '{keyword}'."
    return json.dumps(rows[:50], indent=2)


@tool
def lookup_dining_info(query: str) -> str:
    """Look up general UMD Dining information (NOT daily menus or nutrition).

    Use this for questions about dining plans, meal plan prices, Dining Dollars,
    allergies & special diets policy, sick meals, student employment / jobs,
    connector plans, block meal plans, or general dining services info.

    Args:
        query: The topic or question to search for (e.g. "dining plan prices",
               "sick meals", "student jobs", "dining dollars", "allergies").

    Returns the relevant page content from the UMD Dining website.
    """
    from src.tools.dining_info import lookup_dining_info as _lookup

    pages = _lookup(query=query)
    if not pages:
        return f"No dining info found for '{query}'."

    parts: list[str] = []
    for p in pages[:3]:
        content = p["content"]
        if len(content) > 2000:
            content = content[:2000] + "\n... (truncated)"
        parts.append(f"## {p['title']}\nSource: {p['url']}\n\n{content}")
    return "\n\n---\n\n".join(parts)


MENU_TOOLS = [get_menu, filter_items_by_diet, get_item_nutrition, search_items] + USER_APP_TOOLS
POLICY_TOOLS = [lookup_dining_info] + USER_APP_TOOLS
ALL_TOOLS = [
    get_menu,
    filter_items_by_diet,
    get_item_nutrition,
    search_items,
    lookup_dining_info,
] + USER_APP_TOOLS
