"""FastAPI dependencies: who is calling, and the per-request DB/AI objects.

The browser sends `Authorization: Bearer <supabase access token>`. We verify
it with Supabase Auth on every protected request - a user_id sent by the
browser is never trusted on its own (PDF step 6).
"""

import hashlib
import threading
import time
from dataclasses import dataclass

from fastapi import Depends, Header

from core.config import Settings, get_settings
from core.errors import AuthError
from db.repository import Repository
from db.supabase_client import fetch_auth_user
from services.llm_service import LLMService
from services.usage_service import usage_recorder

# Short cache so one page load does not verify the same token many times.
_TOKEN_CACHE_SECONDS = 60
_token_cache: dict[str, tuple[float, "CurrentUser"]] = {}
_cache_lock = threading.Lock()


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str | None
    access_token: str


def get_current_user(authorization: str | None = Header(default=None)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("Please sign in to continue.")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise AuthError("Please sign in to continue.")

    key = hashlib.sha256(token.encode()).hexdigest()
    now = time.monotonic()
    with _cache_lock:
        cached = _token_cache.get(key)
        if cached and now - cached[0] < _TOKEN_CACHE_SECONDS:
            return cached[1]

    data = fetch_auth_user(token)
    user = CurrentUser(id=data["id"], email=data.get("email"), access_token=token)
    with _cache_lock:
        _token_cache[key] = (now, user)
        # Drop expired entries so the cache cannot grow without bound.
        for stale in [k for k, (t, _) in _token_cache.items() if now - t >= _TOKEN_CACHE_SECONDS]:
            _token_cache.pop(stale, None)
    return user


def get_repository(user: CurrentUser = Depends(get_current_user)) -> Repository:
    return Repository(user.id, user.access_token)


def get_llm(repo: Repository = Depends(get_repository)) -> LLMService:
    return LLMService(on_usage=usage_recorder(repo))


def settings_dep() -> Settings:
    return get_settings()
