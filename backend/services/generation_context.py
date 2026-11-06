"""Everything a platform generator needs, and the shared prompt builder.

Generation context = creator profile + sample posts + Content Brief
+ selected idea + platform rules (PDF step 17).
"""

from dataclasses import dataclass

from prompts.voice import (
    GROUNDING_RULES,
    LANGUAGE_RULES,
    brief_block,
    creator_voice_block,
    idea_block,
    source_block,
)


@dataclass
class GenerationContext:
    project: dict
    profile: dict
    analysis: dict
    idea: dict
    idea_index: int | None = None
    platform_preference: dict | None = None

    @property
    def project_id(self) -> str:
        return self.project["id"]


def build_asset_prompt(ctx: GenerationContext, platform_rules: str, asset_name: str) -> str:
    return f"""{creator_voice_block(ctx.profile, ctx.platform_preference)}

{brief_block(ctx.analysis)}

{idea_block(ctx.idea)}

{source_block(ctx.project)}

{platform_rules}

{GROUNDING_RULES}

{LANGUAGE_RULES}

Create one {asset_name} for the selected idea. Preserve the idea's core message.
"""
