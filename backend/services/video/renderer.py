"""Render one vertical 9:16 MP4 clip with burned-in subtitles using FFmpeg."""

import logging
import subprocess
from pathlib import Path

from core.errors import AIServiceError, ConfigurationError
from core.video_config import get_video_settings
from services.video.media_tools import run_tool
from services.video.subtitles import build_ass

logger = logging.getLogger(__name__)

MAX_OUTPUT_BYTES = 50 * 1024 * 1024  # Supabase free-tier per-file limit
RENDER_TIMEOUT_SECONDS = 900


def _video_filter(width: int, height: int, mode: str) -> str:
    if mode == "crop":
        frame = (f"[0:v]scale={width}:{height}:force_original_aspect_ratio=increase,"
                 f"crop={width}:{height}[framed]")
    else:  # "fit": whole frame centred over a blurred, zoomed copy of itself
        frame = (f"[0:v]split=2[bg][fg];"
                 f"[bg]scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},"
                 f"gblur=sigma=24,eq=brightness=-0.08[bgb];"
                 f"[fg]scale={width}:{height}:force_original_aspect_ratio=decrease[fgs];"
                 f"[bgb][fgs]overlay=(W-w)/2:(H-h)/2[framed]")
    return f"{frame};[framed]ass=subs.ass,setsar=1,format=yuv420p[v]"


def render_clip(source: Path, segments: list[dict], start: float, end: float, work_dir: Path) -> Path:
    """Return the path of the rendered MP4. Raises AppError subclasses on failure."""
    settings = get_video_settings()
    if not settings.ffmpeg_path:
        raise ConfigurationError("FFmpeg is not installed on the server, so clips can't be rendered.")

    work_dir.mkdir(parents=True, exist_ok=True)
    (work_dir / "subs.ass").write_text(
        build_ass(segments, start, end, settings.render_width, settings.render_height), encoding="utf-8")
    output = work_dir / "clip.mp4"

    args = [
        settings.ffmpeg_path, "-y", "-hide_banner", "-loglevel", "error",
        "-ss", f"{start:.2f}", "-i", str(source), "-t", f"{end - start:.2f}",
        "-filter_complex", _video_filter(settings.render_width, settings.render_height, settings.frame_mode),
        "-map", "[v]", "-map", "0:a:0?",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-maxrate", "3500k", "-bufsize", "7000k",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
        "-movflags", "+faststart",
        "clip.mp4",
    ]
    # Run inside work_dir so the subtitle filter can use a relative path
    # (avoids Windows drive-letter escaping problems in filter strings).
    try:
        result = run_tool(args, timeout=RENDER_TIMEOUT_SECONDS, cwd=work_dir)
    except subprocess.TimeoutExpired as error:
        raise AIServiceError("Rendering took too long and was stopped.") from error
    if result.returncode != 0 or not output.exists():
        logger.warning("ffmpeg failed: %s", (result.stderr or "")[-500:])
        raise AIServiceError("FFmpeg could not render this clip. The source file may be damaged or unsupported.")
    if output.stat().st_size > MAX_OUTPUT_BYTES:
        raise AIServiceError("The rendered clip is larger than the 50 MB storage limit. Try a shorter clip.")
    return output
