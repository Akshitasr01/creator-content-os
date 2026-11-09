"""Turn caption files or a pasted transcript into timestamped segments.

Accepted (timestamps are required, so clip times are never invented):
* SRT and WebVTT caption files
* YouTube "Show transcript" copies: "0:05" on its own line followed by the text,
  or "0:05 text" on one line, or "[00:01:05] text"
"""

import re

from core.errors import ValidationFailed

_SRT_TIME = re.compile(
    r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})")
_VTT_TIME = re.compile(
    r"(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})\.(\d{1,3})")
_LINE_TIME = re.compile(r"^\s*\[?((?:\d{1,2}:)?\d{1,2}:\d{2})\]?\s*(.*)$")
_TAGS = re.compile(r"<[^>]+>|\{[^}]+\}")

MIN_TIMESTAMPS = 3
MAX_CHARS = 500_000


def _seconds(h, m, s, ms="0") -> float:
    return int(h or 0) * 3600 + int(m) * 60 + int(s) + int((ms or "0").ljust(3, "0")[:3]) / 1000


def _clean(text: str) -> str:
    return " ".join(_TAGS.sub("", text).split())


def _merge_duplicates(segments: list[dict]) -> list[dict]:
    """Auto-captions often repeat the previous line; drop exact repeats and empty lines."""
    result: list[dict] = []
    for segment in segments:
        if not segment["text"]:
            continue
        if result and segment["text"] == result[-1]["text"]:
            result[-1]["end"] = max(result[-1]["end"], segment["end"])
            continue
        result.append(segment)
    return result


def parse_srt(text: str) -> list[dict]:
    segments, current, lines = [], None, []
    for line in text.replace("\r", "").split("\n"):
        match = _SRT_TIME.search(line)
        if match:
            if current:
                current["text"] = _clean(" ".join(lines))
                segments.append(current)
            g = match.groups()
            current = {"start": round(_seconds(*g[:4]), 2), "end": round(_seconds(*g[4:]), 2), "text": ""}
            lines = []
        elif current is not None and line.strip() and not line.strip().isdigit():
            lines.append(line)
    if current:
        current["text"] = _clean(" ".join(lines))
        segments.append(current)
    return _merge_duplicates(segments)


def parse_vtt(text: str) -> list[dict]:
    segments, current, lines = [], None, []
    for line in text.replace("\r", "").split("\n"):
        match = _VTT_TIME.search(line)
        if match:
            if current:
                current["text"] = _clean(" ".join(lines))
                segments.append(current)
            g = match.groups()
            current = {"start": round(_seconds(*g[:4]), 2), "end": round(_seconds(*g[4:]), 2), "text": ""}
            lines = []
        elif current is not None and line.strip() and not line.startswith(("NOTE", "STYLE")):
            lines.append(line)
    if current:
        current["text"] = _clean(" ".join(lines))
        segments.append(current)
    return _merge_duplicates(segments)


def _parse_clock(value: str) -> float:
    parts = [int(p) for p in value.split(":")]
    while len(parts) < 3:
        parts.insert(0, 0)
    return parts[0] * 3600 + parts[1] * 60 + parts[2]


def parse_youtube_transcript(text: str, duration: float | None = None) -> list[dict]:
    """YouTube 'Show transcript' copy: timestamps with the text on the same or next line."""
    entries: list[list] = []  # [start, text]
    for raw in text.replace("\r", "").split("\n"):
        line = raw.strip()
        if not line:
            continue
        match = _LINE_TIME.match(line)
        if match:
            entries.append([_parse_clock(match.group(1)), match.group(2).strip()])
        elif entries:
            entries[-1][1] = (entries[-1][1] + " " + line).strip()

    segments = []
    for index, (start, words) in enumerate(entries):
        if index + 1 < len(entries):
            end = entries[index + 1][0]
        else:  # last line: estimate ~2.5 words/second, capped by the video length
            end = start + max(2.0, len(words.split()) / 2.5)
            if duration and duration > start:
                end = min(end, duration)
        if end > start:
            segments.append({"start": float(start), "end": round(float(end), 2), "text": _clean(words)})
    return _merge_duplicates(segments)


def parse_transcript(text: str, duration: float | None = None) -> list[dict]:
    """Detect the format and return segments, or explain what's wrong."""
    if len(text) > MAX_CHARS:
        raise ValidationFailed("That transcript is too long (over 500,000 characters).")
    if "-->" in text:
        segments = parse_vtt(text) if text.lstrip().startswith("WEBVTT") or not _SRT_TIME.search(text) else parse_srt(text)
    else:
        segments = parse_youtube_transcript(text, duration)

    if len(segments) < MIN_TIMESTAMPS:
        raise ValidationFailed(
            "The transcript needs timestamps so clip times are accurate. On YouTube, open the video → "
            "'…more' → 'Show transcript', keep timestamps visible, select all lines and paste them here "
            "(or paste an .srt / .vtt caption file).")
    starts = [s["start"] for s in segments]
    if any(b < a for a, b in zip(starts, starts[1:])):
        raise ValidationFailed("The timestamps are out of order. Paste the transcript exactly as copied.")
    if duration and segments[0]["start"] > duration + 5:
        raise ValidationFailed("The transcript's timestamps are longer than the video. Is it from a different video?")
    if duration:
        segments = [s for s in segments if s["start"] < duration + 1]
    return segments
