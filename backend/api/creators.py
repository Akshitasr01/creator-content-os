"""GET/PUT /creator-profile and GET /usage."""

from fastapi import APIRouter, Depends

from api.deps import get_repository, settings_dep
from core.config import Settings
from db.repository import Repository
from schemas.profile import CreatorProfileIn, CreatorProfileOut
from services import profile_service, usage_service

router = APIRouter(tags=["creator"])


@router.get("/creator-profile", response_model=CreatorProfileOut | None)
def get_creator_profile(repo: Repository = Depends(get_repository)):
    """Returns null when the user has not completed onboarding yet."""
    return profile_service.get_profile(repo)


@router.put("/creator-profile", response_model=CreatorProfileOut)
def put_creator_profile(data: CreatorProfileIn, repo: Repository = Depends(get_repository)):
    return profile_service.save_profile(repo, data)


@router.get("/usage")
def get_usage(repo: Repository = Depends(get_repository), settings: Settings = Depends(settings_dep)):
    return usage_service.usage_summary(repo, settings)
