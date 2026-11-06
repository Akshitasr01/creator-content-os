"""Minimal Supabase (PostgREST + Auth) client built on httpx.

Every request is sent with the *signed-in user's* access token, so Postgres
Row Level Security applies exactly as it would in the browser. The
service-role key is never used.
"""

import logging
from typing import Any

import httpx

from core.config import get_settings
from core.errors import AuthError, ConfigurationError, DatabaseError

logger = logging.getLogger(__name__)

_TIMEOUT = httpx.Timeout(15.0)


def _require_config() -> tuple[str, str]:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_publishable_key:
        raise ConfigurationError(
            "Supabase is not configured on the backend. "
            "Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in backend/.env."
        )
    return settings.supabase_url, settings.supabase_publishable_key


def fetch_auth_user(access_token: str) -> dict[str, Any]:
    """Ask Supabase Auth who owns this token. Raises AuthError if invalid/expired."""
    url, key = _require_config()
    try:
        response = httpx.get(
            f"{url}/auth/v1/user",
            headers={"apikey": key, "Authorization": f"Bearer {access_token}"},
            timeout=_TIMEOUT,
        )
    except httpx.HTTPError as error:
        logger.warning("Supabase Auth unreachable: %s", type(error).__name__)
        raise DatabaseError("Could not reach the authentication service.") from error

    if response.status_code != 200:
        raise AuthError("Your session has expired. Please sign in again.")
    return response.json()


class SupabaseRest:
    """Tiny PostgREST wrapper: select / insert / update / upsert / count."""

    def __init__(self, access_token: str):
        url, key = _require_config()
        self._base = f"{url}/rest/v1"
        self._headers = {
            "apikey": key,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }

    def _request(
        self,
        method: str,
        table: str,
        params: dict[str, str] | None = None,
        json: Any = None,
        prefer: str | None = None,
    ) -> httpx.Response:
        headers = dict(self._headers)
        if prefer:
            headers["Prefer"] = prefer
        try:
            response = httpx.request(
                method,
                f"{self._base}/{table}",
                params=params,
                json=json,
                headers=headers,
                timeout=_TIMEOUT,
            )
        except httpx.HTTPError as error:
            logger.warning("Database request failed: %s %s (%s)", method, table, type(error).__name__)
            raise DatabaseError("Could not reach the database. Please try again.") from error

        if response.status_code >= 400:
            self._raise_for_error(response, table)
        return response

    @staticmethod
    def _raise_for_error(response: httpx.Response, table: str) -> None:
        try:
            body = response.json()
        except ValueError:
            body = {}
        code = body.get("code", "")
        message = body.get("message", "")
        # Log the Postgres error code/message (no row data) to help debugging.
        logger.warning("Database error on %s: %s %s", table, code, message)

        if code in ("42703", "PGRST204", "PGRST205"):
            raise DatabaseError(
                "The database schema is out of date. Run "
                "supabase/migrations/001_v1_content_os.sql in the Supabase SQL Editor."
            )
        if response.status_code in (401, 403) or code == "42501":
            raise AuthError("You do not have access to this data. Please sign in again.")
        raise DatabaseError("A database error occurred. Please try again.")

    # -- public helpers ----------------------------------------------------

    def select(self, table: str, filters: dict[str, str], columns: str = "*",
               order: str | None = None, limit: int | None = None) -> list[dict]:
        params = {"select": columns, **filters}
        if order:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        return self._request("GET", table, params=params).json()

    def insert(self, table: str, row: dict[str, Any]) -> dict:
        rows = self._request("POST", table, json=row, prefer="return=representation").json()
        return rows[0]

    def update(self, table: str, filters: dict[str, str], values: dict[str, Any]) -> dict | None:
        rows = self._request(
            "PATCH", table, params=filters, json=values, prefer="return=representation"
        ).json()
        return rows[0] if rows else None

    def upsert(self, table: str, row: dict[str, Any], on_conflict: str) -> dict:
        rows = self._request(
            "POST",
            table,
            params={"on_conflict": on_conflict},
            json=row,
            prefer="return=representation,resolution=merge-duplicates",
        ).json()
        return rows[0]

    def count(self, table: str, filters: dict[str, str]) -> int:
        response = self._request(
            "GET",
            table,
            params={"select": "id", "limit": "1", **filters},
            prefer="count=exact",
        )
        # Content-Range looks like "0-0/42" (or "*/0" when empty).
        total = response.headers.get("content-range", "*/0").split("/")[-1]
        return int(total) if total.isdigit() else 0
