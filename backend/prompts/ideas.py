"""Idea Generator prompt: Content Brief + Creator Profile -> content angles (PDF step 13)."""

from prompts.voice import brief_block, source_block

SYSTEM = """You are the content strategy engine for a creator content repurposing
platform.

Your job is NOT to write complete social media posts yet. Your job is to
identify the strongest standalone content ideas that can be created from the
source material.
"""


def build_user_prompt(project: dict, profile: dict, analysis: dict, count: int) -> str:
    return f"""CREATOR PROFILE

Niche: {profile.get("niche") or "Not provided"}
Audience: {profile.get("audience") or "Not provided"}
Creator's preferred final-content language: {profile.get("language") or "English"}
Tone: {profile.get("tone") or "Not provided"}
Target platforms: {", ".join(profile.get("target_platforms") or []) or "Not provided"}

{brief_block(analysis)}

{source_block(project)}

Generate exactly {count} strong standalone content ideas.

Each idea must contain:
1. title - a clear title.
2. core_message - the one thing the audience should take away.
3. hook - a strong opening line.
4. recommended_format - the single best format (Instagram Reel, LinkedIn Post or Carousel).
5. platforms - every output this idea fits, using only these values: "reel", "linkedin", "carousel".
6. why_it_works - why this idea is likely to work for this audience.

IMPORTANT:
- Write the content-strategy response in English. The creator's preferred
  language is only used later when generating the actual social-media content.
- Do not invent facts.
- Prefer non-overlapping angles: avoid ideas that say essentially the same thing.
- Prefer useful, specific ideas over generic motivational content.
- Order ideas from strongest to weakest.
"""
