"""Rate limiting, free-beta daily limits and usage/cost logging (PDF step 26)."""

import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone

from core.config import Settings
from core.errors import AppError, LimitExceeded
from db.repository import Repository
from services.llm_service import LLMResult

logger = logging.getLogger(__name__)


class RateLimiter:
    """In-memory sliding window per user.

    Good enough for a single backend instance (V1). With several instances,
    move this to Redis or rely on the daily database limit below.
    """

    def __init__(self):
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def hit(self, user_id: str, limit_per_minute: int) -> None:
        now = time.monotonic()
        with self._lock:
            hits = self._hits[user_id]
            while hits and now - hits[0] > 60:
                hits.popleft()
            if len(hits) >= limit_per_minute:
                raise LimitExceeded("Too many AI requests in a minute. Please wait a moment and try again.")
            hits.append(now)


rate_limiter = RateLimiter()


def _start_of_today_utc() -> str:
    now = datetime.now(timezone.utc)
    return now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()


def check_ai_allowed(repo: Repository, settings: Settings, planned_calls: int) -> None:
    """Raise LimitExceeded before spending AI credits the user does not have."""
    rate_limiter.hit(repo.user_id, settings.ai_requests_per_minute)

    if settings.ai_provider == "mock":
        return  # demo output is free; only real AI calls count toward the daily limit

    used = repo.count_usage_since(_start_of_today_utc(), exclude_provider="mock")
    if used + planned_calls > settings.daily_ai_call_limit:
        remaining = max(0, settings.daily_ai_call_limit - used)
        raise LimitExceeded(
            f"Daily free-beta limit reached ({settings.daily_ai_call_limit} AI calls per day, "
            f"{remaining} left, this action needs {planned_calls}). It resets at midnight UTC."
        )


def usage_recorder(repo: Repository):
    """Callback for LLMService: log one row per AI call (token counts only, no content)."""

    def record(result: LLMResult, operation: str, project_id: str | None) -> None:
        try:
            repo.insert_usage(
                {
                    "project_id": project_id,
                    "operation": operation,
                    "provider": result.provider,
                    "model": result.model,
                    "input_tokens": result.input_tokens,
                    "output_tokens": result.output_tokens,
                    "estimated_cost_usd": result.estimated_cost_usd,
                }
            )
        except AppError:
            # Never lose a successful generation because usage logging failed.
            logger.warning("Could not record usage for operation %s", operation)

    return record


def usage_summary(repo: Repository, settings: Settings) -> dict:
    used = repo.count_usage_since(_start_of_today_utc(), exclude_provider="mock")
    return {
        "provider": settings.ai_provider,
        "used_today": used,
        "daily_limit": settings.daily_ai_call_limit,
        "remaining_today": max(0, settings.daily_ai_call_limit - used),
    }
