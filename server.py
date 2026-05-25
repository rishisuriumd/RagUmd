#!/usr/bin/env python3
"""FastAPI server for the TerpDining web app.

Usage:
    uvicorn server:app --reload --port 8000
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv(override=True)


def _guard_langsmith_tracing() -> None:
    """Disable LangSmith tracing when the API key is missing or a placeholder.

    Avoids the noisy 403 spam in logs when the .env still has the example value.
    """
    key = (os.getenv("LANGSMITH_API_KEY") or "").strip()
    placeholder = (not key) or key.endswith("...") or key in {"lsv2_pt_", "your-key-here"}
    if placeholder:
        for var in ("LANGSMITH_TRACING", "LANGCHAIN_TRACING_V2", "LANGCHAIN_TRACING"):
            os.environ[var] = "false"
        os.environ.pop("LANGSMITH_API_KEY", None)
        os.environ.pop("LANGCHAIN_API_KEY", None)
        logging.getLogger(__name__).info(
            "LangSmith tracing disabled (LANGSMITH_API_KEY is missing or placeholder)."
        )


_guard_langsmith_tracing()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.auth import router as auth_router
from src.api.chat import router as chat_router
from src.api.favorites import router as favorites_router
from src.api.menu_browse import router as menu_router
from src.api.nutrition_search import router as nutrition_router
from src.api.recipe import router as recipe_router
from src.api.tracker import router as tracker_router
from src.db.models import get_connection, init_db

app = FastAPI(title="TerpDining API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(chat_router)
app.include_router(favorites_router)
app.include_router(menu_router)
app.include_router(nutrition_router)
app.include_router(recipe_router)
app.include_router(tracker_router)


@app.on_event("startup")
def on_startup():
    conn = get_connection()
    init_db(conn)
    conn.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
