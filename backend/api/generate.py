"""AI pipeline endpoints: analyze, ideas, generate (rate-limited)."""

from uuid import UUID

from fastapi import APIRouter, Depends

from api.deps import get_llm, get_repository, settings_dep
from core.config import Settings
from db.repository import Repository
from schemas.content import GenerateRequest, GenerateResponse
from schemas.project import ProjectOut
from services import project_service
from services.llm_service import LLMService

router = APIRouter(prefix="/projects", tags=["generation"])


@router.post("/{project_id}/analyze", response_model=ProjectOut)
def analyze(
    project_id: UUID,
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Create the Content Brief and save it as project.analysis."""
    return project_service.analyze_project(repo, llm, settings, str(project_id))


@router.post("/{project_id}/ideas", response_model=ProjectOut)
def ideas(
    project_id: UUID,
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Create 10 content angles and save them as project.content_ideas."""
    return project_service.generate_project_ideas(repo, llm, settings, str(project_id))


@router.post("/{project_id}/generate", response_model=GenerateResponse)
def generate(
    project_id: UUID,
    request: GenerateRequest,
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Generate the requested Reels / LinkedIn posts / carousels and save each one."""
    return project_service.generate_content(repo, llm, settings, str(project_id), request)
