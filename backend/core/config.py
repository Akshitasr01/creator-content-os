"""Application settings, read once from environment variables (backend/.env)."""

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value not in (None, "") else default


def _float(name: str, default: float) -> float:
    value = os.getenv(name)
    return float(value) if value not in (None, "") else default


@dataclass(frozen=True)
class Settings:
    # --- Supabase (publishable key only; the service-role key is never used) ---
    supabase_url: str = field(default_factory=lambda: os.getenv("SUPABASE_URL", "").rstrip("/"))
    supabase_publishable_key: str = field(
        default_factory=lambda: os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    )

    # --- AI provider: "mock" (free demo output) or "openai" ---
    ai_provider: str = field(default_factory=lambda: os.getenv("AI_PROVIDER", "mock").strip().lower())
    openai_api_key: str = field(default_factory=lambda: os.getenv("OPENAI_API_KEY", ""))
    openai_model: str = field(default_factory=lambda: os.getenv("OPENAI_MODEL", ""))
    openai_timeout_seconds: float = field(default_factory=lambda: _float("OPENAI_TIMEOUT_SECONDS", 90))
    # Optional pricing used only for cost estimates. 0 = unknown -> cost recorded as 0.
    openai_input_cost_per_1m: float = field(default_factory=lambda: _float("OPENAI_INPUT_COST_PER_1M", 0))
    openai_output_cost_per_1m: float = field(default_factory=lambda: _float("OPENAI_OUTPUT_COST_PER_1M", 0))

    # --- Limits (free beta) ---
    daily_ai_call_limit: int = field(default_factory=lambda: _int("DAILY_AI_CALL_LIMIT", 60))
    ai_requests_per_minute: int = field(default_factory=lambda: _int("AI_REQUESTS_PER_MINUTE", 10))
    source_min_chars: int = field(default_factory=lambda: _int("SOURCE_MIN_CHARS", 200))
    source_max_chars: int = field(default_factory=lambda: _int("SOURCE_MAX_CHARS", 30000))
    max_assets_per_request: int = field(default_factory=lambda: _int("MAX_ASSETS_PER_REQUEST", 8))

    # --- HTTP ---
    cors_origins: list[str] = field(
        default_factory=lambda: [
            origin.strip()
            for origin in os.getenv(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if origin.strip()
        ]
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
