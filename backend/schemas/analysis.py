from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    title: str
    source_type: str
    source_text: str

    niche: str | None = None
    audience: str | None = None


class ContentAnalysis(BaseModel):
    main_topic: str

    target_audience: str

    summary: str

    key_points: list[str] = Field(
        description="The most important ideas from the source content."
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

    why_it_works: str


class ContentIdeasResponse(BaseModel):
    ideas: list[ContentIdea]    
    
class GenerateIdeasRequest(BaseModel):
    title: str

    source_text: str

    niche: str | None = None

    audience: str | None = None

    language: str | None = None

    tone: str | None = None

    analysis: ContentAnalysis    