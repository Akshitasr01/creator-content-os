"""Video-to-Reels operations used by api/videos.py."""

import logging
import shutil
import uuid
from pathlib import Path, PurePosixPath
from typing import BinaryIO

from core.config import Settings
from core.errors import LimitExceeded, NotFoundError, ValidationFailed
from core.video_config import AUDIO_EXTENSIONS, VIDEO_EXTENSIONS, get_video_settings
from db.repository import Repository
from db.video_repository import VideoRepository
from schemas.project import ProjectCreate
from schemas.video import ClipUpdate, VideoFromUrl, VideoFromYouTube
from services import profile_service, project_service
from services.llm_service import LLMService
from services.usage_service import check_ai_allowed
from services.video import media_tools, pipeline, transcriber, url_source, youtube
from services.video.transcript_parser import parse_transcript
from services.video.clip_selector import excerpt_for

logger = logging.getLogger(__name__)

MAX_ACTIVE_JOBS_PER_USER = 2
CHUNK = 1024 * 1024


def capabilities(settings: Settings) -> dict:
    video = get_video_settings()
    ffmpeg = media_tools.ffmpeg_status()
    return {
        "transcription": transcriber.transcription_available(),
        "rendering": ffmpeg["available"],
        "ffmpeg_message": ffmpeg["message"],
        "youtube_metadata": "data_api" if video.youtube_api_key else "oembed",
        "google_oauth_client_id": video.google_oauth_client_id or None,
        "ai_provider": settings.ai_provider,
        "max_clips": video.max_clips,
        "max_upload_mb": video.max_upload_mb,
        "max_duration_minutes": video.max_duration_minutes,
        "video_extensions": sorted(VIDEO_EXTENSIONS),
        "audio_extensions": sorted(AUDIO_EXTENSIONS),
    }


def _check_can_start(vrepo: VideoRepository, repo: Repository, settings: Settings, needs_media: bool = True) -> None:
    """needs_media=False for YouTube transcripts: no FFmpeg or speech model needed."""
    if needs_media:
        if not transcriber.transcription_available():
            raise ValidationFailed("Transcription (faster-whisper) is not installed: run pip install -r requirements.txt.")
        status = media_tools.ffmpeg_status()
        if not status["available"]:
            raise ValidationFailed(status["message"])
    if vrepo.count_active_sources() >= MAX_ACTIVE_JOBS_PER_USER:
        raise LimitExceeded("You already have videos processing. Wait for one to finish, then try again.")
    check_ai_allowed(repo, settings, planned_calls=1)  # one AI call selects the clips


def _start(vrepo: VideoRepository, repo: Repository, llm: LLMService, source_id: str) -> None:
    profile = profile_service.get_profile(repo) or {}
    ctx = pipeline.JobContext(repo=vrepo, llm=llm, profile=profile, source_id=source_id)
    pipeline.runner.submit(f"source:{source_id}", pipeline.process_source, ctx)


def _save_upload(vrepo: VideoRepository, filename: str, stream: BinaryIO, allowed: set[str]) -> Path:
    """Stream an upload to a private temp file with a size cap. Caller deletes/moves it."""
    video = get_video_settings()
    extension = PurePosixPath(filename or "").suffix.lower()
    if extension not in allowed:
        raise ValidationFailed(f"Unsupported file type. Use one of: {', '.join(sorted(allowed))}.")
    incoming = video.media_dir / vrepo.user_id / "_incoming"
    incoming.mkdir(parents=True, exist_ok=True)
    temp_path = incoming / f"{uuid.uuid4()}{extension}"
    limit = video.max_upload_mb * CHUNK
    written = 0
    try:
        with open(temp_path, "wb") as handle:
            while chunk := stream.read(CHUNK):
                written += len(chunk)
                if written > limit:
                    raise ValidationFailed(f"The file is larger than the {video.max_upload_mb} MB upload limit.")
                handle.write(chunk)
        if written == 0:
            raise ValidationFailed("The uploaded file is empty.")
    except BaseException:
        temp_path.unlink(missing_ok=True)
        raise
    return temp_path


def _move_into_source(vrepo: VideoRepository, source_id: str, temp_path: Path) -> None:
    destination = pipeline.source_dir(vrepo.user_id, source_id)
    destination.mkdir(parents=True, exist_ok=True)
    shutil.move(str(temp_path), destination / f"source{temp_path.suffix}")


def create_from_url(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings,
                    data: VideoFromUrl) -> dict:
    kind = url_source.validate_media_url(data.url)
    _check_can_start(vrepo, repo, settings)
    source = vrepo.create_source({
        "title": data.title, "source_kind": "url", "media_type": kind, "source_url": data.url,
        "requested_clips": data.clip_count, "status": "queued", "status_message": "Waiting to start…",
    })
    _start(vrepo, repo, llm, source["id"])
    return source


def create_from_upload(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings, *,
                       title: str, clip_count: int, kind: str, filename: str, stream: BinaryIO) -> dict:
    video = get_video_settings()
    title = title.strip()
    if not title or len(title) > 200:
        raise ValidationFailed("Enter a title (up to 200 characters).")
    if not 1 <= clip_count <= video.max_clips:
        raise ValidationFailed(f"Choose between 1 and {video.max_clips} clips.")
    allowed = AUDIO_EXTENSIONS if kind == "audio" else VIDEO_EXTENSIONS
    if PurePosixPath(filename or "").suffix.lower() not in allowed:
        raise ValidationFailed(f"Unsupported file type. Use one of: {', '.join(sorted(allowed))}.")
    _check_can_start(vrepo, repo, settings)

    # Only valid media becomes a project.
    temp_path = _save_upload(vrepo, filename, stream, allowed)
    try:
        info = media_tools.probe(temp_path)
        if kind != "audio" and not info.has_video:
            raise ValidationFailed("This file has no video track. Use Audio Upload for audio-only files.")

        source = vrepo.create_source({
            "title": title, "source_kind": "audio" if kind == "audio" else "upload",
            "media_type": "video" if info.has_video and kind != "audio" else "audio",
            "original_filename": Path(filename).name[:255], "requested_clips": clip_count,
            "duration_seconds": round(info.duration_seconds, 2),
            "status": "queued", "status_message": "Waiting to start…",
        })
        _move_into_source(vrepo, source["id"], temp_path)
    finally:
        temp_path.unlink(missing_ok=True)  # our own temp file (moved away on success)

    _start(vrepo, repo, llm, source["id"])
    return source


# ---------------------------------------------------------------------------
# YouTube: link -> preview -> transcript (captions / pasted / original file)
# ---------------------------------------------------------------------------

DURATION_TOLERANCE_SECONDS = 5
DURATION_TOLERANCE_RATIO = 0.03
_LANGUAGE_CODES = {"Hindi": "hi", "Hinglish": "hi", "English": "en"}


def validate_youtube(url: str) -> dict:
    """Preview data for a YouTube link (official oEmbed / Data API). Nothing is saved or downloaded."""
    return youtube.fetch_video_info(url).to_dict()


def create_from_youtube(vrepo: VideoRepository, data: VideoFromYouTube) -> dict:
    info = youtube.fetch_video_info(data.url)  # re-validated on the server, never trusted from the browser
    video = get_video_settings()
    if info.duration_seconds and info.duration_seconds > video.max_duration_minutes * 60:
        raise ValidationFailed(f"This video is longer than the {video.max_duration_minutes}-minute limit.")
    return vrepo.create_source({
        "title": (data.title or "").strip() or info.title or "YouTube video",
        "source_kind": "youtube", "media_type": "video",
        "youtube_video_id": info.video_id, "youtube_url": info.url,
        "thumbnail_url": info.thumbnail_url, "channel_title": info.channel_title,
        "duration_seconds": info.duration_seconds, "requested_clips": data.clip_count,
        "status": "awaiting_transcript",
        "status_message": "Add a transcript: get captions from YouTube, paste the transcript, or upload the original file.",
    })


def _require_youtube_awaiting(vrepo: VideoRepository, source_id: str) -> dict:
    source = get_source(vrepo, source_id)
    if source["source_kind"] != "youtube":
        raise ValidationFailed("Transcripts can only be added to YouTube projects.")
    if pipeline.runner.is_active(f"source:{source_id}"):
        raise ValidationFailed("This video is already processing.")
    if vrepo.list_clips(source_id):
        raise ValidationFailed("Clips were already created from a transcript for this video.")
    return source


def _start_from_transcript(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings,
                           source_id: str, segments: list[dict], transcript_source: str,
                           language: str | None) -> dict:
    _check_can_start(vrepo, repo, settings, needs_media=False)
    updated = vrepo.update_source(source_id, {
        "transcript": segments, "transcript_text": " ".join(s["text"] for s in segments),
        "transcript_source": transcript_source, "language": language,
        "status": "queued", "progress": 60, "error_message": None, "status_message": "Finding the strongest moments…",
    })
    _start(vrepo, repo, llm, source_id)
    return updated


def submit_manual_transcript(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings,
                             source_id: str, text: str) -> dict:
    source = _require_youtube_awaiting(vrepo, source_id)
    duration = float(source["duration_seconds"]) if source.get("duration_seconds") else None
    segments = parse_transcript(text, duration)
    return _start_from_transcript(vrepo, repo, llm, settings, source_id, segments, "manual", None)


def fetch_youtube_captions(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings,
                           source_id: str, access_token: str) -> dict:
    source = _require_youtube_awaiting(vrepo, source_id)
    profile = profile_service.get_profile(repo) or {}
    segments, language = youtube.fetch_captions(
        source["youtube_video_id"], access_token, _LANGUAGE_CODES.get(profile.get("language"), "en"))
    return _start_from_transcript(vrepo, repo, llm, settings, source_id, segments, "youtube_captions", language)


def attach_original_file(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings,
                         source_id: str, filename: str, stream: BinaryIO) -> dict:
    """Attach the creator's own copy of a YouTube video so real MP4 clips can be rendered."""
    source = get_source(vrepo, source_id)
    if source["source_kind"] != "youtube":
        raise ValidationFailed("Only YouTube projects take an attached original file.")
    if pipeline.runner.is_active(f"source:{source_id}"):
        raise ValidationFailed("This video is still processing. Wait until it finishes.")
    if pipeline.find_source_file(vrepo.user_id, source_id):
        raise ValidationFailed("An original file is already attached to this project.")
    media_tools.require_ffmpeg()

    temp_path = _save_upload(vrepo, filename, stream, VIDEO_EXTENSIONS)
    try:
        info = media_tools.probe(temp_path)
        if not info.has_video:
            raise ValidationFailed("This file has no video track.")
        expected = source.get("duration_seconds")
        if expected:
            tolerance = max(DURATION_TOLERANCE_SECONDS, float(expected) * DURATION_TOLERANCE_RATIO)
            if abs(info.duration_seconds - float(expected)) > tolerance:
                raise ValidationFailed(
                    f"This file is {round(info.duration_seconds)}s long but the YouTube video is "
                    f"{round(float(expected))}s. Upload the original of this exact video so the clip times line up.")
        segments = source.get("transcript") or []
        if segments and segments[-1]["end"] > info.duration_seconds + DURATION_TOLERANCE_SECONDS:
            raise ValidationFailed("The transcript runs longer than this file. Is it the same video?")
        _move_into_source(vrepo, source_id, temp_path)
    finally:
        temp_path.unlink(missing_ok=True)

    values = {"original_filename": Path(filename).name[:255], "duration_seconds": round(info.duration_seconds, 2)}
    clips = vrepo.list_clips(source_id)
    if clips:
        # Clips already exist: make them renderable; the creator chooses which to render.
        for clip in clips:
            if clip["render_status"] == "not_rendered":
                vrepo.update_clip(clip["id"], {"render_error": None})
        values["status_message"] = f"{len(clips)} clips found. Original attached: select clips to render."
        return vrepo.update_source(source_id, values)

    # No clips yet: run the full pipeline (transcribes locally if there's no transcript).
    _check_can_start(vrepo, repo, settings, needs_media=not source.get("transcript"))
    vrepo.update_source(source_id, {**values, "status": "queued", "error_message": None,
                                    "status_message": "Waiting to start…"})
    _start(vrepo, repo, llm, source_id)
    return get_source(vrepo, source_id)


def render_selected(vrepo: VideoRepository, source_id: str, clip_ids: list[str]) -> list[dict]:
    get_source(vrepo, source_id)
    own_ids = {clip["id"] for clip in vrepo.list_clips(source_id)}
    unknown = [cid for cid in clip_ids if cid not in own_ids]
    if unknown:
        raise NotFoundError("One or more clips were not found in this video project.")
    return [render_clip(vrepo, clip_id) for clip_id in dict.fromkeys(clip_ids)]


# ---------------------------------------------------------------------------
# Reading (with interrupted-job detection and signed links)
# ---------------------------------------------------------------------------


def _mark_if_interrupted(vrepo: VideoRepository, source: dict) -> dict:
    if source["status"] in pipeline.IN_PROGRESS and not pipeline.runner.is_active(f"source:{source['id']}"):
        updated = vrepo.update_source(source["id"], {"status": "failed", "error_message": pipeline.INTERRUPTED,
                                                     "status_message": None})
        return {**source, **(updated or {})}
    return source


def list_sources(vrepo: VideoRepository) -> list[dict]:
    counts = vrepo.clip_counts()
    result = []
    for source in vrepo.list_sources():
        source = _mark_if_interrupted(vrepo, source)
        entry = counts.get(source["id"], {})
        result.append({**source, "clip_count": entry.get("clips", 0), "rendered_count": entry.get("rendered", 0)})
    return result


def get_source(vrepo: VideoRepository, source_id: str) -> dict:
    source = vrepo.get_source(source_id)
    if source is None:
        raise NotFoundError("Video project not found.")
    return source


def get_detail(vrepo: VideoRepository, source_id: str) -> dict:
    source = _mark_if_interrupted(vrepo, get_source(vrepo, source_id))
    clips = vrepo.list_clips(source_id)
    source_busy = pipeline.runner.is_active(f"source:{source_id}")
    bucket = get_video_settings().storage_bucket

    for clip in clips:
        busy = clip["render_status"] in ("queued", "rendering")
        if busy and not source_busy and not pipeline.runner.is_active(f"clip:{clip['id']}"):
            clip.update(vrepo.update_clip(clip["id"], {"render_status": "failed",
                                                       "render_error": "Rendering was interrupted. Click Render again."}) or {})
        if clip["render_status"] == "rendered" and clip.get("storage_path"):
            try:
                url = vrepo.signed_url(bucket, clip["storage_path"])
                clip["preview_url"] = url
                clip["download_url"] = f"{url}&download={_download_name(source['title'], clip)}"
            except Exception:  # noqa: BLE001 - show the clip without a link rather than failing the page
                logger.warning("Could not sign clip %s", clip["id"])

    counts = {"clip_count": len(clips), "rendered_count": sum(c["render_status"] == "rendered" for c in clips)}
    return {**source, **counts, "clips": clips,
            "source_file_available": pipeline.find_source_file(vrepo.user_id, source_id) is not None}


def _download_name(title: str, clip: dict) -> str:
    safe = "".join(ch if ch.isalnum() else "-" for ch in f"{title}-clip-{clip['clip_index'] + 1}").strip("-")
    return f"{safe[:80] or 'clip'}.mp4"


# ---------------------------------------------------------------------------
# Actions
# ---------------------------------------------------------------------------


def retry(vrepo: VideoRepository, repo: Repository, llm: LLMService, settings: Settings, source_id: str) -> dict:
    source = get_source(vrepo, source_id)
    if pipeline.runner.is_active(f"source:{source_id}"):
        return source
    if source["status"] != "failed":
        raise ValidationFailed("Only failed videos can be retried.")
    has_file = pipeline.find_source_file(vrepo.user_id, source_id) is not None
    if source["source_kind"] == "youtube" and not has_file and not source.get("transcript"):
        # Nothing to retry with yet: go back to asking for a transcript.
        return vrepo.update_source(source_id, {
            "status": "awaiting_transcript", "error_message": None,
            "status_message": "Add a transcript: get captions from YouTube, paste the transcript, or upload the original file."})
    if not has_file and not source.get("source_url") and source["source_kind"] != "youtube":
        raise ValidationFailed("The uploaded file is no longer on the server. Please upload it again.")
    if not vrepo.list_clips(source_id):
        check_ai_allowed(repo, settings, planned_calls=1)
    updated = vrepo.update_source(source_id, {"status": "queued", "error_message": None,
                                              "status_message": "Waiting to start…"})
    _start(vrepo, repo, llm, source_id)
    return updated


def update_clip(vrepo: VideoRepository, clip_id: str, changes: ClipUpdate) -> dict:
    clip = vrepo.get_clip(clip_id)
    if clip is None:
        raise NotFoundError("Clip not found.")
    values = changes.model_dump(exclude_none=True)
    if "hashtags" in values:
        values["hashtags"] = [t.replace("#", "").strip() for t in values["hashtags"] if t.strip()]

    if "start_seconds" in values or "end_seconds" in values:
        source = get_source(vrepo, clip["video_source_id"])
        start = values.get("start_seconds", float(clip["start_seconds"]))
        end = values.get("end_seconds", float(clip["end_seconds"]))
        duration = float(source.get("duration_seconds") or end)
        if end <= start:
            raise ValidationFailed("End time must be after start time.")
        if end > duration + 0.5:
            raise ValidationFailed("End time is after the end of the video.")
        if not 3 <= end - start <= 180:
            raise ValidationFailed("Clips must be between 3 seconds and 3 minutes long.")
        values.update({
            "start_seconds": round(start, 2), "end_seconds": round(end, 2),
            "duration_seconds": round(end - start, 2),
            "transcript_excerpt": excerpt_for(source.get("transcript") or [], start, end),
        })
        # The old file no longer matches the timestamps: never show it as the clip.
        if clip["render_status"] == "rendered":
            values.update({"render_status": "not_rendered", "storage_path": None, "file_size_bytes": None,
                           "render_error": "Timestamps changed. Render again to update the video."})
    return vrepo.update_clip(clip_id, values)


def render_clip(vrepo: VideoRepository, clip_id: str) -> dict:
    clip = vrepo.get_clip(clip_id)
    if clip is None:
        raise NotFoundError("Clip not found.")
    source = get_source(vrepo, clip["video_source_id"])
    if source["media_type"] != "video":
        raise ValidationFailed("Audio-only sources can't be rendered as video.")
    if pipeline.find_source_file(vrepo.user_id, source["id"]) is None:
        if source["source_kind"] == "youtube":
            raise ValidationFailed("A YouTube link can't be rendered. Attach the original video file first.")
        raise ValidationFailed("The source file is no longer on the server. Upload the video again to render.")
    status = media_tools.ffmpeg_status()
    if not status["available"]:
        raise ValidationFailed(status["message"])
    if pipeline.runner.is_active(f"source:{source['id']}"):
        raise ValidationFailed("This video is still processing. Wait until it finishes.")
    updated = vrepo.update_clip(clip_id, {"render_status": "queued", "render_error": None})
    pipeline.runner.submit(f"clip:{clip_id}", pipeline.rerender_clip, vrepo, source["id"], clip_id)
    return updated


def create_text_project(vrepo: VideoRepository, repo: Repository, settings: Settings, source_id: str) -> dict:
    """Send the transcript into the existing text pipeline (brief, ideas, LinkedIn, carousels)."""
    source = get_source(vrepo, source_id)
    if source.get("linked_project_id"):
        return {"project_id": source["linked_project_id"], "truncated": False}
    text = (source.get("transcript_text") or "").strip()
    if not text:
        raise ValidationFailed("The transcript isn't ready yet.")
    truncated = len(text) > settings.source_max_chars
    if truncated:
        cut = text[: settings.source_max_chars]
        text = cut[: cut.rfind(". ") + 1] or cut
    project = project_service.create_project(
        repo, settings, ProjectCreate(title=source["title"], source_type="transcript", source_text=text))
    vrepo.update_source(source_id, {"linked_project_id": project["id"]})
    return {"project_id": project["id"], "truncated": truncated}
