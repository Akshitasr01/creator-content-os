"""Project CRUD + the Content Brief."""

from uuid import UUID

from fastapi import APIRouter, Depends, status

from api.deps import get_repository, settings_dep
from core.config import Settings
from db.repository import Repository
from schemas.project import AnalysisUpdate, ProjectCreate, ProjectDetail, ProjectOut, ProjectSummary
from services import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    repo: Repository = Depends(get_repository),
    settings: Settings = Depends(settings_dep),
):
    """Saves the project before any AI call, so failed generations never lose work."""
    return project_service.create_project(repo, settings, data)


@router.get("", response_model=list[ProjectSummary])
def list_projects(repo: Repository = Depends(get_repository)):
    return project_service.list_projects(repo)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: UUID, repo: Repository = Depends(get_repository)):
    return project_service.get_project_detail(repo, str(project_id))


@router.put("/{project_id}/analysis", response_model=ProjectOut)
def update_analysis(project_id: UUID, data: AnalysisUpdate, repo: Repository = Depends(get_repository)):
    """Let the user correct the Content Brief before generation."""
    return project_service.update_analysis(repo, str(project_id), data.analysis)
