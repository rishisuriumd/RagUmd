"""Auth routes — register, login, me."""

from __future__ import annotations

from datetime import datetime, timezone

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr

from src.api.deps import create_access_token, get_current_user, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserResponse(BaseModel):
    id: int
    email: str


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, conn=Depends(get_db)):
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (body.email,)).fetchone()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    now = datetime.now(timezone.utc).isoformat()
    hashed = _hash_password(body.password)
    cursor = conn.execute(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
        (body.email, hashed, now),
    )
    conn.commit()
    user_id = cursor.lastrowid

    token = create_access_token({"sub": str(user_id)})
    return TokenResponse(
        access_token=token,
        user={"id": user_id, "email": body.email},
    )


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, conn=Depends(get_db)):
    row = conn.execute(
        "SELECT id, email, password_hash FROM users WHERE email = ?",
        (body.email,),
    ).fetchone()
    if not row or not _verify_password(body.password, row["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token({"sub": str(row["id"])})
    return TokenResponse(
        access_token=token,
        user={"id": row["id"], "email": row["email"]},
    )


@router.get("/me", response_model=UserResponse)
def me(user=Depends(get_current_user)):
    return UserResponse(**user)
