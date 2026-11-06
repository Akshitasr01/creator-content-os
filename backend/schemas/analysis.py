"""Structured AI outputs for the analysis and idea steps.

Field names match what is already stored in projects.analysis and
projects.content_ideas, so older saved rows still validate. Fields added
later have defaults for the same reason.
"""

from pydantic import BaseModel, Field


class ContentAnalysis(BaseModel):
    """The Content Brief (PDF step 11): a reusable understanding of the source."""

    main_topic: str
    target_audience: str
    summary: str
    key_points: list[str] = Field(
        description="The most important ideas from the source content."
    )
    examples: list[str] = Field(
        default_factory=list,
        description="Concrete examples, stories or data points from the source.",
    )
    strong_claims: list[str] = Field(
        default_factory=list,
        description="Bold or quotable claims the source actually makes.",
    )
    hooks: list[str] = Field(
        description="Strong short-form hooks based on the source."
    )
    content_angles: list[str] = Field(
        description="Different useful ways the content can be repurposed."
    )


class ContentIdea(BaseModel):
    title: str
    core_message: str
    hook: str
    recommended_format: str
    platforms: list[str] = Field(
        default_factory=list,
        description="Which outputs fit this idea: any of reel, linkedin, carousel.",
    )
    why_it_works: str


class ContentIdeasResponse(BaseModel):
    ideas: list[ContentIdea]
