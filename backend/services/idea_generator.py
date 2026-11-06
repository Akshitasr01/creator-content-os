"""Idea Generator: Content Brief + Creator Profile -> 8-12 angles (PDF step 13)."""

from prompts import ideas as prompt
from schemas.analysis import ContentIdeasResponse
from services import mock_provider
from services.llm_service import LLMResult, LLMService

DEFAULT_IDEA_COUNT = 10
VALID_PLATFORMS = {"reel", "linkedin", "carousel"}


def generate_ideas(
    llm: LLMService, project: dict, profile: dict, analysis: dict, count: int = DEFAULT_IDEA_COUNT
) -> LLMResult[ContentIdeasResponse]:
    result = llm.generate_structured(
        operation="ideas",
        system=prompt.SYSTEM,
        user=prompt.build_user_prompt(project, profile, analysis, count),
        schema=ContentIdeasResponse,
        mock_factory=lambda: mock_provider.ideas(analysis, count),
        project_id=project["id"],
    )
    # Keep only platform labels the app understands, so the UI can trust them.
    for idea in result.data.ideas:
        idea.platforms = [p for p in idea.platforms if p in VALID_PLATFORMS]
    return result
