"""Projects: one long-form source and everything generated from it."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator

from schemas.analysis import ContentAnalysis
from schemas.content import GeneratedContentOut

SourceType = Literal["transcript", "article", "notes", "script"]

# draft -> analyzing -> analyzed -> generating -> ready ; any step -> failed
ProjectStatus = Literal["draft", "analyzing", "analyzed", "generating", "ready", "failed"]


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    source_type: SourceType
    source_text: str

    @field_validator("title", "source_text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class ProjectSummary(BaseModel):
    id: str
    title: str
    source_type: str
    status: str
    error_message: str | None = None
    asset_count: int = 0
    has_analysis: bool = False
    idea_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectOut(BaseModel):
    id: str
    title: str
    source_type: str
    source_text: str
    status: str
    error_message: str | None = None
    analysis: dict[str, Any] | None = None
    content_ideas: dict[str, Any] | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ProjectDetail(ProjectOut):
    content: list[GeneratedContentOut] = Field(default_factory=list)


class AnalysisUpdate(BaseModel):
    """The user corrects the Content Brief before generation (PDF step 22)."""

    analysis: ContentAnalysis
