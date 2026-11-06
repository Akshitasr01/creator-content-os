"""Free demo output used when AI_PROVIDER=mock.

This is NOT AI generation. It builds schema-valid placeholder content from the
user's own source text with simple string rules, so the rest of the app
(saving, Studio, rewrite, feedback) can be tested without spending money.
Every asset made here is stored with provider="mock" and labelled
"Demo output" in the UI.
"""

import re

from schemas.analysis import ContentAnalysis, ContentIdea, ContentIdeasResponse
from schemas.content import CarouselContent, CarouselSlide, LinkedInPost, ReelContent

DEMO = "[Demo]"


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n+", text)
    return [p.strip() for p in parts if len(p.strip()) > 25]


def _clip(text: str, limit: int = 140) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def _hashtags(*words: str) -> list[str]:
    tags = []
    for word in words:
        tag = re.sub(r"[^a-z0-9]", "", (word or "").lower())
        if tag and tag not in tags:
            tags.append(tag)
    return tags[:5] or ["creator"]


def analysis(project: dict, profile: dict) -> ContentAnalysis:
    sentences = _sentences(project.get("source_text", "")) or [project.get("title", "Untitled")]
    title = project.get("title", "Untitled")
    key_points = [_clip(s) for s in sentences[:5]]
    return ContentAnalysis(
        main_topic=title,
        target_audience=profile.get("audience") or "General audience",
        summary=f"{DEMO} " + _clip(" ".join(sentences[:3]), 300),
        key_points=key_points,
        examples=[_clip(s) for s in sentences if any(ch.isdigit() for ch in s)][:3],
        strong_claims=[_clip(s) for s in sentences if "!" in s or " must " in s.lower()][:3],
        hooks=[
            f"{DEMO} Most people get {title.lower()} wrong.",
            f"{DEMO} {key_points[0]}",
            f"{DEMO} Here is what nobody tells you about {title.lower()}.",
        ],
        content_angles=[
            "Common mistakes",
            "Step-by-step breakdown",
            "Personal story angle",
            "Myth vs reality",
        ],
    )


def ideas(brief: dict, count: int) -> ContentIdeasResponse:
    points = brief.get("key_points") or [brief.get("main_topic", "Topic")]
    angles = brief.get("content_angles") or ["Breakdown"]
    platform_cycle = [["reel", "carousel"], ["linkedin"], ["reel", "linkedin"], ["carousel", "linkedin"]]
    format_names = {"reel": "Instagram Reel", "linkedin": "LinkedIn Post", "carousel": "Carousel"}

    result = []
    for index in range(count):
        point = points[index % len(points)]
        angle = angles[index % len(angles)]
        platforms = platform_cycle[index % len(platform_cycle)]
        result.append(
            ContentIdea(
                title=f"{DEMO} {angle}: {_clip(point, 60)}",
                core_message=point,
                hook=f"{DEMO} {_clip(point, 80)}",
                recommended_format=format_names[platforms[0]],
                platforms=platforms,
                why_it_works="Demo placeholder - switch AI_PROVIDER to openai for real strategy reasoning.",
            )
        )
    return ContentIdeasResponse(ideas=result)


def reel(idea: dict, profile: dict) -> ReelContent:
    script = (
        f"{idea.get('hook', '')}\n\n"
        f"Here's the thing: {idea.get('core_message', '')}\n\n"
        "This is demo text built from your source, not AI writing. "
        "Switch the backend to OpenAI to get a real script in your voice."
    )
    return ReelContent(
        hook=idea.get("hook", DEMO),
        script=script,
        caption=f"{DEMO} {_clip(idea.get('core_message', ''), 120)}",
        cta="Follow for more.",
        hashtags=_hashtags(profile.get("niche", ""), "content", "learning"),
        estimated_duration_seconds=max(15, len(script.split()) * 2 // 5),
    )


def linkedin(idea: dict, profile: dict) -> LinkedInPost:
    return LinkedInPost(
        hook=f"{DEMO} {idea.get('title', '')}",
        body=(
            f"{idea.get('core_message', '')}\n\n"
            f"Why it matters: {idea.get('why_it_works', '')}\n\n"
            "(Demo text - not AI generated.)"
        ),
        cta="What has your experience been?",
        hashtags=_hashtags(profile.get("niche", ""), "careers"),
    )


def carousel(idea: dict, brief: dict) -> CarouselContent:
    points = (brief.get("key_points") or [idea.get("core_message", "")])[:4]
    slides = [CarouselSlide(number=1, heading=_clip(idea.get("title", "Demo"), 50), body=DEMO)]
    for point in points:
        slides.append(CarouselSlide(number=len(slides) + 1, heading="Key point", body=_clip(point, 120)))
    slides.append(CarouselSlide(number=len(slides) + 1, heading="Save this", body="Follow for more."))
    return CarouselContent(
        title=f"{DEMO} {_clip(idea.get('title', ''), 60)}",
        slides=slides,
        caption=_clip(idea.get("core_message", ""), 150),
        cta="Save this post.",
        hashtags=_hashtags("carousel", "tips"),
    )


def rewrite(content_type: str, content: dict, instruction: str):
    """Apply a visible, rule-based change so the rewrite flow can be tested."""
    data = dict(content)
    tag = f"{DEMO} ({instruction.replace('_', ' ')})"

    if content_type == "carousel":
        data["title"] = f"{tag} {data.get('title', '')}"
        if instruction == "shorter":
            data["slides"] = data.get("slides", [])[:4]
        return CarouselContent.model_validate(data)

    data["hook"] = f"{tag} {data.get('hook', '')}"
    text_field = "script" if content_type == "reel" else "body"
    if instruction == "shorter":
        words = data.get(text_field, "").split()
        data[text_field] = " ".join(words[: max(10, int(len(words) * 0.6))])
    schema = ReelContent if content_type == "reel" else LinkedInPost
    return schema.model_validate(data)
