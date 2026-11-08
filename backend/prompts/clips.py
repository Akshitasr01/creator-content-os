"""Clip selection prompt: timestamped transcript -> the strongest standalone moments."""

from prompts.voice import LANGUAGE_RULES

SYSTEM = """You are the short-form video editor for a creator content repurposing
platform. You read a timestamped transcript of a long-form video and pick the
moments that work best as standalone vertical short videos (Reels / Shorts).
"""


def format_transcript(segments: list[dict]) -> str:
    return "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in segments)


def build_user_prompt(title: str, segments: list[dict], profile: dict, count: int,
                      min_seconds: int, max_seconds: int) -> str:
    return f"""VIDEO TITLE: {title}

CREATOR PROFILE
Niche: {profile.get("niche") or "Not provided"}
Audience: {profile.get("audience") or "Not provided"}
Preferred language: {profile.get("language") or "English"}
Tone: {profile.get("tone") or "Not provided"}
Things to avoid: {profile.get("things_to_avoid") or "Not provided"}

TIMESTAMPED TRANSCRIPT (seconds)
{format_transcript(segments)}

TASK
Select up to {count} of the strongest self-contained moments, ranked best first.

Selection criteria:
- A strong opening line that hooks viewers in the first 3 seconds.
- Interesting insights, stories or concrete examples, or clear educational value.
- Emotional engagement (surprise, humour, relatability, tension).
- A clear beginning and ending: the clip must make sense without the rest of the video.
  Never start or end mid-sentence.
- Minimal overlap between clips: each clip covers a different moment.
- Each clip must be between {min_seconds} and {max_seconds} seconds long.

Rules:
- start_seconds must be the START time of a transcript line; end_seconds must be the END
  time of a transcript line. Use only times that appear in the transcript.
- If the video has fewer good moments than requested, return fewer clips rather than weak ones.
- hook: the opening line of the clip (usually close to its first words).
- caption: a short social caption for the clip. cta: one natural call to action.
- hashtags: 3-6 relevant hashtags without the # symbol.
- reason: one sentence on why this moment works on its own.
- Ground everything in what is actually said; do not invent claims.

{LANGUAGE_RULES}
Apply the language rules to title, hook, caption and cta only.
"""
