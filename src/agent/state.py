"""Shared state schema for the TerpDining LangGraph workflow."""

from __future__ import annotations

from typing import Annotated, Optional

from langgraph.graph.message import add_messages
from typing_extensions import TypedDict


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]
    question_type: Optional[str]  # "policy" | "menu"
    hall: Optional[str]
    date: Optional[str]
    meal: Optional[str]
