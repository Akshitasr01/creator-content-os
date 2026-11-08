"""Thin wrappers around ffprobe / ffmpeg (free, open source, installed locally)."""

import json
import logging
import subprocess
from dataclasses import dataclass
from pathlib import Path

from core.errors import ConfigurationError, ValidationFailed
from core.video_config import get_video_settings

logger = logging.getLogger(__name__)

# Hide console windows for child processes on Windows.
_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


@dataclass
class MediaInfo:
    duration_seconds: float
    has_video: bool
    has_audio: bool
    width: int | None = None
    height: int | None = None


def ffmpeg_available() -> bool:
    settings = get_video_settings()
    return bool(settings.ffmpeg_path and settings.ffprobe_path)


def run_tool(args: list[str], timeout: int, cwd: Path | None = None) -> subprocess.CompletedProcess:
    return subprocess.run(
        args, capture_output=True, text=True, encoding="utf-8", errors="replace",
        timeout=timeout, cwd=cwd, creationflags=_NO_WINDOW,
    )


def probe(path: Path) -> MediaInfo:
    """Read duration and streams. Raises ValidationFailed if the file is not media."""
    settings = get_video_settings()
    if not settings.ffprobe_path:
        raise ConfigurationError("FFmpeg is not installed on the server (ffprobe not found).")
    result = run_tool(
        [settings.ffprobe_path, "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        timeout=60,
    )
    if result.returncode != 0:
        raise ValidationFailed("This file could not be read as audio or video. Try exporting it as MP4 or MP3.")

    data = json.loads(result.stdout or "{}")
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"
                  and not s.get("disposition", {}).get("attached_pic")), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    try:
        duration = float(data.get("format", {}).get("duration") or 0)
    except ValueError:
        duration = 0.0
    if duration <= 0:
        raise ValidationFailed("Could not determine the media duration.")
    return MediaInfo(
        duration_seconds=duration,
        has_video=video is not None,
        has_audio=audio is not None,
        width=video.get("width") if video else None,
        height=video.get("height") if video else None,
    )
