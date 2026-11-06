"""Generated assets (Reel, LinkedIn, Carousel) and the requests that act on them."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, Field

# ---------------------------------------------------------------------------
# Structured AI outputs - one schema per content type (PDF step 12)
# ---------------------------------------------------------------------------


class ReelContent(BaseModel):
    hook: str
    script: str
    caption: str
    cta: str
    hashtags: list[str]
    estimated_duration_seconds: int


class LinkedInPost(BaseModel):
    hook: str = Field(description="The first line that appears before 'see more'.")
    body: str = Field(description="The rest of the post, with short paragraphs separated by blank lines.")
    cta: str
    hashtags: list[str]


class CarouselSlide(BaseModel):
    number: int
    heading: str
    body: str


class CarouselContent(BaseModel):
    title: str
    slides: list[CarouselSlide]
    caption: str
    cta: str
    hashtags: list[str] = Field(default_factory=list)


ContentType = Literal["reel", "linkedin", "carousel"]

# content_type -> (schema, platform) - one place that knows every asset type.
CONTENT_TYPES: dict[str, tuple[type[BaseModel], str]] = {
    "reel": (ReelContent, "instagram"),
    "linkedin": (LinkedInPost, "linkedin"),
    "carousel": (CarouselContent, "instagram"),
}


def validate_content(content_type: str, content: dict[str, Any]) -> dict[str, Any]:
    """Validate asset JSON against its schema and return the cleaned dict."""
    schema, _ = CONTENT_TYPES[content_type]
    return schema.model_validate(content).model_dump()


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class OutputRequest(BaseModel):
    type: ContentType
    count: int = Field(ge=1, le=5)


class GenerateRequest(BaseModel):
    """POST /projects/{id}/generate - PDF API blueprint."""

    outputs: list[OutputRequest] = Field(min_length=1)
    # Indexes into project.content_ideas.ideas. Empty = auto-select top ideas.
    idea_indexes: list[int] = Field(default_factory=list)


class RewriteInstruction(str, Enum):
    shorter = "shorter"
    more_conversational = "more_conversational"
    more_professional = "more_professional"
    stronger_hook = "stronger_hook"
    simplify = "simplify"
    more_storytelling = "more_storytelling"
    hinglish = "hinglish"
    regenerate = "regenerate"


class RewriteRequest(BaseModel):
    instruction: RewriteInstruction


class ContentUpdate(BaseModel):
    """Manual edit and/or status change from the Content Studio."""

    content: dict[str, Any] | None = None
    status: Literal["draft", "liked", "disliked", "approved"] | None = None


FeedbackReason = Literal[
    "too_formal", "too_long", "weak_hook", "sounds_ai", "not_my_voice", "other"
]


class FeedbackCreate(BaseModel):
    rating: Literal["up", "down"]
    reason: FeedbackReason | None = None
    note: str | None = Field(default=None, max_length=1000)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class GeneratedContentOut(BaseModel):
    id: str
    project_id: str
    idea_index: int | None = None
    content_type: str
    platform: str
    content: dict[str, Any]
    status: str = "draft"
    provider: str | None = None
    model: str | None = None
    version: int = 1
    previous_versions: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None


class GenerateResponse(BaseModel):
    created: list[GeneratedContentOut]
    errors: list[str] = Field(default_factory=list)


class FeedbackOut(BaseModel):
    id: str
    content_id: str
    rating: int
    reason: str | None = None
    note: str | None = None
