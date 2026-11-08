"""Background processing: download -> probe -> transcribe -> select clips -> render.

Status (video_sources.status):
  queued -> downloading (links only) -> transcribing -> selecting -> rendering -> completed
  any step -> failed (error_message says why; "Retry" resumes from the failed step)

Jobs run one at a time in a background thread (transcription and rendering are
CPU-heavy). Status is stored in the database so the UI can poll it, and a server
restart is detected and reported instead of leaving an endless spinner.
"""

import logging
import shutil
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from urllib.parse import urlparse

from core.errors import AppError, ValidationFailed
from core.video_config import get_video_settings
from db.video_repository import VideoRepository
from services.llm_service import LLMService
from services.video import clip_selector, media_tools, renderer, transcriber, url_source

logger = logging.getLogger(__name__)

IN_PROGRESS = {"queued", "downloading", "transcribing", "selecting", "rendering"}
INTERRUPTED = "Processing was interrupted (the server restarted). Click Retry to continue."


class JobRunner:
    """Single-worker queue that remembers what is currently queued or running."""

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=1, thread_name_prefix="video-job")
        self._active: set[str] = set()
        self._lock = threading.Lock()

    def submit(self, key: str, fn, *args) -> None:
        with self._lock:
            if key in self._active:
                return
            self._active.add(key)

        def run():
            try:
                fn(*args)
            except Exception:  # noqa: BLE001 - the job itself records failures
                logger.exception("Video job %s crashed", key)
            finally:
                with self._lock:
                    self._active.discard(key)

        self._executor.submit(run)

    def is_active(self, key: str) -> bool:
        with self._lock:
            return key in self._active


runner = JobRunner()


@dataclass
class JobContext:
    repo: VideoRepository
    llm: LLMService
    profile: dict
    source_id: str


# ---------------------------------------------------------------------------
# File locations (source media stays on the backend disk)
# ---------------------------------------------------------------------------


def source_dir(user_id: str, source_id: str) -> Path:
    return get_video_settings().media_dir / user_id / source_id


def find_source_file(user_id: str, source_id: str) -> Path | None:
    folder = source_dir(user_id, source_id)
    matches = sorted(folder.glob("source.*")) if folder.exists() else []
    return matches[0] if matches else None


def storage_path(user_id: str, source_id: str, clip_id: str) -> str:
    return f"{user_id}/{source_id}/{clip_id}.mp4"


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------


def _progress_updater(repo: VideoRepository, source_id: str, low: int, high: int):
    """Map a 0-1 fraction onto [low, high]%, writing at most every 5%."""
    last = {"value": low}

    def update(fraction: float) -> None:
        value = int(low + (high - low) * fraction)
        if value >= last["value"] + 5:
            last["value"] = value
            repo.update_source(source_id, {"progress": value})

    return update


def process_source(ctx: JobContext) -> None:
    repo, source_id = ctx.repo, ctx.source_id
    try:
        _run_pipeline(ctx)
    except AppError as error:
        repo.update_source(source_id, {"status": "failed", "error_message": error.message, "status_message": None})
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected error processing video %s", source_id)
        repo.update_source(source_id, {"status": "failed", "status_message": None,
                                       "error_message": "Something went wrong while processing. Click Retry."})


def _run_pipeline(ctx: JobContext) -> None:
    settings = get_video_settings()
    repo, source_id, user_id = ctx.repo, ctx.source_id, ctx.repo.user_id
    source = repo.get_source(source_id)
    if source is None:
        return

    # 1. Download (links only; uploads are already on disk)
    path = find_source_file(user_id, source_id)
    if path is None:
        if not source.get("source_url"):
            raise ValidationFailed("The uploaded file is no longer on the server. Please upload it again.")
        repo.update_source(source_id, {"status": "downloading", "progress": 2, "error_message": None,
                                       "status_message": "Downloading your file…"})
        extension = PurePosixPath(urlparse(source["source_url"]).path).suffix.lower()
        folder = source_dir(user_id, source_id)
        folder.mkdir(parents=True, exist_ok=True)
        partial = folder / f"download{extension}.part"
        try:
            url_source.download_media(source["source_url"], partial, settings.max_url_download_mb * 1024 * 1024,
                                      _progress_updater(repo, source_id, 2, 10))
            path = partial.rename(folder / f"source{extension}")
        finally:
            partial.unlink(missing_ok=True)

    # 2. Probe
    info = media_tools.probe(path)
    if info.duration_seconds > settings.max_duration_minutes * 60:
        raise ValidationFailed(f"This file is longer than the {settings.max_duration_minutes}-minute limit.")
    if not info.has_audio:
        raise ValidationFailed("This file has no audio track, so there is no speech to turn into clips.")
    media_type = "video" if info.has_video else "audio"
    repo.update_source(source_id, {"duration_seconds": round(info.duration_seconds, 2), "media_type": media_type})

    # 3. Transcribe (skipped on retry if already done)
    segments = source.get("transcript")
    if not segments:
        repo.update_source(source_id, {"status": "transcribing", "progress": 10, "error_message": None,
                                       "status_message": "Transcribing speech with timestamps…"})
        transcript = transcriber.transcribe(path, _progress_updater(repo, source_id, 10, 60))
        segments = transcript.segments
        repo.update_source(source_id, {"transcript": segments, "transcript_text": transcript.text,
                                       "language": transcript.language, "progress": 60})

    # 4. Select clips (skipped on retry if clips already exist)
    clips = repo.list_clips(source_id)
    if not clips:
        repo.update_source(source_id, {"status": "selecting", "progress": 62, "error_message": None,
                                       "status_message": "Finding the strongest moments…"})
        min_s = min(settings.clip_min_seconds, info.duration_seconds)
        max_s = settings.clip_max_seconds
        result = clip_selector.select_clips(ctx.llm, source["title"], segments, ctx.profile,
                                            source["requested_clips"], min_s, max_s)
        chosen = clip_selector.finalize_clips(result.data.clips, segments, info.duration_seconds,
                                              source["requested_clips"], min_s, max_s)
        if not chosen:
            raise ValidationFailed("No self-contained moments were found in this recording.")
        renderable = media_type == "video" and media_tools.ffmpeg_available()
        for index, clip in enumerate(chosen):
            clips.append(repo.insert_clip({
                **clip, "video_source_id": source_id, "clip_index": index,
                "render_status": "queued" if renderable else "unavailable",
                "render_error": None if renderable else (
                    "Audio-only source: timestamp suggestions only." if media_type == "audio"
                    else "FFmpeg is not installed on the server."),
                "provider": result.provider, "model": result.model,
            }))
        repo.update_source(source_id, {"provider": result.provider, "model": result.model})

    # 5. Render (only clips that still need it)
    to_render = [c for c in clips if c["render_status"] in ("queued", "rendering", "failed")]
    if to_render:
        repo.update_source(source_id, {"status": "rendering", "progress": 70, "error_message": None,
                                       "status_message": f"Rendering {len(to_render)} vertical clips…"})
        for done, clip in enumerate(to_render):
            render_one(repo, source_id, clip, path, segments)
            repo.update_source(source_id, {"progress": 70 + int(30 * (done + 1) / len(to_render))})

    final = repo.list_clips(source_id)
    rendered = sum(c["render_status"] == "rendered" for c in final)
    failed = sum(c["render_status"] == "failed" for c in final)
    message = f"{len(final)} clips found"
    if media_type == "video":
        message += f", {rendered} rendered" + (f", {failed} failed to render" if failed else "")
    repo.update_source(source_id, {"status": "completed", "progress": 100, "status_message": message,
                                   "error_message": None})


def render_one(repo: VideoRepository, source_id: str, clip: dict, source_file: Path, segments: list[dict]) -> None:
    """Render + upload one clip, recording success or failure on the clip row."""
    settings = get_video_settings()
    repo.update_clip(clip["id"], {"render_status": "rendering", "render_error": None})
    work_dir = source_dir(repo.user_id, source_id) / "renders" / clip["id"]
    try:
        output = renderer.render_clip(source_file, segments, float(clip["start_seconds"]),
                                      float(clip["end_seconds"]), work_dir)
        object_path = storage_path(repo.user_id, source_id, clip["id"])
        repo.upload_clip_file(settings.storage_bucket, object_path, output)
        repo.update_clip(clip["id"], {"render_status": "rendered", "storage_path": object_path,
                                      "file_size_bytes": output.stat().st_size, "render_error": None})
    except AppError as error:
        repo.update_clip(clip["id"], {"render_status": "failed", "render_error": error.message})
    except Exception:  # noqa: BLE001
        logger.exception("Unexpected render error for clip %s", clip["id"])
        repo.update_clip(clip["id"], {"render_status": "failed", "render_error": "Unexpected rendering error."})
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)  # temporary render files only


def rerender_clip(repo: VideoRepository, source_id: str, clip_id: str) -> None:
    source = repo.get_source(source_id)
    clip = repo.get_clip(clip_id)
    path = find_source_file(repo.user_id, source_id)
    if not source or not clip:
        return
    if path is None:
        repo.update_clip(clip_id, {"render_status": "failed",
                                   "render_error": "The source file is no longer on the server."})
        return
    render_one(repo, source_id, clip, path, source.get("transcript") or [])
