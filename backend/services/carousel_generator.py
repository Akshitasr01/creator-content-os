"""Carousel copy generator (PDF step 16)."""

from prompts import carousel as prompt
from schemas.content import CarouselContent
from services import mock_provider
from services.generation_context import GenerationContext, build_asset_prompt
from services.llm_service import LLMResult, LLMService


def generate_carousel(llm: LLMService, ctx: GenerationContext) -> LLMResult[CarouselContent]:
    result = llm.generate_structured(
        operation="generate_carousel",
        system=prompt.SYSTEM,
        user=build_asset_prompt(ctx, prompt.PLATFORM_RULES, "Instagram carousel"),
        schema=CarouselContent,
        mock_factory=lambda: mock_provider.carousel(ctx.idea, ctx.analysis),
        project_id=ctx.project_id,
    )
    # Guarantee clean 1..N numbering for the slide preview.
    for number, slide in enumerate(result.data.slides, start=1):
        slide.number = number
    return result
