"""Controlled rewrite of ONE asset (PDF step 24).

"regenerate" is handled by content_service (it reruns the generator).
Keeps the creator profile, source context and platform rules; only the
selected asset changes.
"""

import json

from prompts import carousel, linkedin, reel
from prompts import rewrite as prompt
from schemas.content import CONTENT_TYPES
from services import mock_provider
from services.generation_context import GenerationContext, build_asset_prompt
from services.llm_service import LLMResult, LLMService

_PLATFORM = {
    "reel": (reel.PLATFORM_RULES, "Instagram Reel"),
    "linkedin": (linkedin.PLATFORM_RULES, "LinkedIn post"),
    "carousel": (carousel.PLATFORM_RULES, "Instagram carousel"),
}


def rewrite_asset(
    llm: LLMService, ctx: GenerationContext, content_type: str, current: dict, instruction: str
) -> LLMResult:
    schema, _ = CONTENT_TYPES[content_type]
    platform_rules, asset_name = _PLATFORM[content_type]
    user_prompt = (
        build_asset_prompt(ctx, platform_rules, asset_name)
        + "\nCURRENT VERSION OF THE ASSET (JSON)\n\n"
        + json.dumps(current, ensure_ascii=False, indent=2)
        + "\n\n"
        + prompt.instruction_block(instruction)
        + "\nReturn the full revised asset. Change only what the instruction asks for."
    )
    return llm.generate_structured(
        operation=f"rewrite_{instruction}",
        system=prompt.SYSTEM,
        user=user_prompt,
        schema=schema,
        mock_factory=lambda: mock_provider.rewrite(content_type, current, instruction),
        project_id=ctx.project_id,
    )
