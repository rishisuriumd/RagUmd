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

# ---------------------------------------------------------------------------
# Pydantic schemas for structured LLM output
# ---------------------------------------------------------------------------

class ClassificationResult(BaseModel):
    question_type: str = Field(
        description='Either "policy" or "menu".'
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

Classify the user's question into exactly one category:

* "policy" – questions about dining plans, meal plan prices, Dining Dollars,
  connector plans, allergies & special diets policy, sick meals, student
  employment / jobs, or general dining services information.
* "menu" – questions about specific food items, what's being served, nutrition
  facts, dietary/allergen filtering, food searches, or anything about a
  particular dining hall's offerings.

Respond with the category only.
"""


def classify_question(state: AgentState) -> dict:
    """Lightweight LLM call that sets state['question_type']."""
    llm = _get_llm().with_structured_output(ClassificationResult)
    last_user_msg = _last_human_text(state)
    result = llm.invoke([
        {"role": "system", "content": _CLASSIFY_PROMPT},
        {"role": "user", "content": last_user_msg},
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
1. Use the lookup_dining_info tool to find the answer. NEVER guess.
2. If the tool returns no results, say so honestly.
3. Keep answers concise and well-formatted.
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
            return msg.content
        if isinstance(msg, dict) and msg.get("role") == "user":
            return msg["content"]
    return ""
