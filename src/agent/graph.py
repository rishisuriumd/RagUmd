"""LangGraph workflow for UMD Dining queries.

Replaces the single ReAct agent with a multi-step StateGraph:

    START -> router
    router --policy--> policy_agent -> END
    router --menu----> hall_resolver
    hall_resolver --hall_known---> menu_agent -> END
    hall_resolver --hall_missing-> ask_hall   -> END  (waits for user reply)
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from src.agent.nodes import (
    ask_hall,
    classify_question,
    resolve_hall,
    run_app_agent,
    run_menu_agent,
    run_policy_agent,
)
from src.agent.state import AgentState


def _route_by_type(state: AgentState) -> str:
    """Conditional edge after the router node."""
    qt = state.get("question_type")
    if qt == "policy":
        return "policy_agent"
    if qt == "app":
        return "app_agent"
    return "hall_resolver"


def _route_by_hall(state: AgentState) -> str:
    """Conditional edge after hall_resolver."""
    if state.get("hall"):
        return "menu_agent"
    return "ask_hall"


def build_agent(model_name: str = "gpt-4o-mini"):
    """Construct and return the compiled LangGraph workflow."""
    graph = StateGraph(AgentState)

    graph.add_node("router", classify_question)
    graph.add_node("policy_agent", run_policy_agent)
    graph.add_node("app_agent", run_app_agent)
    graph.add_node("hall_resolver", resolve_hall)
    graph.add_node("ask_hall", ask_hall)
    graph.add_node("menu_agent", run_menu_agent)

    graph.set_entry_point("router")

    graph.add_conditional_edges("router", _route_by_type, {
        "policy_agent": "policy_agent",
        "app_agent": "app_agent",
        "hall_resolver": "hall_resolver",
    })

    graph.add_edge("policy_agent", END)
    graph.add_edge("app_agent", END)

    graph.add_conditional_edges("hall_resolver", _route_by_hall, {
        "menu_agent": "menu_agent",
        "ask_hall": "ask_hall",
    })

    graph.add_edge("ask_hall", END)
    graph.add_edge("menu_agent", END)

    return graph.compile()
