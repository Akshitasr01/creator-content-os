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
    ManualTranscript,
    RenderRequest,
    VideoCapabilities,
    VideoClipOut,
    VideoFromUrl,
    VideoFromYouTube,
    VideoSourceDetail,
    VideoSourceSummary,
    YouTubeCaptionsRequest,
    YouTubeValidate,
    YouTubeVideoInfo,
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


# ---------------------------------------------------------------------------
# YouTube (official oEmbed / Data API / OAuth captions; the video is never downloaded)
# ---------------------------------------------------------------------------


@router.post("/youtube/validate", response_model=YouTubeVideoInfo)
def validate_youtube(data: YouTubeValidate, _: CurrentUser = Depends(get_current_user)):
    """Check a YouTube link and return preview metadata. Nothing is saved."""
    return video_service.validate_youtube(data.url)


@router.post("/videos/from-youtube", response_model=VideoSourceSummary, status_code=status.HTTP_201_CREATED)
def create_from_youtube(data: VideoFromYouTube, vrepo: VideoRepository = Depends(get_video_repository)):
    """Create a YouTube project. It waits for a transcript (captions, paste or original file)."""
    return video_service.create_from_youtube(vrepo, data)


@router.post("/videos/{source_id}/transcript", response_model=VideoSourceSummary)
def submit_transcript(
    source_id: UUID,
    data: ManualTranscript,
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Pasted timestamped transcript (YouTube 'Show transcript', SRT or VTT)."""
    return video_service.submit_manual_transcript(vrepo, repo, llm, settings, str(source_id), data.text)


@router.post("/videos/{source_id}/youtube-captions", response_model=VideoSourceSummary)
def youtube_captions(
    source_id: UUID,
    data: YouTubeCaptionsRequest,
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Fetch captions with the creator's Google sign-in (own videos only). The token is not stored."""
    return video_service.fetch_youtube_captions(vrepo, repo, llm, settings, str(source_id), data.access_token)


@router.post("/videos/{source_id}/original-file", response_model=VideoSourceSummary)
def attach_original(
    source_id: UUID,
    file: UploadFile = File(...),
    vrepo: VideoRepository = Depends(get_video_repository),
    repo: Repository = Depends(get_repository),
    llm: LLMService = Depends(get_llm),
    settings: Settings = Depends(settings_dep),
):
    """Attach the creator's own copy of the YouTube video so real MP4 clips can be rendered."""
    return video_service.attach_original_file(vrepo, repo, llm, settings, str(source_id),
                                              file.filename or "", file.file)


@router.post("/videos/{source_id}/render", response_model=list[VideoClipOut], status_code=status.HTTP_202_ACCEPTED)
def render_selected(source_id: UUID, data: RenderRequest, vrepo: VideoRepository = Depends(get_video_repository)):
    """Render the selected clips (requires an uploaded/attached original file)."""
    return video_service.render_selected(vrepo, str(source_id), data.clip_ids)


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
