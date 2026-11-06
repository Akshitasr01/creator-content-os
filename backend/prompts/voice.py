"""Shared prompt blocks: Creator Voice, language rules and grounding rules.

Generation context = creator profile + 3 example posts + Content Brief
+ selected idea + platform rules (PDF step 17).
"""

import json
from typing import Any


def _value(profile: dict, key: str, fallback: str = "Not provided") -> str:
    value = profile.get(key)
    return str(value).strip() if value else fallback


def creator_voice_block(profile: dict, platform_preference: dict | None = None) -> str:
    samples = [s for s in (profile.get("sample_posts") or []) if s and s.strip()]
    samples_text = (
        "\n\n---\n\n".join(samples) if samples else "No sample posts provided."
    )

    preference_text = ""
    if platform_preference:
        preference_text = f"""
Platform preferences for this output:
- Preferred length: {platform_preference.get("preferred_length", "medium")}
- CTA style: {platform_preference.get("cta_style") or "Not provided"}
"""

    return f"""CREATOR PROFILE

Niche: {_value(profile, "niche")}
Audience: {_value(profile, "audience")}
Preferred language: {_value(profile, "language", "English")}
Tone: {_value(profile, "tone")}
Creator style preferences: {_value(profile, "style_description")}
Things to avoid: {_value(profile, "things_to_avoid")}
{preference_text}
Sample posts - style references only:
{samples_text}

CREATOR VOICE INSTRUCTIONS

- Use sample posts only to infer writing style, such as formality,
  sentence length, rhythm, hooks, language mixing, humour, emoji usage and CTA style.
- Do not copy or closely paraphrase their wording.
- Do not reuse their claims, examples, opinions, or factual content.
- Follow the creator's saved style preferences and things to avoid as hard constraints.
- You are adapting to the creator's examples and preferences, not cloning a person.
"""


LANGUAGE_RULES = """LANGUAGE RULES

Write the FINAL content in the creator's preferred language.
If the preferred language is English, write naturally in English.
If the preferred language is Hindi, write naturally in Hindi.
If the preferred language is Hinglish, write natural conversational Hinglish
using English/Roman letters, not Devanagari.
"""

GROUNDING_RULES = """GROUNDING RULES

- Keep factual claims grounded in the original source content.
- Do not invent facts, numbers, results or quotes that are not supported by the source.
- If you add a creative suggestion that is not in the source, make it clearly an opinion or suggestion.
- Avoid generic AI phrases such as "In today's fast-paced world", "Let's dive in",
  "Unlock your potential", "game-changer".
"""


def brief_block(analysis: dict[str, Any]) -> str:
    return "CONTENT BRIEF (what the source says)\n\n" + json.dumps(
        analysis, ensure_ascii=False, indent=2
    )


def idea_block(idea: dict[str, Any]) -> str:
    return f"""SELECTED CONTENT IDEA

Idea title: {idea.get("title", "")}
Core message: {idea.get("core_message", "")}
Suggested hook: {idea.get("hook", "")}
Why it works: {idea.get("why_it_works", "")}
"""


def source_block(project: dict[str, Any]) -> str:
    return f"""ORIGINAL SOURCE MATERIAL

Title: {project.get("title", "")}
Source type: {project.get("source_type", "")}

{project.get("source_text", "")}
"""
