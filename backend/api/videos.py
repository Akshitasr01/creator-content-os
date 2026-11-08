"""AI Video-to-Reels endpoints."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile, status

from api.deps import CurrentUser, get_current_user, get_llm, get_repository, settings_dep
from core.config import Settings
from db.repository import Repository
from db.video_repository import VideoRepository
from schemas.video import (
    ClipUpdate,
    VideoCapabilities,
    VideoClipOut,
    VideoFromUrl,
    VideoSourceDetail,
    VideoSourceSummary,
)
from services.llm_service import LLMService
from services.video import video_service

router = APIRouter(tags=["video-to-reels"])


def get_video_repository(user: CurrentUser = Depends(get_current_user)) -> VideoRepository:
    return VideoRepository(user.id, user.access_token)


@router.get("/videos/capabilities", response_model=VideoCapabilities)
def capabilities(_: CurrentUser = Depends(get_current_user), settings: Settings = Depends(settings_dep)):
    """What this server can do right now (transcription installed? FFmpeg installed?)."""
    return video_service.capabilities(settings)


@router.get("/videos", response_model=list[VideoSourceSummary])
def list_videos(vrepo: VideoRepository = Depends(get_video_repository)):
    return video_service.list_sources(vrepo)


@router.post("/videos/from-url", response_model=VideoSourceSummary, status_code=status.HTTP_202_ACCEPTED)
def create_from_url(
    data: VideoFromUrl,
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Direct links to media files only. Platform pages (YouTube, Instagram…) are rejected."""
    return video_service.create_from_url(vrepo, repo, llm, settings, data)


@router.post("/videos/upload", response_model=VideoSourceSummary, status_code=status.HTTP_202_ACCEPTED)
def upload(
    file: UploadFile = File(...),
    title: str = Form(...),
    clip_count: int = Form(...),
    kind: Literal["video", "audio"] = Form("video"),
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    return video_service.create_from_upload(
        vrepo, repo, llm, settings, title=title, clip_count=clip_count, kind=kind,
        filename=file.filename or "", stream=file.file,
    )


@router.get("/videos/{source_id}", response_model=VideoSourceDetail)
def get_video(source_id: UUID, vrepo: VideoRepository = Depends(get_video_repository)):
    return video_service.get_detail(vrepo, str(source_id))


@router.post("/videos/{source_id}/retry", response_model=VideoSourceSummary)
def retry(
    source_id: UUID,
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    return video_service.retry(vrepo, repo, llm, settings, str(source_id))


@router.post("/videos/{source_id}/text-project")
def create_text_project(
    source_id: UUID,
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    settings: Settings = Depends(settings_dep),
):
    """Use the transcript in the existing text pipeline (brief -> ideas -> posts)."""
    return video_service.create_text_project(vrepo, repo, settings, str(source_id))


@router.patch("/video-clips/{clip_id}", response_model=VideoClipOut)
def update_clip(clip_id: UUID, changes: ClipUpdate, vrepo: VideoRepository = Depends(get_video_repository)):
    return video_service.update_clip(vrepo, str(clip_id), changes)


@router.post("/video-clips/{clip_id}/render", response_model=VideoClipOut, status_code=status.HTTP_202_ACCEPTED)
def render(clip_id: UUID, vrepo: VideoRepository = Depends(get_video_repository)):
    return video_service.render_clip(vrepo, str(clip_id))
