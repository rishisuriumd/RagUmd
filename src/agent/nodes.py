"""Graph nodes for the TerpDining multi-step workflow.

Nodes:
    classify_question  – lightweight LLM call to route "policy" vs "menu"
    resolve_hall       – structured-output LLM call to extract hall/date/meal
    ask_hall           – template message asking the user to pick a dining hall
    run_policy_agent   – ReAct sub-agent with lookup_dining_info only
    run_menu_agent     – ReAct sub-agent with the 4 menu/nutrition tools
"""

from __future__ import annotations

from datetime import date

from langchain_core.messages import AIMessage, HumanMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from pydantic import BaseModel, Field

from src.agent.state import AgentState
from src.agent.tools import MENU_TOOLS, POLICY_TOOLS
from src.agent.tools_user import USER_APP_TOOLS

# ---------------------------------------------------------------------------
# Pydantic schemas for structured LLM output
# ---------------------------------------------------------------------------

class ClassificationResult(BaseModel):
    question_type: str = Field(
        description=(
            'One of: "policy" (dining plans, jobs, sick meals, general info), '
            '"menu" (what is served, nutrition, allergens, hall menus), '
            '"app" (saving favorite foods, listing favorites, opening Menu/Tracker/Chat/Recipe in the app, '
            "anything that only changes the user's account or navigates the app)."
        )
    )


class HallExtraction(BaseModel):
    hall: str | None = Field(
        default=None,
        description=(
            'Canonical dining hall name: "South Campus", '
            '"Yahentamitsi Dining Hall", or "251 North". '
            "null if the user didn't specify or it's ambiguous."
        ),
    )
    date: str | None = Field(
        default=None,
        description="Date in YYYY-MM-DD format, or null if not mentioned.",
    )
    meal: str | None = Field(
        default=None,
        description='"Breakfast", "Lunch", or "Dinner", or null if not mentioned.',
    )


# ---------------------------------------------------------------------------
# Shared LLM instance (lazy-init on first call)
# ---------------------------------------------------------------------------

_llm: ChatOpenAI | None = None


def _get_llm() -> ChatOpenAI:
    global _llm
    if _llm is None:
        _llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    return _llm


# ---------------------------------------------------------------------------
# Node 1: classify_question
# ---------------------------------------------------------------------------

_CLASSIFY_PROMPT = """\
You are a router for a UMD Dining assistant.

Classify the user's **latest** message into exactly one category:

* "policy" – dining plans, meal plan prices, Dining Dollars, connector plans,
  allergies & special diets policy, sick meals, student jobs, general dining services info.
* "menu" – what's being served, nutrition facts, allergens, food search, a specific hall's menu.
* "app" – saving/removing/listing favorite dishes, checking if favorites are on the menu today,
  asking to open the Menu / Tracker / Chat / Recipe screen, or other account/app actions
  that do not require browsing a full hall menu from scratch.

Important:
- If the latest message is only "yes", "ok", "sure", "please", etc. **and** the assistant
  just asked about saving a favorite or app action, classify as **app**.
- If the user both names a favorite and asks what's for lunch, prefer "menu".
- If they only want favorites saved or app navigation, use "app".

You will see recent conversation turns for context — use them.
"""


_AFFIRM_WORDS = frozenset({
    "yes", "yeah", "yep", "yup", "ok", "okay", "sure", "please", "y",
    "definitely", "absolutely",
})
_AFFIRM_PHRASES = (
    "yes please", "go ahead", "sounds good", "do it", "save it",
    "add it", "you can", "that works",
)


def _is_affirmation(text: str) -> bool:
    s = text.strip().lower()
    if not s:
        return False
    if s in _AFFIRM_PHRASES:
        return True
    first = s.split()[0] if s.split() else ""
    if first in _AFFIRM_WORDS and len(s) < 40:
        return True
    return False


def _msg_content_str(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for x in content:
            if isinstance(x, str):
                parts.append(x)
            elif isinstance(x, dict) and x.get("type") == "text":
                parts.append(x.get("text") or "")
        return "".join(parts)
    return str(content) if content else ""


def _last_assistant_text(state: AgentState) -> str:
    msgs = state.get("messages") or []
    if len(msgs) < 2:
        return ""
    for i in range(len(msgs) - 2, -1, -1):
        m = msgs[i]
        if isinstance(m, dict) and m.get("role") == "assistant":
            return _msg_content_str(m.get("content"))
        if isinstance(m, AIMessage):
            return _msg_content_str(m.content)
    return ""


def _assistant_suggested_favorite_save(ai_text: str) -> bool:
    t = ai_text.lower()
    if "favorite" in t:
        return True
    if "save" in t and any(x in t for x in ("would you", "want me", "should i", "like me to")):
        return True
    if "add" in t and "favorite" in t:
        return True
    return False


def _should_force_app_route(state: AgentState) -> bool:
    """Short 'yes' after assistant offered to save a favorite → app."""
    last_user = _last_human_text(state)
    if not _is_affirmation(last_user):
        return False
    prev_ai = _last_assistant_text(state)
    if not prev_ai:
        return False
    return _assistant_suggested_favorite_save(prev_ai)


def _routing_context(state: AgentState) -> str:
    """Last few turns as plain text for the router LLM."""
    lines: list[str] = []
    for m in (state.get("messages") or [])[-8:]:
        if isinstance(m, dict):
            role = m.get("role", "")
            c = _msg_content_str(m.get("content"))
            if c.strip():
                lines.append(f"{role}: {c.strip()[:500]}")
        elif isinstance(m, HumanMessage):
            lines.append(f"user: {_msg_content_str(m.content).strip()[:500]}")
        elif isinstance(m, AIMessage):
            lines.append(f"assistant: {_msg_content_str(m.content).strip()[:500]}")
    return "\n".join(lines) if lines else _last_human_text(state)


def classify_question(state: AgentState) -> dict:
    """Lightweight LLM call that sets state['question_type']."""
    if _should_force_app_route(state):
        return {"question_type": "app"}

    llm = _get_llm().with_structured_output(ClassificationResult)
    ctx = _routing_context(state)
    result = llm.invoke([
        {"role": "system", "content": _CLASSIFY_PROMPT},
        {"role": "user", "content": f"Recent conversation:\n{ctx}\n\nClassify the latest user message."},
    ])
    return {"question_type": result.question_type}


# ---------------------------------------------------------------------------
# Node 2: resolve_hall
# ---------------------------------------------------------------------------

_RESOLVE_PROMPT = f"""\
You are a helper that extracts dining-hall context from a user's question
about UMD Dining.

The three dining halls are:
  - "South Campus"  (nicknames: "South", "SC")
  - "Yahentamitsi Dining Hall"  (nicknames: "the Y", "Yahentamitsi", "Y")
  - "251 North"  (nicknames: "251", "North", "two-fifty-one")

Today's date is {date.today().isoformat()}.
If the user says "today", use today's date.
If the user says "tomorrow", use tomorrow's date.

Return:
  hall  – the canonical name if mentioned, otherwise null
  date  – YYYY-MM-DD if mentioned or inferable, otherwise null
  meal  – "Breakfast", "Lunch", or "Dinner" if mentioned, otherwise null
"""


def resolve_hall(state: AgentState) -> dict:
    """Structured-output LLM call that extracts hall, date, meal."""
    llm = _get_llm().with_structured_output(HallExtraction)
    last_user_msg = _last_human_text(state)
    result = llm.invoke([
        {"role": "system", "content": _RESOLVE_PROMPT},
        {"role": "user", "content": last_user_msg},
    ])
    return {
        "hall": result.hall,
        "date": result.date,
        "meal": result.meal,
    }


# ---------------------------------------------------------------------------
# Node 3: ask_hall
# ---------------------------------------------------------------------------

_ASK_HALL_MSG = (
    "Which dining hall are you asking about?\n"
    "- **South Campus**\n"
    "- **Yahentamitsi Dining Hall** (the Y)\n"
    "- **251 North**"
)


def ask_hall(state: AgentState) -> dict:
    """Append a clarification message asking the user to pick a hall."""
    return {"messages": [AIMessage(content=_ASK_HALL_MSG)]}


# ---------------------------------------------------------------------------
# Node 4: run_policy_agent
# ---------------------------------------------------------------------------

_POLICY_PROMPT = """\
You are **TerpDining Assistant** answering a general policy / info question
about University of Maryland Dining.

Rules:
1. For dining plans, jobs, sick meals, policies: use **lookup_dining_info**. NEVER guess.
2. For saving/removing favorite dishes, listing favorites, checking if favorites are on the menu,
   or opening Menu/Tracker/Chat/Recipe: use **suggest_correct_food_names**, **add_favorite_food**,
   **remove_favorite_food**, **list_my_favorite_foods**, **check_favorites_on_menu**, or **open_app_page**.
   If spelling might be wrong, call **suggest_correct_food_names** first or rely on **add_favorite_food**'s
   did_you_mean response. You CAN save favorites — never say you lack that ability.
3. If the user confirms they want something saved (e.g. "yes" after you offered), call
   **add_favorite_food** with the dish name from the conversation.
4. If the tool returns no results, say so honestly.
5. Keep answers concise and well-formatted.
"""


def run_policy_agent(state: AgentState) -> dict:
    """ReAct sub-agent scoped to policy/info tools only."""
    agent = create_react_agent(
        model=_get_llm(),
        tools=POLICY_TOOLS,
        prompt=_POLICY_PROMPT,
    )
    result = agent.invoke({"messages": state["messages"]})
    return {"messages": result["messages"]}


# ---------------------------------------------------------------------------
# Node 4b: run_app_agent (favorites + in-app navigation)
# ---------------------------------------------------------------------------

_APP_PROMPT = """\
You are **TerpDining Assistant** handling the user's account and the web app itself.

You can:
- suggest_correct_food_names — find real menu item names when the user misspells or shortens a dish
  (e.g. "egg cury" → suggest "Indian Egg Curry"). Use this before saving if spelling looks off.
- add_favorite_food / remove_favorite_food — save or remove a dish name they care about.
  If add_favorite_food returns needs_clarification with did_you_mean, show those options and ask
  which one they meant, then call add_favorite_food again with the exact name they confirm.
- list_my_favorite_foods — show everything they saved.
- check_favorites_on_menu — see which favorites appear on the menu for a date (default today).
- open_app_page — navigate to /menu, /tracker, /chat, or /recipe when they ask to open that screen.

Rules:
1. If the user says they love a dish or want reminders when it's served, ask once if they want it
   saved, then call add_favorite_food with the clearest dish name once they agree (or if they
   clearly already agreed).
2. If the user only replies "yes", "ok", or "sure", look at your previous message for the dish
   name you offered to save, then call add_favorite_food with that exact name.
3. Be concise and friendly. Confirm what you did in plain language.
4. Use tools for real changes; never pretend you saved something without calling the tool.
   Never say you cannot save preferences — you can, using add_favorite_food.
"""


def run_app_agent(state: AgentState) -> dict:
    """ReAct sub-agent: favorites and in-app navigation only."""
    agent = create_react_agent(
        model=_get_llm(),
        tools=USER_APP_TOOLS,
        prompt=_APP_PROMPT,
    )
    result = agent.invoke({"messages": state["messages"]})
    return {"messages": result["messages"]}


# ---------------------------------------------------------------------------
# Node 5: run_menu_agent
# ---------------------------------------------------------------------------

_MENU_PROMPT_TEMPLATE = """\
You are **TerpDining Assistant** answering a question about University of
Maryland dining hall menus, food items, or nutrition facts.

## Context extracted from the question
- Dining hall: {hall}
- Date: {date}
- Meal: {meal}

## Rules
1. **Only use tool results** to answer. Never guess or make up food items,
   nutrition facts, or allergen info.
2. If a tool returns no results, say so honestly — do not invent data.
3. When calling tools, ALWAYS pass the hall, date, and meal shown above
   (if they are known) so results are scoped correctly.
4. Dining halls: South Campus, Yahentamitsi Dining Hall, 251 North.
5. Meals: Breakfast, Lunch, Dinner.
6. Dietary tags: vegan, vegetarian, HalalFriendly,
   Contains dairy, Contains egg, Contains gluten, Contains nuts,
   Contains sesame, Contains soy, Contains fish, Contains Shellfish.
7. Format answers clearly (bullets or a short table). Keep them concise.
8. For allergen / dietary questions, use `filter_items_by_diet`.
   For nutrition facts, use `get_item_nutrition`.
   For general menu lookups, use `get_menu`.
   For keyword searches, use `search_items`.
9. **Multi-step strategy for complex dietary + nutrition queries** (e.g.
   "vegetarian under 500 calories", "high protein low carb vegan"):
   - Step 1: call `filter_items_by_diet` to get items matching dietary tags.
   - Step 2: call `get_item_nutrition` for several of the matching items to
     check their calories, protein, carbs, fat, etc.
   - Step 3: present only the items that meet ALL of the user's criteria
     (dietary tags AND calorie/macro targets) in a clear list with macros.
   NEVER say "I couldn't find information" without first trying this
   multi-step approach. There are ALWAYS items on the menu; your job is
   to find and filter them.
10. If the user asks for meal suggestions or recipe-like combinations,
    do your best with the tools: get the menu, check nutrition, and
    suggest specific items. If the question is very recipe-oriented,
    mention they can also try the **Recipe Creator** tab.
11. **Favorites & app:** If they want a dish saved, removed, or listed, or ask to open another
    tab, use **suggest_correct_food_names** (for typos), **add_favorite_food**, **remove_favorite_food**,
    **list_my_favorite_foods**, **check_favorites_on_menu**, or **open_app_page**. If **add_favorite_food**
    returns possible matches, help the user pick the right menu name. Never claim you cannot save favorites.
"""


def run_menu_agent(state: AgentState) -> dict:
    """ReAct sub-agent scoped to menu/nutrition tools.

    Injects resolved hall/date/meal into its system prompt so the LLM
    doesn't need to figure those out from scratch.
    """
    hall = state.get("hall") or "not specified"
    dt = state.get("date") or "not specified"
    meal = state.get("meal") or "not specified"

    prompt = _MENU_PROMPT_TEMPLATE.format(hall=hall, date=dt, meal=meal)

    agent = create_react_agent(
        model=_get_llm(),
        tools=MENU_TOOLS,
        prompt=prompt,
    )
    result = agent.invoke({"messages": state["messages"]})
    return {"messages": result["messages"]}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _last_human_text(state: AgentState) -> str:
    """Return the text of the most recent HumanMessage."""
    for msg in reversed(state["messages"]):
        if isinstance(msg, HumanMessage):
            return _msg_content_str(msg.content)
        if isinstance(msg, dict) and msg.get("role") == "user":
            return _msg_content_str(msg.get("content"))
    return ""
