"""Readable burned-in subtitles: short word-timed chunks as an ASS file."""

import re

MAX_WORDS_PER_CHUNK = 4
MAX_CHUNK_SECONDS = 1.8
# Keep a caption on screen through short pauses so it doesn't flicker.
MAX_HOLD_GAP_SECONDS = 0.8
_SENTENCE_END = re.compile(r"[.!?,;:]$")


def _timestamp(seconds: float) -> str:
    seconds = max(0.0, seconds)
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{int(hours)}:{int(minutes):02d}:{secs:05.2f}"


def _escape(text: str) -> str:
    return text.replace("\\", "").replace("{", "(").replace("}", ")").replace("\n", " ").strip()


def _words_in_range(segments: list[dict], start: float, end: float) -> list[tuple[float, float, str]]:
    """Words as (start, end, token). Tokens keep a leading space when they start a new word."""
    words: list[tuple[float, float, str]] = []
    for segment in segments:
        if segment["end"] <= start or segment["start"] >= end:
            continue
        if segment.get("words"):
            for w_start, w_end, token in segment["words"]:
                if w_end > start and w_start < end and token.strip():
                    # Older transcripts stored stripped words; treat those as new words.
                    words.append((w_start, w_end, token if token[:1].isspace() or token[:1] in "-'.,!?" else " " + token))
        else:
            # No word timings: spread the line's words evenly across it.
            tokens = segment["text"].split()
            step = (segment["end"] - segment["start"]) / max(1, len(tokens))
            for i, token in enumerate(tokens):
                w_start = segment["start"] + i * step
                if start <= w_start < end:
                    words.append((w_start, w_start + step, " " + token))
    return words


def _make_chunk(words, clip_start: float, clip_end: float) -> list:
    chunk_start = max(words[0][0], clip_start) - clip_start
    chunk_end = min(words[-1][1], clip_end) - clip_start
    text = "".join(w[2] for w in words).strip()
    return [chunk_start, max(chunk_end, chunk_start + 0.3), text]


def build_chunks(segments: list[dict], start: float, end: float) -> list[tuple[float, float, str]]:
    """Group words into short on-screen captions, with times relative to the clip start."""
    chunks: list[list] = []
    current: list[tuple[float, float, str]] = []
    for word in _words_in_range(segments, start, end):
        # A token without a leading space continues the previous word ("two" + "-dimensional").
        is_new_word = word[2][:1].isspace()
        new_word_count = sum(w[2][:1].isspace() for w in current) + is_new_word
        if current and is_new_word and (
            new_word_count > MAX_WORDS_PER_CHUNK
            or word[1] - current[0][0] > MAX_CHUNK_SECONDS
            or _SENTENCE_END.search(current[-1][2])
        ):
            chunks.append(_make_chunk(current, start, end))
            current = []
        current.append(word)
    if current:
        chunks.append(_make_chunk(current, start, end))

    for this, following in zip(chunks, chunks[1:]):
        if 0 < following[0] - this[1] <= MAX_HOLD_GAP_SECONDS:
            this[1] = following[0]
    return [tuple(chunk) for chunk in chunks]


def build_ass(segments: list[dict], start: float, end: float, width: int, height: int) -> str:
    font_size = round(height * 0.045)
    margin_v = round(height * 0.2)
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 0",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, "
        "Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, "
        "MarginL, MarginR, MarginV, Encoding",
        f"Style: Default,Arial,{font_size},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,"
        f"{max(3, font_size // 14)},1,2,{width // 12},{width // 12},{margin_v},1",
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for chunk_start, chunk_end, text in build_chunks(segments, start, end):
        lines.append(f"Dialogue: 0,{_timestamp(chunk_start)},{_timestamp(chunk_end)},Default,,0,0,0,,{_escape(text)}")
    return "\n".join(lines) + "\n"
