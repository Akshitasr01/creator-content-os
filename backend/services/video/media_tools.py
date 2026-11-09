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


FFMPEG_HELP = (
    "Install it with `winget install Gyan.FFmpeg`, then open a NEW terminal and restart the backend "
    "(or set FFMPEG_PATH and FFPROBE_PATH in backend/.env). See README → Video-to-Reels setup."
)

_verified: dict[str, str] = {}  # path -> version line, only for tools that actually ran


def _verify(path: str | None) -> str | None:
    """Run `<tool> -version` once; return its version line, or None if it can't execute."""
    if not path:
        return None
    if path in _verified:
        return _verified[path]
    try:
        result = subprocess.run([path, "-hide_banner", "-version"], capture_output=True, text=True,
                                timeout=15, creationflags=_NO_WINDOW)
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0 or not result.stdout:
        return None
    _verified[path] = result.stdout.splitlines()[0]
    return _verified[path]


def ffmpeg_status() -> dict:
    """Is FFmpeg usable? Includes a human-readable reason when it isn't."""
    settings = get_video_settings()
    ffmpeg_ok = _verify(settings.ffmpeg_path)
    ffprobe_ok = _verify(settings.ffprobe_path)
    if ffmpeg_ok and ffprobe_ok:
        return {"available": True, "version": ffmpeg_ok, "message": None}
    if not settings.ffmpeg_path or not settings.ffprobe_path:
        missing = " and ".join(n for n, p in (("ffmpeg", settings.ffmpeg_path), ("ffprobe", settings.ffprobe_path)) if not p)
        message = f"FFmpeg is not installed or not found ({missing} missing). {FFMPEG_HELP}"
    else:
        message = f"FFmpeg was found but could not run. Reinstall it. {FFMPEG_HELP}"
    return {"available": False, "version": None, "message": message}


def ffmpeg_available() -> bool:
    return ffmpeg_status()["available"]


def require_ffmpeg() -> None:
    status = ffmpeg_status()
    if not status["available"]:
        raise ConfigurationError(status["message"])


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
