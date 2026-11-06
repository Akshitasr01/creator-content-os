"""POST /content/{id}/feedback - thumbs up/down with an optional reason."""

from uuid import UUID

from fastapi import APIRouter, Depends, status

from api.deps import get_repository
from db.repository import Repository
from schemas.content import FeedbackCreate, FeedbackOut
from services import content_service

router = APIRouter(prefix="/content", tags=["feedback"])


@router.post("/{content_id}/feedback", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def add_feedback(content_id: UUID, feedback: FeedbackCreate, repo: Repository = Depends(get_repository)):
    return content_service.add_feedback(repo, str(content_id), feedback)
