"""In-memory stand-in for db.repository.Repository (same method names).

It enforces the same user_id ownership filter as the real repository + RLS,
so isolation tests are meaningful without a real database.
"""

import uuid
from copy import deepcopy
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class FakeDatabase:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {
            "creator_profiles": [],
            "platform_preferences": [],
            "projects": [],
            "generated_content": [],
            "feedback": [],
            "usage_events": [],
        }


class FakeRepository:
    def __init__(self, user_id: str, db: FakeDatabase):
        self.user_id = user_id
        self.db = db

    # helpers
    def _rows(self, table: str, **filters) -> list[dict]:
        return [
            r for r in self.db.tables[table]
            if r["user_id"] == self.user_id and all(r.get(k) == v for k, v in filters.items())
        ]

    def _insert(self, table: str, values: dict) -> dict:
        row = {"id": str(uuid.uuid4()), "created_at": _now(), "updated_at": _now(),
               **deepcopy(values), "user_id": self.user_id}
        self.db.tables[table].append(row)
        return deepcopy(row)

    def _update(self, table: str, row_id: str, values: dict) -> dict | None:
        rows = self._rows(table, id=row_id)
        if not rows:
            return None
        rows[0].update(deepcopy(values), updated_at=_now())
        return deepcopy(rows[0])

    # profile
    def get_profile(self):
        rows = self._rows("creator_profiles")
        return deepcopy(rows[0]) if rows else None

    def insert_profile(self, values):
        return self._insert("creator_profiles", values)

    def update_profile(self, profile_id, values):
        return self._update("creator_profiles", profile_id, values)

    def list_platform_preferences(self):
        return deepcopy(self._rows("platform_preferences"))

    def upsert_platform_preference(self, values):
        existing = self._rows("platform_preferences", platform=values["platform"])
        if existing:
            return self._update("platform_preferences", existing[0]["id"], values)
        return self._insert("platform_preferences", values)

    # projects
    def list_projects(self):
        return deepcopy(self._rows("projects"))

    def get_project(self, project_id):
        rows = self._rows("projects", id=project_id)
        return deepcopy(rows[0]) if rows else None

    def insert_project(self, values):
        return self._insert("projects", values)

    def update_project(self, project_id, values):
        return self._update("projects", project_id, values)

    # content
    def content_counts_by_project(self):
        counts = {}
        for row in self._rows("generated_content"):
            counts[row["project_id"]] = counts.get(row["project_id"], 0) + 1
        return counts

    def list_content(self, project_id):
        return deepcopy(self._rows("generated_content", project_id=project_id))

    def get_content(self, content_id):
        rows = self._rows("generated_content", id=content_id)
        return deepcopy(rows[0]) if rows else None

    def insert_content(self, values):
        return self._insert("generated_content", values)

    def update_content(self, content_id, values):
        return self._update("generated_content", content_id, values)

    # feedback & usage
    def insert_feedback(self, values):
        return self._insert("feedback", values)

    def insert_usage(self, values):
        self._insert("usage_events", values)

    def count_usage_since(self, since_iso, exclude_provider=None):
        return len([
            r for r in self._rows("usage_events")
            if r["created_at"] >= since_iso and r["provider"] != exclude_provider
        ])
