"""Database + Storage access for the Video-to-Reels feature, scoped to one user.

Like db/repository.py, every call uses the signed-in user's token so RLS applies,
and every query is also filtered by user_id.
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from core.errors import AuthError, DatabaseError
from db.supabase_client import SupabaseRest, _require_config

SOURCE_LIST_COLUMNS = (
    "id,title,source_kind,media_type,status,progress,status_message,error_message,"
    "requested_clips,duration_seconds,youtube_video_id,thumbnail_url,created_at,updated_at"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class VideoRepository:
    def __init__(self, user_id: str, access_token: str):
        self.user_id = user_id
        self._token = access_token
        self._db = SupabaseRest(access_token)

    def _mine(self, **filters: str) -> dict[str, str]:
        return {"user_id": f"eq.{self.user_id}", **{k: f"eq.{v}" for k, v in filters.items()}}

    # -- sources ------------------------------------------------------------

    def create_source(self, values: dict[str, Any]) -> dict:
        return self._db.insert("video_sources", {**values, "user_id": self.user_id})

    def get_source(self, source_id: str) -> dict | None:
        rows = self._db.select("video_sources", self._mine(id=source_id), limit=1)
        return rows[0] if rows else None

    def list_sources(self) -> list[dict]:
        return self._db.select("video_sources", self._mine(), columns=SOURCE_LIST_COLUMNS, order="created_at.desc")

    def update_source(self, source_id: str, values: dict[str, Any]) -> dict | None:
        return self._db.update("video_sources", self._mine(id=source_id), {**values, "updated_at": _now()})

    def count_active_sources(self) -> int:
        return self._db.count(
            "video_sources",
            {"user_id": f"eq.{self.user_id}", "status": "in.(queued,downloading,transcribing,selecting,rendering)"},
        )

    # -- clips --------------------------------------------------------------

    def insert_clip(self, values: dict[str, Any]) -> dict:
        return self._db.insert("video_clips", {**values, "user_id": self.user_id})

    def list_clips(self, source_id: str) -> list[dict]:
        return self._db.select("video_clips", self._mine(video_source_id=source_id), order="clip_index.asc")

    def clip_counts(self) -> dict[str, dict[str, int]]:
        rows = self._db.select("video_clips", self._mine(), columns="video_source_id,render_status")
        counts: dict[str, dict[str, int]] = {}
        for row in rows:
            entry = counts.setdefault(row["video_source_id"], {"clips": 0, "rendered": 0})
            entry["clips"] += 1
            entry["rendered"] += row["render_status"] == "rendered"
        return counts

    def get_clip(self, clip_id: str) -> dict | None:
        rows = self._db.select("video_clips", self._mine(id=clip_id), limit=1)
        return rows[0] if rows else None

    def update_clip(self, clip_id: str, values: dict[str, Any]) -> dict | None:
        return self._db.update("video_clips", self._mine(id=clip_id), {**values, "updated_at": _now()})

    # -- storage (rendered clips) -------------------------------------------

    def _storage(self, method: str, path: str, **kwargs) -> httpx.Response:
        url, key = _require_config()
        headers = {"apikey": key, "Authorization": f"Bearer {self._token}", **kwargs.pop("headers", {})}
        try:
            response = httpx.request(method, f"{url}/storage/v1/{path}", headers=headers,
                                     timeout=httpx.Timeout(120.0), **kwargs)
        except httpx.HTTPError as error:
            raise DatabaseError("Could not reach file storage. Please try again.") from error
        if response.status_code in (401, 403):
            raise AuthError("Storage access denied. Run migration 002 and sign in again.")
        if response.status_code == 404 and "Bucket not found" in response.text:
            raise DatabaseError("Storage bucket missing. Run supabase/migrations/002_video_to_reels.sql.")
        if response.status_code >= 400:
            raise DatabaseError(f"File storage error ({response.status_code}).")
        return response

    def upload_clip_file(self, bucket: str, object_path: str, file_path: Path) -> None:
        with open(file_path, "rb") as handle:
            self._storage(
                "POST",
                f"object/{bucket}/{object_path}",
                content=handle.read(),
                headers={"Content-Type": "video/mp4", "x-upsert": "true"},
            )

    def signed_url(self, bucket: str, object_path: str, expires_in: int = 3600) -> str:
        url, _ = _require_config()
        data = self._storage("POST", f"object/sign/{bucket}/{object_path}", json={"expiresIn": expires_in}).json()
        signed = data.get("signedURL") or data.get("signedUrl")
        return f"{url}/storage/v1{signed}"
