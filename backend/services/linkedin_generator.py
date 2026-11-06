"""LinkedIn generator - written separately, not converted from the Reel (PDF step 15)."""

from prompts import linkedin as prompt
from schemas.content import LinkedInPost
from services import mock_provider
from services.generation_context import GenerationContext, build_asset_prompt
from services.llm_service import LLMResult, LLMService


def generate_linkedin(llm: LLMService, ctx: GenerationContext) -> LLMResult[LinkedInPost]:
    return llm.generate_structured(
        operation="generate_linkedin",
        system=prompt.SYSTEM,
        user=build_asset_prompt(ctx, prompt.PLATFORM_RULES, "LinkedIn post"),
        schema=LinkedInPost,
        mock_factory=lambda: mock_provider.linkedin(ctx.idea, ctx.profile),
        project_id=ctx.project_id,
    )
