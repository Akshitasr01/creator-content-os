"""Settings for the Video-to-Reels feature (kept separate from core/config.py)."""

import os
import shutil
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parents[1]


def _int(name: str, default: int) -> int:
    value = os.getenv(name)
    return int(value) if value not in (None, "") else default


def _windows_candidates(executable: str) -> list[Path]:
    """Usual Windows install locations, for terminals opened before PATH was updated."""
    name = f"{executable}.exe"
    local = Path(os.getenv("LOCALAPPDATA", ""))
    candidates = [local / "Microsoft" / "WinGet" / "Links" / name]
    packages = local / "Microsoft" / "WinGet" / "Packages"
    if packages.exists():
        candidates += sorted(packages.glob(f"*FFmpeg*/*/bin/{name}"), reverse=True)
    for root in (Path("C:/ffmpeg"), Path(os.getenv("ProgramFiles", "C:/Program Files")) / "ffmpeg",
                 Path("C:/ProgramData/chocolatey/bin"), Path.home() / "scoop" / "shims"):
        candidates += [root / "bin" / name, root / name]
    return candidates


def _find_tool(env_name: str, executable: str) -> str | None:
    """FFMPEG_PATH/FFPROBE_PATH, then PATH, then common Windows install folders."""
    configured = os.getenv(env_name, "").strip().strip('"')
    if configured:
        return configured if Path(configured).is_file() else None
    found = shutil.which(executable)
    if found:
        return found
    if os.name == "nt":
        for candidate in _windows_candidates(executable):
            if candidate.is_file():
                return str(candidate)
    return None


@dataclass(frozen=True)
class VideoSettings:
    # Source files stay on the backend's disk (Supabase free tier caps files at 50 MB).
    media_dir: Path = field(
        default_factory=lambda: Path(os.getenv("VIDEO_MEDIA_DIR", str(BACKEND_DIR / "media_storage")))
    )
    max_upload_mb: int = field(default_factory=lambda: _int("VIDEO_MAX_UPLOAD_MB", 2048))
    max_url_download_mb: int = field(default_factory=lambda: _int("VIDEO_MAX_URL_DOWNLOAD_MB", 1024))
    max_duration_minutes: int = field(default_factory=lambda: _int("VIDEO_MAX_DURATION_MINUTES", 180))

    # Free local transcription (faster-whisper). Models: tiny, base, small, medium.
    whisper_model: str = field(default_factory=lambda: os.getenv("WHISPER_MODEL", "base"))
    whisper_compute_type: str = field(default_factory=lambda: os.getenv("WHISPER_COMPUTE_TYPE", "int8"))

    ffmpeg_path: str | None = field(default_factory=lambda: _find_tool("FFMPEG_PATH", "ffmpeg"))
    ffprobe_path: str | None = field(default_factory=lambda: _find_tool("FFPROBE_PATH", "ffprobe"))

    max_clips: int = 10
    clip_min_seconds: int = field(default_factory=lambda: _int("CLIP_MIN_SECONDS", 15))
    clip_max_seconds: int = field(default_factory=lambda: _int("CLIP_MAX_SECONDS", 90))

    # Output: vertical 9:16. "fit" keeps the whole frame over a blurred background;
    # "crop" fills the screen by cropping the centre.
    render_width: int = 720
    render_height: int = 1280
    frame_mode: str = field(default_factory=lambda: os.getenv("VIDEO_FRAME_MODE", "fit"))
    storage_bucket: str = field(default_factory=lambda: os.getenv("VIDEO_STORAGE_BUCKET", "video-clips"))

    # --- YouTube (both optional, both free) ---
    # Data API v3 key: adds duration + reliable private/unavailable detection to the preview.
    youtube_api_key: str = field(default_factory=lambda: os.getenv("YOUTUBE_API_KEY", "").strip())
    # OAuth Client ID (public value) for "Sign in with Google" caption access.
    google_oauth_client_id: str = field(default_factory=lambda: os.getenv("GOOGLE_OAUTH_CLIENT_ID", "").strip())


VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".mkv"}
AUDIO_EXTENSIONS = {".mp3", ".m4a", ".wav", ".aac", ".ogg", ".flac"}


@lru_cache
def get_video_settings() -> VideoSettings:
    return VideoSettings()
