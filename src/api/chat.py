"""Chat endpoints: send messages, manage chat sessions with history."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from src.agent.chat_context import chat_context_run
from src.api.deps import get_current_user, get_db

router = APIRouter(prefix="/api", tags=["chat"])

_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        from src.agent.graph import build_agent
        _agent = build_agent()
    return _agent


class ChatRequest(BaseModel):
    session_id: int | None = None
    message: str


class ChatResponse(BaseModel):
    session_id: int
    reply: str
    question_type: str | None = None
    hall: str | None = None
    client_actions: list[dict[str, Any]] = []


class SessionOut(BaseModel):
    id: int
    title: str
    updated_at: str


@router.get("/chat/sessions", response_model=list[SessionOut])
def list_sessions(user=Depends(get_current_user), conn=Depends(get_db)):
    rows = conn.execute(
        "SELECT id, title, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
        (user["id"],),
    ).fetchall()
    return [SessionOut(id=r["id"], title=r["title"], updated_at=r["updated_at"]) for r in rows]


@router.post("/chat/sessions", response_model=SessionOut)
def create_session(user=Depends(get_current_user), conn=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute(
        "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
        (user["id"], "New Chat", now, now),
    )
    conn.commit()
    return SessionOut(id=cur.lastrowid, title="New Chat", updated_at=now)


@router.get("/chat/sessions/{session_id}/messages")
def get_session_messages(session_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user["id"])
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs = conn.execute(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    return {"messages": [{"role": m["role"], "content": m["content"]} for m in msgs]}


@router.delete("/chat/sessions/{session_id}", status_code=204)
def delete_session(session_id: int, user=Depends(get_current_user), conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user["id"])
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    conn.execute("DELETE FROM chat_messages WHERE session_id = ?", (session_id,))
    conn.execute("DELETE FROM chat_sessions WHERE id = ?", (session_id,))
    conn.commit()


@router.post("/chat", response_model=ChatResponse)
def chat(body: ChatRequest, user=Depends(get_current_user), conn=Depends(get_db)):
    now = datetime.now(timezone.utc).isoformat()

    if body.session_id:
        row = conn.execute(
            "SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?",
            (body.session_id, user["id"]),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Session not found")
        session_id = body.session_id
    else:
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")
        cur = conn.execute(
            "INSERT INTO chat_sessions (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
            (user["id"], title, now, now),
        )
        conn.commit()
        session_id = cur.lastrowid

    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, "user", body.message, now),
    )
    conn.commit()

    prev_msgs = conn.execute(
        "SELECT role, content FROM chat_messages WHERE session_id = ? ORDER BY id",
        (session_id,),
    ).fetchall()
    messages = [{"role": m["role"], "content": m["content"]} for m in prev_msgs]

    agent = _get_agent()
    with chat_context_run(user["id"], conn) as action_bucket:
        result = agent.invoke({"messages": messages})
    actions = list(action_bucket)

    reply = ""
    for msg in reversed(result["messages"]):
        if hasattr(msg, "content") and hasattr(msg, "type") and msg.type != "human":
            c = msg.content
            if isinstance(c, str) and c.strip():
                reply = c
                break
        elif hasattr(msg, "content") and not hasattr(msg, "type"):
            c = msg.content
            if isinstance(c, str) and c.strip():
                reply = c
                break

    conn.execute(
        "INSERT INTO chat_messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)",
        (session_id, "assistant", reply, datetime.now(timezone.utc).isoformat()),
    )
    conn.execute(
        "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
        (datetime.now(timezone.utc).isoformat(), session_id),
    )
    conn.commit()

    return ChatResponse(
        session_id=session_id,
        reply=reply,
        question_type=result.get("question_type"),
        hall=result.get("hall"),
        client_actions=actions,
    )
