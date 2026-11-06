"""Reel generator (PDF step 14)."""

from prompts import reel as prompt
from schemas.content import ReelContent
from services import mock_provider
from services.generation_context import GenerationContext, build_asset_prompt
from services.llm_service import LLMResult, LLMService


def generate_reel(llm: LLMService, ctx: GenerationContext) -> LLMResult[ReelContent]:
    return llm.generate_structured(
        operation="generate_reel",
        system=prompt.SYSTEM,
        user=build_asset_prompt(ctx, prompt.PLATFORM_RULES, "Instagram Reel"),
        schema=ReelContent,
        mock_factory=lambda: mock_provider.reel(ctx.idea, ctx.profile),
        project_id=ctx.project_id,
    )
