"""Project lifecycle: create -> analyze -> ideas -> generate (PDF steps 8, 11, 13, 18).

Status model:  draft -> analyzing -> analyzed -> generating -> ready
                                         \\-> failed (with error_message)
The project is always saved BEFORE any AI call so failures never lose work.
"""

import logging
from concurrent.futures import ThreadPoolExecutor

from core.config import Settings
from core.errors import AppError, NotFoundError, ValidationFailed
from db.repository import Repository
from schemas.analysis import ContentAnalysis
from schemas.content import GenerateRequest
from schemas.project import ProjectCreate
from services import content_analyzer, idea_generator
from services.content_service import GENERATORS, build_context, save_new_asset
from services.llm_service import LLMService
from services.profile_service import require_profile
from services.usage_service import check_ai_allowed

logger = logging.getLogger(__name__)

# Statuses saved by older versions of the app that mean "analysis exists".
_LEGACY_ANALYZED = {"ideas_generated"}
MAX_PARALLEL_GENERATIONS = 3


def get_project(repo: Repository, project_id: str) -> dict:
    project = repo.get_project(project_id)
    if project is None:
        raise NotFoundError("Project not found.")
    return project


def get_project_detail(repo: Repository, project_id: str) -> dict:
    project = get_project(repo, project_id)
    return {**project, "content": repo.list_content(project_id)}


def list_projects(repo: Repository) -> list[dict]:
    counts = repo.content_counts_by_project()
    summaries = []
    for project in repo.list_projects():
        ideas = (project.get("content_ideas") or {}).get("ideas") or []
        summaries.append(
            {
                **project,
                "status": normalize_status(project),
                "asset_count": counts.get(project["id"], 0),
                "has_analysis": bool(project.get("analysis")),
                "idea_count": len(ideas),
            }
        )
    return summaries


def normalize_status(project: dict) -> str:
    status = project.get("status") or "draft"
    return "analyzed" if status in _LEGACY_ANALYZED else status


def create_project(repo: Repository, settings: Settings, data: ProjectCreate) -> dict:
    length = len(data.source_text)
    if length < settings.source_min_chars:
        raise ValidationFailed(
            f"Source content is too short ({length} characters). "
            f"Paste at least {settings.source_min_chars} characters."
        )
    if length > settings.source_max_chars:
        raise ValidationFailed(
            f"Source content is too long ({length} characters). "
            f"The limit is {settings.source_max_chars} characters."
        )
    profile = require_profile(repo)
    return repo.insert_project(
        {
            "creator_profile_id": profile["id"],
            "title": data.title,
            "source_type": data.source_type,
            "source_text": data.source_text,
            "status": "draft",
        }
    )


def _fail(repo: Repository, project_id: str, error: AppError) -> None:
    repo.update_project(project_id, {"status": "failed", "error_message": error.message})


def analyze_project(repo: Repository, llm: LLMService, settings: Settings, project_id: str) -> dict:
    project = get_project(repo, project_id)
    profile = require_profile(repo)
    check_ai_allowed(repo, settings, planned_calls=1)

    repo.update_project(project_id, {"status": "analyzing", "error_message": None})
    try:
        result = content_analyzer.analyze(llm, project, profile)
    except AppError as error:
        _fail(repo, project_id, error)
        raise

    analysis = {
        **result.data.model_dump(),
        "generated_by": {"provider": result.provider, "model": result.model},
    }
    return repo.update_project(project_id, {"analysis": analysis, "status": "analyzed", "error_message": None})


def update_analysis(repo: Repository, project_id: str, analysis: ContentAnalysis) -> dict:
    """Save the user's corrections to the Content Brief."""
    project = get_project(repo, project_id)
    generated_by = (project.get("analysis") or {}).get("generated_by")
    values = {**analysis.model_dump(), "generated_by": generated_by, "edited_by_user": True}
    return repo.update_project(project_id, {"analysis": values})


def generate_project_ideas(repo: Repository, llm: LLMService, settings: Settings, project_id: str) -> dict:
    project = get_project(repo, project_id)
    if not project.get("analysis"):
        raise ValidationFailed("Analyze the project before generating ideas.")
    profile = require_profile(repo)
    check_ai_allowed(repo, settings, planned_calls=1)

    result = idea_generator.generate_ideas(llm, project, profile, project["analysis"])
    # Append instead of replace: saved assets reference ideas by index, so
    # existing indexes must keep pointing at the same idea.
    existing = (project.get("content_ideas") or {}).get("ideas") or []
    content_ideas = {
        "ideas": existing + [idea.model_dump() for idea in result.data.ideas],
        "generated_by": {"provider": result.provider, "model": result.model},
    }
    return repo.update_project(project_id, {"content_ideas": content_ideas, "error_message": None})


def plan_assets(ideas: list[dict], request: GenerateRequest) -> list[tuple[str, int]]:
    """Decide which idea each requested asset uses.

    Prefers ideas labelled for that platform and spreads assets across
    different ideas so outputs do not overlap.
    """
    selected = [i for i in request.idea_indexes if 0 <= i < len(ideas)] or list(range(len(ideas)))
    plan: list[tuple[str, int]] = []
    for output in request.outputs:
        fitting = [i for i in selected if output.type in (ideas[i].get("platforms") or [])]
        others = [i for i in selected if i not in fitting]
        order = fitting + others
        for n in range(output.count):
            plan.append((output.type, order[n % len(order)]))
    return plan


def generate_content(
    repo: Repository, llm: LLMService, settings: Settings, project_id: str, request: GenerateRequest
) -> dict:
    project = get_project(repo, project_id)
    if not project.get("analysis"):
        raise ValidationFailed("Analyze the project before generating content.")
    ideas = (project.get("content_ideas") or {}).get("ideas") or []
    if not ideas:
        raise ValidationFailed("Generate content ideas before generating content.")

    plan = plan_assets(ideas, request)
    if len(plan) > settings.max_assets_per_request:
        raise ValidationFailed(
            f"Too many assets in one request ({len(plan)}). The maximum is {settings.max_assets_per_request}."
        )
    profile = require_profile(repo)
    check_ai_allowed(repo, settings, planned_calls=len(plan))

    repo.update_project(project_id, {"status": "generating", "error_message": None})

    def run(job: tuple[str, int]) -> dict:
        content_type, idea_index = job
        ctx = build_context(project, profile, idea_index, content_type)
        result = GENERATORS[content_type](llm, ctx)
        # Save each asset immediately after it succeeds.
        return save_new_asset(repo, project_id, content_type, idea_index, result)

    created, errors = [], []
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_GENERATIONS) as pool:
        futures = [(job, pool.submit(run, job)) for job in plan]
        for (content_type, _), future in futures:
            try:
                created.append(future.result())
            except AppError as error:
                errors.append(f"{content_type}: {error.message}")
            except Exception:  # noqa: BLE001 - one failed asset must not lose the others
                logger.exception("Unexpected error generating %s", content_type)
                errors.append(f"{content_type}: unexpected error")

    if created or repo.list_content(project_id):
        repo.update_project(
            project_id,
            {"status": "ready", "error_message": "; ".join(errors) if errors else None},
        )
    else:
        repo.update_project(
            project_id, {"status": "failed", "error_message": "; ".join(errors) or "Generation failed."}
        )
    return {"created": created, "errors": errors}

