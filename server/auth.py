from __future__ import annotations

import os
import re
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt

SESSION_DAYS = int(os.environ.get("COLORADOGOLF_SESSION_DAYS", "30"))
USERNAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9 _.-]{1,31}$")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )
    except (ValueError, TypeError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def session_expires_at() -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    return exp.isoformat()


def normalize_email(email: str) -> str:
    return email.strip().lower()


def validate_username(username: str) -> str:
    u = username.strip()
    if not USERNAME_RE.fullmatch(u):
        raise ValueError(
            "Username must be 2–32 characters (letters, numbers, spaces, . _ -)."
        )
    return u


def validate_password(password: str) -> None:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters.")


def generate_temporary_password() -> str:
    """Random one-time password (meets minimum length, easy to copy)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
    return "".join(secrets.choice(alphabet) for _ in range(12))
