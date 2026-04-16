"""Tools that act on the current user's account and app (via chat context)."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Optional

from langchain_core.tools import tool

from src.agent.chat_context import append_client_action, get_chat_conn, get_chat_user_id
from src.tools.food_match import best_exact_or_none, find_similar_food_names


def _norm(s: str) -> str:
    return " ".join(s.strip().split())


def _save_favorite_row(uid: int, conn, canonical_name: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "INSERT OR REPLACE INTO user_favorite_foods (user_id, food_name, created_at) VALUES (?, ?, ?)",
        (uid, canonical_name, now),
    )
    conn.commit()
    append_client_action({"type": "favorites_updated"})


@tool
def suggest_correct_food_names(user_phrase: str) -> str:
    """Look up menu item names similar to what the user typed (fixes typos / partial names).

    Call this when the user's spelling might be wrong (e.g. "egg cury" vs "Indian Egg Curry")
    or before saving a favorite if you are unsure the name exists on menus.
    Returns likely matches from the dining database.
    """
    conn = get_chat_conn()
    if conn is None:
        return json.dumps({"error": "session"})
    q = _norm(user_phrase)
    if not q:
        return json.dumps({"matches": []})
    sims = find_similar_food_names(conn, q, limit=8)
    out = [{"name": n, "similarity": round(s, 2)} for n, s in sims]
    return json.dumps({"you_typed": q, "matches": out}, indent=2)


@tool
def add_favorite_food(food_name: str) -> str:
    """Add a food item name to this user's favorites.

    Use when the user wants to be notified when this dish appears on the menu,
    or after they confirm they want something saved as a favorite.
    Pass the exact menu name when known. If the name might be misspelled, the tool will
    either save a high-confidence match or ask you to clarify with the user.
    """
    uid = get_chat_user_id()
    conn = get_chat_conn()
    if uid is None or conn is None:
        return json.dumps({"ok": False, "error": "Could not save favorite (session error)."})
    name = _norm(food_name)
    if not name:
        return json.dumps({"ok": False, "error": "Food name was empty."})

    canon = best_exact_or_none(conn, name)
    if canon:
        _save_favorite_row(uid, conn, canon)
        return json.dumps(
            {
                "ok": True,
                "saved_as": canon,
                "message": f"Saved '{canon}' to your favorites.",
            }
        )

    sims = find_similar_food_names(conn, name, limit=8)
    if not sims:
        return json.dumps(
            {
                "ok": False,
                "needs_clarification": True,
                "you_entered": name,
                "hint": "No similar items in our menu database. Ask the user to check spelling or pick a name from the Menu page.",
            }
        )

    best_n, best_s = sims[0]
    second_s = sims[1][1] if len(sims) > 1 else 0.0
    if best_s >= 0.88 and (len(sims) == 1 or (best_s - second_s) >= 0.1):
        _save_favorite_row(uid, conn, best_n)
        return json.dumps(
            {
                "ok": True,
                "saved_as": best_n,
                "corrected_from": name,
                "message": f"Saved '{best_n}' to your favorites (matched from what you typed).",
            }
        )

    return json.dumps(
        {
            "ok": False,
            "needs_clarification": True,
            "you_entered": name,
            "did_you_mean": [{"name": n, "similarity": round(s, 2)} for n, s in sims[:6]],
            "instruction": (
                "Show the user these options and ask which dish they meant. "
                "When they confirm, call add_favorite_food again with the exact menu name."
            ),
        }
    )


@tool
def remove_favorite_food(food_name: str) -> str:
    """Remove a food name from the user's favorites list."""
    uid = get_chat_user_id()
    conn = get_chat_conn()
    if uid is None or conn is None:
        return "Could not update favorites (session error)."
    name = _norm(food_name)
    conn.execute(
        "DELETE FROM user_favorite_foods WHERE user_id = ? AND food_name = ?",
        (uid, name),
    )
    conn.commit()
    append_client_action({"type": "favorites_updated"})
    return json.dumps({"ok": True, "message": f"Removed '{name}' from favorites."})


@tool
def list_my_favorite_foods() -> str:
    """List every food name the user has saved as a favorite."""
    uid = get_chat_user_id()
    conn = get_chat_conn()
    if uid is None or conn is None:
        return "Could not load favorites (session error)."
    rows = conn.execute(
        "SELECT food_name FROM user_favorite_foods WHERE user_id = ? ORDER BY food_name COLLATE NOCASE",
        (uid,),
    ).fetchall()
    names = [r["food_name"] for r in rows]
    if not names:
        return "No favorites saved yet."
    return json.dumps(names, indent=2)


@tool
def check_favorites_on_menu(dt: Optional[str] = None) -> str:
    """For each favorite food, report whether it appears on the menu for a date (default today).

    Returns halls, meals, and stations where each favorite shows up.
    """
    uid = get_chat_user_id()
    conn = get_chat_conn()
    if uid is None or conn is None:
        return "Could not check the menu (session error)."
    day = dt or date.today().isoformat()
    favs = [
        r["food_name"]
        for r in conn.execute(
            "SELECT food_name FROM user_favorite_foods WHERE user_id = ?",
            (uid,),
        ).fetchall()
    ]
    if not favs:
        return "No favorites saved yet — nothing to check."

    from src.tools.menu import search_items as _search

    results = []
    for fav in favs:
        rows = _search(keyword=fav, hall=None, dt=day)
        matching = [r for r in rows if fav.lower() in (r.get("item_name") or "").lower()]
        if not matching:
            matching = rows[:15]
        results.append({"favorite": fav, "on_menu": len(matching) > 0, "matches": matching[:20]})
    return json.dumps(results, indent=2)


_VALID_PATHS = frozenset({"/menu", "/tracker", "/chat", "/recipe"})


@tool
def open_app_page(path: str) -> str:
    """Open a screen in the TerpDining app for the user.

    Use when they ask to go to the menu, tracker, chat, or recipe page.
    Paths must be exactly: /menu, /tracker, /chat, or /recipe
    """
    p = path.strip()
    if p not in _VALID_PATHS:
        return json.dumps(
            {
                "error": "invalid_path",
                "allowed": list(_VALID_PATHS),
            }
        )
    append_client_action({"type": "navigate", "path": p})
    return json.dumps({"ok": True, "opening": p})


USER_APP_TOOLS = [
    suggest_correct_food_names,
    add_favorite_food,
    remove_favorite_food,
    list_my_favorite_foods,
    check_favorites_on_menu,
    open_app_page,
]
