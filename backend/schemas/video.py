"""Video-to-Reels: requests, responses and the structured AI clip output."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Structured AI output (no non-None defaults: OpenAI strict mode)
# ---------------------------------------------------------------------------


class ClipSuggestion(BaseModel):
    title: str
    start_seconds: float = Field(description="Start time in seconds, taken from a transcript line start.")
    end_seconds: float = Field(description="End time in seconds, taken from a transcript line end.")
    hook: str = Field(description="The opening line viewers hear/see first.")
    caption: str
    hashtags: list[str]
    cta: str
    reason: str = Field(description="Why this moment works as a standalone short.")


class ClipSuggestionList(BaseModel):
    clips: list[ClipSuggestion]


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class VideoFromUrl(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(min_length=8, max_length=2000)
    clip_count: int = Field(ge=1, le=10)

    @field_validator("title", "url")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ClipUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    hook: str | None = Field(default=None, max_length=500)
    caption: str | None = Field(default=None, max_length=2200)
    hashtags: list[str] | None = Field(default=None, max_length=30)
    cta: str | None = Field(default=None, max_length=300)
    start_seconds: float | None = Field(default=None, ge=0)
    end_seconds: float | None = Field(default=None, gt=0)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class VideoClipOut(BaseModel):
    id: str
    video_source_id: str
    clip_index: int
    title: str
    start_seconds: float
    end_seconds: float
    duration_seconds: float
    hook: str = ""
    transcript_excerpt: str = ""
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    cta: str = ""
    reason: str = ""
    render_status: str
    render_error: str | None = None
    file_size_bytes: int | None = None
    provider: str | None = None
    # Temporary signed links - only present when a real rendered file exists.
    preview_url: str | None = None
    download_url: str | None = None


class VideoSourceSummary(BaseModel):
    id: str
    title: str
    source_kind: str
    media_type: str
    status: str
    progress: int = 0
    status_message: str | None = None
    error_message: str | None = None
    requested_clips: int
    duration_seconds: float | None = None
    clip_count: int = 0
    rendered_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class VideoSourceDetail(VideoSourceSummary):
    source_url: str | None = None
    original_filename: str | None = None
    language: str | None = None
    transcript: list[dict[str, Any]] | None = None
    provider: str | None = None
    linked_project_id: str | None = None
    source_file_available: bool = False
    clips: list[VideoClipOut] = Field(default_factory=list)


class VideoCapabilities(BaseModel):
    transcription: bool
    rendering: bool
    ai_provider: str
    max_clips: int
    max_upload_mb: int
    max_duration_minutes: int
    video_extensions: list[str]
    audio_extensions: list[str]
