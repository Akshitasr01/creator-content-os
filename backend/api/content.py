"""Single-asset actions: edit/status and controlled rewrite."""

from uuid import UUID

from fastapi import APIRouter, Depends

from api.deps import get_llm, get_repository, settings_dep
from core.config import Settings
from db.repository import Repository
from schemas.content import ContentUpdate, GeneratedContentOut, RewriteRequest
from services import content_service
from services.llm_service import LLMService

router = APIRouter(prefix="/content", tags=["content"])


@router.patch("/{content_id}", response_model=GeneratedContentOut)
def update_content(content_id: UUID, update: ContentUpdate, repo: Repository = Depends(get_repository)):
    """Save manual edits (previous version is kept) and/or change status."""
    return content_service.update_content(repo, str(content_id), update)


@router.post("/{content_id}/rewrite", response_model=GeneratedContentOut)
def rewrite(
    content_id: UUID,
    request: RewriteRequest,
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Rewrite only this asset with a known instruction (e.g. stronger_hook)."""
    return content_service.rewrite_content(repo, llm, settings, str(content_id), request.instruction.value)
