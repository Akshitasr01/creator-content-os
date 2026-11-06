"""Generated assets as first-class data: save, edit, rewrite, feedback (PDF steps 18, 23-25)."""

from datetime import datetime, timezone

from pydantic import ValidationError

from core.config import Settings
from core.errors import NotFoundError, ValidationFailed
from db.repository import Repository
from schemas.content import CONTENT_TYPES, ContentUpdate, FeedbackCreate, validate_content
from services.carousel_generator import generate_carousel
from services.generation_context import GenerationContext
from services.linkedin_generator import generate_linkedin
from services.llm_service import LLMResult, LLMService
from services.profile_service import preference_for, require_profile
from services.reel_generator import generate_reel
from services.rewriter import rewrite_asset
from services.usage_service import check_ai_allowed

GENERATORS = {
    "reel": generate_reel,
    "linkedin": generate_linkedin,
    "carousel": generate_carousel,
}

MAX_STORED_VERSIONS = 10


def build_context(project: dict, profile: dict, idea_index: int | None, content_type: str = "reel") -> GenerationContext:
    ideas = (project.get("content_ideas") or {}).get("ideas") or []
    if idea_index is not None and 0 <= idea_index < len(ideas):
        idea = ideas[idea_index]
    else:
        # Older assets may not reference an idea; fall back to the brief itself.
        analysis = project.get("analysis") or {}
        idea = {"title": analysis.get("main_topic", project.get("title", "")),
                "core_message": analysis.get("summary", ""), "hook": "", "why_it_works": ""}
    _, platform = CONTENT_TYPES.get(content_type, (None, "instagram"))
    return GenerationContext(
        project=project,
        profile=profile,
        analysis=project.get("analysis") or {},
        idea=idea,
        idea_index=idea_index,
        platform_preference=preference_for(profile, platform),
    )


def save_new_asset(repo: Repository, project_id: str, content_type: str,
                   idea_index: int | None, result: LLMResult) -> dict:
    _, platform = CONTENT_TYPES[content_type]
    return repo.insert_content(
        {
            "project_id": project_id,
            "idea_index": idea_index,
            "content_type": content_type,
            "platform": platform,
            "content": result.data.model_dump(),
            "status": "draft",
            "provider": result.provider,
            "model": result.model,
            "version": 1,
            "previous_versions": [],
        }
    )


def get_content(repo: Repository, content_id: str) -> dict:
    content = repo.get_content(content_id)
    if content is None:
        raise NotFoundError("Content not found.")
    return content


def _content_type(item: dict) -> str:
    content_type = item.get("content_type")
    if content_type not in CONTENT_TYPES:
        raise ValidationFailed(f"Unsupported content type '{content_type}'.")
    return content_type


def _new_version_values(item: dict, new_content: dict, reason: str, **extra) -> dict:
    """Keep the old version in history before replacing it (PDF step 18)."""
    history = list(item.get("previous_versions") or [])
    history.append(
        {
            "version": item.get("version") or 1,
            "content": item.get("content"),
            "provider": item.get("provider"),
            "replaced_at": datetime.now(timezone.utc).isoformat(),
            "replaced_by": reason,
        }
    )
    return {
        "content": new_content,
        "version": (item.get("version") or 1) + 1,
        "previous_versions": history[-MAX_STORED_VERSIONS:],
        **extra,
    }


def update_content(repo: Repository, content_id: str, update: ContentUpdate) -> dict:
    item = get_content(repo, content_id)
    values: dict = {}

    if update.content is not None:
        try:
            cleaned = validate_content(_content_type(item), update.content)
        except ValidationError as error:
            raise ValidationFailed(f"Edited content is not valid: {error.errors()[0]['msg']}") from error
        if cleaned != item.get("content"):
            values.update(_new_version_values(item, cleaned, "manual_edit"))

    if update.status is not None:
        values["status"] = update.status

    if not values:
        return item
    return repo.update_content(content_id, values)


def rewrite_content(repo: Repository, llm: LLMService, settings: Settings,
                    content_id: str, instruction: str) -> dict:
    item = get_content(repo, content_id)
    content_type = _content_type(item)
    project = repo.get_project(item["project_id"])
    if project is None:
        raise NotFoundError("Project not found.")
    profile = require_profile(repo)
    check_ai_allowed(repo, settings, planned_calls=1)

    ctx = build_context(project, profile, item.get("idea_index"), content_type)
    if instruction == "regenerate":
        result = GENERATORS[content_type](llm, ctx)
    else:
        result = rewrite_asset(llm, ctx, content_type, item["content"], instruction)

    values = _new_version_values(
        item, result.data.model_dump(), instruction,
        provider=result.provider, model=result.model, status="draft",
    )
    return repo.update_content(content_id, values)


def add_feedback(repo: Repository, content_id: str, feedback: FeedbackCreate) -> dict:
    get_content(repo, content_id)  # ownership check -> 404 for other users' ids
    rating = 1 if feedback.rating == "up" else -1
    saved = repo.insert_feedback(
        {
            "content_id": content_id,
            "rating": rating,
            "reason": feedback.reason if rating == -1 else None,
            "note": (feedback.note or "").strip() or None,
        }
    )
    repo.update_content(content_id, {"status": "liked" if rating == 1 else "disliked"})
    return saved
