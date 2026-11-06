"""Creator profile (voice + audience) and per-platform preferences."""

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Platform = Literal["instagram", "linkedin"]


class PlatformPreference(BaseModel):
    platform: Platform
    preferred_length: Literal["short", "medium", "long"] = "medium"
    cta_style: str = Field(default="", max_length=300)


class CreatorProfileIn(BaseModel):
    creator_name: str = Field(min_length=1, max_length=100)
    niche: str = Field(default="", max_length=200)
    audience: str = Field(default="", max_length=500)
    language: Literal["English", "Hindi", "Hinglish"] = "English"
    tone: str = Field(default="", max_length=200)
    style_description: str = Field(default="", max_length=2000)
    things_to_avoid: str = Field(default="", max_length=2000)
    sample_posts: list[str] = Field(default_factory=list, max_length=3)
    target_platforms: list[Platform] = Field(default_factory=list)
    platform_preferences: list[PlatformPreference] = Field(default_factory=list)

    @field_validator("creator_name", "niche", "audience", "tone", "style_description", "things_to_avoid")
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("sample_posts")
    @classmethod
    def clean_samples(cls, posts: list[str]) -> list[str]:
        cleaned = [post.strip() for post in posts if post and post.strip()]
        for post in cleaned:
            if len(post) > 5000:
                raise ValueError("Each sample post must be 5000 characters or fewer.")
        return cleaned


class CreatorProfileOut(BaseModel):
    id: str
    creator_name: str | None = None
    niche: str | None = None
    audience: str | None = None
    language: str | None = None
    tone: str | None = None
    style_description: str | None = None
    things_to_avoid: str | None = None
    sample_posts: list[str] = Field(default_factory=list)
    target_platforms: list[str] = Field(default_factory=list)
    platform_preferences: list[PlatformPreference] = Field(default_factory=list)

    @field_validator("sample_posts", "target_platforms", mode="before")
    @classmethod
    def none_to_list(cls, value):
        return value or []
