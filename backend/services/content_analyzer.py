"""Content Analyzer: raw source -> validated Content Brief (PDF step 11)."""

from prompts import analyzer as prompt
from schemas.analysis import ContentAnalysis
from services import mock_provider
from services.llm_service import LLMResult, LLMService


def analyze(llm: LLMService, project: dict, profile: dict) -> LLMResult[ContentAnalysis]:
    return llm.generate_structured(
        operation="analyze",
        system=prompt.SYSTEM,
        user=prompt.build_user_prompt(project, profile),
        schema=ContentAnalysis,
        mock_factory=lambda: mock_provider.analysis(project, profile),
        project_id=project["id"],
    )
