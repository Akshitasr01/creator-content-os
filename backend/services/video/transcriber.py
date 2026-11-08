"""Timestamped transcription with faster-whisper (free, runs locally on the CPU).

The speech model (~75-500 MB depending on WHISPER_MODEL) downloads automatically
on first use and is cached afterwards.
"""

import logging
import os
import subprocess
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from core.errors import ConfigurationError, ValidationFailed
from core.video_config import get_video_settings

logger = logging.getLogger(__name__)
_model_lock = threading.Lock()
# Windows without Developer Mode can't create symlinks in the model cache; that's fine.
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


@dataclass
class Transcript:
    segments: list[dict]  # [{"start", "end", "text", "words": [[start, end, word], ...]}]
    language: str | None
    text: str


def transcription_available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


@lru_cache
def _load_model(name: str, compute_type: str):
    from faster_whisper import WhisperModel

    logger.info("Loading speech model '%s' (first use downloads it)", name)
    return WhisperModel(name, device="cpu", compute_type=compute_type)


SAMPLE_RATE = 16000


def _decode_audio(path: Path):
    """Decode to 16 kHz mono float32 with FFmpeg (what the speech model expects)."""
    import numpy as np

    settings = get_video_settings()
    if not settings.ffmpeg_path:
        raise ConfigurationError("FFmpeg is not installed on the server.")
    result = subprocess.run(
        [settings.ffmpeg_path, "-nostdin", "-hide_banner", "-loglevel", "error", "-i", str(path),
         "-vn", "-ac", "1", "-ar", str(SAMPLE_RATE), "-f", "s16le", "-"],
        capture_output=True, timeout=1800, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    if result.returncode != 0 or not result.stdout:
        raise ValidationFailed("Could not read the audio from this file.")
    return np.frombuffer(result.stdout, np.int16).astype(np.float32) / 32768.0


def transcribe(path: Path, on_progress=None) -> Transcript:
    if not transcription_available():
        raise ConfigurationError("Transcription is not installed. Run: pip install -r requirements.txt")
    settings = get_video_settings()
    with _model_lock:
        model = _load_model(settings.whisper_model, settings.whisper_compute_type)

    segments_iter, info = model.transcribe(_decode_audio(path), word_timestamps=True, vad_filter=True)
    duration = info.duration or 0
    segments = []
    for segment in segments_iter:
        text = segment.text.strip()
        if not text:
            continue
        segments.append({
            "start": round(float(segment.start), 2),
            "end": round(float(segment.end), 2),
            "text": text,
            # Keep whisper's own spacing: a leading space marks a new word, none marks
            # a continuation such as "-dimensional" or punctuation.
            "words": [[round(float(w.start), 2), round(float(w.end), 2), w.word] for w in (segment.words or []) if w.word.strip()],
        })
        if on_progress and duration:
            on_progress(min(segment.end / duration, 1.0))

    if not segments:
        raise ValidationFailed("No speech was found in this file, so there is nothing to turn into clips.")
    return Transcript(
        segments=segments,
        language=info.language,
        text=" ".join(s["text"] for s in segments),
    )
