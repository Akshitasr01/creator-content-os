"""All database reads/writes for one signed-in user.

Every query is filtered by user_id *and* protected by RLS (defence in depth),
so a request can never touch another user's rows even if an id is guessed.
Tests replace this class with an in-memory fake (tests/fakes.py).
"""

from datetime import datetime, timezone
from typing import Any

from db.supabase_client import SupabaseRest

PROJECT_LIST_COLUMNS = (
    "id,title,source_type,status,error_message,analysis,content_ideas,created_at,updated_at"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Repository:
    def __init__(self, user_id: str, access_token: str):
        self.user_id = user_id
        self._db = SupabaseRest(access_token)

    def _mine(self, **filters: str) -> dict[str, str]:
        return {"user_id": f"eq.{self.user_id}", **{k: f"eq.{v}" for k, v in filters.items()}}

    # -- creator profile ----------------------------------------------------

    def get_profile(self) -> dict | None:
        rows = self._db.select("creator_profiles", self._mine(), limit=1)
        return rows[0] if rows else None

    def insert_profile(self, values: dict[str, Any]) -> dict:
        return self._db.insert("creator_profiles", {**values, "user_id": self.user_id})

    def update_profile(self, profile_id: str, values: dict[str, Any]) -> dict:
        return self._db.update(
            "creator_profiles", self._mine(id=profile_id), {**values, "updated_at": _now()}
        )

    def list_platform_preferences(self) -> list[dict]:
        return self._db.select("platform_preferences", self._mine(), order="platform")

    def upsert_platform_preference(self, values: dict[str, Any]) -> dict:
        return self._db.upsert(
            "platform_preferences",
            {**values, "user_id": self.user_id, "updated_at": _now()},
            on_conflict="user_id,platform",
        )

    # -- projects -----------------------------------------------------------

    def list_projects(self) -> list[dict]:
        return self._db.select(
            "projects", self._mine(), columns=PROJECT_LIST_COLUMNS, order="created_at.desc"
        )

    def get_project(self, project_id: str) -> dict | None:
        rows = self._db.select("projects", self._mine(id=project_id), limit=1)
        return rows[0] if rows else None

    def insert_project(self, values: dict[str, Any]) -> dict:
        return self._db.insert("projects", {**values, "user_id": self.user_id})

    def update_project(self, project_id: str, values: dict[str, Any]) -> dict | None:
        return self._db.update("projects", self._mine(id=project_id), {**values, "updated_at": _now()})

    # -- generated content --------------------------------------------------

    def content_counts_by_project(self) -> dict[str, int]:
        rows = self._db.select("generated_content", self._mine(), columns="project_id")
        counts: dict[str, int] = {}
        for row in rows:
            counts[row["project_id"]] = counts.get(row["project_id"], 0) + 1
        return counts

    def list_content(self, project_id: str) -> list[dict]:
        return self._db.select(
            "generated_content", self._mine(project_id=project_id), order="created_at.asc"
        )

    def get_content(self, content_id: str) -> dict | None:
        rows = self._db.select("generated_content", self._mine(id=content_id), limit=1)
        return rows[0] if rows else None

    def insert_content(self, values: dict[str, Any]) -> dict:
        return self._db.insert("generated_content", {**values, "user_id": self.user_id})

    def update_content(self, content_id: str, values: dict[str, Any]) -> dict | None:
        return self._db.update(
            "generated_content", self._mine(id=content_id), {**values, "updated_at": _now()}
        )

    # -- feedback & usage ---------------------------------------------------

    def insert_feedback(self, values: dict[str, Any]) -> dict:
        return self._db.insert("feedback", {**values, "user_id": self.user_id})

    def insert_usage(self, values: dict[str, Any]) -> None:
        self._db.insert("usage_events", {**values, "user_id": self.user_id})

    def count_usage_since(self, since_iso: str, exclude_provider: str | None = None) -> int:
        filters = {"user_id": f"eq.{self.user_id}", "created_at": f"gte.{since_iso}"}
        if exclude_provider:
            filters["provider"] = f"neq.{exclude_provider}"
        return self._db.count("usage_events", filters)
