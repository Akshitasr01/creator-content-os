"""Pick the strongest standalone moments from a timestamped transcript.

The AI proposes clips; this module then *enforces* the rules in code:
timestamps snap to real transcript line boundaries, length stays within
limits, overlapping clips are dropped and the transcript excerpt is copied
from the real transcript (never written by the AI).
"""

import re

from prompts import clips as prompt
from schemas.video import ClipSuggestion, ClipSuggestionList
from services.llm_service import LLMResult, LLMService

MAX_OVERLAP_RATIO = 0.2
DEMO = "[Demo]"


# ---------------------------------------------------------------------------
# Post-processing (pure functions, unit tested)
# ---------------------------------------------------------------------------


def _segment_index_at(segments: list[dict], t: float) -> int:
    for index, segment in enumerate(segments):
        if segment["start"] <= t < segment["end"]:
            return index
    # Not inside any line: nearest line start.
    return min(range(len(segments)), key=lambda i: abs(segments[i]["start"] - t))


def snap_clip(start: float, end: float, segments: list[dict], duration: float,
              min_s: float, max_s: float) -> tuple[float, float]:
    """Return (start, end) aligned to whole transcript lines and within length limits."""
    first = _segment_index_at(segments, max(0.0, start))
    last = max(first, _segment_index_at(segments, max(start, end - 0.01)))

    # Too short: add following lines. Too long: drop trailing lines.
    while last + 1 < len(segments) and segments[last]["end"] - segments[first]["start"] < min_s \
            and segments[last + 1]["end"] - segments[first]["start"] <= max_s:
        last += 1
    while last > first and segments[last]["end"] - segments[first]["start"] > max_s:
        last -= 1

    clip_start = segments[first]["start"]
    clip_end = segments[last]["end"]
    if clip_end - clip_start > max_s:  # a single very long line
        clip_end = clip_start + max_s
    return round(max(0.0, clip_start), 2), round(min(duration, clip_end), 2)


def _overlap(a: tuple[float, float], b: tuple[float, float]) -> float:
    shared = min(a[1], b[1]) - max(a[0], b[0])
    if shared <= 0:
        return 0.0
    return shared / min(a[1] - a[0], b[1] - b[0])


def excerpt_for(segments: list[dict], start: float, end: float) -> str:
    return " ".join(s["text"] for s in segments if s["end"] > start and s["start"] < end).strip()


def _clean_tags(tags: list[str]) -> list[str]:
    cleaned: list[str] = []
    for tag in tags:
        tag = re.sub(r"[^\w]", "", tag.replace("#", "")).lower()
        if tag and tag not in cleaned:
            cleaned.append(tag)
    return cleaned[:8]


def finalize_clips(suggestions: list[ClipSuggestion], segments: list[dict], duration: float,
                   count: int, min_s: float, max_s: float) -> list[dict]:
    accepted: list[dict] = []
    for suggestion in suggestions:
        if len(accepted) >= count:
            break
        start, end = snap_clip(suggestion.start_seconds, suggestion.end_seconds,
                               segments, duration, min_s, max_s)
        if end - start < min(min_s, duration) * 0.5:
            continue  # unusably short even after snapping
        if any(_overlap((start, end), (c["start_seconds"], c["end_seconds"])) > MAX_OVERLAP_RATIO
               for c in accepted):
            continue
        accepted.append({
            "title": suggestion.title.strip(),
            "start_seconds": start,
            "end_seconds": end,
            "duration_seconds": round(end - start, 2),
            "hook": suggestion.hook.strip(),
            "transcript_excerpt": excerpt_for(segments, start, end),
            "caption": suggestion.caption.strip(),
            "hashtags": _clean_tags(suggestion.hashtags),
            "cta": suggestion.cta.strip(),
            "reason": suggestion.reason.strip(),
        })
    return accepted


# ---------------------------------------------------------------------------
# Free demo selector (AI_PROVIDER=mock) - rule-based, clearly labelled
# ---------------------------------------------------------------------------

_ENGAGING = re.compile(r"\?|!|\d|\b(mistake|story|secret|why|how|never|always|biggest|first|you)\b", re.I)


def demo_suggestions(segments: list[dict], count: int, min_s: float, max_s: float) -> ClipSuggestionList:
    # Aim for clips that fit the recording: short videos get shorter clips so the
    # requested number can fit without overlapping.
    total = segments[-1]["end"] - segments[0]["start"]
    target = max(min_s, min((min_s + max_s) / 2, total / max(1, count) * 0.9))
    candidates = []
    for index, segment in enumerate(segments):
        end_index = index
        while end_index + 1 < len(segments) and segments[end_index]["end"] - segment["start"] < target:
            end_index += 1
        window = segments[index:end_index + 1]
        text = " ".join(s["text"] for s in window)
        score = len(_ENGAGING.findall(text)) + 2 * bool(_ENGAGING.search(segment["text"]))
        candidates.append((score, segment["start"], window[-1]["end"], segment["text"], text))

    candidates.sort(key=lambda c: c[0], reverse=True)
    clips = []
    for _, start, end, first_line, text in candidates[: count * 4]:
        words = text.split()
        clips.append(ClipSuggestion(
            title=f"{DEMO} " + " ".join(words[:6]),
            start_seconds=start,
            end_seconds=end,
            hook=first_line,
            caption=f"{DEMO} " + " ".join(words[:18]) + "…",
            hashtags=["reels", "shorts", "creator"],
            cta="Follow for more.",
            reason="Demo selection by keyword rules (not AI). Set AI_PROVIDER=openai for real analysis.",
        ))
    return ClipSuggestionList(clips=clips)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def select_clips(llm: LLMService, title: str, segments: list[dict], profile: dict, count: int,
                 min_s: float, max_s: float) -> LLMResult[ClipSuggestionList]:
    return llm.generate_structured(
        operation="select_clips",
        system=prompt.SYSTEM,
        user=prompt.build_user_prompt(title, segments, profile, count, int(min_s), int(max_s)),
        schema=ClipSuggestionList,
        mock_factory=lambda: demo_suggestions(segments, count, min_s, max_s),
    )
